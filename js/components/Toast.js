/**
 * @fileoverview Toast — Componente de notificaciones tipo toast de Bootstrap.
 * Reutilizable, configurable por tipo y mensaje.
 * Solo renderiza HTML e interactúa con Bootstrap Toast API.
 *
 * @module components/Toast
 */

import { i18n } from '../config/i18n.js';

/**
 * @typedef {'success'|'error'|'warning'|'info'} ToastTipo
 */

/** Mapa de iconos por tipo de toast */
const ICONOS = {
  success: 'bi-check-circle-fill',
  error:   'bi-x-circle-fill',
  warning: 'bi-exclamation-triangle-fill',
  info:    'bi-info-circle-fill',
};

/** Mapa de títulos por tipo de toast */
const TITULOS = {
  success: i18n.toast.exito,
  error:   i18n.toast.error,
  warning: i18n.toast.advertencia,
  info:    i18n.toast.info,
};

/** Mapa de colores de icono por tipo */
const COLORES_ICONO = {
  success: 'text-success',
  error:   'text-danger',
  warning: 'text-warning',
  info:    'text-info',
};
