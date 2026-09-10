/**
 * @fileoverview Burbuja flotante para conectar Google Drive en perfiles Edil.
 *
 * Solo aparece cuando el token de Drive falta, esta vencido o esta cerca de
 * vencer. No modifica el login principal de la aplicacion.
 *
 * @module components/DriveConnectionBubble
 */

import DriveAuthModel from '../models/DriveAuthModel.js';
import Toast from './Toast.js';
import { ROLES } from '../config/collections.js';
import { i18n } from '../config/i18n.js';

const CHECK_INTERVAL_MS = 30 * 1000;

const DriveConnectionBubble = {
  _sesion: null,
  _root: null,
  _btn: null,
  _label: null,
  _icon: null,
  _spinner: null,
  _intervalId: null,
  _unsubDrive: null,
  _bindingListo: false,
  _cargando: false,
  _preparando: false,
  _driveListo: false,

  render({ sesion } = {}) {
    this._sesion = sesion || null;
    this._asegurarDOM();
    this._bindEvents();
    this._suscribirDrive();
    this._prepararDriveSiAplica();
    this._actualizar();
  },

  destruir() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }

    if (this._unsubDrive) {
      this._unsubDrive();
      this._unsubDrive = null;
    }

    this._root?.remove();
    this._root = null;
    this._btn = null;
    this._label = null;
    this._icon = null;
    this._spinner = null;
    this._bindingListo = false;
    this._preparando = false;
    this._driveListo = false;
  },

  _asegurarDOM() {
    if (this._root?.isConnected) return;

    this._root = document.createElement('div');
    this._root.id = 'drive-connection-bubble-root';
    this._root.innerHTML = `
      <button type="button"
              id="drive-connection-bubble"
              class="drive-connection-bubble"
              hidden>
        <span class="drive-connection-bubble-icon" aria-hidden="true">
          <i class="bi bi-google"></i>
          <span class="spinner-border spinner-border-sm d-none" role="status"></span>
        </span>
        <span class="drive-connection-bubble-label"></span>
      </button>
    `;

    document.body.appendChild(this._root);
    this._btn = this._root.querySelector('#drive-connection-bubble');
    this._label = this._root.querySelector('.drive-connection-bubble-label');
    this._icon = this._root.querySelector('.bi-google');
    this._spinner = this._root.querySelector('.spinner-border');
  },

  _bindEvents() {
    if (this._bindingListo || !this._btn) return;
    this._btn.addEventListener('click', () => this._conectarDrive());
    this._bindingListo = true;
  },

  _suscribirDrive() {
    if (this._unsubDrive) return;
    this._unsubDrive = DriveAuthModel.onEstadoCambio(() => this._actualizar());
  },

  _actualizar() {
    if (!this._btn || !this._label) return;

    const esEdil = this._sesion?.rol === ROLES.EDIL;
    if (!esEdil) {
      this._ocultar();
      this._detenerReloj();
      return;
    }

    this._iniciarReloj();
    const estado = DriveAuthModel.getEstadoConexion();

    if (!estado.requiereConexion) {
      this._ocultar();
      return;
    }

    if (!this._driveListo) {
      this._label.textContent = i18n.drive.preparando;
      this._btn.setAttribute('aria-label', i18n.drive.preparando);
      this._btn.disabled = true;
      this._btn.hidden = false;
      return;
    }

    const esPrimeraConexion = estado.estado === 'sin_token';
    this._label.textContent = esPrimeraConexion
      ? i18n.drive.conectar
      : i18n.drive.restablecer;
    this._btn.setAttribute('aria-label', this._label.textContent);
    this._btn.disabled = this._cargando;
    this._btn.hidden = false;
  },

  async _conectarDrive() {
    if (this._cargando || !this._driveListo) return;

    const estado = DriveAuthModel.getEstadoConexion();
    this._setCargando(true);

    try {
      await DriveAuthModel.solicitarToken({
        forceConsent: estado.estado === 'sin_token',
        forceRefresh: estado.estado !== 'sin_token',
      });
      Toast.exito(i18n.drive.conectado);
      this._actualizar();
    } catch (err) {
      console.error('[DriveConnectionBubble._conectarDrive]', err);
      Toast.error(err?.message || i18n.drive.errorConexion);
      this._actualizar();
    } finally {
      this._setCargando(false);
    }
  },

  async _prepararDriveSiAplica() {
    if (this._preparando || this._driveListo || this._sesion?.rol !== ROLES.EDIL) return;

    this._preparando = true;
    try {
      await DriveAuthModel.inicializarDrive();
      this._driveListo = true;
    } catch (err) {
      console.warn('[DriveConnectionBubble._prepararDriveSiAplica]', err);
      this._driveListo = false;
    } finally {
      this._preparando = false;
      this._actualizar();
    }
  },

  _setCargando(cargando) {
    this._cargando = cargando;
    this._btn?.classList.toggle('is-loading', cargando);
    if (this._btn) this._btn.disabled = cargando;
    this._icon?.classList.toggle('d-none', cargando);
    this._spinner?.classList.toggle('d-none', !cargando);
    if (cargando && this._label) {
      this._label.textContent = i18n.drive.conectando;
    }
  },

  _iniciarReloj() {
    if (this._intervalId) return;
    this._intervalId = setInterval(() => this._actualizar(), CHECK_INTERVAL_MS);
  },

  _detenerReloj() {
    if (!this._intervalId) return;
    clearInterval(this._intervalId);
    this._intervalId = null;
  },

  _ocultar() {
    if (this._btn) this._btn.hidden = true;
  },
};

export default DriveConnectionBubble;
