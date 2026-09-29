/**
 * Cloud room: create/join by code, host approve, 2–6 players, 2 displays.
 * Phases: lobby → question → locked → reveal → scores → (next) → finished
 * Host-trusted scoring for pilot (answers loaded only on host path).
 * Identity: always Firebase Auth uid (Google or anonymous) — never guest-* strings.
 */
import { whenReady, getDb, fsMod, getAuth, ensureSignedIn } from './auth.js';
import { ROOMS, CODES, DISPLAY_CODES, USERS } from './paths.js';

const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;
const MAX_DISPLAYS = 2;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const DISPLAY_BIND_KEY = 'sparkonDisplayBind';

export function randomCode(len = 6) {
  const buf = crypto.getRandomValues(new Uint32Array(len));
  return Array.from(buf, n => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('');
}
export function randomDisplayCode() {
  return String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));
}

/** Auth uid only — callers must ensureSignedIn() first for create/join/play. */
export function currentPlayerId() {
  const u = getAuth()?.currentUser;
  if (!u) throw new Error('Sign in (Google or Continue as guest) before playing.');
  return u.uid;
}
export function isGuest() {
  const u = getAuth()?.currentUser;
  return !u || !!u.isAnonymous;
}

export function loadDisplayBind() {
  try {
    const raw = sessionStorage.getItem(DISPLAY_BIND_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw);
    if (b && b.displayId && b.roomId && b.status === 'paired') return b;
  } catch { /* ignore */ }
  return null;
}
export function saveDisplayBind(bind) {
  sessionStorage.setItem(DISPLAY_BIND_KEY, JSON.stringify(bind));
  if (bind.displayId) sessionStorage.setItem('sparkonDisplayId', bind.displayId);
  if (bind.roomId) sessionStorage.setItem('sparkonDisplayRoomId', bind.roomId);
}
export function clearDisplayBind() {
  sessionStorage.removeItem(DISPLAY_BIND_KEY);
  sessionStorage.removeItem('sparkonDisplayRoomId');
}

export async function ensureUserProfile(user) {
  await whenReady();
  const f = fsMod(), db = getDb();
  if (!user || user.isAnonymous) return;
  const ref = f.doc(db, USERS, user.uid);
  const snap = await f.getDoc(ref);
  if (!snap.exists()) {
    await f.setDoc(ref, {
      displayName: user.displayName || 'Player',
      themePref: 'basic',
      entitlements: { premiumTheme: false, heroTheme: false },
      createdAt: f.serverTimestamp(),
      updatedAt: f.serverTimestamp(),
      packVersion: '0.1.1-pilot'
    });
  }
}

export async function createRoom({ nickname, homeLabel = '' } = {}) {
  await whenReady();
  await ensureSignedIn();
  const f = fsMod(), db = getDb();
  const hostId = currentPlayerId();
  const nick = (nickname || 'Host').trim().slice(0, 24) || 'Host';
  let code, roomId, attempts = 0;
  while (attempts++ < 8) {
    code = randomCode(6);
    roomId = code;
    const codeRef = f.doc(db, CODES, code);
    try {
      await f.runTransaction(db, async (tx) => {
        const existing = await tx.get(codeRef);
        if (existing.exists()) throw new Error('code-taken');
        const roomRef = f.doc(db, ROOMS, roomId);
        tx.set(codeRef, { roomId, createdAt: f.serverTimestamp() });
        tx.set(roomRef, {
          code,
          hostUid: hostId,
          phase: 'lobby',
          roundIndex: 0,
          roundId: null,
          revision: 0,
          packVersion: '0.1.1-pilot',
          packId: 'sparkon-family-01',
          mainRoundIds: ['R01','R02','R03','R04','R05','R06','R07','R08'],
          scores: {},
          publicState: { answeredCount: 0, readyCount: 0, playerCount: 0, displayCount: 0 },
          reveal: null,
          createdAt: f.serverTimestamp(),
          updatedAt: f.serverTimestamp(),
          hostTrusted: true,
          trustNote: 'HOST-TRUSTED pilot: host client holds answers.host.json; not for ranked play.'
        });
        tx.set(f.doc(db, ROOMS, roomId, 'members', hostId), {
          nickname: nick,
          homeLabel: homeLabel || '',
          ready: false,
          approved: true,
          isHost: true,
          isGuest: isGuest(),
          connected: true,
          joinedAt: f.serverTimestamp()
        });
      });
      break;
    } catch (e) {
      if (String(e.message).includes('code-taken')) continue;
      throw e;
    }
  }
  sessionStorage.setItem('sparkonRoomId', roomId);
  sessionStorage.setItem('sparkonMemberId', hostId);
  return { roomId, code, hostId };
}

export async function requestJoin({ code, nickname, homeLabel = '' } = {}) {
  await whenReady();
  await ensureSignedIn();
  const f = fsMod(), db = getDb();
  const clean = String(code || '').trim().toUpperCase();
  const codeSnap = await f.getDoc(f.doc(db, CODES, clean));
  if (!codeSnap.exists()) throw new Error('Room code not found.');
  const roomId = codeSnap.data().roomId;
  const roomSnap = await f.getDoc(f.doc(db, ROOMS, roomId));
  if (!roomSnap.exists()) throw new Error('Room no longer exists.');
  const room = roomSnap.data();
  if (room.phase !== 'lobby') throw new Error('This room has already started.');
  const membersSnap = await f.getDocs(f.collection(db, ROOMS, roomId, 'members'));
  const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const approved = members.filter(m => m.approved);
  const uid = currentPlayerId();
  const existing = members.find(m => m.id === uid);
  if (existing) {
    await f.updateDoc(f.doc(db, ROOMS, roomId, 'members', uid), {
      connected: true,
      nickname: (nickname || existing.nickname || 'Player').trim().slice(0, 24)
    });
    sessionStorage.setItem('sparkonRoomId', roomId);
    sessionStorage.setItem('sparkonMemberId', uid);
    return { roomId, code: clean, memberId: uid, pending: !existing.approved };
  }
  if (approved.length >= MAX_PLAYERS) throw new Error('Room is full (6 players).');
  const nick = (nickname || 'Player').trim().slice(0, 24) || 'Player';
  if (members.length >= MAX_PLAYERS + 3) throw new Error('Too many pending joiners. Ask the host.');
  await f.setDoc(f.doc(db, ROOMS, roomId, 'members', uid), {
    nickname: nick,
    homeLabel: homeLabel || '',
    ready: false,
    approved: false,
    isHost: false,
    isGuest: isGuest(),
    connected: true,
    joinedAt: f.serverTimestamp()
  });
  sessionStorage.setItem('sparkonRoomId', roomId);
  sessionStorage.setItem('sparkonMemberId', uid);
  return { roomId, code: clean, memberId: uid, pending: true };
}

export async function setReady(roomId, memberId, ready) {
  await whenReady();
  await ensureSignedIn();
  const f = fsMod(), db = getDb();
  await f.updateDoc(f.doc(db, ROOMS, roomId, 'members', memberId), { ready: !!ready, connected: true });
}

export async function approveMember(roomId, memberId, approved = true) {
  await whenReady();
  await ensureSignedIn();
  const f = fsMod(), db = getDb();
  if (approved) {
    const membersSnap = await f.getDocs(f.collection(db, ROOMS, roomId, 'members'));
    const approvedCount = membersSnap.docs.filter(d => d.data().approved).length;
    if (approvedCount >= MAX_PLAYERS) throw new Error('Room is full (6 players).');
  }
  await f.updateDoc(f.doc(db, ROOMS, roomId, 'members', memberId), { approved: !!approved });
}

/**
 * Mint a waiting TV pairing code. displayId = auth.uid (anon OK) for rules.
 * Skipped by display-app when a paired bind already exists in sessionStorage.
 */
export async function registerDisplayPairing() {
  await whenReady();
  await ensureSignedIn();
  const f = fsMod(), db = getDb();
  const displayId = getAuth().currentUser.uid;
  sessionStorage.setItem('sparkonDisplayId', displayId);
  let code, attempts = 0;
  while (attempts++ < 10) {
    code = randomDisplayCode();
    const ref = f.doc(db, DISPLAY_CODES, code);
    try {
      await f.runTransaction(db, async (tx) => {
        const ex = await tx.get(ref);
        if (ex.exists() && ex.data().status === 'waiting') throw new Error('taken');
        tx.set(ref, {
          displayId,
          status: 'waiting',
          roomId: null,
          createdAt: f.serverTimestamp(),
          expiresAt: Date.now() + 15 * 60 * 1000
        });
      });
      break;
    } catch (e) {
      if (String(e.message).includes('taken')) continue;
      throw e;
    }
  }
  return { displayId, code };
}

export async function attachDisplayToRoom(roomId, displayCode) {
  await whenReady();
  await ensureSignedIn();
  const f = fsMod(), db = getDb();
  const code = String(displayCode || '').trim();
  const codeRef = f.doc(db, DISPLAY_CODES, code);
  const snap = await f.getDoc(codeRef);
  if (!snap.exists() || snap.data().status !== 'waiting') throw new Error('Display code not found or already paired.');
  if (snap.data().expiresAt && Date.now() > snap.data().expiresAt) throw new Error('Display code expired. Refresh the TV.');
  const displays = await f.getDocs(f.collection(db, ROOMS, roomId, 'displays'));
  const displayId = snap.data().displayId;
  // Re-bind same displayId (TV refresh mid-game) does not consume an extra slot
  const already = displays.docs.some(d => d.id === displayId);
  if (!already && displays.size >= MAX_DISPLAYS) throw new Error('Already have 2 displays paired.');
  await f.setDoc(f.doc(db, ROOMS, roomId, 'displays', displayId), {
    pairedAt: f.serverTimestamp(),
    readOnly: true,
    label: already
      ? (displays.docs.find(d => d.id === displayId)?.data()?.label || 'TV')
      : `TV ${displays.size + 1}`,
    lastSeen: f.serverTimestamp()
  }, { merge: true });
  await f.updateDoc(codeRef, { status: 'paired', roomId, pairedAt: f.serverTimestamp() });
  return { displayId };
}

/** Heartbeat for a paired display doc (TV resume / keep-alive). */
export async function touchDisplay(roomId, displayId) {
  await whenReady();
  await ensureSignedIn();
  const f = fsMod(), db = getDb();
  try {
    await f.updateDoc(f.doc(db, ROOMS, roomId, 'displays', displayId), {
      lastSeen: f.serverTimestamp()
    });
  } catch { /* ignore if not yet attached */ }
}

export function watchDisplayPairing(code, onUpdate) {
  const f = fsMod(), db = getDb();
  return f.onSnapshot(f.doc(db, DISPLAY_CODES, code), (snap) => {
    if (snap.exists()) onUpdate(snap.data());
  });
}

/**
 * Watch room + members + displays.
 * Answers: host gets full collection; others query own uid only (reveal-gated rules).
 */
export function watchRoom(roomId, handlers) {
  const f = fsMod(), db = getDb();
  const unsubs = [];
  let answersUnsub = null;
  let answersMode = null; // 'full' | 'own'

  const setupAnswers = (hostUid, phase) => {
    const uid = getAuth()?.currentUser?.uid;
    if (!uid) return;
    const needFull = hostUid === uid || ['reveal', 'scores', 'finished'].includes(phase);
    const mode = needFull ? 'full' : 'own';
    if (answersUnsub && answersMode === mode) return;
    if (answersUnsub) { answersUnsub(); answersUnsub = null; }
    answersMode = mode;
    if (mode === 'full') {
      answersUnsub = f.onSnapshot(f.collection(db, ROOMS, roomId, 'answers'), (snap) => {
        handlers.onAnswers?.(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => handlers.onError?.(err));
    } else {
      const q = f.query(
        f.collection(db, ROOMS, roomId, 'answers'),
        f.where('uid', '==', uid)
      );
      answersUnsub = f.onSnapshot(q, (snap) => {
        handlers.onAnswers?.(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => handlers.onError?.(err));
    }
  };

  unsubs.push(f.onSnapshot(f.doc(db, ROOMS, roomId), (snap) => {
    if (!snap.exists()) return;
    const data = { id: snap.id, ...snap.data() };
    handlers.onRoom?.(data);
    setupAnswers(data.hostUid, data.phase);
  }, (err) => handlers.onError?.(err)));
  unsubs.push(f.onSnapshot(f.collection(db, ROOMS, roomId, 'members'), (snap) => {
    handlers.onMembers?.(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => handlers.onError?.(err)));
  unsubs.push(f.onSnapshot(f.collection(db, ROOMS, roomId, 'displays'), (snap) => {
    handlers.onDisplays?.(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => handlers.onError?.(err)));

  return () => {
    unsubs.forEach(u => u && u());
    if (answersUnsub) answersUnsub();
  };
}

export async function hostAdvance(roomId, expectedRevision, patch) {
  await whenReady();
  await ensureSignedIn();
  const f = fsMod(), db = getDb();
  const ref = f.doc(db, ROOMS, roomId);
  await f.runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Room missing');
    const data = snap.data();
    if (data.revision !== expectedRevision) throw new Error('Stale revision — refresh and try again.');
    const hostId = currentPlayerId();
    if (data.hostUid !== hostId) throw new Error('Only the host can advance the game.');
    const next = {
      ...patch,
      revision: data.revision + 1,
      updatedAt: f.serverTimestamp()
    };
    // Reset answeredCount when entering a new question phase
    if (patch.phase === 'question') {
      const ps = { ...(data.publicState || {}), ...(patch.publicState || {}), answeredCount: 0 };
      next.publicState = ps;
    }
    tx.update(ref, next);
  });
}

export async function submitAnswer(roomId, roundId, { conceptId, optionId }) {
  await whenReady();
  await ensureSignedIn();
  const f = fsMod(), db = getDb();
  const uid = currentPlayerId();
  const answerId = `${roundId}_${uid}`;
  const ref = f.doc(db, ROOMS, roomId, 'answers', answerId);
  const roomRef = f.doc(db, ROOMS, roomId);
  await f.runTransaction(db, async (tx) => {
    const room = await tx.get(roomRef);
    if (!room.exists()) throw new Error('Room missing');
    const r = room.data();
    if (r.phase !== 'question') throw new Error('Answers are locked for this round.');
    if (r.roundId !== roundId) throw new Error('Wrong round.');
    const member = await tx.get(f.doc(db, ROOMS, roomId, 'members', uid));
    if (!member.exists() || !member.data().approved) throw new Error('Not an approved member.');
    const existing = await tx.get(ref);
    if (existing.exists() && existing.data().locked) throw new Error('Already submitted.');
    tx.set(ref, {
      uid,
      roundId,
      conceptId,
      optionId,
      locked: true,
      lockedAt: f.serverTimestamp()
    });
    const ps = { ...(r.publicState || {}) };
    ps.answeredCount = (ps.answeredCount || 0) + 1;
    tx.update(roomRef, {
      publicState: ps,
      updatedAt: f.serverTimestamp()
    });
  });
  return answerId;
}

export async function markConnected(roomId, memberId) {
  await whenReady();
  const f = fsMod(), db = getDb();
  try {
    await f.updateDoc(f.doc(db, ROOMS, roomId, 'members', memberId), {
      connected: true,
      lastSeen: f.serverTimestamp()
    });
  } catch { /* ignore */ }
}

export { MAX_PLAYERS, MIN_PLAYERS, MAX_DISPLAYS };
