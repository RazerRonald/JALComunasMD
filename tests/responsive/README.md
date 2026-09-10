# Verificación responsive automatizada

Script de regresión que recorre **todas las rutas de la SPA** en **10 viewports**
(320×568 a 1920×1080) y verifica que el layout no se rompa.

## Qué verifica

- Overflow horizontal (`scrollWidth > innerWidth`)
- Elementos que se salen del viewport (excluye `.table-responsive`, cuyo scroll es intencional)
- Texto recortado no intencional (excluye `.text-truncate` y line-clamp deliberados)
- Solapamiento entre controles interactivos
- Errores de consola del navegador
- Captura screenshot de página completa por cada ruta × viewport en `reports/screenshots/`

## Uso

```bash
cd tests/responsive
npm install
npx playwright install chromium
npm run check
```

El script levanta su propio servidor estático en el puerto **5501** (la app
reconoce 5500/5501 como entorno local y no usa el proxy `/api/noticias-media`).
Si ya tienes un servidor corriendo, usa `BASE_URL`:

```bash
BASE_URL=http://localhost:5500 npm run check
```

## Credenciales

Las rutas protegidas requieren sesión. Copia `.env.example` como `.env`
(ignorado por git) y completa las cuentas de prueba:

```bash
cp .env.example .env
```

También se pueden pasar como variables de entorno (tienen prioridad sobre `.env`):

```bash
JAL_EDIL_EMAIL=... JAL_EDIL_PASSWORD=... JAL_ESTUDIANTE_EMAIL=... JAL_ESTUDIANTE_PASSWORD=... npm run check
```

Sin credenciales, los grupos protegidos se omiten y el script termina con código 1.

## Salida

- `reports/results.json` — resultado detallado por ruta × viewport
- `reports/screenshots/<rol>-<ruta>/<ancho>x<alto>.png`
- Código de salida `1` si alguna combinación falla el layout (para CI)

`reports/` está en `.gitignore`: se regenera en cada corrida.
