/**
 * @fileoverview AuthController - Orquesta autenticacion y perfiles.
 *
 * Recibe eventos de vistas, valida datos, llama a AuthModel y devuelve
 * mensajes amigables. No toca Firebase directamente ni renderiza HTML.
 *
 * @module controllers/AuthController
 */

import AuthModel from '../models/AuthModel.js';
import { ROLES, TIPOS_DOCUMENTO } from '../config/collections.js';
import { i18n } from '../config/i18n.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AuthController = {
  /**
   * Wrapper compatible con el flujo anterior de crear estudiantes.
   */
  async crearEstudiante(datos, callbacks) {
    return this.crearUsuario({ ...datos, rol: ROLES.ESTUDIANTE }, callbacks);
  },

  /**
   * Crea un usuario estudiante o Edil desde el Panel Admin.
   *
   * @param {Object} datos
   * @param {Object} callbacks
   * @returns {Promise<void>}
   */
  async crearUsuario(datos, { onLoading, onSuccess, onError }) {
    const datosLimpios = this._normalizarDatosUsuario(datos);
    const errorPerfil = this._validarPerfil(datosLimpios);
    if (errorPerfil) {
      onError(errorPerfil);
      return;
    }

    const password = String(datos?.password || '');
    const confirmarPassword = String(datos?.confirmarPassword || '');
    const errorPassword = this._validarPasswordCreacion(password, confirmarPassword);
    if (errorPassword) {
      onError(errorPassword);
      return;
    }

    onLoading(true);
    try {
      const usuario = await AuthModel.crearUsuarioPorEdil({
        ...datosLimpios,
        password,
      });
      onSuccess(usuario);
    } catch (err) {
      console.error('[AuthController.crearUsuario]', err);
      onError(this._mapearErrorFirebase(err.code || err.message));
    } finally {
      onLoading(false);
    }
  },

  /**
   * Lista usuarios para vistas administrativas.
   */
  async listarUsuarios({ onLoading, onSuccess, onError }) {
    onLoading(true);
    try {
      onSuccess(await AuthModel.listarUsuarios());
    } catch (err) {
      console.error('[AuthController.listarUsuarios]', err);
      onError(this._mapearErrorFirebase(err.code || err.message));
    } finally {
      onLoading(false);
    }
  },

  /**
   * Suscribe usuarios en tiempo real.
   *
   * @param {function(Object[]): void} onSuccess
   * @param {function(string): void} onError
   * @returns {function}
   */
  suscribirUsuarios(onSuccess, onError) {
    return AuthModel.suscribirUsuarios(
      onSuccess,
      (err) => {
        console.error('[AuthController.suscribirUsuarios]', err);
        onError(this._mapearErrorFirebase(err.code || err.message));
      },
    );
  },

  /**
   * Actualiza un usuario existente desde el Panel Admin.
   *
   * @param {string} uid
   * @param {Object} datos
   * @param {Object} usuarioActual
   * @param {Object} callbacks
   * @returns {Promise<void>}
   */
  async actualizarUsuario(uid, datos, usuarioActual, { onLoading, onSuccess, onError }) {
    const datosLimpios = this._normalizarDatosUsuario(datos);
    const errorPerfil = this._validarPerfil(datosLimpios);
    if (errorPerfil) {
      onError(errorPerfil);
      return;
    }

    const password = String(datos?.password || '');
    const confirmarPassword = String(datos?.confirmarPassword || '');
    const errorPassword = this._validarPasswordEdicion(password, confirmarPassword);
    if (errorPassword) {
      onError(errorPassword);
      return;
    }

    onLoading(true);
    try {
      const usuario = await AuthModel.actualizarUsuarioPorEdil(
        uid,
        {
          ...datosLimpios,
          password,
        },
        usuarioActual,
      );
      onSuccess(usuario);
    } catch (err) {
      console.error('[AuthController.actualizarUsuario]', err);
      onError(this._mapearErrorFirebase(err.code || err.message));
    } finally {
      onLoading(false);
    }
  },

  /**
   * Elimina un usuario existente desde el Panel Admin.
   *
   * @param {string} uid
   * @param {Object} callbacks
   * @returns {Promise<void>}
   */
  async eliminarUsuario(uid, { onLoading, onSuccess, onError }) {
    onLoading(true);
    try {
      await AuthModel.eliminarUsuarioPorEdil(uid);
      onSuccess(uid);
    } catch (err) {
      console.error('[AuthController.eliminarUsuario]', err);
      onError(this._mapearErrorFirebase(err.code || err.message));
    } finally {
      onLoading(false);
    }
  },

  /**
   * Procesa el intento de inicio de sesion.
   */
  async login(email, password, { onLoading, onSuccess, onError }) {
    if (!email?.trim() || !password?.trim()) {
      onError(i18n.auth.errorCredenciales);
      return;
    }

    onLoading(true);
    try {
      const sesion = await AuthModel.login(email.trim(), password);
      onSuccess(sesion);
    } catch (err) {
      console.error('[AuthController.login]', err);
      onError(this._mapearErrorFirebase(err.code));
    } finally {
      onLoading(false);
    }
  },

  /**
   * Solicita el envio del correo de restablecimiento de contrasena. Se usa
   * tanto en el flujo de aprobacion de solicitudes como en la recuperacion
   * autoservicio desde el login. Por privacidad no revela si el correo existe.
   */
  async enviarCorreoRestablecerPassword(email, { onLoading, onSuccess, onError } = {}) {
    if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
      onError?.(i18n.auth.resetIngresaCorreo);
      return;
    }

    onLoading?.(true);
    try {
      await AuthModel.enviarResetPassword(email.trim());
      onSuccess?.();
    } catch (err) {
      console.error('[AuthController.enviarCorreoRestablecerPassword]', err);
      onError?.(this._mapearErrorFirebase(err.code || err.message));
    } finally {
      onLoading?.(false);
    }
  },

  /**
   * Cambia la contrasena exclusivamente para la cuenta autenticada.
   */
  async cambiarPasswordPropia(datos, { onLoading, onSuccess, onError }) {
    const passwordActual = String(datos?.passwordActual || '');
    const passwordNueva = String(datos?.passwordNueva || '');
    const confirmarPassword = String(datos?.confirmarPassword || '');

    if (!passwordActual || !passwordNueva || !confirmarPassword) {
      onError(i18n.auth.passwordCamposRequeridos);
      return;
    }

    if (passwordNueva.length < 10) {
      onError(i18n.auth.passwordNuevaCorta);
      return;
    }

    if (passwordNueva !== confirmarPassword) {
      onError(i18n.auth.passwordNuevaNoCoincide);
      return;
    }

    if (passwordActual === passwordNueva) {
      onError(i18n.auth.passwordNuevaIgual);
      return;
    }

    onLoading(true);
    try {
      await AuthModel.cambiarPasswordPropia(passwordActual, passwordNueva);
      onSuccess();
    } catch (err) {
      console.error('[AuthController.cambiarPasswordPropia]', err);
      onError(this._mapearErrorCambioPassword(err.code || err.message));
    } finally {
      onLoading(false);
    }
  },

  /**
   * Cierra la sesion del usuario.
   */
  async logout({ onSuccess, onError }) {
    try {
      await AuthModel.logout();
      onSuccess();
    } catch (err) {
      console.error('[AuthController.logout]', err);
      onError(i18n.app.errorGenerico);
    }
  },

  iniciarListener(onCambio) {
    return AuthModel.onAuthChange(onCambio);
  },

  getSesion() {
    return AuthModel.getSesion();
  },

  getRutaPorRol(rol) {
    switch (rol) {
      case ROLES.EDIL:       return '#/admin';
      case ROLES.ESTUDIANTE: return '#/inicio';
      default:               return '#/inicio';
    }
  },

  _normalizarDatosUsuario(datos = {}) {
    return {
      rol: this._normalizarRol(datos.rol),
      email: String(datos.email || '').trim().toLowerCase(),
      nombre: String(datos.nombre || '').trim().replace(/\s+/g, ' '),
      primer_apellido: String(datos.primer_apellido || '').trim().replace(/\s+/g, ' '),
      segundo_apellido: String(datos.segundo_apellido || '').trim().replace(/\s+/g, ' '),
      tipo_documento: String(datos.tipo_documento || '').trim().toUpperCase(),
      numero_documento: String(datos.numero_documento || '').trim().replace(/\s+/g, ''),
      ciudad_documento: String(datos.ciudad_documento || '').trim().replace(/\s+/g, ' '),
    };
  },

  _validarPerfil(datos) {
    const requeridos = [
      'email',
      'nombre',
      'primer_apellido',
      'segundo_apellido',
      'tipo_documento',
      'numero_documento',
      'ciudad_documento',
    ];

    if (requeridos.some((campo) => !datos[campo])) {
      return i18n.admin.usuariosCamposRequeridos;
    }

    if (!EMAIL_RE.test(datos.email)) {
      return i18n.admin.usuariosEmailInvalido;
    }

    if (!TIPOS_DOCUMENTO.includes(datos.tipo_documento)) {
      return i18n.admin.usuariosTipoDocInvalido;
    }

    if (datos.numero_documento.length < 4 || datos.numero_documento.length > 30) {
      return i18n.admin.usuariosNumeroDocInvalido;
    }

    if (datos.ciudad_documento.length > 80) {
      return i18n.admin.usuariosCiudadDocInvalida;
    }

    if (![ROLES.ESTUDIANTE, ROLES.EDIL].includes(datos.rol)) {
      return i18n.auth.accesoDenegado;
    }

    return null;
  },

  _validarPasswordCreacion(password, confirmarPassword) {
    if (!password || !confirmarPassword) {
      return i18n.admin.usuariosCamposRequeridos;
    }

    if (password.length < 10) {
      return i18n.admin.usuariosPasswordCorta;
    }

    if (password !== confirmarPassword) {
      return i18n.admin.usuariosPasswordNoCoincide;
    }

    return null;
  },

  _validarPasswordEdicion(password, confirmarPassword) {
    if (!password && !confirmarPassword) return null;

    if (password.length < 10) {
      return i18n.admin.usuariosPasswordCorta;
    }

    if (password !== confirmarPassword) {
      return i18n.admin.usuariosPasswordNoCoincide;
    }

    return null;
  },

  _normalizarRol(rol) {
    return rol === ROLES.EDIL ? ROLES.EDIL : ROLES.ESTUDIANTE;
  },

  _mapearErrorFirebase(codigo) {
    const mapa = {
      'auth/invalid-credential':     i18n.auth.errorCredenciales,
      'auth/user-not-found':         i18n.auth.errorCredenciales,
      'auth/wrong-password':         i18n.auth.errorCredenciales,
      'auth/invalid-email':          i18n.admin.usuariosEmailInvalido,
      'auth/email-already-in-use':   i18n.admin.usuariosEmailExiste,
      'auth/weak-password':          i18n.admin.usuariosPasswordCorta,
      'auth/operation-not-allowed':  'El proveedor Email/Password no esta habilitado en Firebase Auth.',
      'auth/unauthorized':           i18n.auth.accesoDenegado,
      'auth/no-self-demote':         i18n.admin.usuariosNoAutoCambioRol,
      'auth/no-self-delete':         i18n.admin.usuariosNoAutoEliminar,
      'auth/user-disabled':          'Esta cuenta ha sido desactivada.',
      'auth/too-many-requests':      'Demasiados intentos. Espera unos minutos.',
      'auth/network-request-failed': i18n.auth.errorRed,
      'profile/not-found':           i18n.auth.errorPerfilNoEncontrado || 'Tu cuenta no tiene un perfil registrado. Solicita al Edil administrador que complete tu perfil.',
      'profile/document-duplicate':  i18n.admin.usuariosDocumentoExiste,
      'permission-denied':           i18n.admin.usuariosErrorPermisos,
      'api/backend-unavailable':     i18n.admin.usuariosBackendNoDisponible,
      'api/404':                     i18n.admin.usuariosBackendNoDisponible,
      'api/405':                     i18n.admin.usuariosBackendNoDisponible,
      'api/501':                     i18n.admin.usuariosBackendNoDisponible,
      'method-not-allowed':          i18n.admin.usuariosBackendNoDisponible,
      'api/admin-config-missing':    i18n.admin.usuariosBackendConfig,
      'operation/busy': 'Hay una operacion en curso. Espera dos minutos y reintenta.',
      'operation/recovery-required': 'Hay una actualizacion pendiente. Usa Recuperar actualizacion antes de editar.',
      'api/unavailable': 'El servicio no esta disponible. Intenta nuevamente.',
      'access/not-ready': 'Completa primero el acceso desde Solicitudes de acceso.',
      'auth/email-already-exists': i18n.admin.usuariosEmailExiste,
      'invalid-profile': 'Revisa los datos y la longitud de los campos del formulario.',
      'EMAIL_EXISTS':                i18n.admin.usuariosEmailExiste,
      'INVALID_EMAIL':               i18n.admin.usuariosEmailInvalido,
      'WEAK_PASSWORD':               i18n.admin.usuariosPasswordCorta,
    };
    return mapa[codigo] || i18n.auth.errorGenerico;
  },

  _mapearErrorCambioPassword(codigo) {
    const mapa = {
      'auth/invalid-credential':     i18n.auth.passwordActualIncorrecta,
      'auth/wrong-password':         i18n.auth.passwordActualIncorrecta,
      'auth/user-mismatch':          i18n.auth.passwordActualIncorrecta,
      'auth/weak-password':          i18n.auth.passwordNuevaCorta,
      'auth/requires-recent-login':  i18n.auth.passwordReautenticacion,
      'auth/too-many-requests':      i18n.auth.passwordDemasiadosIntentos,
      'auth/network-request-failed': i18n.auth.errorRed,
      'auth/unauthorized':           i18n.auth.accesoDenegado,
      'auth/email-unavailable':      i18n.auth.passwordEmailNoDisponible,
    };
    return mapa[codigo] || i18n.auth.passwordError;
  },
};

export default AuthController;
