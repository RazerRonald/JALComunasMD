const { problem, validId } = require('./http');
const { profile, fullName } = require('./profile');
const { claim, owned, release } = require('./operations');

function userService({ db, auth, now = Date.now }) {
  async function update(uid, input, password, actor, recover = false) {
    validId(uid);
    if (password && (typeof password !== 'string' || password.length < 10 || password.length > 128)) throw problem('WEAK_PASSWORD', 'La contrasena debe tener entre 10 y 128 caracteres.', 400);
    const desired = recover ? null : profile(input, uid);
    if (uid === actor && desired && desired.rol !== 'edil') throw problem('auth/no-self-demote', 'No puedes quitar tu propio rol Edil.', 400);
    const ref = db.doc(`users/${uid}`); const operationRef = db.doc(`user_operations/${uid}`);
    const current = await ref.get();
    if (!current.exists) throw problem('profile/not-found', 'No existe el perfil.', 404);
    const requestId = current.data().solicitud_acceso_id;
    if (requestId && (await db.doc(`solicitudes_acceso/${requestId}`).get()).data()?.activacion_pendiente) throw problem('access/not-ready', 'Completa primero el acceso desde Solicitudes de acceso.');
    const op = await claim(db, operationRef, { payload: desired, actor, passwordRequested: Boolean(password) }, { recover, now });
    if (!op) return { usuario: current.data(), recuperado: true };
    const cancelToStoredProfile = async () => {
      // A previous attempt may already have changed Auth. Restore the currently
      // stored profile before discarding a definitively rejected operation.
      const stored = (await ref.get()).data();
      await auth.updateUser(uid, { email: stored.email, displayName: fullName(stored) });
      await db.runTransaction(async tx => { await owned(tx, operationRef, op.owner); tx.update(operationRef, { status: 'cancelled', leaseUntil: 0 }); });
    };
    try {
      if (op.payload.delete) throw problem('operation/recovery-required', 'Hay una eliminacion pendiente. Reintenta Eliminar usuario.');
      if (uid === actor && op.payload.rol !== 'edil') throw problem('auth/no-self-demote', 'Otro Edil debe recuperar esta actualizacion.', 400);
      const duplicates = await db.collection('users').where('numero_documento', '==', op.payload.numero_documento).get();
      if (duplicates.docs.some(doc => doc.id !== uid)) {
        await cancelToStoredProfile();
        throw problem('profile/document-duplicate', 'Ya existe un usuario con ese documento.');
      }
      try { await auth.updateUser(uid, { email: op.payload.email, displayName: fullName(op.payload) }); }
      catch (error) {
        // Definitive rejection cancels the journal. Unknown outcomes must resume.
        if (['auth/email-already-exists', 'auth/invalid-email'].includes(error.code)) {
          await cancelToStoredProfile();
          throw problem(error.code, 'No se pudo actualizar la cuenta. Revisa el correo y que el usuario exista.', 400);
        }
        throw error;
      }
      await db.runTransaction(async tx => {
        await owned(tx, operationRef, op.owner);
        const latest = await tx.get(ref);
        if (!latest.exists) throw problem('profile/not-found', 'No existe el perfil.', 404);
        tx.set(ref, { ...latest.data(), ...op.payload, actualizadoPor: op.actor, actualizadoEn: new Date(now()) });
        tx.update(operationRef, { profileSynced: true });
      });
      // Passwords never enter the journal; report separately after both stores agree.
      let passwordActualizada = !op.passwordRequested;
      if (password) { try { await auth.updateUser(uid, { password }); passwordActualizada = true; } catch (_) { passwordActualizada = false; } }
      await db.runTransaction(async tx => { await owned(tx, operationRef, op.owner); tx.update(operationRef, { status: 'complete', leaseUntil: 0 }); });
      return { usuario: op.payload, passwordActualizada };
    } catch (error) {
      if (error.status) throw error;
      throw problem('operation/recovery-required', 'La actualizacion quedo pendiente. Usa Recuperar actualizacion; no crees otra cuenta.', 503);
    } finally { await release(db, operationRef, op.owner); }
  }
  async function remove(uid, actor) {
    validId(uid);
    if (uid === actor) throw problem('auth/no-self-delete', 'No puedes eliminar tu propio usuario.', 400);
    const current = (await db.doc(`users/${uid}`).get()).data();
    if (current?.solicitud_acceso_id && (await db.doc(`solicitudes_acceso/${current.solicitud_acceso_id}`).get()).data()?.activacion_pendiente) {
      throw problem('access/not-ready', 'Completa primero el acceso desde Solicitudes de acceso.');
    }
    const operationRef = db.doc(`user_operations/${uid}`);
    const op = await claim(db, operationRef, { payload: { delete: uid }, actor }, { now });
    try {
      try { await auth.deleteUser(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      await db.runTransaction(async tx => {
        await owned(tx, operationRef, op.owner);
        tx.delete(db.doc(`users/${uid}`)); tx.update(operationRef, { status: 'complete', leaseUntil: 0 });
      });
      return { ok: true, uid };
    } finally { await release(db, operationRef, op.owner); }
  }
  return { update, remove };
}
module.exports = { userService };
