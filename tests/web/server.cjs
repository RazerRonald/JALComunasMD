// Isolated test server. These mocks are never included in production handlers.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
process.env.FIREBASE_PROJECT_ID = 'demo-jal-audit';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9098';
process.env.FIREBASE_WEB_API_KEY = 'demo-key';
process.env.TURNSTILE_SITE_KEY = 'test-site';
process.env.TURNSTILE_SECRET_KEY = `test-secret-${require('node:crypto').randomUUID()}`;
process.env.TURNSTILE_HOSTNAMES = '127.0.0.1';
const root = path.resolve(__dirname, '../..');
const realFetch = global.fetch;
const state = { emailFails: true, captchaFails: false };
global.fetch = async (url, options) => {
  if (String(url).startsWith('https://challenges.cloudflare.com/turnstile/')) {
    const input = JSON.parse(options.body);
    return new Response(JSON.stringify({ success: input.response === 'test-token' && !state.captchaFails, hostname: '127.0.0.1', action: 'solicitar-acceso' }));
  }
  if (String(url).startsWith('https://identitytoolkit.googleapis.com/')) return new Response('{}', { status: state.emailFails ? 503 : 200 });
  return realFetch(url, options);
};
const handlers = { '/api/access-requests': require('../../api/access-requests'), '/api/admin-users': require('../../api/admin-users') };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:5501');
  if (handlers[url.pathname]) return handlers[url.pathname](req, res);
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(root + path.sep)) { res.statusCode = 403; res.end(); return; }
  try {
    let content = fs.readFileSync(file);
    if (url.pathname === '/js/config/firebase.config.js') {
      content = content.toString().replace(/export const firebaseConfig = \{[\s\S]*?\};/, `export const firebaseConfig = { apiKey: 'demo-key', projectId: 'demo-jal-audit', authDomain: 'localhost', appId: 'demo' };`);
      content += `\nimport { connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';\nimport { connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';\nconnectAuthEmulator(auth,'http://127.0.0.1:9098',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8088);`;
    }
    if (url.pathname === '/js/models/AuthModel.js') {
      content = content.toString().replace('const secondaryAuth = getAuth(secondaryApp);', 'const secondaryAuth = getAuth(secondaryApp); connectTestAuth(secondaryAuth, "http://127.0.0.1:9098", {disableWarnings:true});');
      content += '\nimport { connectAuthEmulator as connectTestAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";';
    }
    res.setHeader('Content-Type', ({ '.js':'text/javascript', '.html':'text/html', '.css':'text/css', '.json':'application/json' })[path.extname(file)] || 'application/octet-stream');
    res.end(content);
  } catch (_) { res.statusCode = 404; res.end(); }
});
module.exports = { server, state };
