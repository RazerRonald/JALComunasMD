const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const helper = import('data:text/javascript;base64,' + fs.readFileSync('js/utils/apiResponse.js').toString('base64'));
test('HTML fallback with status 200 or 404 is never interpreted as API success', async () => {
  const { readApiResponse } = await helper;
  for (const status of [200,404]) {
    await assert.rejects(readApiResponse(new Response('<!DOCTYPE html><html>Fallback</html>', {
      status, headers: { 'Content-Type': 'text/html' },
    })), error => error.code === 'api/backend-unavailable' && !/Unexpected|DOCTYPE/.test(error.message));
  }
});
test('Malformed JSON and invalid successful payloads produce a controlled error', async () => {
  const { readApiResponse } = await helper;
  for (const content of ['<!DOCTYPE html>', 'null', '[]', '{}']) {
    await assert.rejects(readApiResponse(new Response(content, { headers: { 'Content-Type': 'application/json' } }),
      data => typeof data.siteKey === 'string'), { code: 'api/backend-unavailable' });
  }
});
test('Valid API errors and successful configuration keep their contract', async () => {
  const { readApiResponse } = await helper;
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  await assert.rejects(readApiResponse(new Response(JSON.stringify({code:'access/not-configured',error:'Formulario temporalmente no disponible.'}), {status:503,headers})),
    {code:'access/not-configured',message:'Formulario temporalmente no disponible.'});
  assert.deepEqual(await readApiResponse(new Response('{"siteKey":"valid"}',{headers}), data=>typeof data.siteKey==='string'), {siteKey:'valid'});
});
test('Local development server returns JSON for APIs and does not expose private files', async () => {
  const { createDevServer } = require('../../scripts/dev.cjs');
  const server = createDevServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const missing = await fetch(base+'/api/unknown');
    assert.equal(missing.status,404); assert.match(missing.headers.get('content-type'), /application\/json/);
    for(const file of ['/.env','/server/firebase.js','/js/..%2fserver/firebase.js']) assert.equal((await fetch(base+file)).status,404);
    assert.equal((await fetch(base+'/index.html')).status,200);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
