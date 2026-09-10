/**
 * @fileoverview Revision de solicitudes publicas de acceso para ediles.
 *
 * @module views/AdminSolicitudesAccesoView
 */

import SolicitudAccesoController from '../controllers/SolicitudAccesoController.js';
import Toast from '../components/Toast.js';
import { i18n } from '../config/i18n.js';
import { ESTADOS_SOLICITUD_ACCESO } from '../config/collections.js';

const AdminSolicitudesAccesoView = {
  _unsub: null,
  _solicitudes: [],
  _filtro: 'todas',
  _busy: false,
  _onVolverDashboard: null,

  render({ onVolverDashboard } = {}) {
    const root = document.getElementById('app-root');
    if (!root) return;

    this.destruir();
    this._filtro = 'todas';
    this._onVolverDashboard = onVolverDashboard || null;

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/admin" class="text-white-50">Admin</a></li>
              <li class="breadcrumb-item active">${i18n.solicitudAcceso.adminTitulo}</li>
            </ol>
          </nav>
          <h1><i class="bi bi-person-check me-2"></i>${i18n.solicitudAcceso.adminTitulo}</h1>
          <p class="page-hero-sub">${i18n.solicitudAcceso.adminSubtitulo}</p>
        </div>
      </div>

      <div class="container py-5">
        <div class="mb-4">
          <button class="btn-jal-secondary" id="btn-volver-dashboard-solicitudes">
            <i class="bi bi-arrow-left me-1"></i>Panel Admin
          </button>
        </div>

        <div class="solicitudes-acceso-resumen mb-4" aria-label="Resumen de solicitudes">
          ${this._buildResumenItem('pendientes', 'bi-hourglass-split', 'warning', i18n.solicitudAcceso.estadoPendiente)}
          ${this._buildResumenItem('aprobadas', 'bi-check-circle', 'success', i18n.solicitudAcceso.estadoAprobada)}
          ${this._buildResumenItem('rechazadas', 'bi-x-circle', 'danger', i18n.solicitudAcceso.estadoRechazada)}
        </div>

        <section class="form-jal p-0 overflow-hidden" aria-labelledby="solicitudes-acceso-listado-titulo">
          <div class="p-4 border-bottom d-flex align-items-center justify-content-between gap-3 flex-wrap">
            <h2 class="h5 fw-700 mb-0" id="solicitudes-acceso-listado-titulo">
              <i class="bi bi-list-check text-primary me-2"></i>${i18n.solicitudAcceso.listado}
            </h2>
            <div class="d-flex align-items-center gap-2">
              <label for="filtro-solicitudes-acceso" class="small text-muted fw-600">${i18n.solicitudAcceso.filtrar}</label>
              <select id="filtro-solicitudes-acceso" class="form-select form-select-sm solicitudes-acceso-filtro">
                <option value="Procesando">En proceso</option>
                <option value="todas" selected>${i18n.solicitudAcceso.todas}</option>
                <option value="${ESTADOS_SOLICITUD_ACCESO.PENDIENTE}">${i18n.solicitudAcceso.estadoPendiente}</option>
                <option value="${ESTADOS_SOLICITUD_ACCESO.APROBADA}">${i18n.solicitudAcceso.estadoAprobada}</option>
                <option value="${ESTADOS_SOLICITUD_ACCESO.RECHAZADA}">${i18n.solicitudAcceso.estadoRechazada}</option>
              </select>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table table-jal mb-0" aria-label="Solicitudes de acceso">
              <thead>
                <tr>
                  <th scope="col">${i18n.admin.colNombre}</th>
                  <th scope="col">${i18n.admin.usuariosCorreo}</th>
                  <th scope="col">${i18n.admin.colFecha}</th>
                  <th scope="col">${i18n.admin.colEstado}</th>
                  <th scope="col" class="text-end">${i18n.admin.colAcciones}</th>
                </tr>
              </thead>
              <tbody id="tabla-solicitudes-acceso-body">
                <tr><td colspan="5" class="text-center py-5 text-muted">
                  <span class="spinner-border spinner-border-sm text-primary me-2" aria-hidden="true"></span>${i18n.app.cargando}
                </td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      ${this._buildModalConfirmacion()}
    `;

    this._bindEvents();
    this._suscribir();
  },

  destruir() {
    if (typeof this._unsub === 'function') this._unsub();
    this._unsub = null;
  },

  _buildResumenItem(id, icono, color, label) {
    return `
      <div class="solicitudes-acceso-stat">
        <span class="solicitudes-acceso-stat-icon text-${color}" aria-hidden="true"><i class="bi ${icono}"></i></span>
        <span class="solicitudes-acceso-stat-number" id="stat-solicitudes-${id}">0</span>
        <span class="solicitudes-acceso-stat-label">${label}</span>
      </div>
    `;
  },

  _buildModalConfirmacion() {
    return `
      <div class="modal fade modal-jal" id="modal-resolver-solicitud-acceso" tabindex="-1"
           aria-labelledby="modal-resolver-solicitud-titulo" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="modal-resolver-solicitud-titulo"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body" id="modal-resolver-solicitud-body"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${i18n.app.cancelar}</button>
              <button type="button" class="btn btn-primary" id="btn-confirmar-resolver-solicitud">${i18n.app.confirmar}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _bindEvents() {
    document.getElementById('btn-volver-dashboard-solicitudes')?.addEventListener('click', () => {
      this.destruir();
      if (this._onVolverDashboard) this._onVolverDashboard();
      else window.location.hash = '#/admin';
    });

    document.getElementById('filtro-solicitudes-acceso')?.addEventListener('change', (event) => {
      this._filtro = event.target.value;
      this._renderTabla();
    });

    document.getElementById('tabla-solicitudes-acceso-body')?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-id]');
      if (!button || this._busy) return;
      const solicitud = this._solicitudes.find((item) => item.id === button.dataset.id);
      if (!solicitud) return;

      if (button.classList.contains('btn-aprobar-acceso')) this._confirmarAprobacion(solicitud);
      if (button.classList.contains('btn-rechazar-acceso')) this._confirmarRechazo(solicitud);
      if (button.classList.contains('btn-reenviar-acceso')) this._reenviarCorreo(solicitud, button);
      if (button.classList.contains('btn-gmail-acceso')) this._abrirGmail(solicitud);
    });
  },

  _suscribir() {
    this._unsub = SolicitudAccesoController.suscribir(
      (solicitudes) => {
        this._solicitudes = solicitudes;
        this._renderResumen();
        this._renderTabla();
      },
      (mensaje) => {
        this._renderError(mensaje);
        Toast.error(mensaje);
      },
    );
  },

  _renderResumen() {
    const conteos = {
      pendientes: this._solicitudes.filter((item) => ['Pendiente', 'Procesando'].includes(item.estado)).length,
      aprobadas: this._solicitudes.filter((item) => item.estado === ESTADOS_SOLICITUD_ACCESO.APROBADA).length,
      rechazadas: this._solicitudes.filter((item) => item.estado === ESTADOS_SOLICITUD_ACCESO.RECHAZADA).length,
    };

    Object.entries(conteos).forEach(([key, value]) => {
      const element = document.getElementById(`stat-solicitudes-${key}`);
      if (element) element.textContent = String(value);
    });
  },

  _renderTabla() {
    const tbody = document.getElementById('tabla-solicitudes-acceso-body');
    if (!tbody) return;

    const solicitudes = this._filtro === 'todas'
      ? this._solicitudes
      : this._solicitudes.filter((item) => item.estado === this._filtro);

    if (!solicitudes.length) {
      tbody.innerHTML = `
        <tr><td colspan="5" class="text-center py-5 text-muted">
          <i class="bi bi-inbox d-block mb-2 opacity-50" style="font-size:2rem"></i>${i18n.solicitudAcceso.sinSolicitudes}
        </td></tr>
      `;
      return;
    }

    tbody.innerHTML = solicitudes.map((solicitud) => `
      <tr data-id="${this._esc(solicitud.id)}">
        <td>
          <div class="fw-600">${this._esc(this._nombreCompleto(solicitud))}</div>
          <small class="text-muted">
            ${this._esc(solicitud.tipo_documento)} ${this._esc(solicitud.numero_documento)}
            - ${this._esc(solicitud.ciudad_documento)}
          </small>
        </td>
        <td class="small text-muted">${this._esc(solicitud.email)}</td>
        <td class="small text-muted text-nowrap">${this._esc(this._formatearFecha(solicitud.fecha_solicitud))}</td>
        <td>${this._buildEstado(solicitud.estado)}</td>
        <td class="text-end">${this._buildAcciones(solicitud)}</td>
      </tr>
    `).join('');
  },

  _buildEstado(estado) {
    const config = {
      Procesando: ['bg-info-subtle text-info-emphasis', 'En proceso'],
      [ESTADOS_SOLICITUD_ACCESO.PENDIENTE]: ['bg-warning-subtle text-warning-emphasis', i18n.solicitudAcceso.estadoPendiente],
      [ESTADOS_SOLICITUD_ACCESO.APROBADA]: ['bg-success-subtle text-success-emphasis', i18n.solicitudAcceso.estadoAprobada],
      [ESTADOS_SOLICITUD_ACCESO.RECHAZADA]: ['bg-danger-subtle text-danger-emphasis', i18n.solicitudAcceso.estadoRechazada],
    }[estado] || ['bg-secondary-subtle text-secondary-emphasis', estado || '-'];
    return `<span class="badge ${config[0]}">${this._esc(config[1])}</span>`;
  },

  _buildAcciones(solicitud) {
    const id = this._esc(solicitud.id);
    if (solicitud.estado === 'Procesando' || solicitud.activacion_pendiente) {
      return '<button type="button" class="btn btn-sm btn-outline-warning btn-aprobar-acceso" data-id="' + id + '">Reintentar acceso</button>';
    }
    if (solicitud.estado === ESTADOS_SOLICITUD_ACCESO.PENDIENTE) {
      return `
        <div class="d-flex justify-content-end gap-2 flex-wrap">
          <button type="button" class="btn btn-sm btn-outline-success btn-aprobar-acceso" data-id="${id}">
            <i class="bi bi-person-check me-1"></i>${i18n.solicitudAcceso.aprobar}
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger btn-rechazar-acceso" data-id="${id}">
            <i class="bi bi-person-x me-1"></i>${i18n.solicitudAcceso.rechazar}
          </button>
        </div>
      `;
    }

    if (solicitud.estado === ESTADOS_SOLICITUD_ACCESO.APROBADA) {
      return `
        <div class="d-flex justify-content-end gap-2 flex-wrap">
        <span class="small text-muted">Correo: ${this._esc(solicitud.correo_estado || 'Sin confirmar')}</span>
        <button type="button" class="btn btn-sm btn-outline-success btn-reenviar-acceso" data-id="${id}">Reenviar correo de contrasena</button>
        <button type="button" class="btn btn-sm btn-outline-primary btn-gmail-acceso" data-id="${id}">
          <i class="bi bi-envelope-arrow-up me-1"></i>${i18n.solicitudAcceso.enviarCredenciales}
        </button></div>
      `;
    }

    return '<span class="text-muted small">-</span>';
  },

  async _reenviarCorreo(solicitud, button) {
    this._busy = true; button.disabled = true;
    try {
      const result = await SolicitudAccesoController.reenviarCorreo(solicitud);
      if (result.correoEnviado) Toast.exito('Correo de contrasena enviado.');
      else Toast.advertencia('No se pudo enviar el correo. Espera un minuto y reintenta.');
    } catch (error) { Toast.error(error.message); }
    finally { this._busy = false; button.disabled = false; }
  },

  _confirmarAprobacion(solicitud) {
    const body = `
      <p>${i18n.solicitudAcceso.confirmarAprobar.replace('{nombre}', `<strong>${this._esc(this._nombreCompleto(solicitud))}</strong>`)}</p>
      <div class="alert alert-info mb-0 small">
        <i class="bi bi-key me-2"></i>${i18n.solicitudAcceso.passwordDocumento}
      </div>
    `;
    this._mostrarConfirmacion(i18n.solicitudAcceso.aprobarTitulo, body, 'primary', async (modal) => {
      await SolicitudAccesoController.aprobar(solicitud, {
        onLoading: (loading) => this._setModalLoading(loading),
        onSuccess: (resultado) => {
          modal.hide();
          if (resultado.correoEnviado) Toast.exito(i18n.solicitudAcceso.aprobadaOk);
          else Toast.advertencia('Cuenta creada. No se pudo confirmar el envio del correo. Usa Reenviar correo de contrasena.');
        },
        onError: (mensaje) => Toast.error(mensaje),
      });
    });
  },

  _confirmarRechazo(solicitud) {
    const body = `<p class="mb-0">${i18n.solicitudAcceso.confirmarRechazar.replace('{nombre}', `<strong>${this._esc(this._nombreCompleto(solicitud))}</strong>`)}</p>`;
    this._mostrarConfirmacion(i18n.solicitudAcceso.rechazarTitulo, body, 'danger', async (modal) => {
      await SolicitudAccesoController.rechazar(solicitud, {
        onLoading: (loading) => this._setModalLoading(loading),
        onSuccess: () => {
          modal.hide();
          Toast.info(i18n.solicitudAcceso.rechazadaOk);
        },
        onError: (mensaje) => Toast.error(mensaje),
      });
    });
  },

  _mostrarConfirmacion(titulo, body, color, onConfirmar) {
    const modalEl = document.getElementById('modal-resolver-solicitud-acceso');
    const tituloEl = document.getElementById('modal-resolver-solicitud-titulo');
    const bodyEl = document.getElementById('modal-resolver-solicitud-body');
    const button = document.getElementById('btn-confirmar-resolver-solicitud');
    if (!modalEl || !tituloEl || !bodyEl || !button) return;

    tituloEl.textContent = titulo;
    bodyEl.innerHTML = body;
    const nuevoButton = button.cloneNode(true);
    button.parentNode.replaceChild(nuevoButton, button);
    nuevoButton.className = `btn btn-${color}`;
    nuevoButton.textContent = i18n.app.confirmar;

    const modal = new window.bootstrap.Modal(modalEl);
    nuevoButton.addEventListener('click', () => onConfirmar(modal));
    modal.show();
  },

  _setModalLoading(loading) {
    const button = document.getElementById('btn-confirmar-resolver-solicitud');
    if (!button) return;
    button.disabled = loading;
    button.innerHTML = loading
      ? `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${i18n.app.guardando}`
      : i18n.app.confirmar;
  },

  _abrirGmail(solicitud) {
    window.open(
      SolicitudAccesoController.construirGmailUrl(solicitud),
      '_blank',
      'noopener,noreferrer',
    );
  },

  _renderError(mensaje) {
    const tbody = document.getElementById('tabla-solicitudes-acceso-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-danger">${this._esc(mensaje)}</td></tr>`;
  },

  _nombreCompleto(solicitud) {
    return [solicitud.nombre, solicitud.primer_apellido, solicitud.segundo_apellido]
      .filter(Boolean)
      .join(' ');
  },

  _formatearFecha(timestamp) {
    const fecha = timestamp?.toDate ? timestamp.toDate() : timestamp ? new Date(timestamp) : null;
    if (!fecha || Number.isNaN(fecha.getTime())) return '-';
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(fecha);
  },

  _esc(valor) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
};

export default AdminSolicitudesAccesoView;
