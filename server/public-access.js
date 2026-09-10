const { createHmac, randomUUID } = require('node:crypto');
const { isIP } = require('node:net');
const { problem } = require('./http');
const { profile } = require('./profile');
function config() {
  const siteKey = process.env.TURNSTILE_SITE_KEY; const secret = process.env.TURNSTILE_SECRET_KEY;
  const hosts = (process.env.TURNSTILE_HOSTNAMES || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!siteKey || !secret || !hosts.length) throw problem('access/not-configured', 'El formulario no esta disponible temporalmente. Intenta mas tarde.', 503);
  return { siteKey, secret, hosts };
}
async function verifyCaptcha(token, ip, settings = config(), fetcher = fetch) {
  if (typeof token !== 'string' || !token || token.length > 2048) throw problem('captcha/invalid', 'Completa la verificacion de seguridad.', 400);
  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: settings.secret, response: token, remoteip: ip, idempotency_key: randomUUID() }),
  });
  const result = await response.json();
  if (!response.ok || !result.success || result.action !== 'solicitar-acceso' || !settings.hosts.includes(result.hostname)) throw problem('captcha/invalid', 'La verificacion vencio o no es valida. Intenta nuevamente.', 400);
}
function clientIp(req) {
  // Vercel overwrites this header; never trust generic X-Forwarded-For.
  const ip = process.env.VERCEL === '1' ? req.headers['x-vercel-forwarded-for'] : req.socket?.remoteAddress;
  if (typeof ip !== 'string' || !isIP(ip)) throw problem('access/ip-unavailable', 'No se pudo validar la conexion.', 400);
  return ip;
}
async function submit({ db, input, ip, secret, now = Date.now }) {
  const { uid, ...data } = profile(input, undefined, true);
  const hash = value => createHmac('sha256', secret).update(value).digest('hex'); const time = now();
  const counters = [{ id: hash(`ip:${ip}:${Math.floor(time / 3600000)}`), max: 5 }, { id: hash(`global:${Math.floor(time / 86400000)}`), max: 200 }];
  await db.runTransaction(async tx => {
    const refs = counters.map(c => db.doc(`access_limits/${c.id}`)); const snaps = await Promise.all(refs.map(ref => tx.get(ref)));
    if (snaps.some((snap, i) => (snap.data()?.count || 0) >= counters[i].max)) throw problem('access/rate-limit', 'Se alcanzo el limite de solicitudes. Intenta mas tarde.', 429);
    refs.forEach((ref, i) => tx.set(ref, { count: (snaps[i].data()?.count || 0) + 1, expiresAt: new Date(time + 172800000) }));
  });
  await db.runTransaction(async tx => {
    const indexes = [db.doc(`access_duplicates/${hash(`email:${data.email}`)}`), db.doc(`access_duplicates/${hash(`document:${data.numero_documento}`)}`)];
    const snaps = await Promise.all(indexes.map(ref => tx.get(ref)));
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const old = await tx.get(db.doc(`solicitudes_acceso/${snap.data().requestId}`));
      if (old.exists && (old.data().estado !== 'Rechazada' || time - snap.data().createdAt < 86400000)) return;
    }
    // Existing installations have requests without deduplication indexes.
    // Check them inside the transaction too, so migration needs no data rewrite.
    for (const field of ['email', 'numero_documento']) {
      const existing = await tx.get(db.collection('solicitudes_acceso').where(field, '==', data[field]));
      if (existing.docs.some(doc => doc.data().estado !== 'Rechazada'
        || time - (doc.data().fecha_respuesta?.toMillis?.() || 0) < 86400000)) return;
    }
    const ref = db.collection('solicitudes_acceso').doc();
    tx.create(ref, { ...data, estado: 'Pendiente', fecha_solicitud: new Date(time), fecha_respuesta: null, uid_edil_respuesta: null, uid_usuario_creado: null });
    indexes.forEach(index => tx.set(index, { requestId: ref.id, createdAt: time }));
  });
  // Identical response for duplicates prevents email/document enumeration.
  return { ok: true };
}
module.exports = { config, verifyCaptcha, clientIp, submit };
