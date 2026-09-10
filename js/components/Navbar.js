/**
 * @fileoverview Navbar — Componente de barra de navegación dinámica según rol.
 * Renderiza diferentes navbars según el estado de sesión:
 * - Sin sesión: links públicos + botón de login
 * - Estudiante: + Mi Trámite + dropdown de perfil
 * - Edil: + Panel Admin + dropdown de perfil
 *
 * @module components/Navbar
 */

import { i18n } from '../config/i18n.js';
import { ROLES } from '../config/collections.js';

/**
 * @typedef {Object} NavbarConfig
 * @property {import('../models/AuthModel.js').SesionUsuario|null} sesion - Sesión activa o null
 * @property {string} rutaActual - Hash de la ruta activa (para marcar active)
 * @property {function(): void} onLogout - Callback para cerrar sesión
 */

const Navbar = {
  /**
   * Renderiza la navbar en el elemento #app-navbar según el rol de la sesión.
   *
   * @param {NavbarConfig} config
   * @returns {void}
   */
  render({ sesion, rutaActual = '', onLogout }) {
    const container = document.getElementById('app-navbar');
    if (!container) return;

    this._limpiarOffcanvas();
    container.innerHTML = this._buildHTML(sesion, rutaActual, onLogout);
    this._bindEvents(sesion, onLogout);
    this._marcarActivo(rutaActual);
  },

  /**
   * Desecha la instancia previa del offcanvas antes de re-renderizar la
   * navbar. Sin esto, el backdrop y el bloqueo de scroll del body quedan
   * huérfanos cuando el router reemplaza el HTML con el menú abierto.
   *
   * @private
   */
  _limpiarOffcanvas() {
    const prev = document.getElementById('navbarMain');
    const inst = prev && window.bootstrap?.Offcanvas?.getInstance?.(prev);
    if (inst) inst.dispose();
    document.querySelectorAll('.offcanvas-backdrop').forEach((el) => el.remove());
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
  },

  /**
   * Construye el HTML completo de la navbar.
   *
   * @private
   * @param {Object|null} sesion
   * @param {string}      rutaActual
   * @returns {string} HTML de la navbar
   */
  _buildHTML(sesion, rutaActual) {
    const linksPublicos = `
      <li class="nav-item">
        <a class="nav-link" href="#/inicio" id="nav-inicio" aria-label="Inicio">
          <i class="bi bi-house-door me-1"></i>${i18n.nav.inicio}
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="#/noticias" id="nav-noticias" aria-label="Noticias">
          <i class="bi bi-newspaper me-1"></i>${i18n.nav.noticias}
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="#/eventos" id="nav-eventos" aria-label="Eventos">
          <i class="bi bi-calendar-event me-1"></i>${i18n.nav.eventos}
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="#/contacto" id="nav-contacto" aria-label="Contacto">
          <i class="bi bi-person-lines-fill me-1"></i>${i18n.nav.contacto}
        </a>
      </li>
    `;

    let linksExtra   = '';
    let accionDerecha = '';

    if (!sesion) {
      // ─── Sin sesión ────────────────────────────────────────────────
      accionDerecha = `
        <a href="#/login" class="btn-nav-login nav-link" id="nav-login" aria-label="Iniciar sesión">
          <i class="bi bi-box-arrow-in-right me-1"></i>${i18n.nav.iniciarSesion}
        </a>
      `;
    } else if (sesion.rol === ROLES.ESTUDIANTE) {
      // ─── Estudiante ───────────────────────────────────────────────
      linksExtra = `
        <li class="nav-item">
          <a class="nav-link" href="#/tramite" id="nav-tramite" aria-label="Mi trámite">
            <i class="bi bi-file-earmark-text me-1"></i>${i18n.nav.miTramite}
          </a>
        </li>
        ${this._buildItemCerrarSesion()}
      `;
      accionDerecha = this._buildBotonPerfil(sesion, 'estudiante');
    } else if (sesion.rol === ROLES.EDIL) {
      // ─── Edil ─────────────────────────────────────────────────────
      linksExtra = `
        <li class="nav-item">
          <a class="nav-link" href="#/admin" id="nav-admin" aria-label="Panel de administración">
            <i class="bi bi-speedometer2 me-1"></i>${i18n.nav.panelAdmin}
          </a>
        </li>
        ${this._buildItemCerrarSesion()}
      `;
      accionDerecha = this._buildBotonPerfil(sesion, 'edil');
    }

    return `
      <nav class="navbar navbar-jal navbar-expand-lg" aria-label="Navegación principal">
        <div class="container">
          <!-- Brand -->
          <a class="navbar-brand" href="#/inicio" aria-label="${i18n.app.nombreCompleto}">
            <i class="bi bi-building-fill-check"></i>
            JAL Manrique
            <span class="brand-badge">C3</span>
          </a>

          <!-- Toggler móvil -->
          <button class="navbar-toggler border-0"
                  type="button"
                  data-bs-toggle="offcanvas"
                  data-bs-target="#navbarMain"
                  aria-controls="navbarMain"
                  aria-label="Abrir menú de navegación">
            <span class="navbar-toggler-icon"></span>
          </button>

          <!-- Links: barra lateral derecha en móvil (offcanvas), fila normal
               de la navbar en escritorio (≥lg lo gestiona Bootstrap). -->
          <div class="offcanvas-lg offcanvas-end navbar-offcanvas"
               tabindex="-1"
               id="navbarMain"
               aria-labelledby="navbarMainLabel">
            <div class="offcanvas-header">
              <span class="offcanvas-title fw-800" id="navbarMainLabel">
                <i class="bi bi-building-fill-check me-1"></i> JAL Manrique
              </span>
              <button type="button"
                      class="btn-close btn-close-white"
                      data-bs-dismiss="offcanvas"
                      data-bs-target="#navbarMain"
                      aria-label="Cerrar menú"></button>
            </div>
            <div class="offcanvas-body">
              <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                ${linksPublicos}
                ${linksExtra}
              </ul>

              <!-- Acción derecha -->
              <div class="d-flex align-items-center gap-2 mt-2 mt-lg-0">
                ${accionDerecha}
              </div>
            </div>
          </div>
        </div>
      </nav>
    `;
  },

  /**
   * Construye el botón de perfil para usuarios autenticados: avatar con
   * iniciales + nombre + rol, que navega directamente a #/perfil.
   * Las demás acciones (Trámites/Panel Admin y Cerrar Sesión) viven como
   * opciones del menú principal.
   *
   * @private
   * @param {Object} sesion
   * @param {'edil'|'estudiante'} tipo
   * @returns {string} HTML del botón de perfil
   */
  _buildBotonPerfil(sesion, tipo) {
    const badgeClass  = tipo === 'edil' ? 'role-badge-edil' : 'role-badge-estudiante';
    const badgeTexto  = tipo === 'edil' ? 'Edil' : 'Estudiante';
    const iniciales   = this._esc(this._obtenerIniciales(sesion.nombre));
    const nombre      = this._esc(sesion.nombre);

    return `
      <a class="nav-perfil-btn d-flex align-items-center gap-2 text-white"
         href="#/perfil"
         id="nav-perfil"
         aria-label="Ir a mi perfil: ${nombre}">
        <div class="nav-perfil-avatar" aria-hidden="true">${iniciales}</div>
        <!-- En 992-1199px solo se muestra el avatar: con los ítems nuevos
             del menú, el nombre completo desborda la navbar en 1024px. -->
        <div class="d-flex d-lg-none d-xl-flex flex-column align-items-start">
          <span class="nav-perfil-nombre">${nombre}</span>
          <span class="role-badge ${badgeClass}">${badgeTexto}</span>
        </div>
      </a>
    `;
  },

  /**
   * Construye el ítem "Cerrar Sesión" del menú principal.
   *
   * @private
   * @returns {string}
   */
  _buildItemCerrarSesion() {
    return `
      <li class="nav-item">
        <button class="nav-link nav-link-logout" id="btn-logout-nav" type="button">
          <i class="bi bi-box-arrow-right me-1"></i>${i18n.nav.cerrarSesion}
        </button>
      </li>
    `;
  },

  /**
   * Obtiene las iniciales de un nombre completo.
   *
   * @private
   * @param {string} nombre
   * @returns {string} 1 o 2 caracteres de iniciales
   */
  _obtenerIniciales(nombre) {
    if (!nombre) return '?';
    const partes = nombre.trim().split(' ').filter(Boolean);
    if (partes.length === 1) return partes[0][0].toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  },

  /**
   * Escapa HTML para datos de sesion renderizados en la navbar.
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
   * Registra los event listeners de la navbar (logout, etc.).
   *
   * @private
   * @param {Object|null}  sesion
   * @param {function}     onLogout
   */
  _bindEvents(sesion, onLogout) {
    const btnLogout = document.getElementById('btn-logout-nav');
    if (btnLogout && onLogout) {
      btnLogout.addEventListener('click', () => onLogout());
    }

    // Cerrar la barra lateral al navegar desde ella (en escritorio no hay
    // instancia de Offcanvas, por lo que hide() simplemente no aplica).
    const offcanvasEl = document.getElementById('navbarMain');
    offcanvasEl?.addEventListener('click', (e) => {
      if (e.target.closest('a.nav-link, #nav-perfil, #btn-logout-nav')) {
        window.bootstrap?.Offcanvas?.getInstance?.(offcanvasEl)?.hide();
      }
    });
  },

  /**
   * Marca el link activo según la ruta actual.
   *
   * @private
   * @param {string} rutaActual - Hash actual (ej: '#/noticias')
   */
  _marcarActivo(rutaActual) {
    // Remover activos anteriores
    document.querySelectorAll('.navbar-jal .nav-link').forEach((el) => {
      el.classList.remove('active');
      el.removeAttribute('aria-current');
    });

    // Mapa de rutas a IDs de link
    const mapaRutas = {
      '#/inicio':    'nav-inicio',
      '#/noticias':  'nav-noticias',
      '#/eventos':   'nav-eventos',
      '#/contacto':  'nav-contacto',
      '#/tramite':   'nav-tramite',
      '#/admin':     'nav-admin',
    };

    // Buscar match parcial (para sub-rutas como #/noticias/abc123)
    let idActivo = null;
    for (const [ruta, id] of Object.entries(mapaRutas)) {
      if (rutaActual === ruta || rutaActual.startsWith(ruta + '/')) {
        idActivo = id;
        break;
      }
    }

    if (idActivo) {
      const el = document.getElementById(idActivo);
      if (el) {
        el.classList.add('active');
        el.setAttribute('aria-current', 'page');
      }
    }
  },

  /**
   * Actualiza solo el marcado activo sin re-renderizar la navbar completa.
   * Útil cuando el router cambia de ruta sin cambio de sesión.
   *
   * @param {string} rutaActual
   */
  actualizarActivo(rutaActual) {
    this._marcarActivo(rutaActual);
  },
};

export default Navbar;
