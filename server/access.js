const { createHash, randomBytes } = require('node:crypto');
const { problem, validId } = require('./http');
const { profile, fullName } = require('./profile');
const { claim, owned, release } = require('./operations');

function accessService({ db, auth, sendReset, now = Date.now }) {
  const requestRef = id => db.doc(`solicitudes_acceso/${validId(id)}`);
  const opRef = id => db.doc(`access_operations/${validId(id)}`);
  async function sendEmail(id) {
    const ref = requestRef(id);
    const request = await db.runTransaction(async tx => {
      const snap = await tx.get(ref); const data = snap.data();
      if (data?.estado !== 'Aprobada' || data.activacion_pendiente) throw problem('access/not-ready', 'Primero completa la creacion de la cuenta.');
      if (data.correo_ultimo_intento && now() - data.correo_ultimo_intento < 60000) throw problem('mail/rate-limit', 'Espera un minuto antes de reenviar el correo.', 429);
      tx.update(ref, { correo_estado: 'Pendiente', correo_ultimo_intento: now() });
      return data;
    });
    let sent = false;
    try { const user = await auth.getUser(request.uid_usuario_creado); await sendReset(user.email); sent = true; }
    catch (_) { /* The account exists; report the email failure independently. */ }
    await ref.update({ correo_estado: sent ? 'Enviado' : 'Error' }).catch(() => {});
    return { correoEnviado: sent };
  }
  async function approve(id, actor) {
    const ref = requestRef(id); const operationRef = opRef(id);
    const operation = await claim(db, operationRef, { payload: { id }, actor }, { now });
    try {
      const request = await db.runTransaction(async tx => {
        await owned(tx, operationRef, operation.owner);
        const snap = await tx.get(ref); const data = snap.data();
        if (!data) throw problem('solicitud/no-encontrada', 'La solicitud no existe.', 404);
        if (data.estado === 'Rechazada') throw problem('solicitud/ya-resuelta', 'La solicitud fue rechazada.');
        if (data.estado === 'Pendiente') tx.update(ref, { estado: 'Procesando' });
        return data;
      });
      const uid = request.uid_usuario_creado || `sol_${createHash('sha256').update(id).digest('hex').slice(0, 40)}`;
      const desired = profile(request, uid, true);
      if (request.estado !== 'Aprobada') {
        const duplicates = await db.collection('users').where('numero_documento', '==', desired.numero_documento).get();
        if (duplicates.docs.some(doc => doc.id !== uid)) throw problem('profile/document-duplicate', 'Ya existe un usuario con ese documento.');
        let user;
        try { user = await auth.getUser(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
        if (!user) user = await auth.createUser({ uid, email: desired.email, displayName: fullName(desired), password: randomBytes(32).toString('base64url'), disabled: true });
        if (user.email?.toLowerCase() !== desired.email) throw problem('access/identity-conflict', 'La cuenta requiere revision administrativa.');
        // Disabled account until approval and profile are committed atomically.
        await db.runTransaction(async tx => {
          await owned(tx, operationRef, operation.owner);
          const snapshot = await tx.get(ref);
          if (snapshot.data()?.estado !== 'Procesando') throw problem('solicitud/ya-resuelta', 'La solicitud cambio. Actualiza y reintenta.');
          tx.create(db.doc(`users/${uid}`), { ...desired, creadoPor: operation.actor, creadoEn: new Date(now()), solicitud_acceso_id: id });
          tx.update(ref, { estado: 'Aprobada', uid_usuario_creado: uid, uid_edil_respuesta: operation.actor,
            fecha_respuesta: new Date(now()), activacion_pendiente: true, correo_estado: 'Pendiente' });
        });
      }
      if (request.estado !== 'Aprobada' || request.activacion_pendiente) await auth.updateUser(uid, { disabled: false });
      await db.runTransaction(async tx => {
        await owned(tx, operationRef, operation.owner);
        tx.update(ref, { activacion_pendiente: false });
        tx.update(operationRef, { status: 'complete', leaseUntil: 0 });
      });
      let correoEnviado = request.correo_estado === 'Enviado';
      if (!correoEnviado) { try { ({ correoEnviado } = await sendEmail(id)); } catch (_) { correoEnviado = false; } }
      return { uid, correoEnviado };
    } catch (error) {
      if (['profile/document-duplicate', 'auth/email-already-exists', 'solicitud/ya-resuelta', 'solicitud/no-encontrada'].includes(error.code)) {
        const uid = `sol_${createHash('sha256').update(id).digest('hex').slice(0, 40)}`;
        let absent = false;
        try { await auth.getUser(uid); } catch (lookupError) { absent = lookupError.code === 'auth/user-not-found'; }
        if (absent) await db.runTransaction(async tx => {
          await owned(tx, operationRef, operation.owner);
          const snap = await tx.get(ref);
          if (snap.data()?.estado === 'Procesando') tx.update(ref, { estado: 'Pendiente' });
          tx.update(operationRef, { status: 'cancelled', leaseUntil: 0 });
        });
        if (error.code === 'auth/email-already-exists') throw problem(error.code, 'Ya existe una cuenta con ese correo. Revisa la solicitud.', 400);
      }
      if (error.status) throw error;
      throw problem('access/recovery-required', 'No se completo el acceso. Usa Reintentar acceso para continuar con la misma cuenta.', 503);
    } finally { await release(db, operationRef, operation.owner); }
  }
  async function reject(id, actor) {
    await db.runTransaction(async tx => {
      const ref = requestRef(id); const op = await tx.get(opRef(id)); const snap = await tx.get(ref);
      if (op.data()?.status === 'pending' || snap.data()?.estado === 'Procesando') throw problem('operation/busy', 'El acceso esta en proceso de creacion. No se puede rechazar.');
      if (snap.data()?.estado !== 'Pendiente') throw problem('solicitud/ya-resuelta', 'La solicitud ya fue resuelta.');
      tx.update(ref, { estado: 'Rechazada', uid_edil_respuesta: actor, fecha_respuesta: new Date(now()), uid_usuario_creado: null });
    });
    return { ok: true };
  }
  return { approve, reject, sendEmail };
}
module.exports = { accessService };
