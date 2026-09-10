/**
 * @fileoverview Autenticacion compartida para Google Drive API.
 *
 * Mantiene un unico token OAuth en memoria para que las operaciones de Drive
 * no pidan consentimiento de Google en cada guardado.
 *
 * @module models/DriveAuthModel
 */

import { DRIVE_CONFIG } from '../config/firebase.config.js';

let _gapiTokenClient = null;
let _gapiIniciado = false;
let _gapiInitPromise = null;
let _tokenExpiraEn = 0;
let _tokenErrorHandler = null;
let _driveQueue = Promise.resolve();

const TOKEN_MARGIN_MS = 60 * 1000;
const TOKEN_WARNING_MS = 5 * 60 * 1000;
const DEFAULT_TOKEN_MS = 50 * 60 * 1000;
const EVENTO_ESTADO = 'jal:drive-auth-change';
const DRIVE_MAX_REINTENTOS = 2;
const DRIVE_RETRY_BASE_MS = 700;
const DRIVE_RETRY_MAX_MS = 4000;

const DriveAuthModel = {
  async inicializarDrive() {
    if (_gapiIniciado) return;
    if (_gapiInitPromise) return _gapiInitPromise;

    _gapiInitPromise = new Promise((resolve, reject) => {
      const esperarGapi = () => {
        if (typeof window.gapi === 'undefined' || !window.google?.accounts?.oauth2) {
          setTimeout(esperarGapi, 200);
          return;
        }

        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });

            _gapiTokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: DRIVE_CONFIG.CLIENT_ID,
              scope: DRIVE_CONFIG.SCOPES,
              callback: () => {},
              error_callback: (err) => {
                if (typeof _tokenErrorHandler === 'function') {
                  _tokenErrorHandler(err);
                }
              },
            });

            _gapiIniciado = true;
            resolve();
          } catch (err) {
            _gapiInitPromise = null;
            reject(err);
          }
        });
      };

      esperarGapi();
    });

    return _gapiInitPromise;
  },

  async solicitarToken({ forceConsent = false, forceRefresh = false } = {}) {
    if (!_gapiTokenClient) {
      await this.inicializarDrive();
    }

    if (!forceConsent && !forceRefresh && this._hayTokenVigente()) return this.getToken();

    if (forceConsent) {
      return this._pedirAccessToken('consent');
    }

    // Intento silencioso primero: con prompt vacio Google reutiliza el
    // consentimiento previo y la sesion activa del usuario, devolviendo el
    // token sin mostrar ningun dialogo (incluso tras recargar la pagina).
    // Solo si Google indica que se necesita interaccion se recae al flujo
    // con consentimiento explicito (el comportamiento anterior).
    try {
      return await this._pedirAccessToken('');
    } catch (err) {
      if (this._requiereInteraccion(err)) {
        return this._pedirAccessToken('consent');
      }
      throw err;
    }
  },

  /**
   * Ejecuta operaciones completas de Drive de forma serial para reducir picos
   * de llamadas simultaneas a Google Drive.
   *
   * @param {string} nombre
   * @param {function(): Promise<*>} operacion
   * @returns {Promise<*>}
   */
  async ejecutarEnCola(nombre, operacion) {
    const tarea = _driveQueue
      .catch(() => {})
      .then(() => operacion());

    _driveQueue = tarea.catch(() => {});
    return tarea;
  },

  /**
   * Ejecuta una peticion fetch autenticada contra Drive con reintentos,
   * refresco de token ante 401 y backoff ante errores temporales.
   *
   * @param {string} url
   * @param {RequestInit} opciones
   * @param {Object} config
   * @returns {Promise<Response>}
   */
  async fetchDrive(url, opciones = {}, config = {}) {
    return this._ejecutarConReintentos(config.nombre || 'fetch Drive', async () => {
      await this.solicitarToken();
      const headers = this._mergeHeaders(opciones.headers, {
        Authorization: `Bearer ${this.getAccessToken()}`,
      });

      const respuesta = await fetch(url, {
        ...opciones,
        headers,
      });

      if (!respuesta.ok) {
        throw await this._crearErrorHttpDrive(respuesta);
      }

      return respuesta;
    }, config);
  },

  /**
   * Ejecuta una llamada gapi.client.drive con reintentos y refresh de token.
   *
   * @param {string} nombre
   * @param {function(): Promise<*>} requestFactory
   * @param {Object} config
   * @returns {Promise<*>}
   */
  async gapiDrive(nombre, requestFactory, config = {}) {
    return this._ejecutarConReintentos(nombre, async () => {
      await this.solicitarToken();
      return requestFactory();
    }, config);
  },

  /**
   * Lanza una solicitud de token con el prompt indicado y resuelve cuando
   * Google responde. Conserva el codigo de error OAuth para decidir reintentos.
   * @private
   * @param {string} prompt - '' (silencioso), 'consent' o 'select_account'.
   */
  _pedirAccessToken(prompt) {
    return new Promise((resolve, reject) => {
      const limpiarErrorHandler = () => {
        _tokenErrorHandler = null;
      };

      _tokenErrorHandler = (err) => {
        limpiarErrorHandler();
        reject(this._normalizarErrorGis(err));
      };

      _gapiTokenClient.callback = (resp) => {
        limpiarErrorHandler();

        if (resp.error) {
          const error = new Error(`Error OAuth: ${resp.error}`);
          error.oauthError = resp.error;
          reject(error);
          return;
        }

        if (resp.access_token && window.gapi?.client?.setToken) {
          window.gapi.client.setToken(resp);
        }

        this._guardarExpiracion(resp);
        resolve(resp);
      };

      try {
        _gapiTokenClient.requestAccessToken({ prompt });
      } catch (err) {
        limpiarErrorHandler();
        reject(err);
      }
    });
  },

  /**
   * Convierte errores no-OAuth de Google Identity en mensajes accionables.
   * @private
   */
  _normalizarErrorGis(err) {
    const tipo = String(err?.type || err?.error || 'unknown');
    const mensajes = {
      popup_failed_to_open: 'El navegador bloqueo la ventana de Google. Permite ventanas emergentes para este sitio e intenta de nuevo.',
      popup_closed: 'La ventana de Google se cerro antes de completar la conexion.',
      unknown: 'No se pudo abrir la autorizacion de Google Drive.',
    };

    const error = new Error(mensajes[tipo] || mensajes.unknown);
    error.oauthError = tipo;
    error.gisError = err;
    return error;
  },

  /**
   * Indica si el fallo de un intento silencioso amerita mostrar el dialogo de
   * consentimiento. Excluye cancelaciones del usuario para no reabrir el
   * dialogo en bucle.
   * @private
   */
  _requiereInteraccion(err) {
    const codigo = String(err?.oauthError || '').toLowerCase();
    if (!codigo) return false;
    if (codigo.includes('access_denied') || codigo.includes('closed') || codigo.includes('cancel')) {
      return false;
    }
    return codigo.includes('interaction_required')
      || codigo.includes('consent_required')
      || codigo.includes('login_required')
      || codigo.includes('account_selection_required')
      || codigo.includes('required');
  },

  getToken() {
    return window.gapi?.client?.getToken?.() || null;
  },

  getAccessToken() {
    return this.getToken()?.access_token || '';
  },

  getEstadoConexion({ margenMs = TOKEN_WARNING_MS } = {}) {
    const token = this.getToken();
    if (!token?.access_token) {
      return {
        estado: 'sin_token',
        requiereConexion: true,
        expiraEn: null,
        msRestantes: 0,
      };
    }

    if (!_tokenExpiraEn) {
      return {
        estado: 'vigente',
        requiereConexion: false,
        expiraEn: null,
        msRestantes: null,
      };
    }

    const msRestantes = _tokenExpiraEn - Date.now();
    if (msRestantes <= 0) {
      return {
        estado: 'vencido',
        requiereConexion: true,
        expiraEn: _tokenExpiraEn,
        msRestantes,
      };
    }

    if (msRestantes <= margenMs) {
      return {
        estado: 'por_vencer',
        requiereConexion: true,
        expiraEn: _tokenExpiraEn,
        msRestantes,
      };
    }

    return {
      estado: 'vigente',
      requiereConexion: false,
      expiraEn: _tokenExpiraEn,
      msRestantes,
    };
  },

  onEstadoCambio(callback) {
    const handler = (event) => callback(event.detail || this.getEstadoConexion());
    window.addEventListener(EVENTO_ESTADO, handler);
    return () => window.removeEventListener(EVENTO_ESTADO, handler);
  },

  _hayTokenVigente() {
    const token = this.getToken();
    if (!token?.access_token) return false;
    if (!_tokenExpiraEn) return true;
    return Date.now() < _tokenExpiraEn - TOKEN_MARGIN_MS;
  },

  _guardarExpiracion(resp) {
    const expiresIn = Number(resp?.expires_in || 0);
    _tokenExpiraEn = Date.now() + (expiresIn > 0 ? expiresIn * 1000 : DEFAULT_TOKEN_MS);
    this._notificarCambio();
  },

  async _ejecutarConReintentos(nombre, operacion, config = {}) {
    const maxReintentos = Number.isInteger(config.reintentos)
      ? Math.max(0, config.reintentos)
      : DRIVE_MAX_REINTENTOS;
    let intento = 0;
    let tokenRefrescado = false;

    while (intento <= maxReintentos) {
      try {
        return await operacion({ intento });
      } catch (err) {
        const error = this._normalizarErrorDrive(err, nombre);

        if (this._esErrorAuthDrive(error) && !tokenRefrescado) {
          tokenRefrescado = true;
          this._limpiarToken();
          await this.solicitarToken({ forceRefresh: true });
          continue;
        }

        if (!this._esErrorReintentableDrive(error) || intento >= maxReintentos) {
          throw error;
        }

        await this._esperarReintento(error, intento);
        intento += 1;
      }
    }

    throw new Error(`No se pudo completar la operacion de Drive: ${nombre}`);
  },

  _normalizarErrorDrive(err, nombre) {
    const gapiError = err?.result?.error || this._parseGapiBody(err?.body)?.error || null;
    const mensaje = err?.message
      || gapiError?.message
      || `No se pudo completar la operacion de Drive: ${nombre}`;
    const error = err instanceof Error ? err : new Error(mensaje);

    error.message = mensaje;
    error.driveOperacion = nombre;
    error.status = Number(error.status || err?.status || err?.code || gapiError?.code || 0) || undefined;
    error.reason = error.reason
      || gapiError?.errors?.[0]?.reason
      || gapiError?.status
      || err?.result?.error?.status
      || '';

    return error;
  },

  async _crearErrorHttpDrive(respuesta) {
    const texto = await respuesta.text();
    const payload = this._parseGapiBody(texto);
    const apiError = payload?.error || null;
    const mensaje = apiError?.message || texto || `Error HTTP ${respuesta.status} en Google Drive`;
    const error = new Error(mensaje);

    error.status = respuesta.status;
    error.reason = apiError?.errors?.[0]?.reason || apiError?.status || '';
    error.retryAfterMs = this._retryAfterMs(respuesta.headers.get('Retry-After'));
    error.drivePayload = payload;

    return error;
  },

  _parseGapiBody(body) {
    if (!body || typeof body !== 'string') return null;
    try {
      return JSON.parse(body);
    } catch (_) {
      return null;
    }
  },

  _esErrorAuthDrive(error) {
    const status = Number(error?.status || 0);
    const reason = String(error?.reason || error?.oauthError || '').toLowerCase();

    return status === 401
      || reason.includes('autherror')
      || reason.includes('invalid_credentials')
      || reason.includes('invalidcredentials')
      || reason.includes('login_required');
  },

  _esErrorReintentableDrive(error) {
    const status = Number(error?.status || 0);
    const reason = String(error?.reason || '').toLowerCase();

    return [408, 429, 500, 502, 503, 504].includes(status)
      || ['ratelimitexceeded', 'userratelimitexceeded', 'backenderror', 'internalerror'].includes(reason)
      || (!status && error instanceof TypeError);
  },

  async _esperarReintento(error, intento) {
    const retryAfter = Number(error?.retryAfterMs || 0);
    const exponencial = Math.min(DRIVE_RETRY_MAX_MS, DRIVE_RETRY_BASE_MS * (2 ** intento));
    const jitter = Math.floor(Math.random() * 250);
    const delay = retryAfter > 0 ? retryAfter : exponencial + jitter;

    await new Promise((resolve) => setTimeout(resolve, delay));
  },

  _retryAfterMs(valor) {
    if (!valor) return 0;
    const segundos = Number(valor);
    if (Number.isFinite(segundos)) return Math.max(0, segundos * 1000);

    const fecha = Date.parse(valor);
    return Number.isFinite(fecha) ? Math.max(0, fecha - Date.now()) : 0;
  },

  _mergeHeaders(headers, extra) {
    const resultado = {};

    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        resultado[key] = value;
      });
    } else if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => {
        resultado[key] = value;
      });
    } else if (headers && typeof headers === 'object') {
      Object.assign(resultado, headers);
    }

    return {
      ...resultado,
      ...extra,
    };
  },

  _limpiarToken() {
    _tokenExpiraEn = 0;
    if (window.gapi?.client?.setToken) {
      window.gapi.client.setToken(null);
    }
    this._notificarCambio();
  },

  _notificarCambio() {
    window.dispatchEvent(new CustomEvent(EVENTO_ESTADO, {
      detail: this.getEstadoConexion(),
    }));
  },
};

export default DriveAuthModel;
