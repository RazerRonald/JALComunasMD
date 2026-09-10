/**
 * @fileoverview EventoModel — CRUD de eventos en Firestore.
 * Habla ÚNICAMENTE con Firestore. No toca el DOM.
 *
 * Colección: `eventos`
 * Estructura de documento:
 * {
 *   id:          string (generado por Firestore),
 *   titulo:      string,
 *   descripcion: string,
 *   fecha:       Timestamp,
 *   lugar:       string,
 *   autorId:     string (uid del Edil)
 * }
 *
 * @module models/EventoModel
 */

import { db }           from '../config/firebase.config.js';
import { COL_EVENTOS }  from '../config/collections.js';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/**
 * @typedef {Object} Evento
 * @property {string}    id          - ID del documento en Firestore
 * @property {string}    titulo      - Título del evento
 * @property {string}    descripcion - Descripción del evento
 * @property {import('firebase/firestore').Timestamp} fecha - Fecha y hora de inicio
 * @property {import('firebase/firestore').Timestamp} fecha_fin - Fecha y hora de fin
 * @property {string}    lugar       - Lugar del evento
 * @property {string}    autorId     - UID del edil autor
 */

const EventoModel = {
  /**
   * Obtiene todos los eventos ordenados por fecha ascendente.
   *
   * @param {number} [limite=50] - Número máximo de eventos
   * @returns {Promise<Evento[]>} Array de eventos
   */
  async getAll(limite = 50) {
    const q    = query(
      collection(db, COL_EVENTOS),
      orderBy('fecha', 'asc'),
      limit(limite),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  /**
   * Obtiene todos los eventos ordenados por fecha descendente (más recientes
   * primero), incluidos los ya pasados. El orden descendente garantiza que el
   * límite conserve los eventos más recientes.
   *
   * @param {number} [limite=50] - Número máximo de eventos
   * @returns {Promise<Evento[]>} Array de eventos
   */
  async getRecientes(limite = 50) {
    const q    = query(
      collection(db, COL_EVENTOS),
      orderBy('fecha', 'desc'),
      limit(limite),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  /**
   * Obtiene un evento específico por su ID.
   *
   * @param {string} id - ID del documento en Firestore
   * @returns {Promise<Evento|null>} El evento o null si no existe
   */
  async getById(id) {
    const snap = await getDoc(doc(db, COL_EVENTOS, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  /**
   * Crea un nuevo evento en Firestore.
   *
   * @param {Object} datos              - Datos del evento
   * @param {string} datos.titulo       - Título
   * @param {string} datos.descripcion  - Descripción
   * @param {string} datos.fecha        - Fecha en formato ISO string o Date
   * @param {string} datos.lugar        - Lugar del evento
   * @param {string} datos.autorId      - UID del edil autor
   * @returns {Promise<string>} ID del documento creado
   */
  async create({ titulo, descripcion, fecha, fecha_fin, lugar, autorId }) {
    const fechaTs    = fecha instanceof Date
      ? Timestamp.fromDate(fecha)
      : Timestamp.fromDate(new Date(fecha));
    const fechaFinTs = fecha_fin instanceof Date
      ? Timestamp.fromDate(fecha_fin)
      : Timestamp.fromDate(new Date(fecha_fin));

    const ref = await addDoc(collection(db, COL_EVENTOS), {
      titulo,
      descripcion,
      fecha:     fechaTs,
      fecha_fin: fechaFinTs,
      lugar,
      autorId,
      creadoEn:  serverTimestamp(),
    });
    return ref.id;
  },

  /**
   * Actualiza un evento existente en Firestore.
   *
   * @param {string} id                        - ID del documento a actualizar
   * @param {Partial<Omit<Evento,'id'>>} datos  - Campos a actualizar
   * @returns {Promise<void>}
   */
  async update(id, datos) {
    const payload = { ...datos, actualizadoEn: serverTimestamp() };

    // Convertir fechas a Timestamp si vienen como string
    if (datos.fecha && !(datos.fecha instanceof Timestamp)) {
      payload.fecha = Timestamp.fromDate(new Date(datos.fecha));
    }
    if (datos.fecha_fin && !(datos.fecha_fin instanceof Timestamp)) {
      payload.fecha_fin = Timestamp.fromDate(new Date(datos.fecha_fin));
    }

    await updateDoc(doc(db, COL_EVENTOS, id), payload);
  },

  /**
   * Elimina un evento de Firestore.
   *
   * @param {string} id - ID del documento a eliminar
   * @returns {Promise<void>}
   */
  async delete(id) {
    await deleteDoc(doc(db, COL_EVENTOS, id));
  },

  /**
   * Suscribe un listener en tiempo real a la colección de eventos.
   * Retorna todos los eventos ordenados por fecha ascendente.
   *
   * @param {function(Evento[]): void} callback - Función llamada en cada cambio
   * @returns {function} Función unsubscribe
   */
  onSnapshot(callback) {
    const q = query(
      collection(db, COL_EVENTOS),
      orderBy('fecha', 'asc'),
    );
    return onSnapshot(q, (snap) => {
      const eventos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(eventos);
    });
  },

};

export default EventoModel;
