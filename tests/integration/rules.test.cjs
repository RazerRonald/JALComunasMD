const { test, before, after } = require('node:test');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc, serverTimestamp, Timestamp } = require('firebase/firestore');
let env;
const suffix = randomUUID().slice(0, 8); const admin = `admin-${suffix}`; const student = `student-${suffix}`;
const profile = uid => ({ uid, nombre: 'Ana', primer_apellido: 'Diaz', segundo_apellido: 'Ruiz', email: `${uid}@example.test`,
  tipo_documento: 'CC', numero_documento: '12345678', ciudad_documento: 'Medellin', rol: 'estudiante' });
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-jal-audit', firestore: { host: '127.0.0.1', port: 8088, rules: fs.readFileSync('firestore.rules','utf8') } });
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users', admin), { ...profile(admin), rol: 'edil' });
    await setDoc(doc(context.firestore(), 'users', student), profile(student));
    await setDoc(doc(context.firestore(), 'solicitudes_acceso', suffix), { estado: 'Pendiente' });
    await setDoc(doc(context.firestore(), 'info_carta_documentos', suffix), { url: 'private' });
  });
});
after(async () => env?.cleanup());
test('Anonymous direct creation bypass is closed; only Edil can read requests', async () => {
  const anon = env.unauthenticatedContext().firestore(); const ed = env.authenticatedContext(admin).firestore();
  await assertFails(setDoc(doc(anon, 'solicitudes_acceso', `new-${suffix}`), { ...profile(student), estado: 'Pendiente' }));
  await assertFails(getDoc(doc(anon, 'solicitudes_acceso', suffix)));
  await assertSucceeds(getDoc(doc(ed, 'solicitudes_acceso', suffix)));
  await assertFails(updateDoc(doc(ed, 'solicitudes_acceso', suffix), { estado: 'Aprobada' }));
});
test('Journals and quotas are private; direct profile edits/deletes cannot bypass recovery', async () => {
  const ed = env.authenticatedContext(admin).firestore(); const stu = env.authenticatedContext(student).firestore();
  for (const name of ['access_operations','user_operations','access_limits','access_duplicates']) {
    await assertFails(setDoc(doc(ed, name, suffix), { status: 'complete' }));
    await assertFails(getDoc(doc(ed, name, suffix)));
  }
  await assertFails(updateDoc(doc(ed, 'users', student), { email: 'other@example.test' }));
  await assertFails(deleteDoc(doc(ed, 'users', student)));
  await assertSucceeds(getDoc(doc(stu, 'users', student)));
  await assertFails(getDoc(doc(stu, 'users', admin)));
  await assertFails(getDoc(doc(stu, 'info_carta_documentos', suffix)));
});
test('Existing manual account creation by Edil still works; self registration remains denied', async () => {
  const ed = env.authenticatedContext(admin).firestore(); const stu = env.authenticatedContext(student).firestore();
  const id = `new-user-${suffix}`;
  await assertSucceeds(setDoc(doc(ed, 'users', id), { ...profile(id), creadoPor: admin, creadoEn: serverTimestamp() }));
  await assertFails(setDoc(doc(stu, 'users', `self-${suffix}`), { ...profile(`self-${suffix}`), creadoPor: student, creadoEn: serverTimestamp() }));
});
test('Event CRUD by Edil, public reading and rejection of student writes remain intact', async () => {
  const ed = env.authenticatedContext(admin).firestore(); const anon = env.unauthenticatedContext().firestore();
  const ref = doc(ed, 'eventos', suffix);
  await assertSucceeds(setDoc(ref, { titulo: 'Evento de prueba', descripcion: 'Descripcion', lugar: 'Casa comunal', autorId: admin,
    fecha: Timestamp.fromMillis(Date.now() + 3600000), fecha_fin: Timestamp.fromMillis(Date.now() + 7200000), creadoEn: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(anon, 'eventos', suffix)));
  await assertSucceeds(updateDoc(ref, { titulo: 'Evento editado', actualizadoEn: serverTimestamp() }));
  await assertFails(updateDoc(doc(env.authenticatedContext(student).firestore(), 'eventos', suffix), { titulo: 'No autorizado' }));
  await assertSucceeds(deleteDoc(ref));
});
