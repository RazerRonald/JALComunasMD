/**
 * @fileoverview NoticiaModel — CRUD de noticias en Firestore.
 * Habla ÚNICAMENTE con Firestore. No toca el DOM.
 *
 * Colección: `noticias`
 * Estructura de documento:
 * {
 *   id:              string (generado por Firestore),
 *   titulo:          string,
 *   cuerpo:          string,
 *   fechaPublicacion: Timestamp,
 *   autorId:         string (uid del Edil),
 *   media_drive_id:  string | null,
 *   media_tipo:      'imagen' | 'video' | null,
 *   media_url:       string | null,
 *   media_embed_url: string | null,
 *   media_view_url:  string | null,
 *   media_mime:      string | null,
 *   media_nombre:    string | null,
 *   media_folder_id: string | null
 * }
 *
 * @module models/NoticiaModel
 */

import { db }                 from '../config/firebase.config.js';
import { COL_NOTICIAS }       from '../config/collections.js';
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
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/**
 * @typedef {Object} Noticia
 * @property {string}    id              - ID del documento en Firestore
 * @property {string}    titulo          - Título de la noticia
 * @property {string}    cuerpo          - Cuerpo completo de la noticia
 * @property {import('firebase/firestore').Timestamp} fechaPublicacion - Fecha de publicación
 * @property {string}    autorId         - UID del edil autor
 * @property {string|null} media_drive_id
 * @property {string|null} media_tipo
 * @property {string|null} media_url
 * @property {string|null} media_embed_url
 * @property {string|null} media_view_url
 * @property {string|null} media_mime
 * @property {string|null} media_nombre
 * @property {string|null} media_folder_id
 */

const NoticiaModel = {
  /**
   * Obtiene todas las noticias ordenadas por fecha de publicación descendente.
   *
   * @param {number} [limite=50] - Número máximo de noticias a obtener
   * @returns {Promise<Noticia[]>} Array de noticias
   */
  async getAll(limite = 50) {
    const q    = query(
      collection(db, COL_NOTICIAS),
      orderBy('fechaPublicacion', 'desc'),
      limit(limite),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  /**
   * Obtiene una noticia específica por su ID.
   *
   * @param {string} id - ID del documento en Firestore
   * @returns {Promise<Noticia|null>} La noticia o null si no existe
   */
  async getById(id) {
    const snap = await getDoc(doc(db, COL_NOTICIAS, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  /**
   * Crea una nueva noticia en Firestore.
   *
   * @param {Object} datos              - Datos de la noticia
   * @param {string} datos.titulo       - Título
   * @param {string} datos.cuerpo       - Contenido
   * @param {string} datos.autorId      - UID del edil autor
   * @returns {Promise<string>} ID del documento creado
   */
  async create({ titulo, cuerpo, autorId }) {
    const ref = await addDoc(collection(db, COL_NOTICIAS), {
      titulo,
      cuerpo,
      autorId,
      fechaPublicacion: serverTimestamp(),
      media_drive_id:  null,
      media_tipo:      null,
      media_url:       null,
      media_embed_url: null,
      media_view_url:  null,
      media_mime:      null,
      media_nombre:    null,
      media_folder_id: null,
    });
    return ref.id;
  },

  /**
   * Actualiza una noticia existente en Firestore.
   * Solo actualiza los campos proporcionados.
   *
   * @param {string} id                        - ID del documento a actualizar
   * @param {Partial<Omit<Noticia,'id'>>} datos - Campos a actualizar
   * @returns {Promise<void>}
   */
  async update(id, datos) {
    const ref = doc(db, COL_NOTICIAS, id);
    await updateDoc(ref, {
      ...datos,
      fechaActualizacion: serverTimestamp(),
    });
  },

  /**
   * Guarda los metadatos del archivo multimedia asociado a la noticia.
   *
   * @param {string} id
   * @param {Object} media
   * @returns {Promise<void>}
   */
  async updateMedia(id, media) {
    const ref = doc(db, COL_NOTICIAS, id);
    await updateDoc(ref, {
      media_drive_id:  media.media_drive_id || null,
      media_tipo:      media.media_tipo || null,
      media_url:       media.media_url || null,
      media_embed_url: media.media_embed_url || null,
      media_view_url:  media.media_view_url || null,
      media_mime:      media.media_mime || null,
      media_nombre:    media.media_nombre || null,
      media_folder_id: media.media_folder_id || null,
      fechaActualizacion: serverTimestamp(),
    });
  },

  /**
   * Elimina una noticia de Firestore.
   *
   * @param {string} id - ID del documento a eliminar
   * @returns {Promise<void>}
   */
  async delete(id) {
    await deleteDoc(doc(db, COL_NOTICIAS, id));
  },

  /**
   * Suscribe un listener en tiempo real a la colección de noticias.
   * Útil para el panel de admin que necesita conteos en vivo.
   *
   * @param {function(Noticia[]): void} callback - Función llamada en cada cambio
   * @returns {function} Función unsubscribe para cancelar la suscripción
   */
  onSnapshot(callback) {
    const q = query(
      collection(db, COL_NOTICIAS),
      orderBy('fechaPublicacion', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      const noticias = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(noticias);
    });
  },
};

export default NoticiaModel;
