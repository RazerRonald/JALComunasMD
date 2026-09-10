/**
 * @fileoverview AdminView — Panel de administración completo para el rol Edil.
 * Incluye: dashboard con estadísticas en tiempo real, CRUD de noticias,
 * CRUD de eventos y gestión de trámites estudiantiles.
 * Solo renderiza HTML; delega lógica a los Controllers.
 *
 * @module views/AdminView
 */

import NoticiaController  from '../controllers/NoticiaController.js';
import EventoController   from '../controllers/EventoController.js';
import ArchivoController  from '../controllers/ArchivoController.js';
import AuthModel          from '../models/AuthModel.js';
import AdminUsuariosView  from './AdminUsuariosView.js';
import AdminSolicitudesAccesoView from './AdminSolicitudesAccesoView.js';
import Toast              from '../components/Toast.js';
import { i18n }           from '../config/i18n.js';
import { ESTADOS_TRAMITE } from '../config/collections.js';

const AdminView = {
  /** @type {Array<function>} Funciones unsubscribe de listeners activos */
  _unsubs: [],

  /** @type {Array<Object>} Caché de trámites para el modal */
  _tramitesCache: [],

  /** @type {Array<Object>} Cache de noticias para busqueda local */
  _noticiasCache: [],

  /** @type {Array<Object>} Cache de eventos para busqueda local */
  _eventosCache: [],

  // ─── DASHBOARD PRINCIPAL ─────────────────────────────────────────────────

  /**
   * Renderiza el dashboard principal del panel de administración.
   * Los contadores se actualizan en tiempo real con onSnapshot.
   *
   * @returns {void}
   */
  renderDashboard() {
    const root   = document.getElementById('app-root');
    const sesion = AuthModel.getSesion();
    if (!root || !sesion) return;

    this._limpiarUnsubs();

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <h1><i class="bi bi-speedometer2 me-2"></i>${i18n.admin.titulo}</h1>
          <p class="page-hero-sub">Bienvenido, <strong>${this._esc(sesion.nombre)}</strong> — ${i18n.admin.subtitulo}</p>
        </div>
      </div>

      <div class="container py-5">

        <!-- ─── Estadísticas en tiempo real ─── -->
        <h2 class="h5 fw-700 mb-3">
          <i class="bi bi-bar-chart-line text-primary me-2"></i>${i18n.admin.resumen}
          <span class="badge bg-success-subtle text-success ms-2 fw-600" style="font-size:0.65rem;">
            <i class="bi bi-circle-fill me-1" style="font-size:0.4rem;"></i>En vivo
          </span>
        </h2>

        <div class="row g-4 mb-5">
          <div class="col-md-4">
            <div class="dashboard-stat-card">
              <div class="stat-icon stat-icon-primary"><i class="bi bi-newspaper"></i></div>
              <div class="stat-number" id="stat-noticias">—</div>
              <div class="stat-label">${i18n.admin.totalNoticias}</div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="dashboard-stat-card">
              <div class="stat-icon stat-icon-success"><i class="bi bi-calendar-event"></i></div>
              <div class="stat-number" id="stat-eventos">—</div>
              <div class="stat-label">${i18n.admin.eventosProximos}</div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="dashboard-stat-card">
              <div class="stat-icon stat-icon-warning"><i class="bi bi-hourglass-split"></i></div>
              <div class="stat-number" id="stat-tramites">—</div>
              <div class="stat-label">${i18n.admin.tramitesPendientes}</div>
            </div>
          </div>
        </div>

        <!-- ─── Accesos rápidos ─── -->
        <h2 class="h5 fw-700 mb-3">
          <i class="bi bi-lightning-fill text-warning me-2"></i>Accesos Rápidos
        </h2>
        <div class="row g-4">
          <div class="col-md-6 col-xl">
            <button class="btn w-100 p-4 text-start form-jal"
                    style="cursor:pointer;border:2px solid var(--color-border);transition:all .25s;"
                    id="btn-admin-noticias"
                    aria-label="Gestionar noticias">
              <div class="d-flex align-items-center gap-3">
                <div class="stat-icon stat-icon-primary"><i class="bi bi-newspaper fs-4"></i></div>
                <div>
                  <div class="fw-700">${i18n.admin.gestionNoticias}</div>
                  <div class="text-muted small">Crear, editar y eliminar noticias</div>
                </div>
                <i class="bi bi-arrow-right ms-auto text-primary"></i>
              </div>
            </button>
          </div>
          <div class="col-md-6 col-xl">
            <button class="btn w-100 p-4 text-start form-jal"
                    style="cursor:pointer;border:2px solid var(--color-border);transition:all .25s;"
                    id="btn-admin-eventos"
                    aria-label="Gestionar eventos">
              <div class="d-flex align-items-center gap-3">
                <div class="stat-icon stat-icon-success"><i class="bi bi-calendar-plus fs-4"></i></div>
                <div>
                  <div class="fw-700">${i18n.admin.gestionEventos}</div>
                  <div class="text-muted small">Crear, editar y eliminar eventos</div>
                </div>
                <i class="bi bi-arrow-right ms-auto text-success"></i>
              </div>
            </button>
          </div>
          <div class="col-md-6 col-xl">
            <button class="btn w-100 p-4 text-start form-jal"
                    style="cursor:pointer;border:2px solid var(--color-border);transition:all .25s;"
                    id="btn-admin-tramites"
                    aria-label="Revisar trámites">
              <div class="d-flex align-items-center gap-3">
                <div class="stat-icon stat-icon-warning"><i class="bi bi-folder2-open fs-4"></i></div>
                <div>
                  <div class="fw-700">${i18n.admin.revisarTramites}</div>
                  <div class="text-muted small">${i18n.admin.revisarTramitesSub}</div>
                </div>
                <i class="bi bi-arrow-right ms-auto text-warning"></i>
              </div>
            </button>
          </div>
          <div class="col-md-6 col-xl">
            <button class="btn w-100 p-4 text-start form-jal"
                    style="cursor:pointer;border:2px solid var(--color-border);transition:all .25s;"
                    id="btn-admin-usuarios"
                    aria-label="${i18n.admin.gestionUsuarios}">
              <div class="d-flex align-items-center gap-3">
                <div class="stat-icon stat-icon-primary"><i class="bi bi-person-plus fs-4"></i></div>
                <div>
                  <div class="fw-700">${i18n.admin.gestionUsuarios}</div>
                  <div class="text-muted small">${i18n.admin.gestionUsuariosSub}</div>
                </div>
                <i class="bi bi-arrow-right ms-auto text-primary"></i>
              </div>
            </button>
          </div>
          <div class="col-md-6 col-xl">
            <button class="btn w-100 p-4 text-start form-jal"
                    style="cursor:pointer;border:2px solid var(--color-border);transition:all .25s;"
                    id="btn-admin-solicitudes-acceso"
                    aria-label="${i18n.solicitudAcceso.adminTitulo}">
              <div class="d-flex align-items-center gap-3">
                <div class="stat-icon stat-icon-success"><i class="bi bi-person-check fs-4"></i></div>
                <div>
                  <div class="fw-700">${i18n.solicitudAcceso.adminTitulo}</div>
                  <div class="text-muted small">${i18n.solicitudAcceso.adminSubtitulo}</div>
                </div>
                <i class="bi bi-arrow-right ms-auto text-success"></i>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Modal de confirmación genérico -->
      ${this._buildModalConfirmacion()}
    `;

    // Bind accesos rápidos
    document.getElementById('btn-admin-noticias')?.addEventListener('click', () => this.renderNoticias());
    document.getElementById('btn-admin-eventos')?.addEventListener('click',  () => this.renderEventos());
    document.getElementById('btn-admin-tramites')?.addEventListener('click', () => this.renderTramites());
    document.getElementById('btn-admin-usuarios')?.addEventListener('click', () => this.renderUsuarios());
    document.getElementById('btn-admin-solicitudes-acceso')?.addEventListener('click', () => {
      window.location.hash = '#/admin/solicitudes-acceso';
    });

    // Suscribir contadores en tiempo real
    this._iniciarContadores();
  },

  /**
   * Renderiza la gestion de usuarios y perfiles.
   *
   * @returns {void}
   */
  renderUsuarios() {
    AdminUsuariosView.render({
      onVolverDashboard: () => this.renderDashboard(),
    });
  },

  /** Renderiza las solicitudes publicas de creacion de estudiantes. */
  renderSolicitudesAcceso() {
    AdminSolicitudesAccesoView.render({
      onVolverDashboard: () => {
        window.location.hash = '#/admin';
      },
    });
  },

  /**
   * Inicia los listeners de tiempo real para los contadores del dashboard.
   * @private
   */
  _iniciarContadores() {
    // Noticias
    const unsubNoticias = NoticiaController.suscribirTiempoReal((noticias) => {
      const el = document.getElementById('stat-noticias');
      if (el) el.textContent = noticias.length;
    });

    // Eventos próximos (cuenta solo futuros)
    const unsubEventos = EventoController.suscribirTiempoReal((eventos) => {
      const ahora = new Date();
      const proximos = eventos.filter((e) => {
        const f = e.fecha?.toDate ? e.fecha.toDate() : new Date(e.fecha);
        return f >= ahora;
      });
      const el = document.getElementById('stat-eventos');
      if (el) el.textContent = proximos.length;
    });

    // Trámites y cartas de finalizacion pendientes
    const unsubTramites = ArchivoController.suscribirTodos((tramites) => {
      const pendientes = tramites.filter((t) =>
        t.estado === ESTADOS_TRAMITE.PENDIENTE ||
        t.finalizacion_estado === 'Pendiente'
      );
      const el = document.getElementById('stat-tramites');
      if (el) el.textContent = pendientes.length;
    });

    this._unsubs.push(unsubNoticias, unsubEventos, unsubTramites);
  },

  // ─── GESTIÓN DE NOTICIAS ─────────────────────────────────────────────────

  /**
   * Renderiza la sección de gestión de noticias con tabla CRUD.
   *
   * @returns {Promise<void>}
   */
  async renderNoticias() {
    const root = document.getElementById('app-root');
    if (!root) return;

    this._limpiarUnsubs();

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/admin" class="text-white-50">Admin</a></li>
              <li class="breadcrumb-item active">Noticias</li>
            </ol>
          </nav>
          <h1><i class="bi bi-newspaper me-2"></i>${i18n.admin.gestionNoticias}</h1>
        </div>
      </div>

      <div class="container py-5">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
          <div>
            <button class="btn-jal-secondary" id="btn-volver-dashboard" aria-label="Volver al dashboard">
              <i class="bi bi-arrow-left me-1"></i> Panel Admin
            </button>
          </div>
          <button class="btn-jal-primary" id="btn-nueva-noticia" aria-label="Crear nueva noticia">
            <i class="bi bi-plus-circle me-1"></i> ${i18n.noticias.crearNoticia}
          </button>
        </div>

        <!-- Formulario de creación/edición (oculto por defecto) -->
        <div id="form-noticia-container" class="d-none mb-4"></div>

        <!-- Tabla de noticias -->
        <div class="form-jal p-0 overflow-hidden">
          <div class="p-4 border-bottom">
            <div class="d-flex justify-content-between align-items-center gap-3 flex-wrap">
              <h2 class="h6 fw-700 mb-0">Noticias publicadas</h2>
              ${this._buildSearchBox({
                id: 'buscador-admin-noticias',
                label: i18n.app.buscar,
                placeholder: i18n.noticias.buscarPlaceholder,
                compact: true,
              })}
            </div>
          </div>
          <div class="table-responsive">
            <table class="table table-jal mb-0" aria-label="Lista de noticias">
              <thead>
                <tr>
                  <th scope="col">Título</th>
                  <th scope="col">Fecha</th>
                  <th scope="col" class="text-end">${i18n.admin.colAcciones}</th>
                </tr>
              </thead>
              <tbody id="tabla-noticias-body">
                <tr><td colspan="3" class="text-center py-4 text-muted">
                  <div class="spinner-border spinner-border-sm text-primary me-2" role="status" aria-hidden="true"></div>
                  ${i18n.app.cargando}
                </td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${this._buildModalConfirmacion()}
    `;

    document.getElementById('btn-volver-dashboard')?.addEventListener('click', () => this.renderDashboard());
    document.getElementById('btn-nueva-noticia')?.addEventListener('click', () => {
      this._mostrarFormNoticia(null);
    });

    // Cargar noticias
    await NoticiaController.listar({
      onLoading: () => {},
      onSuccess: (noticias) => {
        this._noticiasCache = noticias;
        this._renderTablaNoticiasBody(noticias);
        this._bindSearchInput('buscador-admin-noticias', (termino) => {
          const filtradas = this._filtrarNoticias(noticias, termino);
          this._renderTablaNoticiasBody(filtradas, Boolean(this._normalizarBusqueda(termino)));
        });
      },
      onError:   (msg) => {
        this._renderTablaError('tabla-noticias-body', 3, msg);
        Toast.error(msg);
      },
    });
  },

  /**
   * Renderiza las filas de la tabla de noticias.
   * @private
   */
  _renderTablaNoticiasBody(noticias, esBusqueda = false) {
    const tbody = document.getElementById('tabla-noticias-body');
    if (!tbody) return;

    if (noticias.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="text-center py-5 text-muted">
            <i class="bi bi-newspaper opacity-50 d-block mb-2" style="font-size:2rem;"></i>
            ${esBusqueda ? i18n.noticias.sinResultados : i18n.noticias.sinNoticias}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = noticias.map((n) => {
      const id = this._esc(n.id);
      const titulo = this._esc(n.titulo);
      return `
        <tr data-id="${id}">
          <td>
            <div class="fw-600 text-truncate" style="max-width:300px;" title="${titulo}">${titulo}</div>
          </td>
          <td class="text-muted small">${this._formatFecha(n.fechaPublicacion)}</td>
          <td class="text-end">
            <div class="d-flex gap-2 justify-content-end">
              <button class="btn btn-sm btn-outline-primary btn-editar-noticia"
                      data-id="${id}"
                      aria-label="Editar noticia ${titulo}">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger btn-eliminar-noticia"
                      data-id="${id}"
                      data-titulo="${titulo}"
                      aria-label="Eliminar noticia ${titulo}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind botones
    tbody.querySelectorAll('.btn-editar-noticia').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const noticia = noticias.find((n) => n.id === btn.dataset.id);
        if (noticia) this._mostrarFormNoticia(noticia);
      });
    });

    tbody.querySelectorAll('.btn-eliminar-noticia').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._confirmar(
          `¿Eliminar la noticia "<strong>${this._esc(btn.dataset.titulo)}</strong>"?`,
          async () => {
            await NoticiaController.eliminar(btn.dataset.id, {
              onLoading: () => {},
              onSuccess: async () => {
                Toast.exito(i18n.noticias.eliminadoOk);
                await this.renderNoticias();
              },
              onError: (msg) => Toast.error(msg),
            });
          }
        );
      });
    });
  },

  /**
   * Muestra el formulario inline de creación/edición de noticia.
   * @private
   * @param {Object|null} noticia - null para crear, objeto para editar
   */
  _mostrarFormNoticia(noticia) {
    const container = document.getElementById('form-noticia-container');
    if (!container) return;

    const esEdicion = Boolean(noticia);
    const titulo = this._esc(noticia?.titulo || '');
    const cuerpo = this._esc(noticia?.cuerpo || '');

    container.classList.remove('d-none');
    container.innerHTML = `
      <div class="form-jal border border-primary animate-fade-in">
        <h2 class="h6 fw-700 mb-4">
          <i class="bi bi-${esEdicion ? 'pencil-square' : 'plus-circle'} text-primary me-2"></i>
          ${esEdicion ? i18n.noticias.editarNoticia : i18n.noticias.crearNoticia}
        </h2>
        <form id="form-noticia" novalidate>
          <div class="mb-3">
            <label for="noticia-titulo" class="form-label">${i18n.noticias.campoTitulo} *</label>
            <input type="text"
                   id="noticia-titulo"
                   name="titulo"
                   class="form-control"
                   placeholder="${i18n.noticias.placeholderTitulo}"
                   value="${titulo}"
                   required
                   maxlength="200" />
          </div>
          <div class="mb-3">
            <label for="noticia-media" class="form-label">${i18n.noticias.campoArchivo} ${esEdicion ? '' : '*'}</label>
            <input type="file"
                   id="noticia-media"
                   name="mediaFile"
                   class="form-control"
                   accept="image/*,video/*"
                   ${esEdicion ? '' : 'required'} />
            <div class="form-text">${esEdicion ? i18n.noticias.ayudaArchivoEditar : i18n.noticias.ayudaArchivo}</div>
            ${noticia?.media_url ? `
              <div class="mt-2 small text-muted">
                <i class="bi bi-paperclip me-1"></i>${i18n.noticias.archivoActual}: ${this._esc(noticia.media_nombre || noticia.media_tipo || i18n.app.sinDatos)}
              </div>
            ` : ''}
          </div>
          <div class="mb-4">
            <label for="noticia-cuerpo" class="form-label">${i18n.noticias.campoCuerpo} *</label>
            <textarea id="noticia-cuerpo"
                      name="cuerpo"
                      class="form-control"
                      rows="8"
                      placeholder="${i18n.noticias.placeholderCuerpo}"
                      maxlength="12000"
                      required>${cuerpo}</textarea>
          </div>
          <div id="form-noticia-error" class="alert alert-danger d-none mb-3" role="alert"></div>
          <div class="d-flex gap-2 flex-wrap">
            <button type="submit" class="btn-jal-primary" id="btn-guardar-noticia"
                    aria-label="Guardar noticia">
              <span id="btn-guardar-noticia-text">
                <i class="bi bi-save me-1"></i> ${i18n.app.guardar}
              </span>
              <span id="btn-guardar-noticia-loading" class="d-none">
                <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                Guardando…
              </span>
            </button>
            <button type="button" class="btn-jal-secondary" id="btn-cancelar-noticia"
                    aria-label="Cancelar">
              ${i18n.app.cancelar}
            </button>
          </div>
        </form>
      </div>
    `;

    // Cancelar
    document.getElementById('btn-cancelar-noticia')?.addEventListener('click', () => {
      container.classList.add('d-none');
    });

    // Submit
    document.getElementById('form-noticia')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const datos = {
        titulo:     document.getElementById('noticia-titulo')?.value,
        cuerpo:     document.getElementById('noticia-cuerpo')?.value,
        mediaFile:  document.getElementById('noticia-media')?.files?.[0] || null,
      };

      const cbs = {
        onLoading: (v) => this._setFormLoading('btn-guardar-noticia', v),
        onSuccess: async () => {
          Toast.exito(i18n.noticias.guardadoOk);
          container.classList.add('d-none');
          await this.renderNoticias();
        },
        onError: (msg) => {
          const errEl = document.getElementById('form-noticia-error');
          if (errEl) { errEl.textContent = msg; errEl.classList.remove('d-none'); }
        },
      };

      if (esEdicion) {
        await NoticiaController.actualizar(noticia.id, datos, cbs);
      } else {
        await NoticiaController.crear(datos, cbs);
      }
    });

    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // ─── GESTIÓN DE EVENTOS ──────────────────────────────────────────────────

  /**
   * Renderiza la sección de gestión de eventos con tabla CRUD.
   *
   * @returns {Promise<void>}
   */
  async renderEventos() {
    const root = document.getElementById('app-root');
    if (!root) return;

    this._limpiarUnsubs();

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/admin" class="text-white-50">Admin</a></li>
              <li class="breadcrumb-item active">Eventos</li>
            </ol>
          </nav>
          <h1><i class="bi bi-calendar-event me-2"></i>${i18n.admin.gestionEventos}</h1>
        </div>
      </div>

      <div class="container py-5">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
          <button class="btn-jal-secondary" id="btn-volver-dashboard-ev">
            <i class="bi bi-arrow-left me-1"></i> Panel Admin
          </button>
          <button class="btn-jal-primary" id="btn-nuevo-evento">
            <i class="bi bi-plus-circle me-1"></i> ${i18n.admin.gestionEventos.replace('Gestionar', 'Nuevo')}
          </button>
        </div>

        <div id="form-evento-container" class="d-none mb-4"></div>

        <div class="form-jal p-0 overflow-hidden">
          <div class="p-4 border-bottom">
            <div class="d-flex justify-content-between align-items-center gap-3 flex-wrap">
              <h2 class="h6 fw-700 mb-0">Todos los eventos</h2>
              ${this._buildSearchBox({
                id: 'buscador-admin-eventos',
                label: i18n.app.buscar,
                placeholder: i18n.eventos.buscarPlaceholder,
                compact: true,
              })}
            </div>
          </div>
          <div class="table-responsive">
            <table class="table table-jal mb-0" aria-label="Lista de eventos">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Fecha</th>
                  <th>Lugar</th>
                  <th class="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody id="tabla-eventos-body">
                <tr><td colspan="4" class="text-center py-4 text-muted">
                  <div class="spinner-border spinner-border-sm text-primary me-2" role="status" aria-hidden="true"></div>
                  ${i18n.app.cargando}
                </td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${this._buildModalConfirmacion()}
    `;

    document.getElementById('btn-volver-dashboard-ev')?.addEventListener('click', () => this.renderDashboard());
    document.getElementById('btn-nuevo-evento')?.addEventListener('click', () => this._mostrarFormEvento(null));

    await EventoController.listarTodos({
      onLoading: () => {},
      onSuccess: (eventos) => {
        this._eventosCache = eventos;
        this._renderTablaEventosBody(eventos);
        this._bindSearchInput('buscador-admin-eventos', (termino) => {
          const filtrados = this._filtrarEventos(eventos, termino);
          this._renderTablaEventosBody(filtrados, Boolean(this._normalizarBusqueda(termino)));
        });
      },
      onError:   (msg) => {
        this._renderTablaError('tabla-eventos-body', 4, msg);
        Toast.error(msg);
      },
    });
  },

  /**
   * @private
   */
  _renderTablaEventosBody(eventos, esBusqueda = false) {
    const tbody = document.getElementById('tabla-eventos-body');
    if (!tbody) return;

    if (eventos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-5 text-muted">
            <i class="bi bi-calendar-x opacity-50 d-block mb-2" style="font-size:2rem;"></i>
            ${esBusqueda ? i18n.eventos.sinResultados : i18n.eventos.sinEventos}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = eventos.map((ev) => {
      const fecha = ev.fecha?.toDate ? ev.fecha.toDate() : new Date(ev.fecha);
      const fechaStr = fecha.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
      const id = this._esc(ev.id);
      const titulo = this._esc(ev.titulo);
      const lugar = this._esc(ev.lugar);
      return `
        <tr>
          <td class="fw-600">${titulo}</td>
          <td class="text-muted small">${fechaStr}</td>
          <td class="text-muted small text-truncate" style="max-width:150px;">${lugar}</td>
          <td class="text-end">
            <div class="d-flex gap-2 justify-content-end">
              <button class="btn btn-sm btn-outline-primary btn-editar-evento" data-id="${id}"
                      aria-label="Editar evento ${titulo}">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger btn-eliminar-evento"
                      data-id="${id}" data-titulo="${titulo}"
                      aria-label="Eliminar evento ${titulo}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-editar-evento').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ev = eventos.find((e) => e.id === btn.dataset.id);
        if (ev) this._mostrarFormEvento(ev);
      });
    });

    tbody.querySelectorAll('.btn-eliminar-evento').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._confirmar(
          `¿Eliminar el evento "<strong>${this._esc(btn.dataset.titulo)}</strong>"?`,
          async () => {
            await EventoController.eliminar(btn.dataset.id, {
              onLoading: () => {},
              onSuccess: async () => {
                Toast.exito(i18n.eventos.eliminadoOk);
                await this.renderEventos();
              },
              onError: (msg) => Toast.error(msg),
            });
          }
        );
      });
    });
  },

  /**
   * @private
   */
  _mostrarFormEvento(evento) {
    const container = document.getElementById('form-evento-container');
    if (!container) return;

    const esEdicion = Boolean(evento);
    const titulo = this._esc(evento?.titulo || '');
    const lugar = this._esc(evento?.lugar || '');
    const descripcion = this._esc(evento?.descripcion || '');

    // Formatear fechas para datetime-local input (YYYY-MM-DDTHH:mm)
    const fechaVal    = this._formatDatetimeLocal(evento?.fecha);
    const fechaFinVal = this._formatDatetimeLocal(evento?.fecha_fin);

    container.classList.remove('d-none');
    container.innerHTML = `
      <div class="form-jal border border-success animate-fade-in">
        <h2 class="h6 fw-700 mb-4">
          <i class="bi bi-${esEdicion ? 'pencil-square' : 'plus-circle'} text-success me-2"></i>
          ${esEdicion ? i18n.eventos.editarEvento : i18n.eventos.crearEvento}
        </h2>
        <form id="form-evento" novalidate>
          <div class="row g-3">
            <div class="col-md-6">
              <label for="evento-titulo" class="form-label">${i18n.eventos.campoTitulo} *</label>
              <input type="text" id="evento-titulo" class="form-control"
                     placeholder="${i18n.eventos.placeholderTitulo}"
                     value="${titulo}" maxlength="160" required />
            </div>
            <div class="col-md-6">
              <label for="evento-lugar" class="form-label">${i18n.eventos.campoLugar} *</label>
              <input type="text" id="evento-lugar" class="form-control"
                     placeholder="${i18n.eventos.placeholderLugar}"
                     value="${lugar}" maxlength="240" required />
            </div>
            <div class="col-md-6">
              <label for="evento-fecha" class="form-label">${i18n.eventos.campoFechaInicio} *</label>
              <input type="datetime-local" id="evento-fecha" class="form-control"
                     value="${fechaVal}" required />
            </div>
            <div class="col-md-6">
              <label for="evento-fecha-fin" class="form-label">${i18n.eventos.campoFechaFin} *</label>
              <input type="datetime-local" id="evento-fecha-fin" class="form-control"
                     value="${fechaFinVal}" min="${fechaVal}" required />
            </div>
            <div class="col-12">
              <label for="evento-descripcion" class="form-label">${i18n.eventos.campoDescripcion} *</label>
              <textarea id="evento-descripcion" class="form-control" rows="3"
                        placeholder="${i18n.eventos.placeholderDescripcion}"
                        maxlength="4000"
                        required>${descripcion}</textarea>
            </div>
          </div>
          <div id="form-evento-error" class="alert alert-danger d-none mt-3" role="alert"></div>
          <div class="d-flex gap-2 mt-4 flex-wrap">
            <button type="submit" class="btn-jal-primary" id="btn-guardar-evento">
              <span id="btn-guardar-evento-text"><i class="bi bi-save me-1"></i>${i18n.app.guardar}</span>
              <span id="btn-guardar-evento-loading" class="d-none">
                <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Guardando…
              </span>
            </button>
            <button type="button" class="btn-jal-secondary" id="btn-cancelar-evento">${i18n.app.cancelar}</button>
          </div>
        </form>
      </div>
    `;

    document.getElementById('btn-cancelar-evento')?.addEventListener('click', () => {
      container.classList.add('d-none');
    });

    const inicioInput = document.getElementById('evento-fecha');
    const finInput = document.getElementById('evento-fecha-fin');
    inicioInput?.addEventListener('input', () => {
      if (finInput) finInput.min = inicioInput.value || '';
    });

    document.getElementById('form-evento')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const datos = {
        titulo:      document.getElementById('evento-titulo')?.value,
        descripcion: document.getElementById('evento-descripcion')?.value,
        fecha:       document.getElementById('evento-fecha')?.value,
        fecha_fin:   document.getElementById('evento-fecha-fin')?.value,
        lugar:       document.getElementById('evento-lugar')?.value,
      };

      const cbs = {
        onLoading: (v) => this._setFormLoading('btn-guardar-evento', v),
        onSuccess: async () => {
          Toast.exito(i18n.eventos.guardadoOk);
          container.classList.add('d-none');
          await this.renderEventos();
        },
        onError: (msg) => {
          const el = document.getElementById('form-evento-error');
          if (el) { el.textContent = msg; el.classList.remove('d-none'); }
        },
      };

      if (esEdicion) {
        await EventoController.actualizar(evento.id, datos, cbs);
      } else {
        await EventoController.crear(datos, cbs);
      }
    });

    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // ─── GESTIÓN DE TRÁMITES ────────────────────────────────────────────────

  /**
   * Renderiza la tabla de gestión de trámites estudiantiles.
   *
   * @returns {Promise<void>}
   */
  async renderTramites() {
    const root = document.getElementById('app-root');
    if (!root) return;

    this._limpiarUnsubs();

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/admin" class="text-white-50">Admin</a></li>
              <li class="breadcrumb-item active">Trámites</li>
            </ol>
          </nav>
          <h1><i class="bi bi-folder2-open me-2"></i>${i18n.admin.tramitesTitulo}</h1>
          <p class="page-hero-sub">${i18n.admin.tramitesSub}</p>
        </div>
      </div>

      <div class="container py-5">
        <div class="mb-4">
          <button class="btn-jal-secondary" id="btn-volver-dashboard-tr">
            <i class="bi bi-arrow-left me-1"></i> Panel Admin
          </button>
        </div>

        <div class="form-jal p-0 overflow-hidden">
          <div class="p-4 border-bottom d-flex align-items-center justify-content-between">
            <h2 class="h6 fw-700 mb-0">Solicitudes de carta barrial</h2>
            <span class="badge bg-warning-subtle text-warning-emphasis" id="badge-pendientes">
              Cargando…
            </span>
          </div>
          <div class="table-responsive">
            <table class="table table-jal mb-0" aria-label="Tabla de trámites estudiantiles">
              <thead>
                <tr>
                  <th>${i18n.admin.colNombre}</th>
                  <th>${i18n.admin.colCarrera}</th>
                  <th>${i18n.admin.colHoras}</th>
                  <th>${i18n.admin.colFecha}</th>
                  <th>${i18n.admin.colEstado}</th>
                  <th class="text-end">${i18n.admin.colAcciones}</th>
                </tr>
              </thead>
              <tbody id="tabla-tramites-body">
                <tr><td colspan="6" class="text-center py-4 text-muted">
                  <div class="spinner-border spinner-border-sm text-primary me-2" role="status" aria-hidden="true"></div>
                  ${i18n.app.cargando}
                </td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${this._buildModalConfirmacion()}
      ${this._buildModalRechazo()}
      ${this._buildModalMotivoRechazo()}
      ${this._buildModalCarta()}
    `;

    document.getElementById('btn-volver-dashboard-tr')?.addEventListener('click', () => this.renderDashboard());

    const unsub = ArchivoController.suscribirTodos((tramites) => {
      this._tramitesCache = tramites;
      this._renderTablaTramitesBody(tramites);

      const pendientes = tramites.filter((t) =>
        t.estado === ESTADOS_TRAMITE.PENDIENTE ||
        t.finalizacion_estado === 'Pendiente'
      );
      const badge = document.getElementById('badge-pendientes');
      if (badge) badge.textContent = `${pendientes.length} pendiente${pendientes.length !== 1 ? 's' : ''}`;
    });

    this._unsubs.push(unsub);
  },

  /**
   * @private
   */
  _renderTablaTramitesBody(tramites) {
    const tbody = document.getElementById('tabla-tramites-body');
    if (!tbody) return;

    if (tramites.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-5 text-muted">
            <i class="bi bi-check-circle opacity-50 d-block mb-2" style="font-size:2rem;"></i>
            ${i18n.admin.sinTramites}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = tramites.map((t) => {
      const fecha = this._formatFecha(t.fecha_solicitud);
      const badgeClass = {
        [ESTADOS_TRAMITE.PENDIENTE]: 'badge-pendiente',
        [ESTADOS_TRAMITE.APROBADO]:  'badge-aprobado',
        [ESTADOS_TRAMITE.RECHAZADO]: 'badge-rechazado',
        [ESTADOS_TRAMITE.EXPEDIDA]:  'badge-expedida',
      }[t.estado] || '';
      const finalizacionBadgeClass = {
        Pendiente:  'bg-primary-subtle text-primary-emphasis',
        Expedida:   'bg-success-subtle text-success-emphasis',
        Rechazada:  'bg-danger-subtle text-danger-emphasis',
      }[t.finalizacion_estado] || 'bg-secondary-subtle text-secondary-emphasis';

      return `
        <tr data-tramite-id="${this._esc(t.id)}">
          <td>
            <div class="fw-600">${this._esc(t.nombre_completo)}</div>
            <small class="text-muted">${this._esc(t.tipo_documento)} ${this._esc(t.numero_documento)}</small>
          </td>
          <td class="small">
            <div>${this._esc(t.carrera)}</div>
            <small class="text-muted">Semestre: ${this._esc(t.semestre_actual ?? '—')}</small>
          </td>
          <td class="small">${this._esc(t.horas_a_realizar ?? '—')} h</td>
          <td class="small text-muted">${fecha}</td>
          <td>
            <span class="badge-estado ${badgeClass}">${this._esc(t.estado)}</span>
            ${t.finalizacion_estado ? `
              <div class="mt-2">
                <span class="badge ${finalizacionBadgeClass}">Finalización: ${this._esc(t.finalizacion_estado)}</span>
              </div>
            ` : ''}
          </td>
          <td class="text-end">
            <div class="d-flex gap-1 justify-content-end flex-wrap">
              ${[ESTADOS_TRAMITE.PENDIENTE, ESTADOS_TRAMITE.APROBADO].includes(t.estado) ? `
                <button class="btn btn-sm btn-jal-primary btn-vista-previa"
                        data-id="${this._esc(t.id)}"
                        aria-label="${i18n.admin.vistaPrevia}">
                  <i class="bi bi-eye"></i> ${i18n.admin.vistaPrevia}
                </button>
              ` : ''}
              ${t.estado === ESTADOS_TRAMITE.PENDIENTE ? `
                <button class="btn btn-sm btn-outline-success btn-aprobar-tramite"
                        data-id="${this._esc(t.id)}"
                        aria-label="${i18n.admin.aprobar}">
                  <i class="bi bi-check2-circle"></i> ${i18n.admin.aprobar}
                </button>
                <button class="btn btn-sm btn-jal-danger btn-rechazar-tramite"
                        data-id="${this._esc(t.id)}"
                        aria-label="Rechazar solicitud">
                  <i class="bi bi-x-lg"></i> ${i18n.admin.rechazar}
                </button>
              ` : ''}
              ${t.estado === ESTADOS_TRAMITE.EXPEDIDA && t.documento_expedido_url ? `
                <a href="${this._esc(t.documento_expedido_url)}" target="_blank" rel="noopener noreferrer"
                   class="btn btn-sm btn-outline-success"
                   aria-label="Ver carta expedida">
                  <i class="bi bi-file-earmark-check"></i> Ver carta
                </a>
              ` : ''}
              ${t.estado === ESTADOS_TRAMITE.RECHAZADO && t.sugerencia_correccion ? `
                <button class="btn btn-sm btn-outline-danger btn-ver-motivo-rechazo"
                        data-id="${this._esc(t.id)}"
                        data-tipo="inicial"
                        aria-label="${i18n.admin.verMotivoRechazo}">
                  <i class="bi bi-chat-left-text"></i> ${i18n.admin.verMotivoRechazo}
                </button>
              ` : ''}
              ${t.finalizacion_estado === 'Rechazada' && t.finalizacion_sugerencia_correccion ? `
                <button class="btn btn-sm btn-outline-danger btn-ver-motivo-rechazo"
                        data-id="${this._esc(t.id)}"
                        data-tipo="finalizacion"
                        aria-label="${i18n.admin.verMotivoRechazo}">
                  <i class="bi bi-chat-left-text"></i> ${i18n.admin.verMotivoRechazo}
                </button>
              ` : ''}
              ${t.finalizacion_estado === 'Pendiente' ? `
                <button class="btn btn-sm btn-outline-primary btn-vista-previa-finalizacion"
                        data-id="${this._esc(t.id)}"
                        aria-label="Expedir carta de finalización">
                  <i class="bi bi-file-earmark-plus"></i> Finalización
                </button>
                <button class="btn btn-sm btn-outline-danger btn-rechazar-finalizacion"
                        data-id="${this._esc(t.id)}"
                        aria-label="${i18n.admin.rechazarFinalizacion}">
                  <i class="bi bi-x-lg"></i> ${i18n.admin.rechazarFinalizacion}
                </button>
              ` : ''}
              ${t.finalizacion_estado === 'Expedida' && t.documento_finalizacion_url ? `
                <a href="${this._esc(t.documento_finalizacion_url)}" target="_blank" rel="noopener noreferrer"
                   class="btn btn-sm btn-outline-success"
                   aria-label="Ver carta de finalización expedida">
                  <i class="bi bi-file-earmark-check"></i> Ver finalización
                </a>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-vista-previa').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tramite = tramites.find((t) => t.id === btn.dataset.id);
        if (tramite) this._mostrarVistaPrevia(tramite);
      });
    });

    tbody.querySelectorAll('.btn-aprobar-tramite').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._confirmar(i18n.admin.confirmarAprobar, async () => {
          await ArchivoController.aprobar(btn.dataset.id, {
            onLoading: () => {},
            onSuccess: () => Toast.exito(i18n.admin.aprobadoOk),
            onError:   (msg) => Toast.error(msg),
          });
        });
      });
    });

    tbody.querySelectorAll('.btn-rechazar-tramite').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tramite = tramites.find((t) => t.id === btn.dataset.id);
        if (tramite) this._mostrarModalRechazo(tramite, 'inicial');
      });
    });

    tbody.querySelectorAll('.btn-vista-previa-finalizacion').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tramite = tramites.find((t) => t.id === btn.dataset.id);
        if (tramite) this._mostrarVistaPreviaFinalizacion(tramite);
      });
    });

    tbody.querySelectorAll('.btn-rechazar-finalizacion').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tramite = tramites.find((t) => t.id === btn.dataset.id);
        if (tramite) this._mostrarModalRechazo(tramite, 'finalizacion');
      });
    });

    tbody.querySelectorAll('.btn-ver-motivo-rechazo').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tramite = tramites.find((t) => t.id === btn.dataset.id);
        if (tramite) this._mostrarModalMotivoRechazo(tramite, btn.dataset.tipo);
      });
    });

  },

  /**
   * Construye el modal para rechazar con sugerencias de correccion.
   * @private
   */
  _buildModalRechazo() {
    return `
      <div class="modal fade modal-jal" id="modal-rechazo-tramite" tabindex="-1"
           aria-labelledby="modal-rechazo-titulo" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="modal-rechazo-titulo">${i18n.admin.modalRechazoTitulo}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              <form id="form-rechazo-tramite" novalidate>
                <p class="small text-muted mb-3" id="modal-rechazo-intro"></p>
                <div class="mb-2">
                  <label class="form-label" for="rechazo-sugerencia">${i18n.admin.sugerenciaCorreccionLabel}</label>
                  <textarea
                    class="form-control"
                    id="rechazo-sugerencia"
                    rows="5"
                    maxlength="1000"
                    required
                    placeholder="${i18n.admin.sugerenciaCorreccionPlaceholder}"
                  ></textarea>
                  <div class="invalid-feedback">${i18n.admin.sugerenciaCorreccionRequerida}</div>
                  <div class="form-text">${i18n.admin.sugerenciaCorreccionHelp}</div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${i18n.app.cancelar}</button>
              <button type="submit" class="btn btn-danger" id="btn-confirmar-rechazo" form="form-rechazo-tramite">
                <span id="btn-confirmar-rechazo-text">${i18n.admin.rechazar}</span>
                <span id="btn-confirmar-rechazo-loading" class="d-none">
                  <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  ${i18n.app.guardando}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Muestra el modal de rechazo y guarda la sugerencia correspondiente.
   * @private
   */
  _mostrarModalRechazo(tramite, tipo) {
    const modalEl = document.getElementById('modal-rechazo-tramite');
    const tituloEl = document.getElementById('modal-rechazo-titulo');
    const formActual = document.getElementById('form-rechazo-tramite');

    if (!modalEl || !tituloEl || !formActual) return;

    const esFinalizacion = tipo === 'finalizacion';
    const form = formActual.cloneNode(true);
    formActual.parentNode.replaceChild(form, formActual);

    const textarea = form.querySelector('#rechazo-sugerencia');
    const introEl = form.querySelector('#modal-rechazo-intro');
    const sugerenciaActual = esFinalizacion
      ? tramite.finalizacion_sugerencia_correccion
      : tramite.sugerencia_correccion;

    tituloEl.textContent = esFinalizacion
      ? i18n.admin.modalRechazoFinalizacionTitulo
      : i18n.admin.modalRechazoTitulo;

    if (introEl) {
      introEl.innerHTML = `${i18n.admin.sugerenciaCorreccionHelp}<br><strong>${this._esc(tramite.nombre_completo)}</strong>`;
    }

    if (textarea) {
      textarea.value = sugerenciaActual || '';
      textarea.classList.remove('is-invalid');
      textarea.addEventListener('input', () => textarea.classList.remove('is-invalid'));
    }

    const bsModal = new window.bootstrap.Modal(modalEl);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const sugerencia = String(textarea?.value || '').trim().replace(/\s+/g, ' ');
      if (!this._validarSugerenciaRechazo(textarea, sugerencia)) return;

      const accion = esFinalizacion
        ? ArchivoController.rechazarFinalizacion.bind(ArchivoController)
        : ArchivoController.rechazar.bind(ArchivoController);

      await accion(tramite.id, sugerencia, {
        onLoading: (v) => this._setFormLoading('btn-confirmar-rechazo', v),
        onSuccess: () => {
          Toast.exito(esFinalizacion ? i18n.admin.finalizacionRechazadaOk : i18n.admin.rechazadoOk);
          bsModal.hide();
        },
        onError: (msg) => Toast.error(msg),
      });
    });

    modalEl.addEventListener('shown.bs.modal', () => textarea?.focus(), { once: true });
    bsModal.show();
  },

  _validarSugerenciaRechazo(textarea, sugerencia) {
    const valida = sugerencia.length > 0 && sugerencia.length <= 1000;
    textarea?.classList.toggle('is-invalid', !valida);
    return valida;
  },

  /**
   * Construye el modal de lectura del motivo de rechazo enviado al estudiante.
   * @private
   */
  _buildModalMotivoRechazo() {
    return `
      <div class="modal fade modal-jal" id="modal-motivo-rechazo" tabindex="-1"
           aria-labelledby="modal-motivo-rechazo-titulo" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="modal-motivo-rechazo-titulo">${i18n.admin.modalMotivoRechazoTitulo}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body" id="modal-motivo-rechazo-body"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${i18n.app.cerrar}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Muestra el comentario enviado al estudiante al rechazar una solicitud.
   * @private
   */
  _mostrarModalMotivoRechazo(tramite, tipo) {
    const modalEl = document.getElementById('modal-motivo-rechazo');
    const tituloEl = document.getElementById('modal-motivo-rechazo-titulo');
    const bodyEl = document.getElementById('modal-motivo-rechazo-body');

    if (!modalEl || !tituloEl || !bodyEl) return;

    const esFinalizacion = tipo === 'finalizacion';
    const comentario = esFinalizacion
      ? tramite.finalizacion_sugerencia_correccion
      : tramite.sugerencia_correccion;
    const fechaRevision = esFinalizacion
      ? tramite.fecha_sugerencia_finalizacion
      : tramite.fecha_sugerencia_correccion;
    const fecha = this._formatFecha(fechaRevision);

    tituloEl.textContent = esFinalizacion
      ? i18n.admin.modalMotivoRechazoFinalizacionTitulo
      : i18n.admin.modalMotivoRechazoTitulo;

    bodyEl.innerHTML = `
      <div class="mb-3">
        <div class="fw-700">${this._esc(tramite.nombre_completo)}</div>
        <small class="text-muted">
          ${this._esc(tramite.tipo_documento)} ${this._esc(tramite.numero_documento)}
          ${fechaRevision ? ` · ${fecha}` : ''}
        </small>
      </div>
      <div class="alert alert-danger d-flex gap-2 mb-0" role="note">
        <i class="bi bi-chat-left-text flex-shrink-0" aria-hidden="true"></i>
        <div>
          <div class="fw-700 mb-1">${i18n.admin.motivoRechazoIntro}</div>
          <div class="admin-motivo-rechazo-text">${this._esc(comentario || i18n.admin.motivoRechazoSinComentario)}</div>
        </div>
      </div>
    `;

    new window.bootstrap.Modal(modalEl).show();
  },

  /**
   * Construye el modal de vista previa de la carta.
   * @private
   */
  _buildModalCarta() {
    return `
      <div class="modal fade modal-jal" id="modal-carta-preview" tabindex="-1"
           aria-labelledby="modal-carta-titulo" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="modal-carta-titulo">${i18n.admin.modalCartaTitulo}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              <div id="modal-carta-contenido" class="carta-preview"></div>
              <div id="modal-carta-progress" class="d-none mt-3">
                <div class="d-flex align-items-center gap-2">
                  <div class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></div>
                  <span id="modal-carta-progress-msg" class="text-muted small">${i18n.app.cargando}</span>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${i18n.app.cancelar}</button>
              <button type="button" class="btn btn-jal-secondary" id="btn-descargar-carta">
                <i class="bi bi-download me-1"></i>${i18n.admin.descargarCarta}
              </button>
              <button type="button" class="btn btn-jal-primary" id="btn-expedir-carta">
                <i class="bi bi-check2-circle me-1"></i>${i18n.admin.marcarExpedida}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Muestra el modal con la vista previa de la carta.
   * @private
   * @param {Object} tramite
   */
  _mostrarVistaPrevia(tramite) {
    const contenido = document.getElementById('modal-carta-contenido');
    const btnExpedir = document.getElementById('btn-expedir-carta');
    const btnDescargar = document.getElementById('btn-descargar-carta');
    const modalEl = document.getElementById('modal-carta-preview');
    const tituloEl = document.getElementById('modal-carta-titulo');

    if (!contenido || !btnExpedir || !btnDescargar || !modalEl) return;

    if (tituloEl) tituloEl.textContent = i18n.admin.modalCartaTitulo;
    btnDescargar.innerHTML = `<i class="bi bi-download me-1"></i>${i18n.admin.descargarCarta}`;
    btnExpedir.classList.add('d-none');
    btnExpedir.disabled = true;

    const fechaCarta = new Date().toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    contenido.innerHTML = `
      <p class="text-end mb-4">Medellín, ${fechaCarta}</p>
      <h6 class="text-center fw-bold text-uppercase mb-4">Autorización de Servicio Social</h6>
      <p class="fw-bold mb-3">A quien pueda interesar</p>
      <p class="carta-preview-body">
        La Junta Administradora Local de la Comuna 3 Manrique autoriza que el(la) estudiante
        <strong>${this._esc(tramite.nombre_completo)}</strong>.
        Identificado(a) con <strong>${this._esc(tramite.tipo_documento)}</strong>
        N.° <strong>${this._esc(tramite.numero_documento)}</strong>,
        estudiante de la <strong>${this._esc(tramite.universidad)}</strong>
        en la carrera de <strong>${this._esc(tramite.carrera)}</strong>,
        actualmente cursando el semestre <strong>${this._esc(tramite.semestre_actual ?? '—')}</strong>,
        realice las <strong>${this._esc(tramite.horas_a_realizar)}</strong> horas de servicio social
        en el lugar <strong>${this._esc(tramite.lugar_realizacion)}</strong>.
      </p>
      <p class="mt-4 mb-1">Cordialmente,</p>
      <p class="mb-0 fw-600">Johan Sebastián Palacio C.</p>
      <p class="mb-4 text-muted small">Presidente JAL Comuna 3, Manrique</p>
      <hr />
      <p class="text-muted small mb-0">
        Junta Administradora Local de la Comuna 3 - Manrique<br>
        Dirección: Carrera 43 No 66e-03 &nbsp;|&nbsp; TELEFAX: 5718047<br>
        E-mail: jalcomuna32024@gmail.com &nbsp;|&nbsp; Medellín - Colombia
      </p>
    `;

    const bsModal = new window.bootstrap.Modal(modalEl);

    // ─── Botón: Descargar carta (local, sin cambiar estado ni subir a Drive) ───
    const newBtnDesc = btnDescargar.cloneNode(true);
    btnDescargar.parentNode.replaceChild(newBtnDesc, btnDescargar);

    newBtnDesc.addEventListener('click', async () => {
      await ArchivoController.descargarCarta(tramite, {
        onLoading: (v) => {
          const prog = document.getElementById('modal-carta-progress');
          if (prog) prog.classList.toggle('d-none', !v);
          newBtnDesc.disabled = v;
        },
        onProgress: (msg) => {
          const el = document.getElementById('modal-carta-progress-msg');
          if (el) el.textContent = msg;
        },
        onSuccess: ({ blob, nombreArchivo }) => {
          this._descargarBlob(blob, nombreArchivo);
          Toast.exito(i18n.admin.descargadoOk);
        },
        onError: (msg) => Toast.error(msg),
      });
    });

    bsModal.show();
  },

  /**
   * Muestra el modal con la vista previa de la carta de finalizacion.
   * @private
   * @param {Object} tramite
   */
  _mostrarVistaPreviaFinalizacion(tramite) {
    const contenido = document.getElementById('modal-carta-contenido');
    const btnExpedir = document.getElementById('btn-expedir-carta');
    const btnDescargar = document.getElementById('btn-descargar-carta');
    const modalEl = document.getElementById('modal-carta-preview');
    const tituloEl = document.getElementById('modal-carta-titulo');

    if (!contenido || !btnExpedir || !btnDescargar || !modalEl) return;

    if (tituloEl) tituloEl.textContent = i18n.admin.modalFinalizacionTitulo;
    btnDescargar.innerHTML = `<i class="bi bi-download me-1"></i>${i18n.admin.descargarFinalizacion}`;
    btnExpedir.innerHTML = `<i class="bi bi-check2-circle me-1"></i>${i18n.admin.marcarFinalizacionExpedida}`;
    btnExpedir.classList.remove('d-none');
    btnExpedir.disabled = false;

    const fechaCarta = new Date().toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    contenido.innerHTML = `
      <p class="text-end mb-4">Medellín, ${fechaCarta}</p>
      <h6 class="text-center fw-bold text-uppercase mb-4">Certificado de Servicio Social</h6>
      <p class="fw-bold mb-3">A quien pueda interesar</p>
      <p class="carta-preview-body">
        La Junta Administradora Local de la Comuna 3 Manrique certifica que el(la) estudiante
        <strong>${this._esc(tramite.nombre_completo)}</strong>.
        Identificado(a) con <strong>${this._esc(tramite.tipo_documento)}</strong>
        N.° <strong>${this._esc(tramite.numero_documento)}</strong>
        de <strong>${this._esc(tramite.ciudad_documento)}</strong>.
        Estudiante de la <strong>${this._esc(tramite.universidad)}</strong>
        del programa de <strong>${this._esc(tramite.carrera)}</strong>,
        en el <strong>${this._esc(tramite.semestre_actual ?? '—')}</strong> semestre
        cumplió con <strong>${this._esc(tramite.horas_a_realizar)}</strong> horas de servicio social
        en <strong>${this._esc(tramite.lugar_realizacion)}</strong>.
      </p>
      <p class="mt-4 mb-1">Cordialmente,</p>
      <p class="mb-0 fw-600">Johan Sebastián Palacio Munera.</p>
      <p class="mb-4 text-muted small">Presidente JAL Comuna 3, Manrique</p>
      <hr />
      <p class="text-muted small mb-0">
        Junta Administradora Local de la Comuna 3 - Manrique<br>
        Dirección: Carrera 43 No 66e-03 &nbsp;|&nbsp; TELEFAX: 5718047<br>
        E-mail: jalcomuna32024@gmail.com &nbsp;|&nbsp; Medellín - Colombia
      </p>
    `;

    const bsModal = new window.bootstrap.Modal(modalEl);

    const newBtnDesc = btnDescargar.cloneNode(true);
    btnDescargar.parentNode.replaceChild(newBtnDesc, btnDescargar);

    newBtnDesc.addEventListener('click', async () => {
      await ArchivoController.descargarCartaFinalizacion(tramite, {
        onLoading: (v) => {
          const prog = document.getElementById('modal-carta-progress');
          if (prog) prog.classList.toggle('d-none', !v);
          newBtnDesc.disabled = v;
        },
        onProgress: (msg) => {
          const el = document.getElementById('modal-carta-progress-msg');
          if (el) el.textContent = msg;
        },
        onSuccess: ({ blob, nombreArchivo }) => {
          this._descargarBlob(blob, nombreArchivo);
          Toast.exito(i18n.admin.descargadoOk);
        },
        onError: (msg) => Toast.error(msg),
      });
    });

    const newBtn = btnExpedir.cloneNode(true);
    btnExpedir.parentNode.replaceChild(newBtn, btnExpedir);

    newBtn.addEventListener('click', async () => {
      await ArchivoController.expedirDocumentoFinalizacion(tramite.id, tramite, {
        onLoading: (v) => {
          const prog = document.getElementById('modal-carta-progress');
          if (prog) prog.classList.toggle('d-none', !v);
          newBtn.disabled = v;
        },
        onProgress: (msg) => {
          const el = document.getElementById('modal-carta-progress-msg');
          if (el) el.textContent = msg;
        },
        onSuccess: () => {
          Toast.exito(i18n.admin.finalizacionExpedidaOk);
          bsModal.hide();
        },
        onError: (msg) => Toast.error(msg),
      });
    });

    bsModal.show();
  },

  /**
   * Dispara la descarga de un Blob en el dispositivo del Edil.
   * @private
   * @param {Blob}   blob
   * @param {string} nombreArchivo
   */
  _descargarBlob(blob, nombreArchivo) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /**
   * Muestra una fila de error dentro de una tabla administrativa.
   * @private
   */
  _renderTablaError(tbodyId, colspan, mensaje) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="text-center py-5 text-muted">
          <i class="bi bi-exclamation-triangle opacity-50 d-block mb-2" style="font-size:2rem;"></i>
          ${this._esc(mensaje)}
        </td>
      </tr>
    `;
  },

  /**
   * Construye una casilla de busqueda reutilizable para tablas.
   * @private
   */
  _buildSearchBox({ id, label, placeholder, compact = false }) {
    return `
      <div class="content-search ${compact ? 'content-search--compact' : ''}">
        <label class="visually-hidden" for="${id}">${label}</label>
        <div class="input-group">
          <span class="input-group-text" aria-hidden="true">
            <i class="bi bi-search"></i>
          </span>
          <input
            type="search"
            class="form-control"
            id="${id}"
            placeholder="${placeholder}"
            autocomplete="off"
          >
        </div>
      </div>
    `;
  },

  /**
   * Enlaza una casilla de busqueda con su renderizador.
   * @private
   */
  _bindSearchInput(inputId, onSearch) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('input', () => onSearch(input.value));
  },

  /**
   * Filtra noticias por titulo, cuerpo o fecha.
   * @private
   */
  _filtrarNoticias(noticias, termino) {
    const q = this._normalizarBusqueda(termino);
    if (!q) return noticias;

    return noticias.filter((noticia) => this._coincideBusqueda(q, [
      noticia.titulo,
      noticia.cuerpo,
      this._formatFecha(noticia.fechaPublicacion),
    ]));
  },

  /**
   * Filtra eventos por titulo, lugar, descripcion o fecha.
   * @private
   */
  _filtrarEventos(eventos, termino) {
    const q = this._normalizarBusqueda(termino);
    if (!q) return eventos;

    return eventos.filter((evento) => this._coincideBusqueda(q, [
      evento.titulo,
      evento.lugar,
      evento.descripcion,
      this._formatFecha(evento.fecha),
      this._formatHora(evento.fecha),
    ]));
  },

  /**
   * Normaliza texto para busquedas insensibles a mayusculas y acentos.
   * @private
   */
  _normalizarBusqueda(valor) {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  },

  /**
   * Indica si algun valor contiene el termino normalizado.
   * @private
   */
  _coincideBusqueda(terminoNormalizado, valores) {
    return valores.some((valor) => this._normalizarBusqueda(valor).includes(terminoNormalizado));
  },

  /**
   * Escapa HTML para prevenir XSS en datos de usuario.
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

  // ─── HELPERS ──────────────────────────────────────────────────────────

  /**
   * Construye el HTML del modal de confirmación reutilizable.
   * @private
   */
  _buildModalConfirmacion() {
    return `
      <div class="modal fade modal-jal" id="modal-confirmacion" tabindex="-1"
           aria-labelledby="modal-confirm-titulo" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="modal-confirm-titulo">Confirmar acción</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body" id="modal-confirm-body">¿Estás seguro?</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-danger" id="modal-confirm-aceptar">Confirmar</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Muestra el modal de confirmación con un mensaje y ejecuta el callback al confirmar.
   * @private
   * @param {string}   mensaje
   * @param {function} onConfirm
   */
  _confirmar(mensaje, onConfirm) {
    const bodyEl   = document.getElementById('modal-confirm-body');
    const btnAcept = document.getElementById('modal-confirm-aceptar');
    const modalEl  = document.getElementById('modal-confirmacion');

    if (!bodyEl || !btnAcept || !modalEl) return;

    bodyEl.innerHTML = mensaje;

    const bsModal = new window.bootstrap.Modal(modalEl);

    // Clonar para quitar listeners anteriores
    const newBtn = btnAcept.cloneNode(true);
    btnAcept.parentNode.replaceChild(newBtn, btnAcept);

    newBtn.addEventListener('click', async () => {
      bsModal.hide();
      await onConfirm();
    });

    bsModal.show();
  },

  /**
   * Activa/desactiva el estado de carga de un botón de formulario.
   * @private
   * @param {string}  btnId     - ID base del botón (ej: 'btn-guardar-noticia')
   * @param {boolean} cargando
   */
  _setFormLoading(btnId, cargando) {
    const text    = document.getElementById(`${btnId}-text`);
    const loading = document.getElementById(`${btnId}-loading`);
    const btn     = document.getElementById(btnId);

    if (cargando) {
      text?.classList.add('d-none');
      loading?.classList.remove('d-none');
      if (btn) btn.disabled = true;
    } else {
      text?.classList.remove('d-none');
      loading?.classList.add('d-none');
      if (btn) btn.disabled = false;
    }
  },

  /**
   * Formatea un Timestamp de Firestore a fecha legible.
   * @private
   */
  _formatFecha(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  /**
   * Formatea una hora para busquedas en eventos.
   * @private
   */
  _formatHora(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  },

  /**
   * Convierte un Timestamp/fecha al formato de un input datetime-local
   * (YYYY-MM-DDTHH:mm) en hora local. Devuelve '' si no hay fecha válida.
   * @private
   */
  _formatDatetimeLocal(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  },

  /**
   * Cancela todas las suscripciones activas de listeners en tiempo real.
   * @private
   */
  _limpiarUnsubs() {
    this._unsubs.forEach((unsub) => {
      if (typeof unsub === 'function') unsub();
    });
    this._unsubs = [];
  },

  /**
   * Destruye el AdminView, limpiando todos los listeners.
   * @returns {void}
   */
  destruir() {
    this._limpiarUnsubs();
    AdminUsuariosView.destruir();
    AdminSolicitudesAccesoView.destruir();
  },
};

export default AdminView;
