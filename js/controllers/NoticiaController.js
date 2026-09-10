/**
 * @fileoverview NoticiaController — Orquesta operaciones de noticias.
 * Recibe eventos de las vistas, llama a NoticiaModel y devuelve resultados.
 * No toca Firebase directamente; no renderiza HTML.
 *
 * @module controllers/NoticiaController
 */

import NoticiaModel from '../models/NoticiaModel.js';
import NoticiaMediaModel from '../models/NoticiaMediaModel.js';
import AuthModel    from '../models/AuthModel.js';
import { i18n }     from '../config/i18n.js';

const MAX_TITULO_NOTICIA = 200;
const MAX_CUERPO_NOTICIA = 12000;

const NoticiaController = {
  /**
   * Obtiene todas las noticias para mostrar en la vista pública o admin.
   *
   * @param {Object}   callbacks
   * @param {function} callbacks.onLoading - (bool) Indicador de carga
   * @param {function} callbacks.onSuccess - (Noticia[]) Noticias cargadas
   * @param {function} callbacks.onError   - (string) Mensaje de error
   * @param {number}   [limite=50]         - Número máximo de noticias
   * @returns {Promise<void>}
   */
  async listar({ onLoading, onSuccess, onError }, limite = 50) {
    onLoading(true);
    try {
      const noticias = await NoticiaModel.getAll(limite);
      onSuccess(noticias);
    } catch (err) {
      console.error('[NoticiaController.listar]', err);
      onError(i18n.app.errorGenerico);
    } finally {
      onLoading(false);
    }
  },

  /**
   * Obtiene el detalle de una noticia por su ID.
   *
   * @param {string}   id        - ID de la noticia en Firestore
   * @param {Object}   callbacks
   * @param {function} callbacks.onLoading
   * @param {function} callbacks.onSuccess - (Noticia) Noticia encontrada
   * @param {function} callbacks.onError   - (string) Error o 'no encontrada'
   * @returns {Promise<void>}
   */
  async obtenerDetalle(id, { onLoading, onSuccess, onError }) {
    onLoading(true);
    try {
      const noticia = await NoticiaModel.getById(id);
      if (!noticia) {
        onError('Noticia no encontrada.');
        return;
      }
      onSuccess(noticia);
    } catch (err) {
      console.error('[NoticiaController.obtenerDetalle]', err);
      onError(i18n.app.errorGenerico);
    } finally {
      onLoading(false);
    }
  },

  /**
   * Crea una nueva noticia. Solo permite usuarios con rol Edil.
   *
   * @param {Object}   datos             - Datos del formulario
   * @param {string}   datos.titulo      - Título de la noticia
   * @param {string}   datos.cuerpo      - Contenido de la noticia
   * @param {File}     datos.mediaFile   - Imagen o video de la noticia
   * @param {Object}   callbacks
   * @param {function} callbacks.onLoading
   * @param {function} callbacks.onSuccess - (string) ID del documento creado
   * @param {function} callbacks.onError   - (string) Mensaje de error
   * @returns {Promise<void>}
   */
  async crear(datos, { onLoading, onSuccess, onError }) {
    const datosLimpios = this._normalizarDatos(datos);

    if (!this._validarCampos(datosLimpios)) {
      onError(i18n.noticias.camposRequeridos);
      return;
    }

    if (!this._validarLongitudes(datosLimpios)) {
      onError(i18n.noticias.textoMuyLargo);
      return;
    }

    if (!datosLimpios.mediaFile) {
      onError(i18n.noticias.archivoRequerido);
      return;
    }

    try {
      NoticiaMediaModel.validarArchivo(datosLimpios.mediaFile);
    } catch (err) {
      onError(err?.message || i18n.noticias.errorGuardar);
      return;
    }

    const sesion = AuthModel.getSesion();
    if (!sesion) {
      onError(i18n.auth.accesoDenegado);
      return;
    }

    onLoading(true);
    let noticiaId = null;
    let mediaDriveId = null;
    let mediaFolderId = null;
    try {
      noticiaId = await NoticiaModel.create({
        titulo:     datosLimpios.titulo,
        cuerpo:     datosLimpios.cuerpo,
        autorId:    sesion.uid,
      });

      const media = await NoticiaMediaModel.subirContenidoNoticia(datosLimpios.mediaFile, {
        id: noticiaId,
        titulo: datosLimpios.titulo,
      });
      mediaDriveId = media.media_drive_id;
      mediaFolderId = media.media_folder_id;

      await NoticiaModel.updateMedia(noticiaId, media);
      onSuccess(noticiaId);
    } catch (err) {
      console.error('[NoticiaController.crear]', err);
      if (noticiaId) {
        await this._rollbackCrearNoticia(noticiaId, mediaDriveId, mediaFolderId);
      }
      onError(err?.message || i18n.noticias.errorGuardar);
    } finally {
      onLoading(false);
    }
  },

  /**
   * Actualiza una noticia existente.
   *
   * @param {string}   id                - ID del documento en Firestore
   * @param {Object}   datos             - Campos a actualizar
   * @param {Object}   callbacks
   * @param {function} callbacks.onLoading
   * @param {function} callbacks.onSuccess
   * @param {function} callbacks.onError
   * @returns {Promise<void>}
   */
  async actualizar(id, datos, { onLoading, onSuccess, onError }) {
    const datosLimpios = this._normalizarDatos(datos);

    if (!this._validarCampos(datosLimpios)) {
      onError(i18n.noticias.camposRequeridos);
      return;
    }

    if (!this._validarLongitudes(datosLimpios)) {
      onError(i18n.noticias.textoMuyLargo);
      return;
    }

    if (datosLimpios.mediaFile) {
      try {
        NoticiaMediaModel.validarArchivo(datosLimpios.mediaFile);
      } catch (err) {
        onError(err?.message || i18n.noticias.errorGuardar);
        return;
      }
    }

    onLoading(true);
    try {
      const noticiaActual = await NoticiaModel.getById(id);
      await NoticiaModel.update(id, {
        titulo:     datosLimpios.titulo,
        cuerpo:     datosLimpios.cuerpo,
      });

      if (datosLimpios.mediaFile) {
        const media = await NoticiaMediaModel.subirContenidoNoticia(datosLimpios.mediaFile, {
          ...noticiaActual,
          id,
          titulo: datosLimpios.titulo,
        });
        await NoticiaModel.updateMedia(id, media);
      }

      onSuccess();
    } catch (err) {
      console.error('[NoticiaController.actualizar]', err);
      onError(err?.message || i18n.noticias.errorGuardar);
    } finally {
      onLoading(false);
    }
  },

  /**
   * Elimina una noticia de Firestore.
   *
   * @param {string}   id       - ID del documento a eliminar
   * @param {Object}   callbacks
   * @param {function} callbacks.onLoading
   * @param {function} callbacks.onSuccess
   * @param {function} callbacks.onError
   * @returns {Promise<void>}
   */
  async eliminar(id, { onLoading, onSuccess, onError }) {
    onLoading(true);
    try {
      const noticia = await NoticiaModel.getById(id);
      await NoticiaModel.delete(id);
      if (noticia?.media_drive_id || noticia?.media_folder_id) {
        try {
          await NoticiaMediaModel.eliminarContenidoNoticia({
            fileId: noticia.media_drive_id,
            folderId: noticia.media_folder_id,
          });
        } catch (mediaErr) {
          console.warn('[NoticiaController.eliminar] No se pudo eliminar todo el contenido de Drive', mediaErr);
        }
      }
      onSuccess();
    } catch (err) {
      console.error('[NoticiaController.eliminar]', err);
      onError(i18n.noticias.errorEliminar);
    } finally {
      onLoading(false);
    }
  },

  /**
   * Suscribe un listener en tiempo real a la colección de noticias.
   *
   * @param {function(import('../models/NoticiaModel.js').Noticia[]): void} callback
   * @returns {function} Función unsubscribe
   */
  suscribirTiempoReal(callback) {
    return NoticiaModel.onSnapshot(callback);
  },

  // ─── Privado: validación de formulario ───────────────────────────────
  /**
   * Valida que los campos obligatorios de una noticia no estén vacíos.
   *
   * @private
   * @param {Object} datos
   * @returns {boolean}
   */
  _validarCampos(datos) {
    return Boolean(datos?.titulo?.trim() && datos?.cuerpo?.trim());
  },

  /**
   * Normaliza los valores de formulario antes de validarlos/guardarlos.
   *
   * @private
   * @param {Object} datos
   * @returns {Object}
   */
  _normalizarDatos(datos) {
    return {
      ...datos,
      titulo: String(datos?.titulo || '').trim(),
      cuerpo: String(datos?.cuerpo || '').trim(),
      mediaFile: datos?.mediaFile || null,
    };
  },

  /**
   * Evita guardar textos accidentalmente enormes.
   *
   * @private
   * @param {Object} datos
   * @returns {boolean}
   */
  _validarLongitudes(datos) {
    return datos.titulo.length <= MAX_TITULO_NOTICIA
      && datos.cuerpo.length <= MAX_CUERPO_NOTICIA;
  },

  /**
   * Limpia una noticia creada si falla la subida/registro del archivo.
   *
   * @private
   */
  async _rollbackCrearNoticia(noticiaId, mediaDriveId, mediaFolderId = null) {
    try {
      if (mediaDriveId || mediaFolderId) {
        await NoticiaMediaModel.eliminarContenidoNoticia({
          fileId: mediaDriveId,
          folderId: mediaFolderId,
        });
      }
      await NoticiaModel.delete(noticiaId);
    } catch (err) {
      console.warn('[NoticiaController._rollbackCrearNoticia] No se pudo revertir la noticia incompleta', err);
    }
  },
};

export default NoticiaController;
