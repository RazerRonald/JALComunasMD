// Local server for the static frontend and the same API handlers used by Vercel.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const handlers = {
  '/api/access-requests': require('../api/access-requests'),
  '/api/admin-users': require('../api/admin-users'),
  '/api/noticias-media': require('../api/noticias-media'),
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
function createDevServer() {
  return http.createServer(async (req, res) => {
    const reply = (status, error) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error }));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      req.query = Object.fromEntries(url.searchParams);
      if (handlers[url.pathname]) return await handlers[url.pathname](req, res);
      if (url.pathname.startsWith('/api/')) return reply(404, 'Servicio no encontrado.');
      if (!['GET', 'HEAD'].includes(req.method)) return reply(405, 'Método no permitido.');
      const requested = decodeURIComponent(url.pathname);
      const relative = requested === '/' ? 'index.html' : requested.slice(1);
      const file = path.resolve(root, relative);
      const normalized = path.relative(root, file).replaceAll(path.sep, '/');
      if (!file.startsWith(root + path.sep) || (normalized !== 'index.html' && !/^(js|css|assets)\//.test(normalized))) {
        return reply(404, 'Archivo no encontrado.');
      }
      let content;
      try { content = await fs.promises.readFile(file); } catch (_) { return reply(404, 'Archivo no encontrado.'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (_) { if (!res.headersSent) reply(500, 'No se pudo completar la petición.'); else res.end(); }
  });
}
if (require.main === module) {
  const port = Number(process.env.JAL_DEV_PORT || 3000);
  createDevServer().listen(port, '127.0.0.1', () => console.log(`Aplicación local: http://127.0.0.1:${port}`));
}
module.exports = { createDevServer };
