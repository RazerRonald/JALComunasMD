/**
 * @fileoverview Persistencia de solicitudes publicas de acceso estudiantil.
 * No toca el DOM ni crea usuarios de Firebase Auth.
 *
 * @module models/SolicitudAccesoModel
 */

import { db, auth } from '../config/firebase.config.js';
import { readApiResponse } from '../utils/apiResponse.js';
import {
  COL_SOLICITUDES_ACCESO,
} from '../config/collections.js';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const SolicitudAccesoModel = {
  /**
   * Registra una solicitud publica. El estado y el rol no provienen de la UI.
   *
   * @param {Object} datos
   * @param {string} captchaToken Token de verificacion de un solo uso.
   * @returns {Promise<{ok: boolean}>} Confirmacion sin exponer datos de duplicados.
   */
  async crear(datos, captchaToken) {
    return this._api('POST', { datos, captchaToken });
  },

  /**
   * Suscribe las solicitudes para la vista exclusiva de ediles.
   *
   * @param {function(Object[]): void} onSuccess
   * @param {function(Error): void} onError
   * @returns {function}
   */
  suscribir(onSuccess, onError = () => {}) {
    const solicitudesQuery = query(
      collection(db, COL_SOLICITUDES_ACCESO),
      orderBy('fecha_solicitud', 'desc'),
    );

    return onSnapshot(
      solicitudesQuery,
      (snap) => onSuccess(snap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }))),
      onError,
    );
  },

  /**
   * Delega la resolucion y los reintentos al servidor autenticado.
   *
   * @param {string} id
   * @param {'approve'|'reject'|'email'} action
   * @returns {Promise<Object>}
   */
  async resolver(id, action) {
    return this._api('PATCH', { id, action });
  },

  async _api(method, datos) {
    const token = method === 'PATCH' ? await auth.currentUser?.getIdToken() : null;
    if (method === 'PATCH' && !token) throw this._crearError('auth/unauthorized');
    const response = await fetch('/api/access-requests', {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(datos),
    });
    return readApiResponse(response, result => {
      if (method === 'POST' || datos.action === 'reject') return result.ok === true;
      if (datos.action === 'approve') return typeof result.uid === 'string' && Boolean(result.uid)
        && typeof result.correoEnviado === 'boolean';
      return typeof result.correoEnviado === 'boolean';
    });
  },

  _crearError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  },
};

export default SolicitudAccesoModel;
