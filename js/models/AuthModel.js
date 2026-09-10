/**
 * @fileoverview AuthModel - Logica de autenticacion y gestion de perfiles.
 *
 * Habla unicamente con Firebase Auth, Firestore y endpoints propios de la app.
 * No toca el DOM.
 *
 * @module models/AuthModel
 */

import { firebaseConfig, auth, db } from '../config/firebase.config.js';
import { COL_USERS, ROLES, TIPOS_DOCUMENTO } from '../config/collections.js';
import {
  initializeApp,
  deleteApp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  inMemoryPersistence,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/**
 * @typedef {Object} SesionUsuario
 * @property {string} uid
 * @property {string} email
 * @property {string} nombre Nombre completo para mostrar en UI.
 * @property {string} nombre_perfil Nombre de pila guardado en el perfil.
 * @property {string} primer_apellido
 * @property {string} segundo_apellido
 * @property {string} tipo_documento
 * @property {string} numero_documento
 * @property {string} ciudad_documento
 * @property {string} rol
 */

/** @type {SesionUsuario|null} */
let _sesionActual = null;

const AuthModel = {
  /**
   * Crea una cuenta de estudiante sin cambiar la sesion principal del Edil.
   * Se conserva como wrapper para compatibilidad con llamadas existentes.
   *
   * @param {Object} datos
   * @returns {Promise<Object>}
   */
  async crearEstudiantePorEdil(datos) {
    return this.crearUsuarioPorEdil({ ...datos, rol: ROLES.ESTUDIANTE });
  },

  /**
   * Crea un usuario estudiante o Edil desde una sesion Edil.
   *
   * @param {Object} datos
   * @returns {Promise<Object>}
   */
  async crearUsuarioPorEdil(datos) {
    const sesionEdil = this.getSesion();
    if (!sesionEdil || sesionEdil.rol !== ROLES.EDIL) {
      throw this._crearError('auth/unauthorized');
    }

    const perfilBase = this._normalizarPerfilEntrada(datos);
    const rol = this._normalizarRol(datos?.rol);
    const password = String(datos?.password || '');
    await this._asegurarDocumentoDisponible(perfilBase.numero_documento);

    const appName = `admin-create-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);
    await setPersistence(secondaryAuth, inMemoryPersistence);

    let usuarioCreado = null;
    let perfilCreado = false;

    try {
      const credencial = await createUserWithEmailAndPassword(
        secondaryAuth,
        perfilBase.email,
        password,
      );
      usuarioCreado = credencial.user;

      const perfil = {
        uid: usuarioCreado.uid,
        ...perfilBase,
        rol,
        creadoEn: serverTimestamp(),
        creadoPor: sesionEdil.uid,
      };

      await updateProfile(usuarioCreado, {
        displayName: this._buildNombreCompleto(perfil),
      });
      await setDoc(doc(db, COL_USERS, usuarioCreado.uid), perfil);
      perfilCreado = true;

      return this._normalizarUsuario(perfil);
    } catch (err) {
      if (usuarioCreado && !perfilCreado) {
        try {
          await deleteUser(usuarioCreado);
        } catch (deleteErr) {
          console.warn('[AuthModel.crearUsuarioPorEdil] No se pudo revertir usuario Auth incompleto', deleteErr);
        }
      }
      throw err;
    } finally {
      try {
        await signOut(secondaryAuth);
      } catch (_) {}
      try {
        await deleteApp(secondaryApp);
      } catch (_) {}
    }
  },

  /**
   * Lista todos los perfiles visibles para el Edil autenticado.
   *
   * @returns {Promise<Object[]>}
   */
  async listarUsuarios() {
    const snap = await getDocs(collection(db, COL_USERS));
    return this._ordenarUsuarios(snap.docs.map((d) =>
      this._normalizarUsuario({ id: d.id, ...d.data() })
    ));
  },

  /**
   * Suscribe perfiles en tiempo real. Solo debe usarse desde vistas de Edil.
   *
   * @param {function(Object[]): void} callback
   * @param {function(Error): void} onError
   * @returns {function}
   */
  suscribirUsuarios(callback, onError = () => {}) {
    return onSnapshot(
      collection(db, COL_USERS),
      (snap) => {
        callback(this._ordenarUsuarios(snap.docs.map((d) =>
          this._normalizarUsuario({ id: d.id, ...d.data() })
        )));
      },
      onError,
    );
  },

  /**
   * Todas las ediciones usan el servidor para coordinar Auth, perfil y recuperacion.
   *
   * @param {string} uid
   * @param {Object} datos
   * @param {Object|null} usuarioActual
   * @returns {Promise<Object>}
   */
  async actualizarUsuarioPorEdil(uid, datos, usuarioActual = null) {
    const sesionEdil = this.getSesion();
    if (!sesionEdil || sesionEdil.rol !== ROLES.EDIL) {
      throw this._crearError('auth/unauthorized');
    }

    const perfil = {
      uid,
      ...this._normalizarPerfilEntrada(datos),
      rol: this._normalizarRol(datos?.rol || usuarioActual?.rol),
      actualizadoPor: sesionEdil.uid,
    };

    if (uid === sesionEdil.uid && perfil.rol !== ROLES.EDIL) {
      throw this._crearError('auth/no-self-demote');
    }

    const usuario = await this._actualizarUsuarioViaApi(uid, perfil, String(datos?.password || ''));
    if (auth.currentUser?.uid === uid) await auth.currentUser.reload().catch(() => {});
    this._actualizarSesionSiEsActual(uid, usuario);
    return usuario;
  },

  /**
   * Elimina un usuario administrado desde el Panel Admin.
   * La eliminacion de Firebase Auth y Firestore se delega al endpoint
   * serverless para no exponer privilegios administrativos en el cliente.
   *
   * @param {string} uid
   * @returns {Promise<void>}
   */
  async eliminarUsuarioPorEdil(uid) {
    const sesionEdil = this.getSesion();
    if (!sesionEdil || sesionEdil.rol !== ROLES.EDIL) {
      throw this._crearError('auth/unauthorized');
    }

    if (uid === sesionEdil.uid) {
      throw this._crearError('auth/no-self-delete');
    }

    await this._eliminarUsuarioViaApi(uid);
  },

  /**
   * Inicia sesion con correo y contrasena usando Firebase Auth.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<SesionUsuario>}
   */
  async login(email, password) {
    const credencial = await signInWithEmailAndPassword(auth, email, password);
    const perfilSnap = await getDoc(doc(db, COL_USERS, credencial.user.uid));

    if (!perfilSnap.exists()) {
      await signOut(auth);
      throw this._crearError('profile/not-found');
    }

    const usuario = this._normalizarUsuario({
      id: perfilSnap.id,
      ...perfilSnap.data(),
      email: credencial.user.email || perfilSnap.data().email,
    });

    _sesionActual = this._usuarioASesion(usuario);
    return _sesionActual;
  },

  /**
   * Envia un correo oficial de Firebase para restablecer la contrasena de una
   * cuenta. No requiere sesion activa de esa cuenta y no expone credenciales.
   *
   * @param {string} email
   * @returns {Promise<void>}
   */
  async enviarResetPassword(email) {
    const correo = this._normalizarEmail(email);
    if (!correo) {
      throw this._crearError('auth/email-unavailable');
    }
    await sendPasswordResetEmail(auth, correo);
  },

  /**
   * Cambia la contrasena de la cuenta autenticada. La reautenticacion evita
   * que una sesion abierta permita cambiarla sin conocer la clave actual.
   *
   * @param {string} passwordActual
   * @param {string} passwordNueva
   * @returns {Promise<void>}
   */
  async cambiarPasswordPropia(passwordActual, passwordNueva) {
    const usuario = auth.currentUser;
    const sesion = this.getSesion();
    if (!usuario || !sesion || usuario.uid !== sesion.uid) {
      throw this._crearError('auth/unauthorized');
    }

    const email = this._normalizarEmail(usuario.email || sesion.email);
    if (!email) {
      throw this._crearError('auth/email-unavailable');
    }

    const credencial = EmailAuthProvider.credential(email, passwordActual);
    await reauthenticateWithCredential(usuario, credencial);
    await updatePassword(usuario, passwordNueva);
  },

  /**
   * Cierra la sesion activa.
   *
   * @returns {Promise<void>}
   */
  async logout() {
    await signOut(auth);
    _sesionActual = null;
  },

  /**
   * Retorna la sesion en memoria.
   *
   * @returns {SesionUsuario|null}
   */
  getSesion() {
    return _sesionActual;
  },

  /**
   * Establece manualmente la sesion en memoria.
   *
   * @param {SesionUsuario|null} sesion
   */
  setSesion(sesion) {
    _sesionActual = sesion;
  },

  /**
   * Suscribe cambios de Firebase Auth y reconstruye la sesion desde Firestore.
   *
   * @param {function(SesionUsuario|null): void} callback
   * @returns {function}
   */
  onAuthChange(callback) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        _sesionActual = null;
        callback(null);
        return;
      }

      try {
        const perfilSnap = await getDoc(doc(db, COL_USERS, firebaseUser.uid));
        if (!perfilSnap.exists()) {
          await signOut(auth);
          _sesionActual = null;
          callback(null);
          return;
        }

        const usuario = this._normalizarUsuario({
          id: perfilSnap.id,
          ...perfilSnap.data(),
          email: firebaseUser.email || perfilSnap.data().email,
        });

        _sesionActual = this._usuarioASesion(usuario);
        callback(_sesionActual);
      } catch (err) {
        console.error('[AuthModel.onAuthChange]', err);
        _sesionActual = null;
        callback(null);
      }
    });
  },

  _normalizarPerfilEntrada(datos = {}) {
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

  _normalizarUsuario(raw = {}) {
    const nombrePerfil = String(raw.nombre || '').trim().replace(/\s+/g, ' ');
    const primerApellido = String(raw.primer_apellido || '').trim().replace(/\s+/g, ' ');
    const segundoApellido = String(raw.segundo_apellido || '').trim().replace(/\s+/g, ' ');
    const email = this._normalizarEmail(raw.email || raw.correo);
    const fallbackNombre = email ? email.split('@')[0] : 'Usuario';
    const base = {
      uid: String(raw.uid || raw.id || '').trim(),
      email,
      nombre: nombrePerfil || String(raw.nombre_completo || '').trim() || fallbackNombre,
      primer_apellido: primerApellido,
      segundo_apellido: segundoApellido,
      tipo_documento: String(raw.tipo_documento || '').trim().toUpperCase(),
      numero_documento: String(raw.numero_documento || '').trim(),
      ciudad_documento: String(raw.ciudad_documento || '').trim().replace(/\s+/g, ' '),
      rol: this._normalizarRol(raw.rol),
      creadoEn: raw.creadoEn || null,
      creadoPor: raw.creadoPor || null,
      actualizadoEn: raw.actualizadoEn || null,
      actualizadoPor: raw.actualizadoPor || null,
    };

    return {
      ...base,
      nombre_completo: this._buildNombreCompleto(base),
    };
  },

  _usuarioASesion(usuario) {
    return {
      ...usuario,
      nombre_perfil: usuario.nombre,
      nombre: usuario.nombre_completo,
    };
  },

  _actualizarSesionSiEsActual(uid, usuario) {
    if (_sesionActual?.uid !== uid) return;
    _sesionActual = this._usuarioASesion(this._normalizarUsuario(usuario));
  },

  async _actualizarUsuarioViaApi(uid, perfil, password) {
    const token = await auth.currentUser?.getIdToken?.();
    if (!token) {
      throw this._crearError('auth/unauthorized');
    }

    const response = await fetch('/api/admin-users', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        uid,
        perfil,
        password: password || undefined,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if ([404, 405, 501].includes(response.status)) {
        throw this._crearError('api/backend-unavailable');
      }
      throw this._crearError(payload.code || `api/${response.status}`, payload.error);
    }

    return { ...this._normalizarUsuario(payload.usuario || perfil), passwordActualizada: payload.passwordActualizada };
  },

  async recuperarActualizacion(uid) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw this._crearError('auth/unauthorized');
    const response = await fetch('/api/admin-users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ uid, action: 'recover' }),
    });
    const result = await response.json();
    if (!response.ok) throw this._crearError(result.code, result.error);
    const usuario = this._normalizarUsuario(result.usuario);
    this._actualizarSesionSiEsActual(uid, usuario);
    return result;
  },

  async _eliminarUsuarioViaApi(uid) {
    const token = await auth.currentUser?.getIdToken?.();
    if (!token) {
      throw this._crearError('auth/unauthorized');
    }

    const response = await fetch('/api/admin-users', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uid }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if ([404, 405, 501].includes(response.status)) {
        throw this._crearError('api/backend-unavailable');
      }
      throw this._crearError(payload.code || `api/${response.status}`, payload.error);
    }
  },

  _buildNombreCompleto(usuario = {}) {
    return [
      usuario.nombre,
      usuario.primer_apellido,
      usuario.segundo_apellido,
    ].filter(Boolean).join(' ').trim() || usuario.email?.split('@')[0] || 'Usuario';
  },

  _normalizarRol(rol) {
    return rol === ROLES.EDIL ? ROLES.EDIL : ROLES.ESTUDIANTE;
  },

  _normalizarEmail(email) {
    return String(email || '').trim().toLowerCase();
  },

  async _asegurarDocumentoDisponible(numeroDocumento, uidActual = '') {
    const numero = String(numeroDocumento || '').trim();
    if (!numero) return;

    const snap = await getDocs(query(
      collection(db, COL_USERS),
      where('numero_documento', '==', numero),
      limit(2),
    ));

    const duplicado = snap.docs.some((perfilDoc) => perfilDoc.id !== uidActual);
    if (duplicado) {
      throw this._crearError('profile/document-duplicate');
    }
  },

  _ordenarUsuarios(usuarios) {
    return [...usuarios].sort((a, b) => {
      if (a.rol !== b.rol) return a.rol === ROLES.EDIL ? -1 : 1;
      return a.nombre_completo.localeCompare(b.nombre_completo, 'es', { sensitivity: 'base' });
    });
  },

  _crearError(code, message = '') {
    const error = new Error(message || code);
    error.code = code;
    return error;
  },

  esTipoDocumentoValido(tipo) {
    return TIPOS_DOCUMENTO.includes(String(tipo || '').trim().toUpperCase());
  },
};

export default AuthModel;
