function problem(code, message, status = 409) {
  return Object.assign(new Error(message), { code, status });
}
function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}
async function body(req) {
  const max = 16 * 1024;
  let value = req.body;
  if (value === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > max) throw problem('invalid-body', 'Solicitud demasiado grande.', 413);
      chunks.push(Buffer.from(chunk));
    }
    value = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value)) > max) {
    throw problem('invalid-body', 'Solicitud demasiado grande.', 413);
  }
  try { value = typeof value === 'string' ? JSON.parse(value) : value; }
  catch { throw problem('invalid-body', 'Solicitud invalida.', 400); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw problem('invalid-body', 'Solicitud invalida.', 400);
  return value;
}
async function edil(req, { auth, db }) {
  const token = String(req.headers.authorization || '').match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw problem('auth/unauthorized', 'Inicia sesion nuevamente.', 401);
  let user;
  try { user = await auth.verifyIdToken(token, true); }
  catch { throw problem('auth/unauthorized', 'Inicia sesion nuevamente.', 401); }
  const profile = await db.doc(`users/${user.uid}`).get();
  if (profile.data()?.rol !== 'edil') throw problem('auth/unauthorized', 'Se requieren permisos de Edil.', 403);
  return user.uid;
}
function failure(res, error) {
  // Only controlled errors reach the browser; no provider payloads or PII in logs.
  console.error('[api]', error.code || 'internal');
  json(res, error.status || 503, { code: error.status ? error.code : 'api/unavailable',
    error: error.status ? error.message : 'No se pudo completar la operacion. Intenta nuevamente.' });
}
function validId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw problem('invalid-id', 'Identificador invalido.', 400);
  return id;
}
module.exports = { problem, json, body, edil, failure, validId };
