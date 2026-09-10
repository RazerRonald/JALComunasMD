// Focused browser regression; no Firebase, CAPTCHA or production service requests.
const { chromium } = require('playwright');
const { createDevServer } = require('../../scripts/dev.cjs');
const assert = require('node:assert/strict');
const server = createDevServer();
(async () => {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch();
  try {
    const page=await browser.newPage(); const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let fixture={status:200,contentType:'text/html',body:'<!DOCTYPE html><html>Fallback</html>'};
    await page.route('**/api/access-requests',route=>route.fulfill(fixture));
    await page.route('**/fixture',route=>route.fulfill({contentType:'text/html',body:'<div id="captcha"></div><p id="error"></p><script type="module">import Captcha from "/js/components/AccessCaptcha.js";new Captcha(document.querySelector("#captcha"),()=>{},message=>document.querySelector("#error").textContent=message).mount();</script>'}));
    const base=`http://127.0.0.1:${server.address().port}`;
    for(const status of [200,404]) {
      fixture.status=status;await page.goto(base+'/fixture');
      await page.waitForFunction(()=>document.querySelector('#error').textContent.length>0);
      assert.match(await page.locator('#error').innerText(),/servicio de solicitudes no está disponible/);
      assert.doesNotMatch(await page.locator('#error').innerText(),/Unexpected|DOCTYPE|JSON/);
    }
    fixture={status:503,contentType:'application/json',body:JSON.stringify({code:'access/not-configured',error:'Formulario temporalmente no disponible.'})};
    await page.goto(base+'/fixture');await page.waitForFunction(()=>document.querySelector('#error').textContent.length>0);
    assert.equal(await page.locator('#error').innerText(),'Formulario temporalmente no disponible.');
    assert.deepEqual(errors,[]);
    console.log('PASS: HTML 200, HTML 404 y error JSON 503; sin excepciones del navegador.');
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
