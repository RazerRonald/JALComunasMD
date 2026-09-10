/**
 * @fileoverview EstudianteView - Vista de solicitud de carta barrial.
 * Muestra el historial de solicitudes y permite crear varias solicitudes pendientes.
 *
 * @module views/EstudianteView
 */

import ArchivoController   from '../controllers/ArchivoController.js';
import AuthModel           from '../models/AuthModel.js';
import Toast               from '../components/Toast.js';
import { i18n }            from '../config/i18n.js';
import { ESTADOS_TRAMITE } from '../config/collections.js';

const EstudianteView = {
  /**
   * Vista "Mis solicitudes" (#/tramite): historial del estudiante.
   * El formulario de nueva solicitud vive en su propia vista (#/tramite/nueva).
   */
  async renderHistorial() {
    const root   = document.getElementById('app-root');
    const sesion = AuthModel.getSesion();
    if (!root || !sesion) return;

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/inicio" class="text-white-50">Inicio</a></li>
              <li class="breadcrumb-item active">${i18n.tramite.historialTitulo}</li>
            </ol>
          </nav>
          <div class="d-flex justify-content-between align-items-end gap-3 flex-wrap">
            <div>
              <h1><i class="bi bi-list-check me-2"></i>${i18n.tramite.historialTitulo}</h1>
              <p class="page-hero-sub mb-0">Hola, <strong>${this._esc(sesion.nombre)}</strong> - ${i18n.tramite.historialSub}</p>
            </div>
            <a href="#/tramite/nueva" class="btn-jal-primary d-inline-flex align-items-center gap-2">
              <i class="bi bi-plus-lg"></i>${i18n.tramite.solicitarCarta}
            </a>
          </div>
        </div>
      </div>

      <div class="container py-5">
        <div id="tramite-listado-container">
          <div class="d-flex justify-content-center py-4">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">${i18n.app.cargando}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    await ArchivoController.obtenerMisTramites({
      onLoading: () => {},
      onSuccess: (tramites) => this._renderListado(tramites),
      onError: (msg) => {
        const container = document.getElementById('tramite-listado-container');
        if (container) {
          container.innerHTML = `<div class="alert alert-warning">${this._esc(msg)}</div>`;
        }
      },
    });
  },

  /**
   * Vista "Solicitar carta" (#/tramite/nueva): solo el formulario.
   */
  async renderFormulario() {
    const root   = document.getElementById('app-root');
    const sesion = AuthModel.getSesion();
    if (!root || !sesion) return;

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/inicio" class="text-white-50">Inicio</a></li>
              <li class="breadcrumb-item"><a href="#/tramite" class="text-white-50">${i18n.tramite.historialTitulo}</a></li>
              <li class="breadcrumb-item active">${i18n.tramite.solicitarCarta}</li>
            </ol>
          </nav>
          <h1><i class="bi bi-file-earmark-plus me-2"></i>${i18n.tramite.solicitarCarta}</h1>
          <p class="page-hero-sub mb-0">${i18n.tramite.nuevaSolicitudSub}</p>
        </div>
      </div>

      <div class="container py-5">
        <div class="row justify-content-center">
          <div class="col-lg-8">
            <div class="mb-3">
              <a href="#/tramite" class="btn-jal-secondary d-inline-flex align-items-center gap-2">
                <i class="bi bi-arrow-left"></i>${i18n.tramite.volverSolicitudes}
              </a>
            </div>
            <div id="tramite-form-container"></div>
          </div>
        </div>
      </div>
    `;

    this._renderFormulario();
  },

  /**
   * Renderiza el historial de solicitudes del estudiante.
   * @private
   */
  _renderListado(tramites = []) {
    const container = document.getElementById('tramite-listado-container');
    if (!container) return;

    if (!tramites.length) {
      container.innerHTML = `
        <div class="tramite-status-card animate-fade-in-up" style="border-color:var(--color-border);background:var(--color-surface);">
          <div class="status-icon"><i class="bi bi-file-earmark-plus"></i></div>
          <div class="status-label">${i18n.tramite.historialTitulo}</div>
          <div class="status-title" style="color:var(--color-text-muted);">${i18n.tramite.sinTramite}</div>
          <p class="mb-3 text-muted">${i18n.tramite.sinTramiteSub}</p>
          <a href="#/tramite/nueva" class="btn-jal-primary d-inline-flex align-items-center gap-2">
            <i class="bi bi-plus-lg"></i>${i18n.tramite.solicitarCarta}
          </a>
        </div>
      `;
      return;
    }

    const pendientes = this._contarSolicitudesPendientes(tramites);

    container.innerHTML = `
      <div class="form-jal p-0 animate-fade-in-up">
        <div class="p-4 border-bottom d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <span class="fw-600 text-muted">
            <i class="bi bi-list-check text-primary me-2"></i>${tramites.length} ${tramites.length === 1 ? 'solicitud' : 'solicitudes'}
          </span>
          <span class="badge bg-warning-subtle text-warning-emphasis">
            ${pendientes} ${i18n.tramite.solicitudesPendientes}
          </span>
        </div>
        <div class="list-group list-group-flush">
          ${tramites.map((tramite) => this._buildSolicitudItem(tramite)).join('')}
        </div>
      </div>
    `;

    this._bindFinalizacionEvents(tramites);
    this._bindSolicitudToggleEvents();
  },

  /**
   * Construye un item del historial.
   * @private
   */
  _buildSolicitudItem(tramite) {
    const fecha = this._formatFecha(tramite.fecha_solicitud);
    const fechaResolucion = this._formatFecha(tramite.fecha_resolucion);
    const puedeSolicitarFinalizacion =
      tramite.estado === ESTADOS_TRAMITE.EXPEDIDA &&
      !tramite.finalizacion_solicitada &&
      !tramite.finalizacion_estado;
    return `
      <div class="list-group-item p-4 solicitud-item">
        <div class="d-flex align-items-start justify-content-between gap-3">
          <div>
            <div class="fw-700">${this._esc(tramite.carrera || 'Carrera no registrada')}</div>
            <small class="text-muted d-block">
              ${this._esc(tramite.universidad || 'Universidad no registrada')}
              <span class="mx-1">·</span>
              <i class="bi bi-calendar3 me-1"></i>${fecha}
            </small>
            ${this._buildEstadoPills(tramite)}
          </div>
          <button type="button"
                  class="btn btn-sm btn-outline-secondary btn-toggle-solicitud"
                  aria-expanded="false">
            <i class="bi bi-chevron-down" aria-hidden="true"></i>
            <span>${i18n.tramite.verDetalles}</span>
          </button>
        </div>

        <div class="solicitud-detalle" hidden>
          <div class="border-top pt-3 mt-3">
            <div class="row g-2 small text-muted">
              <div class="col-sm-6">
                <i class="bi bi-geo me-1"></i>
                ${i18n.tramite.campoCiudadDoc}: <strong>${this._esc(tramite.ciudad_documento || '-')}</strong>
              </div>
              <div class="col-sm-6">
                <i class="bi bi-clock-history me-1"></i>
                ${this._esc(tramite.horas_a_realizar ?? '-')} horas
              </div>
              <div class="col-sm-6">
                <i class="bi bi-layers me-1"></i>
                ${i18n.tramite.campoSemestre}: <strong>${this._esc(tramite.semestre_actual ?? '-')}</strong>
              </div>
              <div class="col-sm-6">
                <i class="bi bi-geo-alt me-1"></i>
                ${this._esc(tramite.lugar_realizacion || 'Lugar no registrado')}
              </div>
              ${tramite.fecha_resolucion ? `
                <div class="col-12">
                  <i class="bi bi-check2-circle me-1"></i>
                  Resolución: <strong>${fechaResolucion}</strong>
                </div>
              ` : ''}
            </div>

            ${this._buildAvisos(tramite)}

            ${puedeSolicitarFinalizacion ? `
              <div class="mt-3 border-top pt-3">
                <p class="small text-muted mb-2">${i18n.tramite.finalizacionDisponibleMsg}</p>
                <button type="button"
                        class="btn btn-sm btn-outline-primary btn-solicitar-finalizacion"
                        data-id="${this._esc(tramite.id)}">
                  <i class="bi bi-file-earmark-plus me-1"></i>${i18n.tramite.solicitarFinalizacion}
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Registra los eventos para solicitar carta de finalizacion.
   * @private
   */
  _bindFinalizacionEvents(tramites) {
    document.querySelectorAll('.btn-solicitar-finalizacion').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tramite = tramites.find((t) => t.id === btn.dataset.id);
        if (!tramite) return;

        await ArchivoController.solicitarFinalizacion(tramite.id, tramite, {
          onLoading: (cargando) => {
            btn.disabled = cargando;
            btn.classList.toggle('disabled', cargando);
          },
          onSuccess: () => {
            Toast.exito(i18n.tramite.finalizacionSolicitadaOk);
            this.renderHistorial();
          },
          onError: (msg) => Toast.error(msg),
        });
      });
    });
  },

  /**
   * Registra el despliegue/ocultamiento de cada solicitud del historial.
   * @private
   */
  _bindSolicitudToggleEvents() {
    document.querySelectorAll('.btn-toggle-solicitud').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.solicitud-item');
        const detalles = item?.querySelectorAll('.solicitud-detalle');
        const icono = btn.querySelector('i');
        const texto = btn.querySelector('span');
        if (!detalles?.length) return;

        const expandido = detalles[0].hasAttribute('hidden');
        detalles.forEach((detalle) => detalle.toggleAttribute('hidden', !expandido));
        item?.classList.toggle('is-expanded', expandido);
        btn.setAttribute('aria-expanded', String(expandido));

        if (icono) {
          icono.classList.toggle('bi-chevron-down', !expandido);
          icono.classList.toggle('bi-chevron-up', expandido);
        }

        if (texto) {
          texto.textContent = expandido
            ? i18n.tramite.ocultarDetalles
            : i18n.tramite.verDetalles;
        }
      });
    });
  },

  /**
   * Construye los pills compactos de estado (siempre visibles) para la
   * carta barrial y la carta de finalizacion.
   * @private
   */
  _buildEstadoPills(tramite) {
    const barrial = this._getEstadoCartaBarrial(tramite);
    const finalizacion = this._getEstadoCartaFinalizacion(tramite);

    return `
      <div class="solicitud-pills">
        ${this._buildPill(i18n.tramite.cartaBarrialCorta, barrial)}
        ${this._buildPill(i18n.tramite.cartaFinalizacionCorta, finalizacion)}
      </div>
    `;
  },

  /**
   * @private
   */
  _buildPill(label, estado) {
    return `
      <span class="estado-pill ${estado.clase}">
        <i class="bi ${estado.icono}" aria-hidden="true"></i>
        <span>${this._esc(label)} · ${this._esc(estado.titulo)}</span>
      </span>
    `;
  },

  /**
   * Construye los avisos detallados (mensaje de cada carta), mostrados solo
   * dentro del detalle desplegable. Evita repetir el mensaje en el listado.
   * @private
   */
  _buildAvisos(tramite) {
    const avisos = [
      this._getEstadoCartaBarrial(tramite),
      this._getEstadoCartaFinalizacion(tramite),
    ].filter((estado) => estado.mensaje);

    if (!avisos.length) return '';

    return `
      <div class="solicitud-avisos mt-3">
        ${avisos.map((estado) => `
          <div class="solicitud-aviso ${estado.clase}">
            <i class="bi ${estado.icono}" aria-hidden="true"></i>
            <span>
              <strong>${this._esc(estado.label)}:</strong> ${this._esc(estado.mensaje)}
              ${estado.sugerencia ? `
                <span class="solicitud-sugerencia d-block mt-2">
                  <strong>${i18n.tramite.sugerenciaCorreccionTitulo}:</strong>
                  ${this._esc(estado.sugerencia)}
                </span>
              ` : ''}
            </span>
          </div>
        `).join('')}
      </div>
    `;
  },

  /**
   * @private
   */
  _getEstadoCartaBarrial(tramite) {
    if (tramite.estado === ESTADOS_TRAMITE.EXPEDIDA) {
      return {
        label: i18n.tramite.cartaBarrial,
        titulo: i18n.tramite.expedida,
        mensaje: i18n.tramite.expedidaMsg,
        icono: 'bi-check2-circle',
        clase: 'estado-expedida',
      };
    }

    if (tramite.estado === ESTADOS_TRAMITE.RECHAZADO) {
      return {
        label: i18n.tramite.cartaBarrial,
        titulo: i18n.tramite.rechazado,
        mensaje: i18n.tramite.rechazadoMsg,
        sugerencia: tramite.sugerencia_correccion,
        icono: 'bi-x-circle',
        clase: 'estado-rechazado',
      };
    }

    return {
      label: i18n.tramite.cartaBarrial,
      titulo: tramite.estado === ESTADOS_TRAMITE.APROBADO
        ? i18n.tramite.aprobado
        : i18n.tramite.pendiente,
      mensaje: tramite.estado === ESTADOS_TRAMITE.APROBADO
        ? i18n.tramite.pendienteExpedicionMsg
        : i18n.tramite.pendienteMsg,
      icono: 'bi-hourglass-split',
      clase: 'estado-espera',
    };
  },

  /**
   * @private
   */
  _getEstadoCartaFinalizacion(tramite) {
    if (tramite.finalizacion_estado === 'Expedida') {
      return {
        label: i18n.tramite.cartaFinalizacion,
        titulo: i18n.tramite.expedida,
        mensaje: i18n.tramite.finalizacionExpedidaMsg,
        icono: 'bi-check2-circle',
        clase: 'estado-expedida',
      };
    }

    if (tramite.finalizacion_estado === 'Rechazada') {
      return {
        label: i18n.tramite.cartaFinalizacion,
        titulo: i18n.tramite.rechazado,
        mensaje: i18n.tramite.finalizacionRechazadaMsg,
        sugerencia: tramite.finalizacion_sugerencia_correccion,
        icono: 'bi-x-circle',
        clase: 'estado-rechazado',
      };
    }

    if (tramite.finalizacion_estado === 'Pendiente' || tramite.finalizacion_solicitada) {
      return {
        label: i18n.tramite.cartaFinalizacion,
        titulo: i18n.tramite.pendiente,
        mensaje: i18n.tramite.finalizacionPendienteMsg,
        icono: 'bi-hourglass-split',
        clase: 'estado-espera',
      };
    }

    if (tramite.estado === ESTADOS_TRAMITE.EXPEDIDA) {
      return {
        label: i18n.tramite.cartaFinalizacion,
        titulo: i18n.tramite.noSolicitada,
        mensaje: i18n.tramite.finalizacionNoSolicitadaMsg,
        icono: 'bi-file-earmark-plus',
        clase: 'estado-neutral',
      };
    }

    return {
      label: i18n.tramite.cartaFinalizacion,
      titulo: i18n.tramite.noDisponible,
      mensaje: i18n.tramite.finalizacionNoDisponibleMsg,
      icono: 'bi-lock',
      clase: 'estado-neutral',
    };
  },

  /**
   * @private
   */
  _contarSolicitudesPendientes(tramites) {
    return tramites.reduce((total, tramite) => {
      const cartaBarrialPendiente =
        tramite.estado !== ESTADOS_TRAMITE.EXPEDIDA &&
        tramite.estado !== ESTADOS_TRAMITE.RECHAZADO;
      const finalizacionPendiente = tramite.finalizacion_estado === 'Pendiente';

      return total + (cartaBarrialPendiente ? 1 : 0) + (finalizacionPendiente ? 1 : 0);
    }, 0);
  },

  /**
   * Renderiza siempre el formulario de nueva solicitud.
   * @private
   */
  _renderFormulario() {
    const container = document.getElementById('tramite-form-container');
    const sesion = AuthModel.getSesion();
    if (!container) return;

    container.innerHTML = `
      <div class="form-jal animate-fade-in-up">
        <h2 class="h5 fw-700 mb-4">
          <i class="bi bi-pencil-square text-primary me-2"></i>
          ${i18n.tramite.formDatosTitulo}
        </h2>

        <form id="form-solicitud-carta" novalidate>
          <div class="row g-3">
            <div class="col-12">
              <label for="carta-nombre" class="form-label">${i18n.tramite.campoNombre} *</label>
              <input type="text" id="carta-nombre" class="form-control"
                     placeholder="${i18n.tramite.placeholderNombre}"
                     value="${this._esc(sesion?.nombre || '')}"
                     required maxlength="120" readonly />
            </div>
            <div class="col-md-6">
              <label for="carta-tipo-doc" class="form-label">${i18n.tramite.campoTipoDoc} *</label>
              <input type="text" id="carta-tipo-doc" class="form-control"
                     value="${this._esc(sesion?.tipo_documento || '')}" required readonly />
            </div>
            <div class="col-md-6">
              <label for="carta-numero-doc" class="form-label">${i18n.tramite.campoNumeroDoc} *</label>
              <input type="text" id="carta-numero-doc" class="form-control"
                     placeholder="${i18n.tramite.placeholderNumero}"
                     value="${this._esc(sesion?.numero_documento || '')}"
                     required maxlength="30" readonly />
            </div>
            <div class="col-md-6">
              <label for="carta-ciudad-doc" class="form-label">${i18n.tramite.campoCiudadDoc} *</label>
              <input type="text" id="carta-ciudad-doc" class="form-control"
                     placeholder="${i18n.tramite.placeholderCiudadDoc}"
                     value="${this._esc(sesion?.ciudad_documento || '')}"
                     required maxlength="80" readonly />
            </div>
            <div class="col-md-6">
              <label for="carta-universidad" class="form-label">${i18n.tramite.campoUniversidad} *</label>
              <input type="text" id="carta-universidad" name="universidad" class="form-control"
                     placeholder="${i18n.tramite.placeholderUniversidad}" required maxlength="120" />
            </div>
            <div class="col-md-6">
              <label for="carta-carrera" class="form-label">${i18n.tramite.campoCarrera} *</label>
              <input type="text" id="carta-carrera" name="carrera" class="form-control"
                     placeholder="${i18n.tramite.placeholderCarrera}" required maxlength="120" />
            </div>
            <div class="col-md-6">
              <label for="carta-semestre" class="form-label">${i18n.tramite.campoSemestre} *</label>
              <input type="text" id="carta-semestre" name="semestre_actual" class="form-control"
                     placeholder="${i18n.tramite.placeholderSemestre}" required pattern="[0-9]+" inputmode="numeric" />
            </div>
            <div class="col-md-6">
              <label for="carta-horas" class="form-label">${i18n.tramite.campoHoras} *</label>
              <input type="number" id="carta-horas" name="horas_a_realizar" class="form-control"
                     placeholder="${i18n.tramite.placeholderHoras}" required min="1" max="9999" />
            </div>
            <div class="col-md-6">
              <label for="carta-lugar" class="form-label">${i18n.tramite.campoLugar} *</label>
              <input type="text" id="carta-lugar" name="lugar_realizacion" class="form-control"
                     placeholder="${i18n.tramite.placeholderLugar}" required maxlength="200" />
            </div>
          </div>

          <div id="solicitud-progress" class="d-none mt-3">
            <div class="d-flex align-items-center gap-2">
              <div class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></div>
              <span id="solicitud-progress-msg" class="text-muted small">${i18n.app.cargando}</span>
            </div>
          </div>

          <div class="mt-4">
            <button type="submit" class="btn-jal-primary d-flex align-items-center gap-2" id="btn-enviar-solicitud">
              <i class="bi bi-send"></i>
              <span id="btn-enviar-text">${i18n.tramite.enviarSolicitud}</span>
            </button>
          </div>
        </form>
      </div>
    `;

    this._bindFormEvents();
  },

  /**
   * @private
   */
  _bindFormEvents() {
    const form = document.getElementById('form-solicitud-carta');
    const semestreInput = document.getElementById('carta-semestre');

    semestreInput?.addEventListener('input', () => {
      semestreInput.value = semestreInput.value.replace(/\D/g, '');
    });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleEnviar(form);
    });
  },

  /**
   * @private
   */
  async _handleEnviar(form) {
    const formData = Object.fromEntries(new FormData(form).entries());

    await ArchivoController.enviarSolicitud(formData, {
      onLoading: (cargando) => this._setSolicitudLoading(cargando),
      onProgress: (msg) => {
        const el = document.getElementById('solicitud-progress-msg');
        if (el) el.textContent = msg;
      },
      onSuccess: () => {
        Toast.exito(i18n.tramite.solicitadoOk);
        window.location.hash = '#/tramite';
      },
      onError: (msg) => {
        Toast.error(msg);
        this._setSolicitudLoading(false);
      },
    });
  },

  /**
   * @private
   */
  _setSolicitudLoading(cargando) {
    const progress = document.getElementById('solicitud-progress');
    const btn      = document.getElementById('btn-enviar-solicitud');

    if (cargando) {
      progress?.classList.remove('d-none');
      if (btn) btn.disabled = true;
    } else {
      progress?.classList.add('d-none');
      if (btn) btn.disabled = false;
    }
  },

  /**
   * @private
   */
  _formatFecha(ts) {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
  },

  /**
   * Escapa HTML para prevenir inyeccion de marcado en datos dinamicos.
   * @private
   */
  _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
};

export default EstudianteView;
