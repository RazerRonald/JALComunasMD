const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
process.env.FIREBASE_PROJECT_ID = 'demo-jal-audit';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9098';
const { services } = require('../../server/firebase');
const users = require('../../api/admin-users');
const requests = require('../../api/access-requests');
const { db, auth } = services();
async function invoke(handler, method, body, token) {
  let result;
  const res = { setHeader() {}, end(value) { result = { status: this.statusCode, body: value ? JSON.parse(value) : null }; } };
  await handler({ method, body, headers: token ? { authorization: `Bearer ${token}` } : {} }, res);
  return result;
}
after(async () => db.terminate());
test('Administrative endpoints reject missing/invalid tokens and unsupported methods', async () => {
  for (const handler of [users, requests]) {
    assert.equal((await invoke(handler, 'PATCH', { uid: 'someone', id: 'request', action: 'approve' })).status, 401);
    assert.equal((await invoke(handler, 'PATCH', {}, 'not-a-token')).status, 401);
    assert.equal((await invoke(handler, 'PUT', {})).status, 405);
  }
});
test('A valid student token cannot administer users or approve requests', async () => {
  const uid = `api-${randomUUID()}`;
  await auth.createUser({ uid, email: `${uid}@example.test`, password: 'test-password-long' });
  await db.doc(`users/${uid}`).set({ uid, rol: 'estudiante' });
  const response = await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${uid}@example.test`, password: 'test-password-long', returnSecureToken: true }),
  });
  const { idToken } = await response.json(); assert.ok(idToken);
  assert.equal((await invoke(users, 'PATCH', { uid, perfil: { rol: 'edil' } }, idToken)).status, 403);
  assert.equal((await invoke(requests, 'PATCH', { id: 'request', action: 'approve' }, idToken)).status, 403);
});
