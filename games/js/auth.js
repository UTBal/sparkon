/** Google sign-in — Whiteboard cloud.js pattern (popup + redirect fallback). */
import { firebaseConfig } from './config.js';

const FIREBASE_VERSION = '12.19.0';
const FIREBASE_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
const INIT_TIMEOUT_MS = 10000;

let auth, db, a, f;
let ready = false;
export let initError = null;
export let redirectError = null;
export function clearRedirectError() { redirectError = null; }

let resolveReady;
const readyPromise = new Promise(resolve => { resolveReady = resolve; });
export function isReady() { return ready; }
export function whenReady() { return readyPromise; }
export function getAuth() { return auth; }
export function getDb() { return db; }
export function authMod() { return a; }
export function fsMod() { return f; }

function prefersRedirectSignIn() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
}
function rejectAfter(ms, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}
async function loadFirebaseModules() {
  return Promise.all([
    import(`${FIREBASE_BASE}/firebase-app.js`),
    import(`${FIREBASE_BASE}/firebase-auth.js`),
    import(`${FIREBASE_BASE}/firebase-firestore.js`)
  ]);
}
function formatInitError(err = initError) {
  if (!err) return 'Cloud connection is not ready.';
  const msg = String(err.message || err);
  if (/timed out|timeout/i.test(msg)) return 'Cloud libraries took too long to load. Check Wi‑Fi / content blockers, then reload.';
  if (/Failed to fetch|NetworkError|Load failed|dynamically imported/i.test(msg) || err.name === 'TypeError') {
    return 'Could not load Google cloud libraries (www.gstatic.com). Check connection or blockers.';
  }
  if (/unauthorized-domain|auth\/unauthorized-domain/i.test(msg)) {
    return 'This site is not yet an authorized Firebase domain. Alex must add sparkon.cards in Firebase Auth → Authorized domains.';
  }
  return `Cloud setup failed: ${msg}`;
}
export function initErrorMessage(err = initError) { return formatInitError(err); }

async function initializeCore(onUser) {
  const [app, authModule, firestoreModule] = await loadFirebaseModules();
  a = authModule;
  f = firestoreModule;
  const instance = app.initializeApp(firebaseConfig);
  auth = a.getAuth(instance);
  db = f.getFirestore(instance);
  try { await a.getRedirectResult(auth); }
  catch (e) { redirectError = e; }
  a.onAuthStateChanged(auth, onUser);
  ready = true;
}

export async function initialize(onUser) {
  try {
    await Promise.race([
      initializeCore(onUser),
      rejectAfter(INIT_TIMEOUT_MS, `Cloud libraries timed out after ${Math.round(INIT_TIMEOUT_MS / 1000)}s`)
    ]);
  } catch (e) {
    if (!ready) {
      initError = e instanceof Error ? e : new Error(String(e));
      throw initError;
    }
  } finally {
    resolveReady();
  }
}

export async function signIn() {
  await whenReady();
  if (initError || !auth || !a) throw new Error(formatInitError(initError));
  await a.setPersistence(auth, a.browserSessionPersistence);
  const provider = new a.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (prefersRedirectSignIn()) {
    await a.signInWithRedirect(auth, provider);
    return;
  }
  try {
    await a.signInWithPopup(auth, provider);
  } catch (e) {
    if (e?.code === 'auth/popup-blocked') {
      await a.signInWithRedirect(auth, provider);
      return;
    }
    if (e?.code === 'auth/unauthorized-domain') {
      throw new Error(formatInitError(e));
    }
    throw e;
  }
}

export async function signInAnonymously() {
  await whenReady();
  if (initError || !auth || !a) throw new Error(formatInitError(initError));
  await a.setPersistence(auth, a.browserSessionPersistence);
  if (auth.currentUser) return auth.currentUser;
  const cred = await a.signInAnonymously(auth);
  return cred.user;
}

/** Ensure Firebase Auth user (Google or anonymous). Required for least-privilege rules. */
export async function ensureSignedIn() {
  await whenReady();
  if (initError || !auth || !a) throw new Error(formatInitError(initError));
  if (auth.currentUser) return auth.currentUser;
  return signInAnonymously();
}

export async function signOut() { if (auth) await a.signOut(auth); }
