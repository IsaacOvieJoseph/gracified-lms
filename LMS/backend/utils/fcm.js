const admin = require('firebase-admin');

let initialized = false;
let initError = null;

/**
 * Builds the firebase-admin credential from environment configuration.
 * Supports, in priority order:
 *  1. FIREBASE_SERVICE_ACCOUNT  — raw JSON string or base64-encoded JSON string
 *  2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *     (private key may contain literal \n sequences)
 *  3. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS, or GCP
 *     workload identity when running on Google Cloud)
 */
function buildCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    let parsed = null;
    try {
      parsed = JSON.parse(serviceAccountJson);
    } catch (e) {
      try {
        parsed = JSON.parse(Buffer.from(serviceAccountJson, 'base64').toString('utf8'));
      } catch (e2) {
        throw new Error(
          'FIREBASE_SERVICE_ACCOUNT must be valid JSON or a base64-encoded JSON string'
        );
      }
    }
    return admin.credential.cert(parsed);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    });
  }

  return admin.credential.applicationDefault();
}

/** Lazily initializes the default firebase-admin app exactly once. */
function ensureInitialized() {
  if (initialized) return admin;
  if (initError) throw initError;
  try {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: buildCredential() });
    }
    initialized = true;
    return admin;
  } catch (error) {
    initError = error;
    throw error;
  }
}

/** True if at least one credential source is present in the environment. */
function isFirebaseConfigured() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT ||
      (process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

/** Returns the firebase-admin messaging service. */
function messaging() {
  return ensureInitialized().messaging();
}

module.exports = {
  admin,
  ensureInitialized,
  isFirebaseConfigured,
  messaging,
};
