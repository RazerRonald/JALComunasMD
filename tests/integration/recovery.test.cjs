const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
// Never permit these tests to select a real project.
process.env.FIREBASE_PROJECT_ID = 'demo-jal-audit';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9098';
const { services } = require('../../server/firebase');
const { accessService } = require('../../server/access');
const { userService } = require('../../server/users');
const { submit } = require('../../server/public-access');
const { db, auth } = services();
const prefix = randomUUID().slice(0, 8);
let index = 0;
const data = () => ({ nombre: 'Ana', primer_apellido: 'Diaz', segundo_apellido: 'Ruiz',
  email: `${prefix}-${++index}@example.test`, numero_documento: `${prefix}${index}`, tipo_documento: 'CC', ciudad_documento: 'Medellin', rol: 'estudiante' });
async function request(extra = {}) {
  const ref = db.collection('solicitudes_acceso').doc();
  await ref.set({ ...data(), estado: 'Pendiente', fecha_solicitud: new Date(), ...extra });
  return ref;
}
function failWrite(db, collection) {
  let armed = true;
  return new Proxy(db, { get(target, key) {
    if (key === 'runTransaction') return fn => target.runTransaction(tx => fn(new Proxy(tx, { get(t, k) {
      if (['create', 'set'].includes(k)) return (ref, value) => {
        if (armed && ref.path.startsWith(collection + '/')) { armed = false; throw new Error('Injected Firestore failure'); }
        return t[k](ref, value);
      };
      return typeof t[k] === 'function' ? t[k].bind(t) : t[k];
    } })));
    return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
  } });
}
const wrapAuth = overrides => new Proxy(auth, { get(target, key) { return overrides[key] || (typeof target[key] === 'function' ? target[key].bind(target) : target[key]); } });
const gate = () => { let resolve; return { promise: new Promise(r => { resolve = r; }), open: () => resolve() }; };
after(async () => { await db.terminate(); });

test('Approval activates only after atomic profile and approval; repeated approval uses same UID', async () => {
  const ref = await request(); let creates = 0; let sent = 0;
  const service = accessService({ db, sendReset: async () => { sent++; }, auth: wrapAuth({
    createUser: async input => { creates++; assert.equal(input.disabled, true); return auth.createUser(input); },
    updateUser: async (uid, fields) => {
      assert.equal((await ref.get()).data().estado, 'Aprobada');
      assert.equal((await db.doc(`users/${uid}`).get()).exists, true);
      return auth.updateUser(uid, fields);
    },
  }) });
  const first = await service.approve(ref.id, 'edil');
  const second = await service.approve(ref.id, 'edil');
  assert.equal(first.uid, second.uid); assert.equal(creates, 1); assert.equal(sent, 1);
  assert.equal((await auth.getUser(first.uid)).disabled, false);
});
test('Concurrent approval/rejection and double approval cannot race', async () => {
  const ref = await request(); const entered = gate(); const proceed = gate();
  const service = accessService({ db, sendReset: async () => {}, auth: wrapAuth({ createUser: async input => {
    entered.open(); await proceed.promise; return auth.createUser(input);
  } }) });
  const approving = service.approve(ref.id, 'edil'); await entered.promise;
  await assert.rejects(service.reject(ref.id, 'other'), { code: 'operation/busy' });
  await assert.rejects(service.approve(ref.id, 'other'), { code: 'operation/busy' });
  proceed.open(); await approving;
});
test('Firestore failure leaves disabled account and recovery creates no duplicate', async () => {
  const ref = await request(); let creates = 0; let uid;
  const wrapped = wrapAuth({ createUser: async input => { creates++; uid = input.uid; return auth.createUser(input); } });
  await assert.rejects(accessService({ db: failWrite(db, 'users'), auth: wrapped, sendReset: async () => {} }).approve(ref.id, 'edil'), { code: 'access/recovery-required' });
  assert.equal((await auth.getUser(uid)).disabled, true);
  assert.equal((await db.doc(`users/${uid}`).get()).exists, false);
  assert.equal((await ref.get()).data().estado, 'Procesando');
  await accessService({ db, auth: wrapped, sendReset: async () => {} }).approve(ref.id, 'other');
  assert.equal(creates, 1); assert.equal((await auth.getUser(uid)).disabled, false);
});
test('Lost response after Auth creation recovers predetermined UID', async () => {
  const ref = await request();
  const wrapped = wrapAuth({ createUser: async input => { await auth.createUser(input); throw new Error('Lost response'); } });
  await assert.rejects(accessService({ db, auth: wrapped, sendReset: async () => {} }).approve(ref.id, 'edil'));
  const result = await accessService({ db, auth, sendReset: async () => {} }).approve(ref.id, 'edil');
  assert.equal((await auth.getUser(result.uid)).disabled, false);
});
test('Failed activation can resume; rejected request never creates an account', async () => {
  const ref = await request();
  await assert.rejects(accessService({ db, auth: wrapAuth({ updateUser: async () => { throw new Error('Unavailable'); } }), sendReset: async () => {} }).approve(ref.id, 'edil'));
  assert.equal((await ref.get()).data().activacion_pendiente, true);
  await accessService({ db, auth, sendReset: async () => {} }).approve(ref.id, 'edil');
  assert.equal((await ref.get()).data().activacion_pendiente, false);
  const rejected = await request(); const service = accessService({ db, auth, sendReset: async () => {} });
  await service.reject(rejected.id, 'edil');
  await assert.rejects(service.approve(rejected.id, 'edil'), { code: 'solicitud/ya-resuelta' });
  assert.equal((await rejected.get()).data().estado, 'Rechazada');
});
test('Existing email releases reservation, allowing rejection', async () => {
  const input = data(); await auth.createUser({ email: input.email, password: 'test-password-long' });
  const ref = await request(input); const service = accessService({ db, auth, sendReset: async () => {} });
  await assert.rejects(service.approve(ref.id, 'edil'), { code: 'auth/email-already-exists' });
  assert.equal((await ref.get()).data().estado, 'Pendiente');
  await service.reject(ref.id, 'edil');
});
test('Email failure is separate; resend is throttled and uses current Auth email', async () => {
  const ref = await request(); let time = Date.now(); let fail = true; let recipient;
  const service = accessService({ db, auth, now: () => time, sendReset: async email => { if (fail) throw new Error('Mail failure'); recipient = email; } });
  const result = await service.approve(ref.id, 'edil');
  assert.equal(result.correoEnviado, false); assert.equal((await ref.get()).data().correo_estado, 'Error');
  await assert.rejects(service.sendEmail(ref.id), { code: 'mail/rate-limit' });
  time += 61000; fail = false;
  const email = `${prefix}-changed@example.test`; await auth.updateUser(result.uid, { email });
  assert.equal((await service.sendEmail(ref.id)).correoEnviado, true); assert.equal(recipient, email);
});
async function user() {
  const input = data(); const record = await auth.createUser({ email: input.email, password: 'test-password-long' });
  await db.doc(`users/${record.uid}`).set({ ...input, uid: record.uid, creadoPor: 'edil', creadoEn: new Date() });
  return { ...input, uid: record.uid };
}
test('Profile failure after Auth update is durable, blocks new edits/deletion, recovers exact intent', async () => {
  const old = await user(); const desired = { ...old, email: `${prefix}-edited@example.test`, nombre: 'Elena' };
  const service = userService({ db: failWrite(db, 'users'), auth });
  await assert.rejects(service.update(old.uid, desired, 'new-password-long', 'edil'), { code: 'operation/recovery-required' });
  assert.equal((await auth.getUser(old.uid)).email, desired.email);
  assert.equal((await db.doc(`users/${old.uid}`).get()).data().email, old.email);
  const journal = (await db.doc(`user_operations/${old.uid}`).get()).data();
  assert.equal(JSON.stringify(journal).includes('new-password-long'), false);
  const recovery = userService({ db, auth });
  await assert.rejects(recovery.update(old.uid, { ...old, nombre: 'Different' }, '', 'edil'), { code: 'operation/recovery-required' });
  await assert.rejects(recovery.remove(old.uid, 'edil'), { code: 'operation/recovery-required' });
  const result = await recovery.update(old.uid, null, '', 'edil', true);
  assert.equal(result.passwordActualizada, false);
  assert.equal((await db.doc(`users/${old.uid}`).get()).data().email, desired.email);
  assert.equal((await db.doc(`users/${old.uid}`).get()).data().creadoPor, 'edil');
});
test('Password failure reports partial result without desynchronizing the profile', async () => {
  const old = await user(); const desired = { ...old, nombre: 'Nombre actualizado' };
  const service = userService({ db, auth: wrapAuth({ updateUser: (uid, values) => {
    if (values.password) throw new Error('Password rejected'); return auth.updateUser(uid, values);
  } }) });
  const result = await service.update(old.uid, desired, 'new-password-long', 'edil');
  assert.equal(result.passwordActualizada, false);
  assert.equal((await db.doc(`users/${old.uid}`).get()).data().nombre, desired.nombre);
});
test('Rejected email edit restores the stored profile and permits a corrected edit', async () => {
  const old = await user(); const other = await user(); const service = userService({ db, auth });
  await assert.rejects(service.update(old.uid, { ...old, email: other.email }, '', 'edil'), { code: 'auth/email-already-exists' });
  assert.equal((await auth.getUser(old.uid)).email, old.email);
  assert.equal((await db.doc(`user_operations/${old.uid}`).get()).data().status, 'cancelled');
  await service.update(old.uid, { ...old, nombre: 'Edicion corregida' }, '', 'edil');
});
test('Self-demotion and self-deletion remain blocked', async () => {
  const old = await user(); const service = userService({ db, auth });
  await assert.rejects(service.update(old.uid, old, '', old.uid), { code: 'auth/no-self-demote' });
  await assert.rejects(service.remove(old.uid, old.uid), { code: 'auth/no-self-delete' });
});
test('Lost Auth update response retries the same payload regardless of JSON key order', async () => {
  const old = await user(); const desired = { ...old, nombre: 'Cambio recuperable' };
  await assert.rejects(userService({ db, auth: wrapAuth({ updateUser: async (uid, input) => {
    await auth.updateUser(uid, input); throw new Error('Lost response');
  } }) }).update(old.uid, desired, '', 'edil'), { code: 'operation/recovery-required' });
  const reversed = Object.fromEntries(Object.entries(desired).reverse());
  await userService({ db, auth }).update(old.uid, reversed, '', 'edil');
  assert.equal((await db.doc(`users/${old.uid}`).get()).data().nombre, desired.nombre);
});
test('A crashed worker lease blocks edits and allows recovery only after expiration', async () => {
  const old = await user(); const time = Date.now();
  await db.doc(`user_operations/${old.uid}`).set({ status: 'pending', payload: old, actor: 'edil', owner: 'crashed', leaseUntil: time + 120000 });
  await assert.rejects(userService({ db, auth, now: () => time }).update(old.uid, null, '', 'edil', true), { code: 'operation/busy' });
  await userService({ db, auth, now: () => time + 120001 }).update(old.uid, null, '', 'edil', true);
  assert.equal((await db.doc(`user_operations/${old.uid}`).get()).data().status, 'complete');
});
test('Atomic deduplication and persistent per-IP limits', async () => {
  const input = data(); const options = { db, input, secret: prefix, ip: '127.0.0.1' };
  await Promise.all([submit(options), submit({ ...options, ip: '127.0.0.2' })]);
  assert.equal((await db.collection('solicitudes_acceso').where('email', '==', input.email).get()).size, 1);
  for (let i = 0; i < 4; i++) await submit(options);
  await assert.rejects(submit(options), { code: 'access/rate-limit' });
  await submit({ ...options, input: { ...input, email: `${prefix}-duplicate@example.test` }, ip: '127.0.0.3' });
  assert.equal((await db.collection('solicitudes_acceso').where('numero_documento', '==', input.numero_documento).get()).size, 1);
});
test('Legacy duplicate requests without indexes are also blocked', async () => {
  const ref = await request(); const input = (await ref.get()).data();
  await submit({ db, input, secret: `${prefix}-legacy`, ip: '127.0.0.9' });
  assert.equal((await db.collection('solicitudes_acceso').where('email', '==', input.email).get()).size, 1);
});
test('Global daily ceiling applies across different IPs', async () => {
  const { createHmac } = require('node:crypto'); const time = Date.now(); const secret = `${prefix}-global`;
  const key = createHmac('sha256', secret).update(`global:${Math.floor(time / 86400000)}`).digest('hex');
  await db.doc(`access_limits/${key}`).set({ count: 199 });
  await submit({ db, input: data(), secret, ip: '127.0.0.4', now: () => time });
  await assert.rejects(submit({ db, input: data(), secret, ip: '127.0.0.5', now: () => time }), { code: 'access/rate-limit' });
});
