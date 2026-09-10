/**
 * @fileoverview Nombres centralizados de colecciones y constantes de dominio.
 *
 * Usar estas constantes evita strings duplicados en modelos, vistas y reglas.
 *
 * @module config/collections
 */

/** Coleccion de usuarios (perfiles y roles). */
export const COL_USERS = 'users';

/** Coleccion de noticias de la JAL. */
export const COL_NOTICIAS = 'noticias';

/** Coleccion de eventos de la JAL. */
export const COL_EVENTOS = 'eventos';

/** Coleccion de tramites / info carta inicial estudiantiles. */
export const COL_ARCHIVOS = 'info_carta_inicial';

/** Coleccion privada con IDs y enlaces de cartas expedidas. Solo Edil. */
export const COL_DOCUMENTOS_CARTAS = 'info_carta_documentos';

/** Solicitudes publicas para crear accesos de estudiantes. */
export const COL_SOLICITUDES_ACCESO = 'solicitudes_acceso';

/**
 * Roles del sistema.
 * Deben coincidir exactamente con el valor del campo `rol` en Firestore.
 */
export const ROLES = {
  /** Edil de la JAL - acceso total. */
  EDIL:       'edil',
  /** Estudiante - gestiona su propio tramite. */
  ESTUDIANTE: 'estudiante',
  /** Publico general - solo lectura (sin sesion). */
  PUBLICO:    'publico',
};

/** Tipos de documento permitidos para perfiles de usuarios. */
export const TIPOS_DOCUMENTO = ['CC', 'CE', 'PPT', 'PA'];

/** Estados del flujo de solicitudes publicas de acceso. */
export const ESTADOS_SOLICITUD_ACCESO = {
  PENDIENTE: 'Pendiente',
  APROBADA:  'Aprobada',
  RECHAZADA: 'Rechazada',
};

/**
 * Estados posibles de un tramite estudiantil.
 */
export const ESTADOS_TRAMITE = {
  PENDIENTE: 'Pendiente',
  APROBADO:  'Aprobado',
  RECHAZADO: 'Rechazado',
  EXPEDIDA:  'Expedida',
};
