/**
 * End-to-end client flow against the Auth + Firestore emulators, using the REAL
 * games/js/room.js (copied next to an auth shim at runtime) and rules/merged.rules.
 * Two separate anonymous users: host creates, guest joins by code, host approves,
 * guest readies + answers, duplicate answer is rejected.
 * Run: npm run test:flow   (from games/rules-tests)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, getDocs, collection } from 'firebase/firestore';

const here = path.dirname(fileURLToPath(import.meta.url));
const js = path.join(here, '..', '..', 'js');
const tmp = fs.mkdtempSync(path.join(here, '.tmp-'));
fs.copyFileSync(path.join(js, 'room.js'), path.join(tmp, 'room.js'));
fs.copyFileSync(path.join(js, 'paths.js'), path.join(tmp, 'paths.js'));
fs.copyFileSync(path.join(here, 'auth-shim.js'), path.join(tmp, 'auth.js'));
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
globalThis.sessionStorage ??= { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
const { ctx } = await import(pathToFileURL(path.join(tmp, 'auth.js')));
const R = await import(pathToFileURL(path.join(tmp, 'room.js')));

const cfg = { apiKey: 'demo', projectId: 'demo-sparkon', authDomain: 'x', appId: 'x' };
async function user(name) {
  const app = initializeApp(cfg, name);
  const auth = getAuth(app); const db = initializeFirestore(app, {});
  connectAuthEmulator(auth, 'http://127.0.0.1:9299', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8280);
  await signInAnonymously(auth);
  return { auth, db, name };
}
let failed = 0;
async function expectOk(u, label, fn) {
  ctx.cur = u;
  try { const r = await fn(); console.log('PASS', label); return r; }
  catch (e) { failed++; console.log('FAIL', label, e.code || '', e.message); }
}
async function expectFail(u, label, fn) {
  ctx.cur = u;
  try { await fn(); failed++; console.log('FAIL (should be refused)', label); }
  catch { console.log('PASS (refused)', label); }
}
try {
  const host = await user('host'), guest = await user('guest'), late = await user('late');
  const { roomId, code } = await expectOk(host, 'host createRoom', () => R.createRoom({ nickname: 'Host' }));
  const gid = guest.auth.currentUser.uid;
  await expectOk(guest, 'guest requestJoin by code (not yet a member)', () => R.requestJoin({ code, nickname: 'Guest' }));
  await expectOk(guest, 'guest re-join same code (existing member path)', () => R.requestJoin({ code, nickname: 'Guest' }));
  await expectOk(host, 'host approveMember', () => R.approveMember(roomId, gid, true));
  await expectOk(guest, 'guest setReady', () => R.setReady(roomId, gid, true));
  await expectOk(host, 'host advance to question', () => R.hostAdvance(roomId, 0, { phase: 'question', roundId: 'R01', roundIndex: 0 }));
  await expectFail(late, 'join after start', () => R.requestJoin({ code, nickname: 'Late' }));
  await expectOk(guest, 'guest submitAnswer', () => R.submitAnswer(roomId, 'R01', { conceptId: 'c', optionId: 'o1' }));
  await expectFail(guest, 'guest duplicate answer', () => R.submitAnswer(roomId, 'R01', { conceptId: 'c', optionId: 'o2' }));
  await expectOk(host, 'host sees exactly 1 answer', async () => {
    ctx.cur = host; const s = await getDocs(collection(host.db, 'sparkonRooms', roomId, 'answers'));
    if (s.size !== 1) throw new Error('answers=' + s.size);
  });
  await expectFail(late, 'non-member cannot list members', () => getDocs(collection(late.db, 'sparkonRooms', roomId, 'members')));
  await expectFail(late, 'nobody can list rooms', () => getDocs(collection(late.db, 'sparkonRooms')));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
