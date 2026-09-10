import NoticiaController from '../controllers/NoticiaController.js';
import EventoController  from '../controllers/EventoController.js';
import Carousel          from '../components/Carousel.js';
import Toast             from '../components/Toast.js';
import { i18n }          from '../config/i18n.js';

/** Datos del carrusel hero (estáticos, de la JAL) */
const SLIDES_HERO = [
  {
    // Special:FilePath redirige a la ubicacion vigente del archivo, por lo
    // que sobrevive a re-subidas (los thumbs con hash /9/91/ ya no existen).
    imgUrl:      'https://commons.wikimedia.org/wiki/Special:FilePath/Medell%C3%ADn_Colombia.jpg?width=1280',
    tag:         'Portal Oficial',
    titulo:      'Junta Administradora Local — Comuna 3 Manrique',
    descripcion: 'Trabajando por el bienestar, la participación y el desarrollo de nuestra comunidad.',
    ctaUrl:      '#/noticias',
    ctaTexto:    'Ver Noticias',
  },
  {
    // El archivo original "Barrio Manrique - Medellin.jpg" fue eliminado de
    // Commons; se usa una foto vigente tomada en la 45 de Manrique.
    imgUrl:      'https://commons.wikimedia.org/wiki/Special:FilePath/Empieza_a_llover_en_Medellin_desde_la_45_Manrique_-_panoramio.jpg?width=1280',
    tag:         'Trámites',
    titulo:      'Carta Barrial para Estudiantes',
    descripcion: 'Solicita tu Carta Barrial de manera fácil y rápida a través de nuestro portal.',
    ctaUrl:      '#/tramite',
    ctaTexto:    'Gestionar Trámite',
  },
  {
    imgUrl:      'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1280',
    tag:         'Comunidad',
    titulo:      'Eventos y Actividades Comunitarias',
    descripcion: 'Entérate de reuniones, talleres y actividades de la JAL.',
    ctaUrl:      '#/eventos',
    ctaTexto:    'Ver Eventos',
  },
];

const EVENTOS_TIME_ZONE = 'America/Bogota';

const PublicoView = {
  // ─── INICIO ──────────────────────────────────────────────────────────────

  /**
   * Renderiza la página de inicio con carrusel, noticias y eventos.
   *
   * @returns {Promise<void>}
   */
  async renderInicio() {
    const root = document.getElementById('app-root');
    if (!root) return;

    root.innerHTML = this._buildInicioHTML();

    // Inicializar carrusel
    Carousel.init({
      containerId: 'hero-carousel-container',
      slides:      SLIDES_HERO,
      intervalo:   7000,
      autoplay:    true,
    });

    // Cargar noticias recientes
    await NoticiaController.listar({
      onLoading: (v) => this._setSkeletonNoticias(v),
      onSuccess: (noticias) => this._renderNoticiasHome(noticias.slice(0, 3)),
      onError:   (msg) => {
        this._renderContainerError('noticias-home-container', i18n.noticias.errorCarga, msg, 'bi-exclamation-triangle');
        Toast.error(msg);
      },
    }, 3);

    // Cargar eventos recientes (incluye pasados, más recientes primero)
    await EventoController.listarRecientes({
      onLoading: (v) => this._setSkeletonEventos(v),
      onSuccess: (eventos) => this._renderEventosHome(eventos.slice(0, 4)),
      onError:   (msg) => {
        this._renderContainerError('eventos-home-container', i18n.eventos.errorCarga, msg, 'bi-exclamation-triangle');
        Toast.error(msg);
      },
    });
  },

  /**
   * Construye el HTML de la página de inicio.
   *
   * @private
   * @returns {string}
   */
  _buildInicioHTML() {
    return `
      <!-- Hero Carousel -->
      <div id="hero-carousel-container" style="min-height:320px;background:#0f172a;"></div>

      <!-- Sección: Últimas Noticias -->
      <section class="py-5" aria-labelledby="titulo-noticias">
        <div class="container">
          <div class="d-flex align-items-end justify-content-between mb-4 flex-wrap gap-2">
            <div>
              <h2 id="titulo-noticias" class="section-title mb-1">
                <i class="bi bi-newspaper text-primary me-2"></i>${i18n.inicio.ultimasNoticias}
              </h2>
              <div class="section-divider"></div>
            </div>
            <a href="#/noticias" class="btn-jal-secondary" aria-label="Ver todas las noticias">
              ${i18n.inicio.verTodas} <i class="bi bi-arrow-right ms-1"></i>
            </a>
          </div>
          <div id="noticias-home-container" class="row g-4">
            ${this._buildSkeletonCards(3)}
          </div>
        </div>
      </section>

      <hr class="divider-gradient mx-auto" style="max-width:600px;">

      <!-- Sección: Eventos Recientes -->
      <section class="py-5 bg-light" aria-labelledby="titulo-eventos">
        <div class="container">
          <div class="d-flex align-items-end justify-content-between mb-4 flex-wrap gap-2">
            <div>
              <h2 id="titulo-eventos" class="section-title mb-1">
                <i class="bi bi-calendar-event text-primary me-2"></i>${i18n.inicio.eventosRecientes}
              </h2>
              <div class="section-divider"></div>
            </div>
            <a href="#/eventos" class="btn-jal-secondary" aria-label="Ver todos los eventos">
              ${i18n.inicio.verTodos} <i class="bi bi-arrow-right ms-1"></i>
            </a>
          </div>
          <div id="eventos-home-container" class="row g-4">
            ${this._buildSkeletonCards(4, true)}
          </div>
        </div>
      </section>

      <!-- Sección: Información institucional -->
      <section class="py-5" aria-label="Información institucional">
        <div class="container">
          <div class="row g-4 justify-content-center">
            <div class="col-md-4">
              <div class="card-contacto text-center">
                <div class="text-primary mb-3" style="font-size:2.5rem;"><i class="bi bi-geo-alt-fill"></i></div>
                <h3 class="h6 fw-700">Ubicación</h3>
                <p class="text-muted small mb-0">${i18n.contacto.direccion}</p>
              </div>
            </div>
            <div class="col-md-4">
              <div class="card-contacto text-center">
                <div class="text-primary mb-3" style="font-size:2.5rem;"><i class="bi bi-clock-fill"></i></div>
                <h3 class="h6 fw-700">Horario de Atención</h3>
                <p class="text-muted small mb-0">${i18n.contacto.horarioVal}</p>
              </div>
            </div>
            <div class="col-md-4">
              <div class="card-contacto text-center">
                <div class="text-primary mb-3" style="font-size:2.5rem;"><i class="bi bi-telephone-fill"></i></div>
                <h3 class="h6 fw-700">Contacto</h3>
                <p class="text-muted small mb-0">jalcomuna3@medellin.gov.co</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  },
// ─── NOTICIAS — LISTA ────────────────────────────────────────────────────

  /**
   * Renderiza la página de listado de noticias.
   *
   * @returns {Promise<void>}
   */
  async renderNoticias() {
    const root = document.getElementById('app-root');
    if (!root) return;

    root.innerHTML = `
      <!-- Hero de página -->
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/inicio" class="text-white-50">Inicio</a></li>
              <li class="breadcrumb-item active">Noticias</li>
            </ol>
          </nav>
          <h1><i class="bi bi-newspaper me-2"></i>${i18n.noticias.titulo}</h1>
          <p class="page-hero-sub">${i18n.noticias.subtitulo}</p>
        </div>
      </div>

      <div class="container py-4">
        ${this._buildSearchBox({
          id: 'buscador-noticias',
          label: i18n.app.buscar,
          placeholder: i18n.noticias.buscarPlaceholder,
        })}
        <div id="noticias-lista" class="row g-4">
          ${this._buildSkeletonCards(6)}
        </div>
      </div>
    `;

    await NoticiaController.listar({
      onLoading: () => {},
      onSuccess: (noticias) => {
        this._renderNoticiasListado(noticias);
        this._bindSearchInput('buscador-noticias', (termino) => {
          const filtradas = this._filtrarNoticias(noticias, termino);
          this._renderNoticiasListado(filtradas, Boolean(this._normalizarBusqueda(termino)));
        });
      },
      onError: (msg) => {
        this._renderContainerError('noticias-lista', i18n.noticias.errorCarga, msg, 'bi-exclamation-triangle');
        Toast.error(msg);
      },
    });
  },

  // ─── NOTICIAS — DETALLE ──────────────────────────────────────────────────

  /**
   * Renderiza el detalle completo de una noticia.
   *
   * @param {string} id - ID de la noticia en Firestore
   * @returns {Promise<void>}
   */
  async renderNoticiaDetalle(id) {
    const root = document.getElementById('app-root');
    if (!root) return;

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/inicio" class="text-white-50">Inicio</a></li>
              <li class="breadcrumb-item"><a href="#/noticias" class="text-white-50">Noticias</a></li>
              <li class="breadcrumb-item active">Detalle</li>
            </ol>
          </nav>
          <h1>Noticia</h1>
        </div>
      </div>
      <div class="container py-5">
        <div id="noticia-detalle-content" class="row justify-content-center">
          <div class="col-lg-8">
            <div class="skeleton" style="height:300px;border-radius:1rem;margin-bottom:1.5rem;"></div>
            <div class="skeleton" style="height:2.5rem;width:80%;margin-bottom:1rem;"></div>
            <div class="skeleton" style="height:1rem;width:40%;margin-bottom:2rem;"></div>
            <div class="skeleton" style="height:1rem;margin-bottom:0.5rem;"></div>
            <div class="skeleton" style="height:1rem;margin-bottom:0.5rem;"></div>
            <div class="skeleton" style="height:1rem;width:70%;"></div>
          </div>
        </div>
      </div>
    `;

    await NoticiaController.obtenerDetalle(id, {
      onLoading: () => {},
      onSuccess: (noticia) => {
        const container = document.getElementById('noticia-detalle-content');
        if (!container) return;
        const titulo = this._esc(noticia.titulo);
        const cuerpo = this._esc(noticia.cuerpo || '').replace(/\n/g, '<br>');
        container.innerHTML = `
          <div class="col-lg-8 animate-fade-in-up">
            <a href="#/noticias" class="btn-jal-secondary mb-4 d-inline-flex align-items-center gap-2">
              <i class="bi bi-arrow-left"></i> ${i18n.noticias.volver}
            </a>

            ${this._buildNoticiaMediaDetalle(noticia)}

            <h1 class="noticia-detail-titulo">${titulo}</h1>

            <div class="noticia-detail-meta">
              <span class="meta-item">
                <i class="bi bi-calendar3"></i>
                ${i18n.noticias.publicadoEl} ${this._formatearFecha(noticia.fechaPublicacion)}
              </span>
            </div>

            <div class="noticia-detail-cuerpo">
              ${cuerpo}
            </div>

            <div class="mt-4 pt-3 border-top">
              <a href="#/noticias" class="btn-jal-secondary d-inline-flex align-items-center gap-2">
                <i class="bi bi-arrow-left"></i> ${i18n.noticias.volver}
              </a>
            </div>
          </div>
        `;
        this._aplicarFondosBlur(container);
      },
      onError: (msg) => {
        const container = document.getElementById('noticia-detalle-content');
        if (container) {
          container.innerHTML = `<div class="col-12"><div class="alert alert-warning">${this._esc(msg)}</div></div>`;
        }
        Toast.error(msg);
      },
    });
  },

  // ─── EVENTOS ─────────────────────────────────────────────────────────────

  /**
   * Renderiza la página de listado de eventos.
   *
   * @returns {Promise<void>}
   */
  async renderEventos() {
    const root = document.getElementById('app-root');
    if (!root) return;

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/inicio" class="text-white-50">Inicio</a></li>
              <li class="breadcrumb-item active">Eventos</li>
            </ol>
          </nav>
          <h1><i class="bi bi-calendar-event me-2"></i>${i18n.eventos.titulo}</h1>
          <p class="page-hero-sub">${i18n.eventos.subtitulo}</p>
        </div>
      </div>

      <div class="container py-4">
        ${this._buildSearchBox({
          id: 'buscador-eventos',
          label: i18n.app.buscar,
          placeholder: i18n.eventos.buscarPlaceholder,
        })}
        <div id="eventos-lista" class="row g-4">
          ${this._buildSkeletonCards(6, true)}
        </div>
      </div>
    `;

    await EventoController.listarRecientes({
      onLoading: () => {},
      onSuccess: (eventos) => {
        this._renderEventosListado(eventos);
        this._bindSearchInput('buscador-eventos', (termino) => {
          const filtrados = this._filtrarEventos(eventos, termino);
          this._renderEventosListado(filtrados, Boolean(this._normalizarBusqueda(termino)));
        });
      },
      onError: (msg) => {
        this._renderContainerError('eventos-lista', i18n.eventos.errorCarga, msg, 'bi-exclamation-triangle');
        Toast.error(msg);
      },
    });
  },

  // ─── CONTACTO ────────────────────────────────────────────────────────────

  /**
   * Renderiza la página estática de contacto.
   *
   * @returns {void}
   */
  renderContacto() {
    const root = document.getElementById('app-root');
    if (!root) return;

    // Datos estáticos de los ediles (sin BD)
    const EDILES = [
      {
        nombre:  'Claudia Patricia Restrepo',
        cargo:   'Presidenta JAL',
        tel:     '(604) 385-6000 ext. 10201',
        correo:  'c.restrepo@jalcomuna3.gov.co',
      },
      {
        nombre:  'Carlos Andrés Gómez',
        cargo:   'Vicepresidente JAL',
        tel:     '(604) 385-6000 ext. 10202',
        correo:  'ca.gomez@jalcomuna3.gov.co',
      },
      {
        nombre:  'María Fernanda López',
        cargo:   'Edil — Comisión de Educación',
        tel:     '(604) 385-6000 ext. 10203',
        correo:  'mf.lopez@jalcomuna3.gov.co',
      },
      {
        nombre:  'José Luis Herrera',
        cargo:   'Edil — Comisión de Salud',
        tel:     '(604) 385-6000 ext. 10204',
        correo:  'jl.herrera@jalcomuna3.gov.co',
      },
      {
        nombre:  'Leidy Johana Muñoz',
        cargo:   'Edil — Comisión de Infraestructura',
        tel:     '(604) 385-6000 ext. 10205',
        correo:  'lj.munoz@jalcomuna3.gov.co',
      },
      {
        nombre:  'Andrés Felipe Ospina',
        cargo:   'Edil — Comisión de Cultura',
        tel:     '(604) 385-6000 ext. 10206',
        correo:  'af.ospina@jalcomuna3.gov.co',
      },
    ];

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/inicio" class="text-white-50">Inicio</a></li>
              <li class="breadcrumb-item active">Contacto</li>
            </ol>
          </nav>
          <h1><i class="bi bi-person-lines-fill me-2"></i>${i18n.contacto.titulo}</h1>
          <p class="page-hero-sub">${i18n.contacto.subtitulo}</p>
        </div>
      </div>

      <div class="container py-5">
        <!-- Info institucional -->
        <div class="row g-4 mb-5">
          <div class="col-12">
            <div class="form-jal p-4">
              <div class="row g-4">
                <div class="col-md-4 text-center">
                  <i class="bi bi-geo-alt-fill text-primary mb-2" style="font-size:2rem;"></i>
                  <h3 class="h6 fw-700 mb-1">Dirección</h3>
                  <p class="text-muted small mb-0">${i18n.contacto.direccion}</p>
                </div>
                <div class="col-md-4 text-center">
                  <i class="bi bi-clock-fill text-primary mb-2" style="font-size:2rem;"></i>
                  <h3 class="h6 fw-700 mb-1">Horario de Atención</h3>
                  <p class="text-muted small mb-0">${i18n.contacto.horarioVal}</p>
                </div>
                <div class="col-md-4 text-center">
                  <i class="bi bi-envelope-fill text-primary mb-2" style="font-size:2rem;"></i>
                  <h3 class="h6 fw-700 mb-1">Correo Institucional</h3>
                  <p class="text-muted small mb-0">jalcomuna3@medellin.gov.co</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Ediles -->
        <h2 class="section-title mb-1">Ediles de la JAL</h2>
        <div class="section-divider mb-4"></div>
        <div class="row g-4">
          ${EDILES.map((e) => `
            <div class="col-md-6 col-lg-4 animate-fade-in-up">
              <div class="card-contacto">
                <div class="avatar">${e.nombre.split(' ').map(p => p[0]).slice(0,2).join('')}</div>
                <p class="contacto-nombre">${e.nombre}</p>
                <p class="contacto-cargo">${e.cargo}</p>
                <p class="contacto-info">
                  <i class="bi bi-telephone"></i>
                  <a href="tel:${e.tel.replace(/\D/g,'')}" class="text-muted">${e.tel}</a>
                </p>
                <p class="contacto-info">
                  <i class="bi bi-envelope"></i>
                  <a href="mailto:${e.correo}" class="text-muted">${e.correo}</a>
                </p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },
// ─── NOTICIAS — LISTA ────────────────────────────────────────────────────

  /**
   * Renderiza la página de listado de noticias.
   *
   * @returns {Promise<void>}
   */
  async renderNoticias() {
    const root = document.getElementById('app-root');
    if (!root) return;

    root.innerHTML = `
      <!-- Hero de página -->
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/inicio" class="text-white-50">Inicio</a></li>
              <li class="breadcrumb-item active">Noticias</li>
            </ol>
          </nav>
          <h1><i class="bi bi-newspaper me-2"></i>${i18n.noticias.titulo}</h1>
          <p class="page-hero-sub">${i18n.noticias.subtitulo}</p>
        </div>
      </div>

      <div class="container py-4">
        ${this._buildSearchBox({
          id: 'buscador-noticias',
          label: i18n.app.buscar,
          placeholder: i18n.noticias.buscarPlaceholder,
        })}
        <div id="noticias-lista" class="row g-4">
          ${this._buildSkeletonCards(6)}
        </div>
      </div>
    `;

    await NoticiaController.listar({
      onLoading: () => {},
      onSuccess: (noticias) => {
        this._renderNoticiasListado(noticias);
        this._bindSearchInput('buscador-noticias', (termino) => {
          const filtradas = this._filtrarNoticias(noticias, termino);
          this._renderNoticiasListado(filtradas, Boolean(this._normalizarBusqueda(termino)));
        });
      },
      onError: (msg) => {
        this._renderContainerError('noticias-lista', i18n.noticias.errorCarga, msg, 'bi-exclamation-triangle');
        Toast.error(msg);
      },
    });
  },

  // ─── NOTICIAS — DETALLE ──────────────────────────────────────────────────

  /**
   * Renderiza el detalle completo de una noticia.
   *
   * @param {string} id - ID de la noticia en Firestore
   * @returns {Promise<void>}
   */
  async renderNoticiaDetalle(id) {
    const root = document.getElementById('app-root');
    if (!root) return;

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/inicio" class="text-white-50">Inicio</a></li>
              <li class="breadcrumb-item"><a href="#/noticias" class="text-white-50">Noticias</a></li>
              <li class="breadcrumb-item active">Detalle</li>
            </ol>
          </nav>
          <h1>Noticia</h1>
        </div>
      </div>
      <div class="container py-5">
        <div id="noticia-detalle-content" class="row justify-content-center">
          <div class="col-lg-8">
            <div class="skeleton" style="height:300px;border-radius:1rem;margin-bottom:1.5rem;"></div>
            <div class="skeleton" style="height:2.5rem;width:80%;margin-bottom:1rem;"></div>
            <div class="skeleton" style="height:1rem;width:40%;margin-bottom:2rem;"></div>
            <div class="skeleton" style="height:1rem;margin-bottom:0.5rem;"></div>
            <div class="skeleton" style="height:1rem;margin-bottom:0.5rem;"></div>
            <div class="skeleton" style="height:1rem;width:70%;"></div>
          </div>
        </div>
      </div>
    `;

    await NoticiaController.obtenerDetalle(id, {
      onLoading: () => {},
      onSuccess: (noticia) => {
        const container = document.getElementById('noticia-detalle-content');
        if (!container) return;
        const titulo = this._esc(noticia.titulo);
        const cuerpo = this._esc(noticia.cuerpo || '').replace(/\n/g, '<br>');
        container.innerHTML = `
          <div class="col-lg-8 animate-fade-in-up">
            <a href="#/noticias" class="btn-jal-secondary mb-4 d-inline-flex align-items-center gap-2">
              <i class="bi bi-arrow-left"></i> ${i18n.noticias.volver}
            </a>

            ${this._buildNoticiaMediaDetalle(noticia)}

            <h1 class="noticia-detail-titulo">${titulo}</h1>

            <div class="noticia-detail-meta">
              <span class="meta-item">
                <i class="bi bi-calendar3"></i>
                ${i18n.noticias.publicadoEl} ${this._formatearFecha(noticia.fechaPublicacion)}
              </span>
            </div>

            <div class="noticia-detail-cuerpo">
              ${cuerpo}
            </div>

            <div class="mt-4 pt-3 border-top">
              <a href="#/noticias" class="btn-jal-secondary d-inline-flex align-items-center gap-2">
                <i class="bi bi-arrow-left"></i> ${i18n.noticias.volver}
              </a>
            </div>
          </div>
        `;
        this._aplicarFondosBlur(container);
      },
      onError: (msg) => {
        const container = document.getElementById('noticia-detalle-content');
        if (container) {
          container.innerHTML = `<div class="col-12"><div class="alert alert-warning">${this._esc(msg)}</div></div>`;
        }
        Toast.error(msg);
      },
    });
  },

  // ─── EVENTOS ─────────────────────────────────────────────────────────────

  /**
   * Renderiza la página de listado de eventos.
   *
   * @returns {Promise<void>}
   */
  async renderEventos() {
    const root = document.getElementById('app-root');
    if (!root) return;

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/inicio" class="text-white-50">Inicio</a></li>
              <li class="breadcrumb-item active">Eventos</li>
            </ol>
          </nav>
          <h1><i class="bi bi-calendar-event me-2"></i>${i18n.eventos.titulo}</h1>
          <p class="page-hero-sub">${i18n.eventos.subtitulo}</p>
        </div>
      </div>

      <div class="container py-4">
        ${this._buildSearchBox({
          id: 'buscador-eventos',
          label: i18n.app.buscar,
          placeholder: i18n.eventos.buscarPlaceholder,
        })}
        <div id="eventos-lista" class="row g-4">
          ${this._buildSkeletonCards(6, true)}
        </div>
      </div>
    `;

    await EventoController.listarRecientes({
      onLoading: () => {},
      onSuccess: (eventos) => {
        this._renderEventosListado(eventos);
        this._bindSearchInput('buscador-eventos', (termino) => {
          const filtrados = this._filtrarEventos(eventos, termino);
          this._renderEventosListado(filtrados, Boolean(this._normalizarBusqueda(termino)));
        });
      },
      onError: (msg) => {
        this._renderContainerError('eventos-lista', i18n.eventos.errorCarga, msg, 'bi-exclamation-triangle');
        Toast.error(msg);
      },
    });
  },

  // ─── CONTACTO ────────────────────────────────────────────────────────────

  /**
   * Renderiza la página estática de contacto.
   *
   * @returns {void}
   */
  renderContacto() {
    const root = document.getElementById('app-root');
    if (!root) return;

    // Datos estáticos de los ediles (sin BD)
    const EDILES = [
      {
        nombre:  'Claudia Patricia Restrepo',
        cargo:   'Presidenta JAL',
        tel:     '(604) 385-6000 ext. 10201',
        correo:  'c.restrepo@jalcomuna3.gov.co',
      },
      {
        nombre:  'Carlos Andrés Gómez',
        cargo:   'Vicepresidente JAL',
        tel:     '(604) 385-6000 ext. 10202',
        correo:  'ca.gomez@jalcomuna3.gov.co',
      },
      {
        nombre:  'María Fernanda López',
        cargo:   'Edil — Comisión de Educación',
        tel:     '(604) 385-6000 ext. 10203',
        correo:  'mf.lopez@jalcomuna3.gov.co',
      },
      {
        nombre:  'José Luis Herrera',
        cargo:   'Edil — Comisión de Salud',
        tel:     '(604) 385-6000 ext. 10204',
        correo:  'jl.herrera@jalcomuna3.gov.co',
      },
      {
        nombre:  'Leidy Johana Muñoz',
        cargo:   'Edil — Comisión de Infraestructura',
        tel:     '(604) 385-6000 ext. 10205',
        correo:  'lj.munoz@jalcomuna3.gov.co',
      },
      {
        nombre:  'Andrés Felipe Ospina',
        cargo:   'Edil — Comisión de Cultura',
        tel:     '(604) 385-6000 ext. 10206',
        correo:  'af.ospina@jalcomuna3.gov.co',
      },
    ];

    root.innerHTML = `
      <div class="page-hero">
        <div class="container">
          <nav aria-label="breadcrumb" class="page-hero-breadcrumb mb-2">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><a href="#/inicio" class="text-white-50">Inicio</a></li>
              <li class="breadcrumb-item active">Contacto</li>
            </ol>
          </nav>
          <h1><i class="bi bi-person-lines-fill me-2"></i>${i18n.contacto.titulo}</h1>
          <p class="page-hero-sub">${i18n.contacto.subtitulo}</p>
        </div>
      </div>

      <div class="container py-5">
        <!-- Info institucional -->
        <div class="row g-4 mb-5">
          <div class="col-12">
            <div class="form-jal p-4">
              <div class="row g-4">
                <div class="col-md-4 text-center">
                  <i class="bi bi-geo-alt-fill text-primary mb-2" style="font-size:2rem;"></i>
                  <h3 class="h6 fw-700 mb-1">Dirección</h3>
                  <p class="text-muted small mb-0">${i18n.contacto.direccion}</p>
                </div>
                <div class="col-md-4 text-center">
                  <i class="bi bi-clock-fill text-primary mb-2" style="font-size:2rem;"></i>
                  <h3 class="h6 fw-700 mb-1">Horario de Atención</h3>
                  <p class="text-muted small mb-0">${i18n.contacto.horarioVal}</p>
                </div>
                <div class="col-md-4 text-center">
                  <i class="bi bi-envelope-fill text-primary mb-2" style="font-size:2rem;"></i>
                  <h3 class="h6 fw-700 mb-1">Correo Institucional</h3>
                  <p class="text-muted small mb-0">jalcomuna3@medellin.gov.co</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Ediles -->
        <h2 class="section-title mb-1">Ediles de la JAL</h2>
        <div class="section-divider mb-4"></div>
        <div class="row g-4">
          ${EDILES.map((e) => `
            <div class="col-md-6 col-lg-4 animate-fade-in-up">
              <div class="card-contacto">
                <div class="avatar">${e.nombre.split(' ').map(p => p[0]).slice(0,2).join('')}</div>
                <p class="contacto-nombre">${e.nombre}</p>
                <p class="contacto-cargo">${e.cargo}</p>
                <p class="contacto-info">
                  <i class="bi bi-telephone"></i>
                  <a href="tel:${e.tel.replace(/\D/g,'')}" class="text-muted">${e.tel}</a>
                </p>
                <p class="contacto-info">
                  <i class="bi bi-envelope"></i>
                  <a href="mailto:${e.correo}" class="text-muted">${e.correo}</a>
                </p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },
// ─── HELPERS DE RENDER ───────────────────────────────────────────────────

  /**
   * Renderiza las tarjetas de noticias en la sección home.
   * @private
   */
  _renderNoticiasHome(noticias) {
    const container = document.getElementById('noticias-home-container');
    if (!container) return;
    if (noticias.length === 0) {
      container.innerHTML = `<div class="col-12">${this._buildEmptyState(i18n.noticias.sinNoticias, '', 'bi-newspaper')}</div>`;
      return;
    }
    container.innerHTML = noticias.map((n) => this._buildNoticiaCard(n)).join('');
    this._aplicarFondosBlur(container);
    this._bindNoticiasClick();
  },

  /**
   * Renderiza las tarjetas de eventos en la sección home.
   * @private
   */
  _renderEventosHome(eventos) {
    const container = document.getElementById('eventos-home-container');
    if (!container) return;
    if (eventos.length === 0) {
      container.innerHTML = `<div class="col-12">${this._buildEmptyState(i18n.eventos.sinEventos, '', 'bi-calendar-x')}</div>`;
      return;
    }
    container.innerHTML = eventos.map((e) => this._buildEventoCard(e)).join('');
  },

  /**
   * Renderiza el listado publico de noticias y sus estados vacios.
   * @private
   */
  _renderNoticiasListado(noticias, esBusqueda = false) {
    const container = document.getElementById('noticias-lista');
    if (!container) return;

    if (noticias.length === 0) {
      container.innerHTML = esBusqueda
        ? this._buildEmptyState(i18n.noticias.sinResultados, i18n.noticias.sinResultadosSub, 'bi-search')
        : this._buildEmptyState(i18n.noticias.sinNoticias, i18n.noticias.sinNoticiasSub, 'bi-newspaper');
      return;
    }

    container.innerHTML = noticias.map((n) => this._buildNoticiaCard(n)).join('');
    this._aplicarFondosBlur(container);
    this._bindNoticiasClick();
  },

  /**
   * Renderiza el listado publico de eventos y sus estados vacios.
   * @private
   */
  _renderEventosListado(eventos, esBusqueda = false) {
    const container = document.getElementById('eventos-lista');
    if (!container) return;

    if (eventos.length === 0) {
      container.innerHTML = esBusqueda
        ? this._buildEmptyState(i18n.eventos.sinResultados, i18n.eventos.sinResultadosSub, 'bi-search')
        : this._buildEmptyState(i18n.eventos.sinEventos, i18n.eventos.sinEventosSub, 'bi-calendar-x');
      return;
    }

    container.innerHTML = eventos.map((e) => this._buildEventoCard(e)).join('');
  },

  /**
   * Construye una casilla de busqueda reutilizable para listados.
   * @private
   */
  _buildSearchBox({ id, label, placeholder }) {
    return `
      <div class="content-search mb-4">
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
      this._formatearFecha(noticia.fechaPublicacion),
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
      this._formatearFecha(evento.fecha),
      this._formatearHora(evento.fecha),
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
   * Construye la tarjeta HTML de una noticia.
   * @private
   * @param {Object} noticia
   * @returns {string}
   */
  _buildNoticiaCard(noticia) {
    const fecha = this._formatearFecha(noticia.fechaPublicacion);
    const titulo = this._esc(noticia.titulo);
    return `
      <div class="col-md-6 col-lg-4 animate-fade-in-up">
        <article class="card-noticia cursor-pointer"
                 data-id="${this._esc(noticia.id)}"
                 data-noticia-card
                 role="button"
                 tabindex="0"
                 aria-label="Leer noticia: ${titulo}">
          <div class="card-img-wrapper">
            ${this._buildNoticiaMediaCard(noticia)}
          </div>
          <div class="card-body">
            <p class="card-fecha">
              <i class="bi bi-calendar3 me-1"></i>${fecha}
            </p>
            <h3 class="card-title">${titulo}</h3>
            <div class="card-footer-custom">
              <span class="text-primary fw-600" style="font-size:0.85rem;">
                ${i18n.noticias.verDetalle} <i class="bi bi-arrow-right ms-1"></i>
              </span>
            </div>
          </div>
        </article>
      </div>
    `;
  },

  /**
   * Construye el medio principal para una tarjeta de noticia.
   * @private
   */
  _buildNoticiaMediaCard(noticia) {
    const media = this._getMediaNoticia(noticia);
    const titulo = this._esc(noticia.titulo);

    if (!media.url) {
      return `<div class="card-img-placeholder"><i class="bi bi-newspaper"></i></div>`;
    }

    return `
      <div class="card-img-blur"
           data-bg="${this._esc(media.url)}"
           aria-hidden="true"></div>
      <img src="${this._esc(media.url)}" alt="${titulo}" loading="lazy"
           onerror="this.style.display='none';this.previousElementSibling.style.display='none';this.nextElementSibling.style.display='flex';">
      <div class="card-img-placeholder" style="display:none;"><i class="bi bi-image"></i></div>
      ${media.tipo === 'video' ? `
        <span class="card-media-video-badge">
          <i class="bi bi-play-fill" aria-hidden="true"></i> Video
        </span>
      ` : ''}
    `;
  },

  /**
   * Construye el medio principal del detalle de noticia.
   * @private
   */
  _buildNoticiaMediaDetalle(noticia) {
    const media = this._getMediaNoticia(noticia);
    const titulo = this._esc(noticia.titulo);

    if (!media.url) return '';

    if (media.tipo === 'video' && media.embedUrl) {
      return `
        <div class="noticia-detail-video">
          <iframe src="${this._esc(media.embedUrl)}"
                  title="${titulo}"
                  allow="autoplay; encrypted-media"
                  allowfullscreen></iframe>
        </div>
      `;
    }

    return `
      <figure class="noticia-detail-figure">
        <div class="noticia-detail-blur"
             data-bg="${this._esc(media.url)}"
             aria-hidden="true"></div>
        <img src="${this._esc(media.url)}"
             alt="${titulo}"
             class="noticia-detail-img"
             onerror="this.closest('figure').style.display='none'" />
      </figure>
    `;
  },

  /**
   * Normaliza contenido nuevo de Drive y noticias antiguas con portadaUrl.
   * @private
   */
  _getMediaNoticia(noticia) {
    const tipo = noticia.media_tipo || (noticia.portadaUrl ? 'imagen' : '');
    const urlOriginal = noticia.media_url || noticia.portadaUrl || '';
    const usarProxy = tipo === 'imagen'
      && noticia.id
      && noticia.media_drive_id
      && !this._esServidorEstaticoLocal();

    return {
      tipo,
      url: usarProxy ? this._buildProxyImagenNoticiaUrl(noticia) : urlOriginal,
      embedUrl: noticia.media_embed_url || '',
    };
  },

  /**
   * Construye la URL del proxy CDN para imagenes de noticias.
   * @private
   */
  _buildProxyImagenNoticiaUrl(noticia) {
    const params = new URLSearchParams({ id: noticia.id });
    if (noticia.media_drive_id) {
      params.set('v', noticia.media_drive_id);
    }
    return `/api/noticias-media?${params.toString()}`;
  },

  /**
   * Evita romper la vista cuando se prueba con un servidor estatico local.
   * Para probar el proxy localmente, usar Vercel Dev en vez de Live Server.
   * @private
   */
  _esServidorEstaticoLocal() {
    const host = window.location.hostname;
    const port = window.location.port;
    return ['localhost', '127.0.0.1'].includes(host) && ['5500', '5501'].includes(port);
  },

  /**
   * Construye la tarjeta HTML de un evento.
   * @private
   * @param {Object} evento
   * @returns {string}
   */
  _buildEventoCard(evento) {
    const { inicio, fin } = this._rangoEvento(evento);
    const dia       = inicio.toLocaleDateString('es-CO', { day: '2-digit', timeZone: EVENTOS_TIME_ZONE });
    const mes       = inicio.toLocaleDateString('es-CO', { month: 'short', timeZone: EVENTOS_TIME_ZONE }).replace('.', '');
    const horaInicio = this._formatearHoraEvento(inicio);
    const horaFin    = this._formatearHoraEvento(fin);
    const horaFmt    = `${horaInicio} - ${horaFin}`;
    const titulo    = this._esc(evento.titulo);
    const lugar     = this._esc(evento.lugar);
    const descripcion = this._esc(evento.descripcion || '');

    return `
      <div class="col-md-6 col-lg-3 animate-fade-in-up">
        <article class="card-evento">
          <div class="evento-fecha-badge" aria-label="Fecha: ${dia} de ${mes}">
            <span class="day">${dia}</span>
            <span class="month">${mes}</span>
          </div>
          <h3 class="evento-title">${titulo}</h3>
          <p class="evento-meta">
            <i class="bi bi-clock" aria-hidden="true"></i>
            <span>${horaFmt}</span>
          </p>
          <p class="evento-meta">
            <i class="bi bi-geo-alt" aria-hidden="true"></i>
            <span>${lugar}</span>
          </p>
          ${evento.descripcion
            ? `<p class="text-muted small mt-2 mb-0"
                  style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                ${descripcion}
              </p>`
            : ''}
          ${this._buildBotonCalendario(evento)}
        </article>
      </div>
    `;
  },

  /**
   * Construye el enlace para anadir el evento a Google Calendar.
   * @private
   */
  _buildBotonCalendario(evento) {
    const googleUrl = this._buildGoogleCalendarUrl(evento);
    return `
      <a class="evento-cal-link"
         href="${this._esc(googleUrl)}"
         target="_blank"
         rel="noopener noreferrer"
         aria-label="${i18n.eventos.anadirCalendario}">
        <i class="bi bi-google" aria-hidden="true"></i>${i18n.eventos.anadirCalendario}
      </a>
    `;
  },

  /**
   * Calcula el rango inicio/fin del evento. Si no hay fecha_fin (eventos
   * antiguos) o es inválida, usa una duración por defecto de 2 horas.
   * @private
   * @returns {{ inicio: Date, fin: Date }}
   */
  _rangoEvento(evento) {
    const inicio = evento.fecha?.toDate ? evento.fecha.toDate() : new Date(evento.fecha);
    let fin = evento.fecha_fin?.toDate ? evento.fecha_fin.toDate() : (evento.fecha_fin ? new Date(evento.fecha_fin) : null);
    if (!fin || Number.isNaN(fin.getTime()) || fin <= inicio) {
      fin = new Date(inicio.getTime() + 2 * 60 * 60 * 1000);
    }
    return { inicio, fin };
  },

  /**
   * Formatea la hora de un evento en la zona horaria de Colombia.
   * @private
   */
  _formatearHoraEvento(date) {
    return date.toLocaleTimeString('es-CO', {
      hour:     '2-digit',
      minute:   '2-digit',
      timeZone: EVENTOS_TIME_ZONE,
    });
  },

  /**
   * Formatea una fecha para Google Calendar en la zona horaria de Colombia.
   * @private
   */
  _formatFechaCalendario(date) {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: EVENTOS_TIME_ZONE,
      year:     'numeric',
      month:    '2-digit',
      day:      '2-digit',
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   false,
      hourCycle: 'h23',
    }).formatToParts(date).reduce((acc, parte) => {
      if (parte.type !== 'literal') acc[parte.type] = parte.value;
      return acc;
    }, {});

    return `${partes.year}${partes.month}${partes.day}T${partes.hour}${partes.minute}${partes.second}`;
  },

  /**
   * Construye el enlace de Google Calendar con el evento prellenado.
   * @private
   */
  _buildGoogleCalendarUrl(evento) {
    const { inicio, fin } = this._rangoEvento(evento);
    const params = new URLSearchParams({
      action:   'TEMPLATE',
      text:     evento.titulo || 'Evento JAL Comuna 3',
      dates:    `${this._formatFechaCalendario(inicio)}/${this._formatFechaCalendario(fin)}`,
      details:  evento.descripcion || '',
      location: evento.lugar || '',
      ctz:      EVENTOS_TIME_ZONE,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  },

  /**
   * Registra los clicks en tarjetas de noticias para abrir el detalle.
   * @private
   */
  _bindNoticiasClick() {
    document.querySelectorAll('[data-noticia-card]').forEach((card) => {
      const ir = () => {
        window.location.hash = `#/noticias/${card.dataset.id}`;
      };
      card.addEventListener('click', ir);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          ir();
        }
      });
    });
  },

  /**
   * Muestra / oculta skeleton cards como indicador de carga.
   * @private
   */
  _setSkeletonNoticias(mostrar) {
    const c = document.getElementById('noticias-home-container');
    if (!c) return;
    if (mostrar) c.innerHTML = this._buildSkeletonCards(3);
  },

  _setSkeletonEventos(mostrar) {
    const c = document.getElementById('eventos-home-container');
    if (!c) return;
    if (mostrar) c.innerHTML = this._buildSkeletonCards(4, true);
  },

  /**
   * Construye cards skeleton de carga.
   * @private
   * @param {number}  n         - Número de cards
   * @param {boolean} [esEvento=false]
   * @returns {string}
   */
  _buildSkeletonCards(n, esEvento = false) {
    const col   = esEvento ? 'col-md-6 col-lg-3' : 'col-md-6 col-lg-4';
    const items = Array.from({ length: n }, () => `
      <div class="${col}">
        <div class="card-noticia" aria-hidden="true">
          <div class="skeleton" style="height:200px;border-radius:0;"></div>
          <div class="card-body">
            <div class="skeleton mb-2" style="height:0.75rem;width:40%;"></div>
            <div class="skeleton mb-1" style="height:1rem;width:90%;"></div>
            <div class="skeleton" style="height:1rem;width:70%;"></div>
          </div>
        </div>
      </div>
    `).join('');
    return items;
  },

  /**
   * Muestra un estado de error dentro de un contenedor de cards.
   * @private
   */
  _renderContainerError(containerId, titulo, detalle, icono) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = this._buildEmptyState(titulo, detalle, icono);
  },

  /**
   * Construye el HTML de estado vacío.
   * @private
   */
  _buildEmptyState(titulo, subtitulo, icono) {
    const safeTitulo = this._esc(titulo);
    const safeSubtitulo = this._esc(subtitulo);
    const safeIcono = this._esc(icono);
    return `
      <div class="col-12">
        <div class="empty-state">
          <div class="empty-icon"><i class="bi ${safeIcono}"></i></div>
          <h4>${safeTitulo}</h4>
          ${safeSubtitulo ? `<p>${safeSubtitulo}</p>` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Formatea un Timestamp de Firestore o Date a cadena legible en español.
   * @private
   * @param {Object|Date|null} ts
   * @returns {string}
   */
  _formatearFecha(ts) {
    if (!ts) return '—';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('es-CO', {
      day:   '2-digit',
      month: 'long',
      year:  'numeric',
    });
  },

  /**
   * Formatea una hora para busquedas en eventos.
   * @private
   */
  _formatearHora(ts) {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('es-CO', {
      hour:   '2-digit',
      minute: '2-digit',
    });
  },

  /**
   * Asigna las imagenes de fondo (blur) por propiedad DOM en lugar de un
   * atributo style inline. Evita que una comilla en la URL cierre el url() de
   * CSS tras la re-decodificacion de entidades HTML del atributo (F7).
   * @private
   */
  _aplicarFondosBlur(container) {
    if (!container) return;
    container.querySelectorAll('[data-bg]').forEach((el) => {
      const url = el.getAttribute('data-bg') || '';
      el.removeAttribute('data-bg');
      if (url) el.style.backgroundImage = `url("${this._escCssUrl(url)}")`;
    });
  },

  /**
   * Neutraliza una URL para usarla dentro de un string CSS entre comillas
   * dobles asignado por propiedad DOM (sin re-decodificacion HTML).
   * @private
   */
  _escCssUrl(url) {
    return String(url ?? '')
      .replace(/[\r\n]/g, '')
      .replace(/[\\"]/g, '\\$&');
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

  /**
   * Limpia suscripciones activas al destruir la vista.
   * @returns {void}
   */
  destruir() {
    Carousel.destruir();
  },
};

export default PublicoView;