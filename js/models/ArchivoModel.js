/**
 * @fileoverview ArchivoModel — Gestión de cartas barriales en Google Drive API v3
 * y registro de solicitudes en Firestore.
 * Habla ÚNICAMENTE con Google Drive API y Firestore. No toca el DOM.
 *
 * Colección Firestore: `info_carta_inicial`
 * Estructura de documento:
 * {
 *   id:                    string (generado por Firestore),
 *   uid_estudiante:        string (uid del estudiante),
 *   nombre_completo:       string,
 *   tipo_documento:        string,
 *   numero_documento:      string,
 *   ciudad_documento:      string,
 *   universidad:           string,
 *   carrera:               string,
 *   semestre_actual:       number,
 *   horas_a_realizar:      number,
 *   lugar_realizacion:     string,
 *   estado:                'Pendiente' | 'Aprobado' | 'Rechazado' | 'Expedida',
 *   fecha_solicitud:       Timestamp,
 *   fecha_resolucion:      Timestamp | null,
 *   sugerencia_correccion: string | null,
 *   fecha_sugerencia_correccion: Timestamp | null,
 *   uid_edil_revision: string | null,
 *   documento_expedido_id: null,  // enlaces reales en info_carta_documentos
 *   documento_expedido_url: null,
 *   finalizacion_solicitada: boolean,
 *   finalizacion_estado: string | null,
 *   fecha_solicitud_finalizacion: Timestamp | null,
 *   fecha_expedicion_finalizacion: Timestamp | null,
 *   finalizacion_sugerencia_correccion: string | null,
 *   fecha_sugerencia_finalizacion: Timestamp | null,
 *   uid_edil_revision_finalizacion: string | null,
 *   documento_finalizacion_id: null,
 *   documento_finalizacion_url: null,
 * }
 *
 * @module models/ArchivoModel
 */

import { db, DRIVE_CONFIG }        from '../config/firebase.config.js';
import { COL_ARCHIVOS, COL_DOCUMENTOS_CARTAS, ESTADOS_TRAMITE } from '../config/collections.js';
import DriveAuthModel              from './DriveAuthModel.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/**
 * @typedef {Object} Tramite
 * @property {string}    id
 * @property {string}    uid_estudiante
 * @property {string}    nombre_completo
 * @property {string}    tipo_documento
 * @property {string}    numero_documento
 * @property {string}    ciudad_documento
 * @property {string}    universidad
 * @property {string}    carrera
 * @property {number}    semestre_actual
 * @property {number}    horas_a_realizar
 * @property {string}    lugar_realizacion
 * @property {string}    estado
 * @property {import('firebase/firestore').Timestamp} fecha_solicitud
 * @property {import('firebase/firestore').Timestamp|null} fecha_resolucion
 * @property {string|null} sugerencia_correccion
 * @property {import('firebase/firestore').Timestamp|null} fecha_sugerencia_correccion
 * @property {string|null} uid_edil_revision
 * @property {string|null} documento_expedido_id - Solo se adjunta en flujos del Edil
 * @property {string|null} documento_expedido_url - Solo se adjunta en flujos del Edil
 * @property {boolean}   finalizacion_solicitada
 * @property {string|null} finalizacion_estado
 * @property {import('firebase/firestore').Timestamp|null} fecha_solicitud_finalizacion
 * @property {import('firebase/firestore').Timestamp|null} fecha_expedicion_finalizacion
 * @property {string|null} finalizacion_sugerencia_correccion
 * @property {import('firebase/firestore').Timestamp|null} fecha_sugerencia_finalizacion
 * @property {string|null} uid_edil_revision_finalizacion
 * @property {string|null} documento_finalizacion_id - Solo se adjunta en flujos del Edil
 * @property {string|null} documento_finalizacion_url - Solo se adjunta en flujos del Edil
 */

// ─── Estado interno del token OAuth de Google Drive ──────────────────────
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const ArchivoModel = {
  // ─── GOOGLE DRIVE API ─────────────────────────────────────────────────

  /**
   * Inicializa el cliente de Google API (gapi) y solicita autorización OAuth.
   *
   * @returns {Promise<void>}
   */
  async inicializarDrive() {
    await DriveAuthModel.inicializarDrive();
  },

  /**
   * Solicita un token OAuth de Google para el scope de Drive.
   *
   * @returns {Promise<void>}
   */
  async solicitarToken() {
    await DriveAuthModel.solicitarToken();
  },

  /**
   * Sube un archivo (File o Blob) a Google Drive API v3.
   *
   * @param {File|Blob} archivo
   * @param {string}    [nombreCustom]
   * @returns {Promise<{ fileId: string, viewUrl: string, folderId: string }>}
   */
  async subirDrive(archivo, nombreCustom, opciones = {}) {
    return DriveAuthModel.ejecutarEnCola('subir carta a Drive', () =>
      this._subirDriveInterno(archivo, nombreCustom, opciones)
    );
  },

  async _subirDriveInterno(archivo, nombreCustom, opciones = {}) {
    await this.solicitarToken();

    const opcionesObj = typeof opciones === 'object' && opciones !== null
      ? opciones
      : {};
    const carpetaEstudiante = typeof opciones === 'string'
      ? opciones
      : opcionesObj.carpetaEstudiante;
    const compartirConEmail = DRIVE_CONFIG.TRAMITES_SHARE_EMAIL || opcionesObj.compartirConEmail || '';
    const parentId = carpetaEstudiante
      ? await this._obtenerOCrearCarpetaEstudiante(carpetaEstudiante)
      : DRIVE_CONFIG.FOLDER_ID;

    const nombre   = nombreCustom || (archivo.name || 'Carta_Barrial.docx');
    const metadata = {
      name:    nombre,
      parents: [parentId],
    };

    const fileBlob = archivo instanceof File
      ? archivo
      : new File([archivo], nombre, { type: MIME_DOCX });

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileBlob);

    const respuesta = await DriveAuthModel.fetchDrive(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method:  'POST',
        body:    form,
      },
      { nombre: 'subir carta a Drive', reintentos: 0 },
    );

    const { id: fileId, webViewLink } = await respuesta.json();

    await this._asegurarAccesoPrivadoTramite({
      folderId: parentId,
      fileId,
      email: compartirConEmail,
      nombreCarpeta: carpetaEstudiante,
    });

    return { fileId, viewUrl: webViewLink, folderId: parentId };
  },

  // ─── FIRESTORE ────────────────────────────────────────────────────────

  /**
   * Busca o crea una subcarpeta del estudiante dentro de la carpeta raiz.
   *
   * @param {string} nombreEstudiante
   * @returns {Promise<string>} ID de la carpeta de destino
   * @private
   */
  async _obtenerOCrearCarpetaEstudiante(nombreEstudiante) {
    const nombreCarpeta = this._sanitizarNombreCarpeta(nombreEstudiante);
    const queryDrive = [
      "mimeType = 'application/vnd.google-apps.folder'",
      `name = '${this._escaparQueryDrive(nombreCarpeta)}'`,
      `'${DRIVE_CONFIG.FOLDER_ID}' in parents`,
      'trashed = false',
    ].join(' and ');

    const existentes = await DriveAuthModel.gapiDrive('buscar carpeta de estudiante', () =>
      window.gapi.client.drive.files.list({
        q:        queryDrive,
        spaces:   'drive',
        pageSize: 1,
        fields:   'files(id,name)',
      })
    );

    const carpetaExistente = existentes.result?.files?.[0];
    if (carpetaExistente?.id) return carpetaExistente.id;

    const creada = await DriveAuthModel.gapiDrive(
      'crear carpeta de estudiante',
      () => window.gapi.client.drive.files.create({
        resource: {
          name:     nombreCarpeta,
          mimeType: 'application/vnd.google-apps.folder',
          parents:  [DRIVE_CONFIG.FOLDER_ID],
        },
        fields: 'id,name',
      }),
      { reintentos: 0 },
    );

    return creada.result.id;
  },

  async _asegurarAccesoPrivadoTramite({ folderId, fileId, email, nombreCarpeta }) {
    const correo = this._normalizarCorreo(email);
    const mensaje = [
      `La JAL Comuna 3 compartio contigo la carpeta de tramites${nombreCarpeta ? ` de ${nombreCarpeta}` : ''}.`,
      'El acceso queda restringido a este correo y a las personas que ya tengan permisos privados en Drive.',
    ].join('\n\n');

    await this._quitarPermisosPublicos(fileId);

    if (folderId && folderId !== DRIVE_CONFIG.FOLDER_ID) {
      await this._quitarPermisosPublicos(folderId);
      await this._compartirDriveConCorreo(folderId, correo, {
        notificar: DRIVE_CONFIG.TRAMITES_SEND_SHARE_EMAIL !== false,
        emailMessage: mensaje,
      });
    }

    await this._compartirDriveConCorreo(fileId, correo, {
      notificar: false,
    });
  },

  async _quitarPermisosPublicos(fileId) {
    if (!fileId) return;

    try {
      const respuesta = await DriveAuthModel.gapiDrive('listar permisos publicos de Drive', () =>
        window.gapi.client.drive.permissions.list({
          fileId,
          fields: 'permissions(id,type,role,emailAddress,deleted,permissionDetails)',
          supportsAllDrives: true,
        })
      );

      const permisosPublicos = (respuesta.result?.permissions || []).filter((permiso) =>
        !permiso.deleted && ['anyone', 'domain'].includes(permiso.type)
      );

      for (const permiso of permisosPublicos) {
        try {
          await DriveAuthModel.gapiDrive('quitar permiso publico de Drive', () =>
            window.gapi.client.drive.permissions.delete({
              fileId,
              permissionId: permiso.id,
              supportsAllDrives: true,
            })
          );
        } catch (err) {
          console.warn('[ArchivoModel._quitarPermisosPublicos] No se pudo quitar un permiso publico de Drive', err);
        }
      }
    } catch (err) {
      console.warn('[ArchivoModel._quitarPermisosPublicos] No se pudieron revisar permisos de Drive', err);
    }
  },

  async _compartirDriveConCorreo(fileId, email, opciones = {}) {
    const correo = this._normalizarCorreo(email);
    if (!fileId || !correo) return;

    try {
      const existentes = await DriveAuthModel.gapiDrive('listar permisos privados de Drive', () =>
        window.gapi.client.drive.permissions.list({
          fileId,
          fields: 'permissions(id,type,role,emailAddress,deleted)',
          supportsAllDrives: true,
        })
      );

      const yaCompartido = (existentes.result?.permissions || []).some((permiso) =>
        !permiso.deleted &&
        ['user', 'group'].includes(permiso.type) &&
        String(permiso.emailAddress || '').toLowerCase() === correo.toLowerCase()
      );

      if (yaCompartido) return;

      const params = {
        fileId,
        sendNotificationEmail: Boolean(opciones.notificar),
        supportsAllDrives: true,
        fields: 'id',
        resource: {
          role: opciones.role || 'reader',
          type: 'user',
          emailAddress: correo,
        },
      };

      if (params.sendNotificationEmail && opciones.emailMessage) {
        params.emailMessage = opciones.emailMessage;
      }

      await DriveAuthModel.gapiDrive('compartir recurso de Drive por correo', () =>
        window.gapi.client.drive.permissions.create(params)
      );
    } catch (err) {
      console.warn('[ArchivoModel._compartirDriveConCorreo] No se pudo compartir el recurso de Drive por correo', err);
    }
  },

  _normalizarCorreo(email) {
    const correo = String(email || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ? correo : '';
  },

  /**
   * Limpia caracteres no validos para nombres de carpeta en Drive.
   *
   * @param {string} nombre
   * @returns {string}
   * @private
   */
  _sanitizarNombreCarpeta(nombre) {
    return (nombre || 'Estudiante')
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 100)
      || 'Estudiante';
  },

  /**
   * Escapa valores usados dentro del parametro q de Drive API.
   *
   * @param {string} valor
   * @returns {string}
   * @private
   */
  _escaparQueryDrive(valor) {
    return String(valor).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  },

  /**
   * Registra una nueva solicitud de carta con estado "Pendiente".
   *
   * @param {Object} datos
   * @returns {Promise<string>} ID del documento creado
   */
  async registrarSolicitud(datos) {
    const ref = await addDoc(collection(db, COL_ARCHIVOS), {
      uid_estudiante:        datos.uid_estudiante,
      nombre_completo:       datos.nombre_completo,
      tipo_documento:        datos.tipo_documento,
      numero_documento:      datos.numero_documento,
      ciudad_documento:      datos.ciudad_documento,
      universidad:           datos.universidad,
      carrera:               datos.carrera,
      semestre_actual:       datos.semestre_actual,
      horas_a_realizar:      datos.horas_a_realizar,
      lugar_realizacion:     datos.lugar_realizacion,
      estado:                ESTADOS_TRAMITE.PENDIENTE,
      fecha_solicitud:       serverTimestamp(),
      fecha_resolucion:      null,
      sugerencia_correccion: null,
      fecha_sugerencia_correccion: null,
      uid_edil_revision:     null,
      documento_expedido_id: null,
      documento_expedido_url: null,
      finalizacion_solicitada: false,
      finalizacion_estado:    null,
      fecha_solicitud_finalizacion: null,
      fecha_expedicion_finalizacion: null,
      finalizacion_sugerencia_correccion: null,
      fecha_sugerencia_finalizacion: null,
      uid_edil_revision_finalizacion: null,
      documento_finalizacion_id: null,
      documento_finalizacion_url: null,
    });
    return ref.id;
  },

  /**
   * Obtiene todos los tramites de un estudiante, del mas reciente al mas antiguo.
   *
   * @param {string} uidEstudiante
   * @returns {Promise<Tramite[]>}
   */
  async getTramitesPorEstudiante(uidEstudiante) {
    const q    = query(
      collection(db, COL_ARCHIVOS),
      where('uid_estudiante', '==', uidEstudiante),
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => this._ocultarDocumentosPrivados({ id: d.id, ...d.data() }));
    docs.sort((a, b) => this._fechaMs(b.fecha_solicitud) - this._fechaMs(a.fecha_solicitud));
    return docs;
  },

  /**
   * Obtiene todos los trámites (panel admin).
   *
   * @returns {Promise<Tramite[]>}
   */
  async getAllTramites() {
    const q    = query(
      collection(db, COL_ARCHIVOS),
      orderBy('fecha_solicitud', 'desc'),
    );
    const snap = await getDocs(q);
    const tramites = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    try {
      await this._migrarDocumentosPrivadosSiHaceFalta(tramites);
      return await this._adjuntarDocumentosPrivados(tramites);
    } catch (err) {
      console.warn('[ArchivoModel.getAllTramites] No se pudieron adjuntar documentos privados', err);
      return tramites;
    }
  },

  /**
   * Actualiza el estado de un trámite.
   *
   * @param {string} tramiteId
   * @param {string} nuevoEstado
   * @returns {Promise<void>}
   */
  async actualizarEstado(tramiteId, nuevoEstado) {
    await updateDoc(doc(db, COL_ARCHIVOS, tramiteId), {
      estado:          nuevoEstado,
      fecha_resolucion: serverTimestamp(),
    });
  },

  /**
   * Rechaza una carta barrial y registra la sugerencia visible para el estudiante.
   *
   * @param {string} tramiteId
   * @param {string} sugerenciaCorreccion
   * @param {string} uidEdil
   * @returns {Promise<void>}
   */
  async rechazarTramite(tramiteId, sugerenciaCorreccion, uidEdil) {
    await updateDoc(doc(db, COL_ARCHIVOS, tramiteId), {
      estado:                       ESTADOS_TRAMITE.RECHAZADO,
      fecha_resolucion:             serverTimestamp(),
      sugerencia_correccion:        this._normalizarSugerencia(sugerenciaCorreccion),
      fecha_sugerencia_correccion:  serverTimestamp(),
      uid_edil_revision:            uidEdil,
    });
  },

  /**
   * Marca un trámite como expedido y guarda los datos de Drive en colección privada.
   *
   * @param {string} tramiteId
   * @param {string} driveFileId
   * @param {string} driveViewUrl
   * @returns {Promise<void>}
   */
  async expedirTramite(tramiteId, driveFileId, driveViewUrl) {
    const batch = writeBatch(db);
    const tramiteRef = doc(db, COL_ARCHIVOS, tramiteId);
    const documentoRef = doc(db, COL_DOCUMENTOS_CARTAS, tramiteId);

    batch.set(documentoRef, {
      tramite_id: tramiteId,
      documento_expedido_id: driveFileId,
      documento_expedido_url: driveViewUrl,
      actualizado_en: serverTimestamp(),
    }, { merge: true });

    batch.update(tramiteRef, {
      estado:                 ESTADOS_TRAMITE.EXPEDIDA,
      documento_expedido_id:  null,
      documento_expedido_url: null,
      fecha_resolucion:       serverTimestamp(),
    });

    await batch.commit();
  },

  /**
   * Registra que el estudiante solicito la carta de finalizacion.
   *
   * @param {string} tramiteId
   * @returns {Promise<void>}
   */
  async solicitarFinalizacion(tramiteId) {
    await updateDoc(doc(db, COL_ARCHIVOS, tramiteId), {
      finalizacion_solicitada: true,
      finalizacion_estado: 'Pendiente',
      fecha_solicitud_finalizacion: serverTimestamp(),
    });
  },

  /**
   * Marca la carta de finalizacion como expedida y guarda los datos de Drive en colección privada.
   *
   * @param {string} tramiteId
   * @param {string} driveFileId
   * @param {string} driveViewUrl
   * @returns {Promise<void>}
   */
  async expedirFinalizacion(tramiteId, driveFileId, driveViewUrl) {
    const batch = writeBatch(db);
    const tramiteRef = doc(db, COL_ARCHIVOS, tramiteId);
    const documentoRef = doc(db, COL_DOCUMENTOS_CARTAS, tramiteId);

    batch.set(documentoRef, {
      tramite_id: tramiteId,
      documento_finalizacion_id: driveFileId,
      documento_finalizacion_url: driveViewUrl,
      actualizado_en: serverTimestamp(),
    }, { merge: true });

    batch.update(tramiteRef, {
      finalizacion_solicitada: true,
      finalizacion_estado: 'Expedida',
      documento_finalizacion_id: null,
      documento_finalizacion_url: null,
      fecha_expedicion_finalizacion: serverTimestamp(),
    });

    await batch.commit();
  },

  /**
   * Rechaza la carta de finalizacion y registra la sugerencia visible.
   *
   * @param {string} tramiteId
   * @param {string} sugerenciaCorreccion
   * @param {string} uidEdil
   * @returns {Promise<void>}
   */
  async rechazarFinalizacion(tramiteId, sugerenciaCorreccion, uidEdil) {
    await updateDoc(doc(db, COL_ARCHIVOS, tramiteId), {
      finalizacion_estado: 'Rechazada',
      finalizacion_sugerencia_correccion: this._normalizarSugerencia(sugerenciaCorreccion),
      fecha_sugerencia_finalizacion: serverTimestamp(),
      uid_edil_revision_finalizacion: uidEdil,
    });
  },

  /**
   * Listener en tiempo real para todos los trámites.
   *
   * @param {function(Tramite[]): void} callback
   * @returns {function} unsubscribe
   */
  onSnapshotAll(callback) {
    const q = query(
      collection(db, COL_ARCHIVOS),
      orderBy('fecha_solicitud', 'desc'),
    );
    return onSnapshot(q, async (snap) => {
      const tramites = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      try {
        await this._migrarDocumentosPrivadosSiHaceFalta(tramites);
        callback(await this._adjuntarDocumentosPrivados(tramites));
      } catch (err) {
        console.warn('[ArchivoModel.onSnapshotAll] No se pudieron adjuntar documentos privados', err);
        callback(tramites);
      }
    });
  },

  /**
   * Adjunta a cada tramite los enlaces privados de Drive. Solo debe llamarse
   * desde flujos del Edil, porque la colección privada no es legible por estudiantes.
   * @private
   */
  async _adjuntarDocumentosPrivados(tramites) {
    return Promise.all(tramites.map(async (tramite) => {
      const snap = await getDoc(doc(db, COL_DOCUMENTOS_CARTAS, tramite.id));
      if (!snap.exists()) return tramite;
      return { ...tramite, ...snap.data() };
    }));
  },

  /**
   * Migra enlaces antiguos que quedaron en documentos legibles por estudiantes
   * hacia la colección privada del Edil y limpia el documento público.
   * @private
   */
  async _migrarDocumentosPrivadosSiHaceFalta(tramites) {
    const pendientes = tramites.filter((tramite) =>
      tramite.documento_expedido_id ||
      tramite.documento_expedido_url ||
      tramite.documento_finalizacion_id ||
      tramite.documento_finalizacion_url
    );

    if (!pendientes.length) return;

    await Promise.all(pendientes.map(async (tramite) => {
      const payload = {
        tramite_id: tramite.id,
        actualizado_en: serverTimestamp(),
      };

      if (tramite.documento_expedido_id || tramite.documento_expedido_url) {
        payload.documento_expedido_id = tramite.documento_expedido_id || null;
        payload.documento_expedido_url = tramite.documento_expedido_url || null;
      }

      if (tramite.documento_finalizacion_id || tramite.documento_finalizacion_url) {
        payload.documento_finalizacion_id = tramite.documento_finalizacion_id || null;
        payload.documento_finalizacion_url = tramite.documento_finalizacion_url || null;
      }

      await setDoc(doc(db, COL_DOCUMENTOS_CARTAS, tramite.id), payload, { merge: true });
      await updateDoc(doc(db, COL_ARCHIVOS, tramite.id), {
        documento_expedido_id: null,
        documento_expedido_url: null,
        documento_finalizacion_id: null,
        documento_finalizacion_url: null,
      });
    }));
  },

  /**
   * Limpia cualquier referencia a documentos de Drive antes de entregar datos
   * al perfil del estudiante.
   * @private
   */
  _ocultarDocumentosPrivados(tramite) {
    return {
      ...tramite,
      documento_expedido_id: null,
      documento_expedido_url: null,
      documento_finalizacion_id: null,
      documento_finalizacion_url: null,
    };
  },

  /**
   * Convierte un Timestamp de Firestore a milisegundos.
   * @private
   */
  _fechaMs(ts) {
    if (!ts) return 0;
    if (ts.toMillis) return ts.toMillis();
    return new Date(ts).getTime();
  },

  /**
   * Normaliza espacios y limita el texto de revision guardado en Firestore.
   * @private
   */
  _normalizarSugerencia(valor) {
    return String(valor || '').trim().replace(/\s+/g, ' ').slice(0, 1000);
  },
};

export default ArchivoModel;
