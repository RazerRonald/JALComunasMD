/**
 * @fileoverview Carousel — Carrusel automático con barra de progreso CSS animada.
 * Sin dependencias externas. Completamente controlado por JS + CSS custom.
 * La barra de progreso se anima mediante CSS transitions sobre width.
 *
 * @module components/Carousel
 */

/**
 * @typedef {Object} CarouselSlide
 * @property {string}  imgUrl      - URL de la imagen de fondo
 * @property {string}  tag         - Etiqueta tipo chip (ej: "Noticia")
 * @property {string}  titulo      - Título del slide
 * @property {string}  descripcion - Descripción corta
 * @property {string}  [ctaUrl]    - URL del botón CTA (opcional)
 * @property {string}  [ctaTexto]  - Texto del botón CTA (opcional)
 */

/**
 * @typedef {Object} CarouselConfig
 * @property {string}          containerId    - ID del elemento contenedor
 * @property {CarouselSlide[]} slides         - Array de slides
 * @property {number}          [intervalo=6000] - Tiempo en ms entre slides
 * @property {boolean}         [autoplay=true]  - Si debe avanzar automáticamente
 */

const Carousel = {
  /** @type {number|null} ID del intervalo de autoplay */
  _intervaloId:  null,

  /** @type {number} Índice del slide activo */
  _indiceActual: 0,

  /** @type {CarouselConfig} Configuración activa */
  _config:       null,

  /** @type {HTMLElement|null} Elemento de la barra de progreso */
  _progressFill: null,

  /**
   * Inicializa y renderiza el carrusel en el contenedor indicado.
   *
   * @param {CarouselConfig} config
   * @returns {void}
   */
  init(config) {
    const { containerId, slides, intervalo = 6000, autoplay = true } = config;

    if (!slides || slides.length === 0) return;

    this._config       = config;
    this._indiceActual = 0;

    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`[Carousel] No se encontró #${containerId}`);
      return;
    }

    container.innerHTML = this._buildHTML(slides, intervalo);
    container.classList.add('hero-carousel');

    this._progressFill = container.querySelector('.carousel-progress-fill');

    // Mostrar primer slide
    this._mostrarSlide(0);

    // Bind dots
    container.querySelectorAll('.carousel-dot').forEach((dot, i) => {
      dot.addEventListener('click', () => {
        this._irA(i);
      });
    });

    // Botones CTA
    container.querySelectorAll('[data-carousel-cta]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const url = btn.dataset.carouselCta;
        if (url) window.location.hash = url;
      });
    });

    // Pausar en hover
    container.addEventListener('mouseenter', () => this._pausar());
    container.addEventListener('mouseleave', () => {
      if (autoplay) this._iniciarAutoplay(intervalo);
    });

    // Iniciar autoplay
    if (autoplay && slides.length > 1) {
      this._iniciarAutoplay(intervalo);
    }
  },

  /**
   * Construye el HTML completo del carrusel.
   *
   * @private
   * @param {CarouselSlide[]} slides
   * @param {number}          intervalo
   * @returns {string} HTML del carrusel
   */
  _buildHTML(slides, intervalo) {
    const slidesHTML = slides.map((slide, i) => {
      const imgUrl = this._esc(slide.imgUrl);
      const titulo = this._esc(slide.titulo);
      const tag = this._esc(slide.tag || 'JAL Manrique');
      const descripcion = this._esc(slide.descripcion || '');
      const ctaUrl = this._esc(slide.ctaUrl || '');
      const ctaTexto = this._esc(slide.ctaTexto || 'Ver más');

      return `
        <div class="carousel-item${i === 0 ? ' active' : ''}"
             data-index="${i}"
             role="group"
             aria-roledescription="slide"
             aria-label="Diapositiva ${i + 1} de ${slides.length}">

          <!-- Fondo: siempre eager — Chrome nunca dispara loading="lazy" en
               slides apilados con opacity 0, y el autoplay los necesita ya
               cargados antes del crossfade. -->
          <img src="${imgUrl}"
               alt="${titulo}"
               class="carousel-bg"
               loading="eager"
               onerror="this.style.display='none'" />

          <!-- Overlay oscuro -->
          <div class="carousel-overlay" aria-hidden="true"></div>

          <!-- Contenido -->
          <div class="carousel-content">
            <span class="carousel-tag">${tag}</span>
            <h2 class="carousel-title">${titulo}</h2>
            <p class="carousel-desc">${descripcion}</p>
            ${slide.ctaUrl ? `
            <button class="btn-jal-primary"
                    type="button"
                    data-carousel-cta="${ctaUrl}"
                    aria-label="${ctaTexto}">
              ${ctaTexto}
              <i class="bi bi-arrow-right ms-1"></i>
            </button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    const dotsHTML = slides.length > 1
      ? slides.map((_, i) => `
          <button class="carousel-dot${i === 0 ? ' active' : ''}"
                  type="button"
                  aria-label="Ir al slide ${i + 1}"
                  data-dot="${i}">
          </button>
        `).join('')
      : '';

    return `
      <div aria-roledescription="carrusel" aria-label="Destacados JAL Manrique">
        ${slidesHTML}
      </div>

      <!-- Barra de progreso -->
      <div class="carousel-progress-bar" aria-hidden="true">
        <div class="carousel-progress-fill"></div>
      </div>

      <!-- Dots de navegación -->
      ${slides.length > 1 ? `<div class="carousel-dots" role="tablist" aria-label="Navegación del carrusel">${dotsHTML}</div>` : ''}
    `;
  },

  /**
   * Muestra el slide del índice indicado.
   *
   * @private
   * @param {number} indice
   */
  _mostrarSlide(indice) {
    const slides = document.querySelectorAll(`#${this._config.containerId} .carousel-item`);
    const dots   = document.querySelectorAll(`#${this._config.containerId} .carousel-dot`);

    slides.forEach((s, i) => {
      s.classList.toggle('active', i === indice);
    });

    dots.forEach((d, i) => {
      d.classList.toggle('active', i === indice);
    });

    this._indiceActual = indice;
    this._animarProgreso(this._config.intervalo || 6000);
  },

  /**
   * Avanza al slide siguiente en modo circular.
   *
   * @private
   */
  _siguiente() {
    const total = this._config.slides.length;
    const next  = (this._indiceActual + 1) % total;
    this._mostrarSlide(next);
  },

  /**
   * Navega directamente a un slide específico.
   *
   * @private
   * @param {number} indice
   */
  _irA(indice) {
    this._pausar();
    this._mostrarSlide(indice);
    if (this._config.autoplay !== false) {
      this._iniciarAutoplay(this._config.intervalo || 6000);
    }
  },

  /**
   * Inicia el autoplay con el intervalo configurado.
   *
   * @private
   * @param {number} intervalo - ms
   */
  _iniciarAutoplay(intervalo) {
    this._pausar();
    this._intervaloId = setInterval(() => this._siguiente(), intervalo);
  },

  /**
   * Pausa el autoplay.
   *
   * @private
   */
  _pausar() {
    if (this._intervaloId) {
      clearInterval(this._intervaloId);
      this._intervaloId = null;
    }
  },

  /**
   * Anima la barra de progreso CSS del slide actual.
   * Usa transitions de CSS sobre la propiedad width.
   *
   * @private
   * @param {number} duracion - Duración en ms
   */
  _animarProgreso(duracion) {
    if (!this._progressFill) return;

    // Resetear sin transición
    this._progressFill.style.transition = 'none';
    this._progressFill.style.width      = '0%';

    // Forzar repaint
    void this._progressFill.offsetWidth;

    // Animar con transición lineal
    this._progressFill.style.transition = `width ${duracion}ms linear`;
    this._progressFill.style.width      = '100%';
  },

  /**
   * Escapa HTML para campos configurables del carrusel.
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
   * Destruye el carrusel y limpia el intervalo activo.
   * Llamar cuando se desmonte la vista que contiene el carrusel.
   *
   * @returns {void}
   */
  destruir() {
    this._pausar();
    this._config       = null;
    this._progressFill = null;
    this._indiceActual = 0;
  },
};

export default Carousel;
