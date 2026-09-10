/**
 * Verificacion responsive automatizada — JAL Comuna 3.
 *
 * Por cada ruta de la SPA y cada viewport:
 *  - Captura screenshot de pagina completa en reports/screenshots/
 *  - Detecta overflow horizontal (scrollWidth > innerWidth)
 *  - Detecta elementos que se salen del viewport (excluye .table-responsive,
 *    cuyo scroll horizontal es intencional)
 *  - Detecta texto recortado no intencional y solapamiento de controles
 *  - Registra errores de consola del navegador
 *
 * Uso:
 *   cd tests/responsive
 *   npm install
 *   npx playwright install chromium
 *   npm run check
 *
 * Variables de entorno opcionales:
 *   BASE_URL             — usa un servidor ya levantado en vez de arrancar uno
 *   JAL_EDIL_EMAIL / JAL_EDIL_PASSWORD             — credenciales de prueba Edil
 *   JAL_ESTUDIANTE_EMAIL / JAL_ESTUDIANTE_PASSWORD — credenciales de prueba estudiante
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar tests/responsive/.env (ignorado por git) sin dependencias externas.
// Las variables ya definidas en el entorno tienen prioridad.
const envFile = join(__dirname, '.env');
if (existsSync(envFile)) {
  for (const linea of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const REPO_ROOT = resolve(__dirname, '..', '..');
const REPORTS_DIR = join(REPO_ROOT, 'reports');
const SCREENSHOTS_DIR = join(REPORTS_DIR, 'screenshots');

// Puerto 5501: la app lo reconoce como servidor estatico local y evita el
// proxy /api/noticias-media (que no existe sin Vercel Dev).
const PORT = 5501;
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

const CREDENCIALES = {
  edil: {
    email: process.env.JAL_EDIL_EMAIL,
    password: process.env.JAL_EDIL_PASSWORD,
  },
  estudiante: {
    email: process.env.JAL_ESTUDIANTE_EMAIL,
    password: process.env.JAL_ESTUDIANTE_PASSWORD,
  },
};

const VIEWPORTS = [
  { width: 320,  height: 568  },
  { width: 375,  height: 667  },
  { width: 390,  height: 844  },
  { width: 414,  height: 896  },
  { width: 768,  height: 1024 },
  { width: 820,  height: 1180 },
  { width: 1024, height: 768  },
  { width: 1280, height: 800  },
  { width: 1440, height: 900  },
  { width: 1920, height: 1080 },
];

// Rutas agrupadas por sesion requerida. '#/noticias/:id' se resuelve en runtime.
const GRUPOS = [
  { rol: 'publico',    rutas: ['#/inicio', '#/noticias', '#/noticias/:id', '#/eventos', '#/contacto', '#/login', '#/solicitar-acceso'] },
  { rol: 'estudiante', rutas: ['#/tramite', '#/tramite/nueva', '#/perfil'] },
  { rol: 'edil',       rutas: ['#/admin', '#/publicar', '#/admin/noticias', '#/admin/eventos', '#/admin/tramites', '#/admin/usuarios', '#/admin/solicitudes-acceso', '#/perfil'] },
];

const esperar = (ms) => new Promise((res) => setTimeout(res, ms));

function slug(ruta) {
  return ruta.replace(/^#\//, '').replace(/[/:]+/g, '-').replace(/-+$/, '') || 'raiz';
}

/** Auditoria de layout ejecutada dentro de la pagina. */
async function auditarPagina(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const fuera = [];
    const recortados = [];
    const interactivos = [];

    const descripcion = (el) => {
      const cls = (el.className || '').toString().trim().split(/\s+/).slice(0, 3).join('.');
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
    };

    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;

      // Los elementos ocultos estacionados fuera de pantalla (p. ej. un
      // offcanvas cerrado con translateX(100%)) no son un problema de layout.
      if (getComputedStyle(el).visibility === 'hidden') return;

      // Elementos que exceden el viewport horizontal (scroll intencional excluido)
      if ((r.right > vw + 1 || r.left < -1) && !el.closest('.table-responsive')) {
        fuera.push(`${descripcion(el)} [${Math.round(r.left)}, ${Math.round(r.right)}]`);
      }

      // Texto recortado no intencional
      const tieneTextoDirecto = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
      );
      if (tieneTextoDirecto && el.scrollWidth > el.clientWidth + 3) {
        const cs = getComputedStyle(el);
        const intencional =
          el.closest('.text-truncate, .card-title, .table-responsive, .visually-hidden') ||
          cs.webkitLineClamp !== 'none' ||
          cs.textOverflow === 'ellipsis';
        if (cs.overflowX === 'hidden' && !intencional) {
          recortados.push(`${descripcion(el)} "${el.textContent.trim().slice(0, 40)}"`);
        }
      }

      // Candidatos para deteccion de solapamiento. Los overlays fijos
      // (toasts, burbuja de Drive) flotan sobre el contenido por diseño.
      if (el.matches('a, button, input, select, [role="button"]')) {
        const cs = getComputedStyle(el);
        const enOverlayFijo = (() => {
          for (let p = el; p && p !== document.body; p = p.parentElement) {
            if (getComputedStyle(p).position === 'fixed') return true;
          }
          return false;
        })();
        if (cs.visibility !== 'hidden' && cs.opacity !== '0' && !enOverlayFijo) {
          interactivos.push({ el, r });
        }
      }
    });

    // Solapamiento entre controles interactivos (no anidados entre si)
    const solapados = [];
    for (let i = 0; i < interactivos.length; i++) {
      for (let j = i + 1; j < interactivos.length; j++) {
        const a = interactivos[i];
        const b = interactivos[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (ix <= 0 || iy <= 0) continue;
        const interseccion = ix * iy;
        const menor = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
        if (interseccion > menor * 0.4) {
          solapados.push(`${descripcion(a.el)} <-> ${descripcion(b.el)}`);
        }
      }
    }

    return {
      scrollW: document.documentElement.scrollWidth,
      innerW: vw,
      overflowHorizontal: document.documentElement.scrollWidth > vw,
      fueraDeViewport: fuera.slice(0, 10),
      totalFuera: fuera.length,
      textoRecortado: [...new Set(recortados)].slice(0, 10),
      solapados: [...new Set(solapados)].slice(0, 10),
    };
  });
}

/** Navega a una ruta hash y espera a que la vista termine de cargar. */
async function irARuta(page, ruta) {
  await page.evaluate((r) => { window.location.hash = r; }, ruta);
  await esperar(600);
  // Esperar a que desaparezcan los spinners de carga (max 12 s)
  await page
    .waitForFunction(
      () => {
        const root = document.getElementById('app-root');
        if (!root || !root.innerText.trim()) return false;
        return !root.querySelector('.spinner-border');
      },
      { timeout: 12_000 },
    )
    .catch(() => {}); // vistas con spinner persistente (p. ej. error de datos) siguen adelante
  await esperar(800);
}

/** Inicia sesion mediante el formulario real de la app. */
async function login(page, rol) {
  const cred = CREDENCIALES[rol];
  await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-email', { timeout: 15_000 });
  await page.fill('#login-email', cred.email);
  await page.fill('#login-password', cred.password);
  await page.click('#btn-login');
  await page.waitForFunction(() => !window.location.hash.startsWith('#/login'), { timeout: 20_000 });
  await esperar(1000);
}

async function main() {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  // ─── Servidor estatico ───
  // Se invoca el bin de http-server con node directamente (sin shell) para
  // que las rutas con espacios lleguen como un solo argumento.
  let server = null;
  if (!process.env.BASE_URL) {
    const httpServerBin = fileURLToPath(import.meta.resolve('http-server/bin/http-server'));
    server = spawn(
      process.execPath,
      [httpServerBin, REPO_ROOT, '-p', String(PORT), '-c-1', '--silent'],
      { stdio: 'ignore' },
    );
    // Esperar a que el servidor responda con la app real
    let listo = false;
    for (let i = 0; i < 20 && !listo; i++) {
      await esperar(500);
      listo = await fetch(`${BASE_URL}/index.html`)
        .then((r) => r.ok)
        .catch(() => false);
    }
    if (!listo) throw new Error(`El servidor estatico no respondio en ${BASE_URL}`);
  }

  const browser = await chromium.launch();
  const resultados = [];
  let fallosLayout = 0;

  try {
    for (const grupo of GRUPOS) {
      if (grupo.rol !== 'publico') {
        const cred = CREDENCIALES[grupo.rol];
        if (!cred.email || !cred.password) {
          console.warn(`\n⚠ Grupo "${grupo.rol}" omitido: faltan credenciales. ` +
            'Copia tests/responsive/.env.example como .env o define las variables de entorno.');
          fallosLayout++;
          continue;
        }
      }
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      try {
      const page = await context.newPage();

      const erroresConsola = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') erroresConsola.push(msg.text());
      });
      page.on('pageerror', (err) => erroresConsola.push(`pageerror: ${err.message}`));

      await page.setViewportSize(VIEWPORTS[0]);
      await page.goto(`${BASE_URL}/#/inicio`, { waitUntil: 'domcontentloaded' });
      // Sanidad: si esto falla, el servidor no esta sirviendo la SPA
      await page.waitForSelector('#app-root', { state: 'attached', timeout: 10_000 });
      await esperar(2500);

      if (grupo.rol !== 'publico') {
        console.log(`\n→ Iniciando sesion como ${grupo.rol}…`);
        await login(page, grupo.rol);
      }

      for (let ruta of grupo.rutas) {
        // Resolver la ruta dinamica de detalle de noticia
        if (ruta === '#/noticias/:id') {
          await irARuta(page, '#/noticias');
          await page.waitForSelector('[data-noticia-card]', { timeout: 10_000 }).catch(() => {});
          const id = await page.evaluate(
            () => document.querySelector('[data-noticia-card]')?.dataset.id || null,
          );
          if (!id) {
            console.log('  (sin noticias publicadas: se omite #/noticias/:id)');
            continue;
          }
          ruta = `#/noticias/${id}`;
        }

        const nombreRuta = slug(ruta);
        const dirRuta = join(SCREENSHOTS_DIR, `${grupo.rol}-${nombreRuta}`);
        mkdirSync(dirRuta, { recursive: true });
        console.log(`\n▶ [${grupo.rol}] ${ruta}`);

        await irARuta(page, ruta);

        for (const vp of VIEWPORTS) {
          erroresConsola.length = 0;
          await page.setViewportSize(vp);
          await esperar(500);

          const audit = await auditarPagina(page);
          const file = join(dirRuta, `${vp.width}x${vp.height}.png`);
          await page.screenshot({ path: file, fullPage: true });

          const layoutOk = !audit.overflowHorizontal && audit.totalFuera === 0;
          if (!layoutOk) fallosLayout++;

          resultados.push({
            rol: grupo.rol,
            ruta,
            viewport: `${vp.width}x${vp.height}`,
            layout: layoutOk ? 'PASS' : 'FAIL',
            ...audit,
            erroresConsola: [...new Set(erroresConsola)],
            screenshot: file.replace(REPO_ROOT + '\\', '').replaceAll('\\', '/'),
          });

          const marca = layoutOk ? '✓' : '✗';
          const extra = [
            audit.overflowHorizontal ? `overflow ${audit.scrollW}>${audit.innerW}` : '',
            audit.totalFuera ? `${audit.totalFuera} fuera de viewport` : '',
            audit.textoRecortado.length ? `${audit.textoRecortado.length} texto recortado` : '',
            audit.solapados.length ? `${audit.solapados.length} solapados` : '',
            erroresConsola.length ? `${erroresConsola.length} errores consola` : '',
          ].filter(Boolean).join(' | ');
          console.log(`  ${marca} ${vp.width}x${vp.height}${extra ? '  — ' + extra : ''}`);
        }
      }

      } catch (err) {
        console.error(`✗ Grupo "${grupo.rol}" abortado: ${err.message}`);
        fallosLayout++;
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }

  writeFileSync(join(REPORTS_DIR, 'results.json'), JSON.stringify(resultados, null, 2));

  const total = resultados.length;
  const conErrores = resultados.filter((r) => r.erroresConsola.length > 0).length;
  console.log(`\n═══ Resumen ═══`);
  console.log(`Combinaciones ruta × viewport: ${total}`);
  console.log(`Layout PASS: ${total - fallosLayout} / ${total}`);
  console.log(`Con errores de consola: ${conErrores}`);
  console.log(`Resultados: reports/results.json — screenshots: reports/screenshots/`);

  process.exit(fallosLayout > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
