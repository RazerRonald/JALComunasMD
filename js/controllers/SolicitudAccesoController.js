/**
 * @fileoverview Orquesta solicitudes publicas y su revision por ediles.
 *
 * @module controllers/SolicitudAccesoController
 */

import SolicitudAccesoModel from '../models/SolicitudAccesoModel.js';
import AuthController from './AuthController.js';
import {
  ESTADOS_SOLICITUD_ACCESO,
  ROLES,
  TIPOS_DOCUMENTO,
} from '../config/collections.js';
import { i18n } from '../config/i18n.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SolicitudAccesoController = {
  /** Registra una solicitud publica para unicamente el rol estudiante. */
  async crear(datos, { onLoading, onSuccess, onError }, captchaToken) {
    const solicitud = this._normalizar(datos);
    const error = this._validar(solicitud);
    if (error) {
      onError(error);
      return;
    }

    onLoading(true);
    try {
      const id = await SolicitudAccesoModel.crear(solicitud, captchaToken);
      onSuccess(id);
    } catch (err) {
      console.error('[SolicitudAccesoController.crear]', err);
      onError(this._mapearError(err));
    } finally {
      onLoading(false);
    }
  },

  /** Suscribe el listado exclusivo para ediles. */
  suscribir(onSuccess, onError) {
    return SolicitudAccesoModel.suscribir(
      onSuccess,
      (err) => {
        console.error('[SolicitudAccesoController.suscribir]', err);
        onError(this._mapearError(err));
      },
    );
  },

  /**
   * Solicita al servidor un alta recuperable; informa aparte el resultado del correo.
   */
  async aprobar(solicitud, { onLoading, onSuccess, onError }) {
    const sesion = AuthController.getSesion();
    if (!sesion || sesion.rol !== ROLES.EDIL) {
      onError(i18n.auth.accesoDenegado);
      return;
    }

    if (!['Pendiente', 'Procesando', 'Aprobada'].includes(solicitud?.estado)) {
      onError(i18n.solicitudAcceso.yaResuelta);
      return;
    }

    onLoading(true);
    try {
      const usuario = await SolicitudAccesoModel.resolver(solicitud.id, 'approve');
      onSuccess(usuario);
    } catch (err) {
      console.error('[SolicitudAccesoController.aprobar]', err);
      onError(this._mapearError(err));
    } finally {
      onLoading(false);
    }
  },

  /** Rechaza una solicitud sin crear acceso ni modificar usuarios. */
  async rechazar(solicitud, { onLoading, onSuccess, onError }) {
    const sesion = AuthController.getSesion();
    if (!sesion || sesion.rol !== ROLES.EDIL) {
      onError(i18n.auth.accesoDenegado);
      return;
    }

    if (solicitud?.estado !== ESTADOS_SOLICITUD_ACCESO.PENDIENTE) {
      onError(i18n.solicitudAcceso.yaResuelta);
      return;
    }

    onLoading(true);
    try {
      await SolicitudAccesoModel.resolver(solicitud.id, 'reject');
      onSuccess();
    } catch (err) {
      console.error('[SolicitudAccesoController.rechazar]', err);
      onError(this._mapearError(err));
    } finally {
      onLoading(false);
    }
  },

  /**
   * Construye una redaccion de Gmail sin enviar el mensaje automaticamente.
   * No incluye contrasena: el estudiante la crea mediante el correo oficial de
   * restablecimiento de Firebase.
   */
  construirGmailUrl(solicitud) {
    const asunto = i18n.solicitudAcceso.correoAsunto;
    const cuerpo = [
      i18n.solicitudAcceso.correoSaludo.replace('{nombre}', solicitud.nombre),
      '',
      i18n.solicitudAcceso.correoMensaje,
      '',
      `${i18n.solicitudAcceso.correoCredencial}: ${solicitud.email}`,
      '',
      i18n.solicitudAcceso.correoInstruccionReset,
    ].join('\n');

    const params = new URLSearchParams({
      view: 'cm',
      fs: '1',
      to: solicitud.email,
      su: asunto,
      body: cuerpo,
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  },

  async reenviarCorreo(solicitud) {
    return SolicitudAccesoModel.resolver(solicitud.id, 'email');
  },

  _normalizar(datos = {}) {
    return {
      email: String(datos.email || '').trim().toLowerCase(),
      nombre: String(datos.nombre || '').trim().replace(/\s+/g, ' '),
      primer_apellido: String(datos.primer_apellido || '').trim().replace(/\s+/g, ' '),
      segundo_apellido: String(datos.segundo_apellido || '').trim().replace(/\s+/g, ' '),
      tipo_documento: String(datos.tipo_documento || '').trim().toUpperCase(),
      numero_documento: String(datos.numero_documento || '').trim().replace(/\s+/g, ''),
      ciudad_documento: String(datos.ciudad_documento || '').trim().replace(/\s+/g, ' '),
    };
  },

  _validar(datos) {
    if (Object.values(datos).some((valor) => !valor)) {
      return i18n.solicitudAcceso.camposRequeridos;
    }
    if (!EMAIL_RE.test(datos.email) || datos.email.length > 180) {
      return i18n.solicitudAcceso.emailInvalido;
    }
    if ([datos.nombre, datos.primer_apellido, datos.segundo_apellido].some((valor) => valor.length > 80)) {
      return i18n.solicitudAcceso.nombreInvalido;
    }
    if (!TIPOS_DOCUMENTO.includes(datos.tipo_documento)) {
      return i18n.solicitudAcceso.tipoDocumentoInvalido;
    }
    if (datos.numero_documento.length < 6 || datos.numero_documento.length > 30) {
      return i18n.solicitudAcceso.numeroDocumentoInvalido;
    }
    if (datos.ciudad_documento.length > 80) {
      return i18n.solicitudAcceso.ciudadInvalida;
    }
    return '';
  },

  _mapearError(err = {}) {
    if (err.code === 'usuario/no-creado') return err.message;
    if (err.code === 'solicitud/ya-resuelta') return i18n.solicitudAcceso.yaResuelta;
    if (err.code === 'solicitud/no-encontrada') return i18n.solicitudAcceso.noEncontrada;
    if (err.code === 'permission-denied') return i18n.solicitudAcceso.errorPermisos;
    if (err.code === 'unavailable' || err.code === 'network-request-failed') {
      return i18n.auth.errorRed;
    }
    return err.message && err.message !== err.code ? err.message : i18n.solicitudAcceso.errorGenerico;
  },

  _crearError(code, message) {
    const error = new Error(message || code);
    error.code = code;
    return error;
  },
};

export default SolicitudAccesoController;
