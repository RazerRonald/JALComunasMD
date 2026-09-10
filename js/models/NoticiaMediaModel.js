/**
 * @fileoverview Gestion de imagenes y videos de noticias en Google Drive.
 *
 * Usa una carpeta independiente llamada ContenidoJAL para el contenido publico
 * de noticias y crea una subcarpeta por cada noticia.
 *
 * @module models/NoticiaMediaModel
 */

import { DRIVE_CONFIG } from '../config/firebase.config.js';
import DriveAuthModel from './DriveAuthModel.js';

const CARPETA_CONTENIDO = 'ContenidoJAL';
const MIME_FOLDER = 'application/vnd.google-apps.folder';
const TIPOS_PERMITIDOS = ['image/', 'video/'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const NoticiaMediaModel = {
  /**
   * Valida el archivo antes de crear o actualizar la noticia.
   *
   * @param {File} archivo
   * @returns {void}
   */
  validarArchivo(archivo) {
    this._validarArchivo(archivo);
  },

  /**
   * Sube o reemplaza el archivo multimedia de una noticia.
   *
   * @param {File} archivo
   * @param {Object} noticia
   * @returns {Promise<Object>}
   */
  async subirContenidoNoticia(archivo, noticia) {
    this.validarArchivo(archivo);
    return DriveAuthModel.ejecutarEnCola('subir contenido de noticia a Drive', () =>
      this._subirContenidoNoticiaInterno(archivo, noticia)
    );
  },

  async _subirContenidoNoticiaInterno(archivo, noticia) {
    await this._solicitarToken();

    const carpetaRaizId = await this._obtenerCarpetaContenido();
    const carpetaNoticiaId = await this._obtenerOCrearCarpeta(
      this._buildNombreCarpetaNoticia(noticia),
      carpetaRaizId,
    );
    const nombreArchivo = this._buildNombreArchivo(archivo, noticia);

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({
      name: nombreArchivo,
      parents: [carpetaNoticiaId],
    })], { type: 'application/json' }));
    form.append('file', archivo);

    const respuesta = await DriveAuthModel.fetchDrive(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,thumbnailLink',
      {
        method: 'POST',
        body: form,
      },
      { nombre: 'subir contenido de noticia a Drive', reintentos: 0 },
    );

    const file = await respuesta.json();

    await DriveAuthModel.gapiDrive('publicar contenido de noticia en Drive', () =>
      window.gapi.client.drive.permissions.create({
        fileId: file.id,
        resource: { role: 'reader', type: 'anyone' },
      })
    );

    const esVideo = archivo.type.startsWith('video/');

    if (noticia.media_drive_id && noticia.media_drive_id !== file.id) {
      await this._eliminarArchivoSiExiste(noticia.media_drive_id);
    }

    return {
      media_drive_id: file.id,
      media_folder_id: carpetaNoticiaId,
      media_nombre: file.name || nombreArchivo,
      media_mime: file.mimeType || archivo.type,
      media_tipo: esVideo ? 'video' : 'imagen',
      media_url: this._buildThumbnailUrl(file.id, esVideo ? 900 : 1200),
      media_view_url: file.webViewLink || '',
      media_embed_url: `https://drive.google.com/file/d/${file.id}/preview`,
    };
  },

  /**
   * Elimina el archivo y la subcarpeta de Drive asociados a una noticia.
   *
   * @param {Object} contenido
   * @param {string|null} contenido.fileId
   * @param {string|null} contenido.folderId
   * @returns {Promise<void>}
   */
  async eliminarContenidoNoticia({ fileId, folderId } = {}) {
    const archivoId = String(fileId || '').trim();
    const carpetaId = String(folderId || '').trim();

    if (!archivoId && !carpetaId) return;

    return DriveAuthModel.ejecutarEnCola('eliminar carpeta de noticia en Drive', async () => {
      await this._solicitarToken();
      if (archivoId) await this._eliminarArchivoSiExiste(archivoId);
      if (carpetaId) await this._eliminarCarpetaSiExiste(carpetaId);
    });
  },

  async _obtenerCarpetaContenido() {
    const carpetaConfiguradaId = String(DRIVE_CONFIG.CONTENT_FOLDER_ID || '').trim();
    if (carpetaConfiguradaId) return carpetaConfiguradaId;

    return this._obtenerOCrearCarpeta(CARPETA_CONTENIDO);
  },

  async _solicitarToken() {
    await DriveAuthModel.solicitarToken();
  },

  async _obtenerOCrearCarpeta(nombre, parentId = null) {
    const nombreCarpeta = this._sanitizarNombre(nombre);
    const parentSeguro = String(parentId || '').trim();
    const filtros = [
      `mimeType = '${MIME_FOLDER}'`,
      `name = '${this._escaparQueryDrive(nombreCarpeta)}'`,
      'trashed = false',
    ];

    filtros.push(parentSeguro
      ? `'${this._escaparQueryDrive(parentSeguro)}' in parents`
      : "'root' in parents");

    const queryDrive = filtros.join(' and ');

    const existentes = await DriveAuthModel.gapiDrive('buscar carpeta de contenido JAL', () =>
      window.gapi.client.drive.files.list({
        q: queryDrive,
        spaces: 'drive',
        pageSize: 1,
        fields: 'files(id,name)',
      })
    );

    const carpetaExistente = existentes.result?.files?.[0];
    if (carpetaExistente?.id) return carpetaExistente.id;

    const creada = await DriveAuthModel.gapiDrive(
      'crear carpeta de contenido JAL',
      () => window.gapi.client.drive.files.create({
        resource: {
          name: nombreCarpeta,
          mimeType: MIME_FOLDER,
          ...(parentSeguro ? { parents: [parentSeguro] } : {}),
        },
        fields: 'id,name',
      }),
      { reintentos: 0 },
    );

    return creada.result.id;
  },

  async _eliminarArchivoSiExiste(fileId) {
    try {
      await DriveAuthModel.gapiDrive('eliminar archivo anterior de Drive', () =>
        window.gapi.client.drive.files.delete({ fileId })
      );
    } catch (err) {
      console.warn('[NoticiaMediaModel._eliminarArchivoSiExiste] No se pudo eliminar archivo anterior', err);
    }
  },

  async _eliminarCarpetaSiExiste(folderId) {
    const carpetaContenidoId = String(DRIVE_CONFIG.CONTENT_FOLDER_ID || '').trim();
    if (carpetaContenidoId && folderId === carpetaContenidoId) {
      console.warn('[NoticiaMediaModel._eliminarCarpetaSiExiste] Se omitio eliminar la carpeta raiz de contenido');
      return;
    }

    try {
      await DriveAuthModel.gapiDrive('eliminar carpeta de noticia en Drive', () =>
        window.gapi.client.drive.files.delete({ fileId: folderId })
      );
    } catch (err) {
      console.warn('[NoticiaMediaModel._eliminarCarpetaSiExiste] No se pudo eliminar carpeta de noticia', err);
    }
  },

  _validarArchivo(archivo) {
    if (!archivo || !(archivo instanceof File)) {
      throw new Error('Selecciona una imagen o video para la noticia.');
    }

    const tipoArchivo = String(archivo.type || '').toLowerCase();
    const esVideo = tipoArchivo.startsWith('video/');

    if (!TIPOS_PERMITIDOS.some((tipo) => tipoArchivo.startsWith(tipo))) {
      throw new Error('El archivo de la noticia debe ser una imagen o un video.');
    }

    if (!archivo.size || archivo.size <= 0) {
      throw new Error('El archivo de la noticia esta vacio o no se puede leer.');
    }

    const maxBytes = esVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (archivo.size > maxBytes) {
      throw new Error(`El archivo supera el tamano permitido (${this._formatearBytes(maxBytes)}).`);
    }
  },

  _formatearBytes(bytes) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  },

  _buildNombreCarpetaNoticia(noticia) {
    return `${noticia.titulo || 'Noticia'} - ${noticia.id}`;
  },

  _buildNombreArchivo(archivo, noticia) {
    const extension = this._obtenerExtension(archivo.name);
    return `${this._sanitizarNombre(noticia.titulo || 'Noticia')}${extension}`;
  },

  _buildThumbnailUrl(fileId, size) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
  },

  _obtenerExtension(nombre) {
    const match = String(nombre || '').match(/\.[a-zA-Z0-9]+$/);
    return match ? match[0].toLowerCase() : '';
  },

  _sanitizarNombre(nombre) {
    return (nombre || 'Noticia')
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 100)
      || 'Noticia';
  },

  _escaparQueryDrive(valor) {
    return String(valor).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  },
};

export default NoticiaMediaModel;
