const { randomUUID } = require('node:crypto');
const { problem } = require('./http');
// Vercel handlers are capped at 60 s. A crashed worker expires after 120 s,
// and only the SAME immutable operation can resume. No new payload can replace it.
const LEASE_MS = 120000;
// Firestore may return map keys in a different order than the submitted JSON.
const samePayload = (a, b) => JSON.stringify(Object.entries(a || {}).sort(([x], [y]) => x.localeCompare(y)))
  === JSON.stringify(Object.entries(b || {}).sort(([x], [y]) => x.localeCompare(y)));
async function claim(db, ref, initial, { recover = false, now = Date.now } = {}) {
  const owner = randomUUID();
  const operation = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref); const old = snapshot.data();
    if (old?.leaseUntil > now()) throw problem('operation/busy', 'Hay una operacion en curso. Espera dos minutos y reintenta.');
    if (old?.status === 'pending' && !recover && !samePayload(old.payload, initial.payload)) {
      throw problem('operation/recovery-required', 'Hay una actualizacion pendiente. Usa Recuperar actualizacion antes de editar.');
    }
    if (recover && old?.status !== 'pending') return null;
    const next = old?.status === 'pending' ? old : { ...initial, status: 'pending' };
    tx.set(ref, { ...next, owner, leaseUntil: now() + LEASE_MS });
    return { ...next, owner };
  });
  return operation;
}
async function owned(tx, ref, owner) {
  const snap = await tx.get(ref);
  if (snap.data()?.owner !== owner || snap.data()?.status !== 'pending') throw problem('operation/busy', 'La operacion cambio. Actualiza y reintenta.');
  return snap.data();
}
async function release(db, ref, owner) {
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.data()?.owner === owner) tx.update(ref, { leaseUntil: 0 });
  }).catch(() => {}); // If Firestore is down the bounded lease permits later recovery.
}
module.exports = { claim, owned, release, LEASE_MS };
