const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

function services() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'jal3-fd8a2';
    // Emulators are accepted only for an explicitly isolated demo project.
    const emulator = projectId.startsWith('demo-') && process.env.FIRESTORE_EMULATOR_HOST
      && process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.NODE_ENV !== 'production';
    if (emulator) initializeApp({ projectId });
    else {
      if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        throw new Error('Emuladores no permitidos para este proyecto');
      }
      const account = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : { client_email: process.env.GOOGLE_CLIENT_EMAIL, private_key: process.env.GOOGLE_PRIVATE_KEY };
      initializeApp({ projectId, credential: cert({ projectId,
        clientEmail: account.client_email,
        privateKey: String(account.private_key || '').replace(/\\n/g, '\n'),
      }) });
    }
  }
  return { db: getFirestore(), auth: getAuth() };
}
module.exports = { services };
