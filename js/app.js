/**
 * @fileoverview app.js — Bootstrap de la aplicación y Router SPA.
 *
 * @module app
 */

import AuthController   from './controllers/AuthController.js';
import AuthModel        from './models/AuthModel.js';

import Navbar           from './components/Navbar.js';
import Toast            from './components/Toast.js';
import DriveConnectionBubble from './components/DriveConnectionBubble.js';

import LoginView        from './views/LoginView.js';
import PublicoView      from './views/PublicoView.js';
import EstudianteView   from './views/EstudianteView.js';
import AdminView        from './views/AdminView.js';
import PerfilView       from './views/PerfilView.js';
import SolicitudAccesoView from './views/SolicitudAccesoView.js';

import { ROLES }        from './config/collections.js';
import { i18n }         from './config/i18n.js';

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function actualizarFooterYear() {
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

// ─── TABLA DE RUTAS ───────────────────────────────────────────────────────
// Estructura: { handler: fn, rolRequerido: string|null }
// rolRequerido: null = público, 'estudiante'/'edil' = autenticado con ese rol
// Para agregar una nueva ruta → añadir una entrada aquí (una línea).
const RUTAS = {
  '#/login':    { handler: () => LoginView.render(),                     rolRequerido: null              },
  '#/solicitar-acceso': { handler: () => SolicitudAccesoView.render(),   rolRequerido: null              },
  '#/inicio':   { handler: () => PublicoView.renderInicio(),             rolRequerido: null              },
  '#/noticias': { handler: () => PublicoView.renderNoticias(),           rolRequerido: null              },
  '#/eventos':  { handler: () => PublicoView.renderEventos(),            rolRequerido: null              },
  '#/contacto': { handler: () => PublicoView.renderContacto(),           rolRequerido: null              },
  '#/tramite':  { handler: () => EstudianteView.renderHistorial(),       rolRequerido: ROLES.ESTUDIANTE  },
  '#/tramite/nueva': { handler: () => EstudianteView.renderFormulario(), rolRequerido: ROLES.ESTUDIANTE  },
  '#/perfil':   { handler: () => PerfilView.render(),                    rolRequerido: [ROLES.ESTUDIANTE, ROLES.EDIL] },
  '#/admin':    { handler: () => AdminView.renderDashboard(),            rolRequerido: ROLES.EDIL        },
  '#/publicar': { handler: () => AdminView.renderNoticias(),             rolRequerido: ROLES.EDIL        },
  '#/admin/noticias': { handler: () => AdminView.renderNoticias(),       rolRequerido: ROLES.EDIL        },
  '#/admin/eventos':  { handler: () => AdminView.renderEventos(),        rolRequerido: ROLES.EDIL        },
  '#/admin/tramites': { handler: () => AdminView.renderTramites(),       rolRequerido: ROLES.EDIL        },
  '#/admin/usuarios': { handler: () => AdminView.renderUsuarios(),       rolRequerido: ROLES.EDIL        },
  '#/admin/solicitudes-acceso': { handler: () => AdminView.renderSolicitudesAcceso(), rolRequerido: ROLES.EDIL },
};

const INACTIVIDAD_LIMITE_MS = 15 * 60 * 1000;
const INACTIVIDAD_THROTTLE_MS = 1000;
const EVENTOS_ACTIVIDAD = [
  'click',
  'keydown',
  'mousemove',
  'pointerdown',
  'scroll',
  'touchstart',
];
const OPCIONES_EVENTO_ACTIVIDAD = { capture: true, passive: true };

let temporizadorInactividad = null;
let eventosInactividadActivos = false;
let ultimoRegistroActividad = 0;
let cierrePorInactividadEnCurso = false;

// ─── VISTA DE ERROR 404 ───────────────────────────────────────────────────
function render404() {
  const root = document.getElementById('app-root');
  if (!root) return;
  root.innerHTML = `
    <div class="access-denied animate-fade-in">
      <div class="denied-icon">🗺️</div>
      <h1 class="h2 fw-800 mb-2">Página no encontrada</h1>
      <p class="text-muted mb-4">La ruta <code>${escHtml(window.location.hash || '#/')}</code> no existe.</p>
      <a href="#/inicio" class="btn-jal-primary">
        <i class="bi bi-house me-2"></i>Ir al Inicio
      </a>
    </div>
  `;
}

// ─── VISTA DE ACCESO DENEGADO ────────────────────────────────────────────
function renderAccesoDenegado() {
  const root = document.getElementById('app-root');
  if (!root) return;
  root.innerHTML = `
    <div class="access-denied animate-fade-in">
      <div class="denied-icon"><i class="bi bi-shield-lock-fill"></i></div>
      <h1 class="h2 fw-800 mb-2">${i18n.auth.accesoDenegado}</h1>
      <p class="text-muted mb-4">No tienes permisos para acceder a esta sección.</p>
      <a href="#/login" class="btn-jal-primary">
        <i class="bi bi-box-arrow-in-right me-2"></i>${i18n.auth.iniciarSesion}
      </a>
    </div>
  `;
}

// ─── ROUTER ───────────────────────────────────────────────────────────────

// Control global de cierre de sesion por inactividad.
function configurarCierrePorInactividad(sesion) {
  if (!sesion) {
    detenerCierrePorInactividad();
    return;
  }

  registrarEventosInactividad();
  reiniciarTemporizadorInactividad(true);
}

function registrarEventosInactividad() {
  if (eventosInactividadActivos) return;

  EVENTOS_ACTIVIDAD.forEach((evento) => {
    window.addEventListener(evento, manejarActividadUsuario, OPCIONES_EVENTO_ACTIVIDAD);
  });
  document.addEventListener('visibilitychange', manejarCambioVisibilidad);
  eventosInactividadActivos = true;
}

function removerEventosInactividad() {
  if (!eventosInactividadActivos) return;

  EVENTOS_ACTIVIDAD.forEach((evento) => {
    window.removeEventListener(evento, manejarActividadUsuario, OPCIONES_EVENTO_ACTIVIDAD);
  });
  document.removeEventListener('visibilitychange', manejarCambioVisibilidad);
  eventosInactividadActivos = false;
}

function manejarActividadUsuario() {
  if (!AuthModel.getSesion() || cierrePorInactividadEnCurso) return;

  const ahora = Date.now();
  if (ahora - ultimoRegistroActividad < INACTIVIDAD_THROTTLE_MS) return;

  reiniciarTemporizadorInactividad();
}

function manejarCambioVisibilidad() {
  if (document.visibilityState !== 'visible') return;

  const sesion = AuthModel.getSesion();
  if (!sesion || cierrePorInactividadEnCurso) return;

  const tiempoInactivo = Date.now() - ultimoRegistroActividad;
  if (tiempoInactivo >= INACTIVIDAD_LIMITE_MS) {
    cerrarSesionPorInactividad();
    return;
  }

  reiniciarTemporizadorInactividad(true);
}

function reiniciarTemporizadorInactividad(forzar = false) {
  if (!AuthModel.getSesion() || cierrePorInactividadEnCurso) return;

  const ahora = Date.now();
  if (!forzar && ahora - ultimoRegistroActividad < INACTIVIDAD_THROTTLE_MS) return;

  ultimoRegistroActividad = ahora;
  if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
  temporizadorInactividad = setTimeout(cerrarSesionPorInactividad, INACTIVIDAD_LIMITE_MS);
}

function detenerCierrePorInactividad() {
  if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
  temporizadorInactividad = null;
  ultimoRegistroActividad = 0;
  removerEventosInactividad();
}

async function cerrarSesionPorInactividad() {
  if (!AuthModel.getSesion() || cierrePorInactividadEnCurso) return;

  cierrePorInactividadEnCurso = true;
  if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
  temporizadorInactividad = null;

  await AuthController.logout({
    onSuccess: () => {
      Toast.info(i18n.auth.sesionCerradaInactividad);
      window.location.hash = '#/login';
      setTimeout(() => {
        cierrePorInactividadEnCurso = false;
        const sesionActual = AuthModel.getSesion();
        if (sesionActual) configurarCierrePorInactividad(sesionActual);
      }, 1000);
    },
    onError: (msg) => {
      cierrePorInactividadEnCurso = false;
      reiniciarTemporizadorInactividad(true);
      Toast.error(msg);
    },
  });
}


/**
 
 * @returns {Promise<void>}
 */
async function procesarRuta() {
  const hash = window.location.hash || '#/inicio';

  // ─── Resolver ruta exacta o con parámetro ──────────────────────────
  let rutaKey    = hash;
  let params     = {};

  // Soporte para sub-ruta de detalle de noticia: #/noticias/:id
  const matchNoticia = hash.match(/^#\/noticias\/(.+)$/);
  if (matchNoticia) {
    rutaKey         = '#/noticias/:id';
    params.noticiaId = matchNoticia[1];
  }

  // ─── Verificar si la ruta existe ──────────────────────────────────
  const rutaConfig = RUTAS[rutaKey] || RUTAS[hash];

  if (!rutaConfig) {
    // Ruta con parámetro: detalle de noticia
    if (params.noticiaId) {
      actualizarNavbar(hash);
      mostrarApp();
      await PublicoView.renderNoticiaDetalle(params.noticiaId);
      return;
    }
    // Ruta desconocida → 404
    actualizarNavbar(hash);
    mostrarApp();
    render404();
    return;
  }

  const { handler, rolRequerido } = rutaConfig;
  const sesion = AuthModel.getSesion();

  // ─── Verificar permisos ────────────────────────────────────────────
  if (rolRequerido) {
    if (!sesion) {
      // No autenticado → redirigir a login
      if (!cierrePorInactividadEnCurso) {
        Toast.advertencia('Debes iniciar sesión para acceder a esta sección.');
      }
      window.location.hash = '#/login';
      return;
    }

    const tienePermiso = Array.isArray(rolRequerido)
      ? rolRequerido.includes(sesion.rol)
      : sesion.rol === rolRequerido;

    if (!tienePermiso) {
      actualizarNavbar(hash);
      mostrarApp();
      renderAccesoDenegado();
      return;
    }
  }

  // ─── Si está en login y ya está autenticado → redirigir ───────────
  if (['#/login', '#/solicitar-acceso'].includes(hash) && sesion) {
    window.location.hash = AuthController.getRutaPorRol(sesion.rol);
    return;
  }

  // ─── Renderizar vista ─────────────────────────────────────────────
  actualizarNavbar(hash);
  mostrarApp();

  try {
    await handler();
  } catch (err) {
    console.error('[Router] Error al renderizar vista:', err);
    Toast.error(i18n.app.errorGenerico);
  }
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────

/**
 * Re-renderiza la navbar con el estado de sesión actual y la ruta activa.
 *
 * @param {string} rutaActual - Hash actual de la URL
 */
function actualizarNavbar(rutaActual) {
  const sesion = AuthModel.getSesion();
  Navbar.render({
    sesion,
    rutaActual,
    onLogout: async () => {
      await AuthController.logout({
        onSuccess: () => {
          Toast.info(i18n.auth.sesionCerrada);
          window.location.hash = '#/login';
        },
        onError: (msg) => Toast.error(msg),
      });
    },
  });
  DriveConnectionBubble.render({ sesion });
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────

/**
 * Oculta la pantalla de carga y muestra el contenido principal.
 */
function mostrarApp() {
  const loading = document.getElementById('loading-screen');
  const root    = document.getElementById('app-root');
  const footer  = document.getElementById('app-footer');

  if (loading && !loading.classList.contains('d-none')) {
    loading.classList.add('fade-out');
    setTimeout(() => loading.classList.add('d-none'), 400);
  }

  root?.classList.remove('d-none');
  footer?.classList.remove('d-none');
}

// ─── INICIALIZACIÓN ───────────────────────────────────────────────────────

/**
 * Punto de entrada principal de la aplicación.
 * Suscribe el listener de autenticación de Firebase y configura el router.
 */
function iniciarApp() {
  actualizarFooterYear();

  // 1. Observar estado de autenticación (restaura sesión si ya existe)
  const unsubAuth = AuthController.iniciarListener(async (sesion) => {
    configurarCierrePorInactividad(sesion);
    // Al cambiar el estado de auth → re-procesar la ruta actual
    await procesarRuta();
  });

  // 2. Escuchar cambios de hash (navegación SPA)
  window.addEventListener('hashchange', async () => {
    // Destruir componentes que puedan tener suscripciones activas
    SolicitudAccesoView.destruir();
    try { AdminView.destruir(); }   catch (_) { /* view no montada */ }
    try { PublicoView.destruir(); } catch (_) { /* view no montada */ }

    await procesarRuta();
  });

  // 3. Si no hay hash inicial → redirigir a #/inicio
  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = '#/inicio';
  }

  // 4. Manejar cierre de la app (limpiar listeners)
  window.addEventListener('beforeunload', () => {
    unsubAuth();
    detenerCierrePorInactividad();
    DriveConnectionBubble.destruir();
    try { AdminView.destruir(); }   catch (_) {}
    try { PublicoView.destruir(); } catch (_) {}
  });
}

// ─── ARRANQUE ─────────────────────────────────────────────────────────────
// El listener de Firebase onAuthStateChanged es asíncrono:
// muestra la pantalla de carga hasta que responde la primera vez.
// Esto evita el flash de contenido no autenticado (FOUC).

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarApp);
} else {
  iniciarApp();
}

// Timeout de seguridad: si Firebase tarda >8s, mostrar la app de todas formas
setTimeout(() => {
  mostrarApp();
  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = '#/inicio';
  }
}, 8000);
