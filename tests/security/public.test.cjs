const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyCaptcha, clientIp, config } = require('../../server/public-access');
const { profile } = require('../../server/profile');
const { body } = require('../../server/http');
const settings = { secret: 'test-only', hosts: ['example.test'] };
const verify = result => verifyCaptcha('token', '127.0.0.1', settings, async () => ({ ok: true, json: async () => result }));
test('CAPTCHA requires success, exact hostname and action', async () => {
  const valid = { success: true, hostname: 'example.test', action: 'solicitar-acceso' };
  await verify(valid);
  for (const result of [{ ...valid, success: false }, { ...valid, hostname: 'evil.test' }, { ...valid, action: 'other' }]) await assert.rejects(verify(result), { code: 'captcha/invalid' });
  await assert.rejects(verifyCaptcha('', '127.0.0.1', settings), { code: 'captcha/invalid' });
});
test('Unconfigured CAPTCHA fails closed', () => {
  const previous = process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  assert.throws(config, { code: 'access/not-configured' });
  if (previous) process.env.TURNSTILE_SECRET_KEY = previous;
});
test('IP cannot be chosen with generic forwarded header', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '8.8.8.8' }, socket: { remoteAddress: '127.0.0.1' } }), '127.0.0.1');
});
test('Malformed and oversized requests fail with controlled errors', async () => {
  for (const value of ['{', 'null', '[]']) await assert.rejects(body({ body: value }), { code: 'invalid-body' });
  await assert.rejects(body({ body: { value: 'x'.repeat(17000) } }), { status: 413 });
});
test('Public profile forces student role and validates lengths', () => {
  const input = { nombre: 'Ana', primer_apellido: 'Diaz', segundo_apellido: 'Ruiz', email: ' ANA@example.test ',
    numero_documento: '123456', tipo_documento: 'CC', ciudad_documento: 'Medellin', rol: 'edil' };
  assert.equal(profile(input, 'id', true).rol, 'estudiante');
  assert.equal(profile(input, 'id', true).email, 'ana@example.test');
  assert.throws(() => profile({ ...input, nombre: 'a'.repeat(81) }, 'id'), { code: 'invalid-profile' });
});
