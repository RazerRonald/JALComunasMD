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
