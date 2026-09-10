const { server, state } = require('./server.cjs');
const { services } = require('../../server/firebase');
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { db, auth } = services();
const id = randomUUID().slice(0, 8);
const password = 'Test-password-1234';
const profile = (uid, rol) => ({ uid, rol, email: `${uid}@example.test`, nombre: 'Ana', primer_apellido: 'Diaz', segundo_apellido: 'Ruiz',
  numero_documento: uid, tipo_documento: 'CC', ciudad_documento: 'Medellin', creadoEn: new Date(), creadoPor: 'seed' });
const reports = [];
let browser;
async function main() {
  fs.mkdirSync('reports/audit', { recursive: true });
  const admin = `web-admin-${id}`; const student = `web-student-${id}`;
  for (const [uid, rol] of [[admin, 'edil'], [student, 'estudiante']]) {
    await auth.createUser({ uid, email: `${uid}@example.test`, password });
    await db.doc(`users/${uid}`).set(profile(uid, rol));
  }
  await db.doc(`noticias/web-${id}`).set({ titulo: 'Noticia de prueba', cuerpo: 'Contenido de prueba para revisar la vista publica.', autorId: admin, fechaPublicacion: new Date(),
    media_drive_id: null, media_tipo: null, media_url: null, media_embed_url: null, media_view_url: null, media_mime: null, media_nombre: null, media_folder_id: null });
  await db.doc(`eventos/web-${id}`).set({ titulo: 'Evento de prueba', descripcion: 'Encuentro comunitario', lugar: 'Casa comunal', autorId: admin,
    fecha: new Date(Date.now() + 86400000), fecha_fin: new Date(Date.now() + 90000000), creadoEn: new Date() });
  await new Promise(resolve => server.listen(5501, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const errors = []; const forbidden = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'challenges.cloudflare.com') return route.fulfill({ contentType:'text/javascript', body: `window.turnstile={render(el,o){this.o=o;el.innerHTML='<button type="button" id="test-captcha">Verificar</button>';el.firstChild.onclick=()=>o.callback('test-token');return 1},reset(){},remove(){}};` });
    if (['accounts.google.com','apis.google.com'].includes(url.hostname)) return route.fulfill({ contentType:'text/javascript', body:'' });
    if (['identitytoolkit.googleapis.com','securetoken.googleapis.com','firestore.googleapis.com','drive.google.com','www.googleapis.com'].includes(url.hostname)) {
      forbidden.push(url.hostname); return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const go = async route => {
    if (page.url() === 'about:blank') await page.goto(`http://127.0.0.1:5501/${route}`);
    else await page.evaluate(hash => { location.hash = hash; }, route);
    await page.waitForTimeout(150);
    await page.waitForFunction(() => document.querySelector('#app-root h1, #app-root h2'));
    await page.waitForTimeout(350);
  };
  const scan = async (role, routes) => {
    for (const route of routes) {
      await go(route);
      for (const width of [320,375,390,414,768,820,1024,1280,1440,1920]) {
        await page.setViewportSize({ width, height: 900 });
        // Wait for responsive offcanvas transitions after crossing breakpoints.
        await page.waitForTimeout(400);
        if (width < 992) assert.equal(await page.locator('#navbarMain').evaluate(el => getComputedStyle(el).visibility), 'hidden');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        reports.push({ role, route, width, overflow });
        if (width === 375 || width === 1280) await page.screenshot({ path: `reports/audit/${role}-${route.replace(/[^a-z0-9]/gi,'_')}-${width}.png`, fullPage: true });
      }
    }
  };
  const login = async uid => {
    await go('#/login'); await page.fill('#login-email', `${uid}@example.test`); await page.fill('#login-password', password);
    await page.click('#btn-login'); await page.waitForFunction(() => !location.hash.includes('login'));
  };
  const logout = async () => { await page.evaluate(async () => { const { default: model } = await import('/js/models/AuthModel.js'); await model.logout(); }); };
  await scan('publico', ['#/inicio','#/noticias',`#/noticias/web-${id}`,'#/eventos','#/contacto','#/login','#/solicitar-acceso']);
  await page.setViewportSize({width:375,height:900}); await page.waitForTimeout(400);
  await page.click('.navbar-toggler'); await page.waitForSelector('#navbarMain.show');
  await page.click('#navbarMain [data-bs-dismiss="offcanvas"]');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('navbarMain')).visibility === 'hidden');
  await go('#/solicitar-acceso');
  assert.equal(await page.isDisabled('#btn-enviar-solicitud-acceso'), true);
  for (const [name,value] of Object.entries({ nombre:'Laura', primer_apellido:'Perez', segundo_apellido:'Diaz', numero_documento:`req${id}`, ciudad_documento:'Medellin', email:`request-${id}@example.test` })) await page.fill(`[name="${name}"]`, value);
  await page.selectOption('[name="tipo_documento"]', 'CC'); await page.click('#test-captcha');
  await page.evaluate(() => window.turnstile.o['expired-callback']());
  assert.equal(await page.isDisabled('#btn-enviar-solicitud-acceso'), true);
  state.captchaFails = true;
  await page.click('#test-captcha'); await page.click('#btn-enviar-solicitud-acceso');
  await page.waitForSelector('#solicitud-acceso-error:not(.d-none)');
  assert.equal((await db.collection('solicitudes_acceso').where('email','==',`request-${id}@example.test`).get()).size,0);
  state.captchaFails = false; await page.click('#test-captcha');
  await page.click('#btn-enviar-solicitud-acceso'); await page.waitForSelector('#solicitud-acceso-exito:not(.d-none)');
  const request = (await db.collection('solicitudes_acceso').where('email','==',`request-${id}@example.test`).get()).docs[0];
  assert.ok(request);
  await login(admin);
  await scan('edil', ['#/admin','#/admin/noticias','#/publicar','#/admin/eventos','#/admin/tramites','#/admin/usuarios','#/admin/solicitudes-acceso','#/perfil']);
  await page.evaluate(async ({admin,id,password}) => {
    const {default: users} = await import('/js/models/AuthModel.js');
    const created = await users.crearUsuarioPorEdil({rol:'estudiante',email:`manual-${id}@example.test`,password,
      nombre:'Manual',primer_apellido:'Perez',segundo_apellido:'Diaz',tipo_documento:'CC',numero_documento:`manual${id}`,ciudad_documento:'Medellin'});
    if(users.getSesion().uid !== admin) throw new Error('Manual creation replaced Edil session');
    await users.actualizarUsuarioPorEdil(created.uid,{...created,email:`manual-edit-${id}@example.test`},created);
    await users.eliminarUsuarioPorEdil(created.uid);
    const {default: news} = await import('/js/models/NoticiaModel.js');
    const noticia = await news.create({titulo:'Nueva noticia',cuerpo:'Contenido de prueba',autorId:admin});
    await news.update(noticia,{titulo:'Noticia editada'});
    if((await news.getById(noticia)).titulo !== 'Noticia editada') throw new Error('News update failed');
    await news.delete(noticia);
    const {default: events} = await import('/js/models/EventoModel.js');
    const event = await events.create({titulo:'Nuevo evento',descripcion:'Descripcion',lugar:'Casa comunal',autorId:admin,fecha:new Date(Date.now()+3600000),fecha_fin:new Date(Date.now()+7200000)});
    await events.update(event,{titulo:'Evento editado'});
    if((await events.getById(event)).titulo !== 'Evento editado') throw new Error('Event update failed');
    await events.delete(event);
  }, {admin,id,password});
  await go('#/admin/solicitudes-acceso');
  await page.click(`.btn-aprobar-acceso[data-id="${request.id}"]`); await page.click('#btn-confirmar-resolver-solicitud');
  await page.waitForFunction(() => document.querySelector('#toast-container')?.textContent.includes('No se pudo confirmar'));
  assert.equal((await request.ref.get()).data().correo_estado, 'Error');
  state.emailFails = false; await request.ref.update({ correo_ultimo_intento: Date.now() - 61000 });
  await page.click(`.btn-reenviar-acceso[data-id="${request.id}"]`);
  await page.waitForFunction(() => document.querySelector('#toast-container')?.textContent.includes('Correo de contrasena enviado'));
  // Real model -> real API -> Auth emulator + Firestore emulator.
  await page.evaluate(async ({uid}) => {
    const {default: model} = await import('/js/models/AuthModel.js');
    const user = (await model.listarUsuarios()).find(u=>u.uid===uid);
    await model.actualizarUsuarioPorEdil(uid, {...user,nombre:'Nombre editado'},user);
  }, {uid:student});
  assert.equal((await db.doc(`users/${student}`).get()).data().nombre, 'Nombre editado');
  // Simulate a prior interrupted update and recover from the actual UI.
  await db.doc(`user_operations/${student}`).set({ status:'pending', leaseUntil:0, actor:admin, payload:{...profile(student,'estudiante'), nombre:'Perfil recuperado'} });
  await go('#/admin/usuarios'); await page.click(`.btn-editar-usuario[data-id="${student}"]`); await page.click('#btn-recuperar-usuario');
  await page.waitForFunction(() => document.querySelector('#toast-container')?.textContent.includes('Perfil sincronizado'));
  assert.equal((await db.doc(`users/${student}`).get()).data().nombre,'Perfil recuperado');
  await logout(); await login(student);
  await scan('estudiante', ['#/inicio','#/tramite','#/tramite/nueva','#/perfil']);
  const tramite = await page.evaluate(async () => {
    const {default: users} = await import('/js/models/AuthModel.js');
    const {default: files} = await import('/js/models/ArchivoModel.js');
    const user=users.getSesion();
    return files.registrarSolicitud({uid_estudiante:user.uid,nombre_completo:user.nombre,tipo_documento:user.tipo_documento,
      numero_documento:user.numero_documento,ciudad_documento:user.ciudad_documento,universidad:'Universidad de prueba',carrera:'Sistemas',
      semestre_actual:3,horas_a_realizar:80,lugar_realizacion:'Casa comunal'});
  });
  assert.equal((await db.doc(`info_carta_inicial/${tramite}`).get()).data().estado,'Pendiente');
  await go('#/tramite'); assert.match(await page.locator('#app-root').innerText(), /Universidad de prueba/);
  await go('#/perfil'); await page.click('#btn-cambiar-password');
  await page.fill('#password-actual',password); await page.fill('#password-nueva','Changed-password-123'); await page.fill('#password-confirmar','Changed-password-123');
  await page.click('#btn-guardar-password'); await page.waitForSelector('#modal-cambiar-password', {state:'hidden'});
  await go('#/admin/solicitudes-acceso');
  assert.match(await page.locator('#app-root').innerText(), /No tienes permiso/);
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  const overflows = reports.filter(r=>r.overflow);
  fs.writeFileSync('reports/audit/web-results.json', JSON.stringify({ reports, errors, forbidden, overflows },null,2));
  console.log(JSON.stringify({routeViewportChecks:reports.length,overflows,pageErrors:errors.length,productionRequests:forbidden.length,functionalFlows:'PASS'}));
  assert.deepEqual(overflows, []);
}
main().catch(async error => { console.error(error); if(browser) { const page=browser.contexts()[0]?.pages()[0]; if(page) await page.screenshot({path:'reports/audit/failure.png',fullPage:true}).catch(()=>{}); } process.exitCode=1; })
  .finally(async()=>{ if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); await db.terminate(); });
