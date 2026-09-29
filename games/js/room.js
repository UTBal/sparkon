/**
 * Cloud room: create/join by code, host approve, 5 players, 2 displays.
 * Phases: lobby → question → locked → reveal → scores → (next) → finished
 * Host-trusted scoring for pilot (answers loaded only on host path).
 */
import { whenReady, getDb, fsMod, getAuth } from './auth.js';
import { ROOMS, CODES, DISPLAY_CODES, USERS } from './paths.js';

const MAX_PLAYERS = 5;
const MAX_DISPLAYS = 2;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(len = 6) {
  const buf = crypto.getRandomValues(new Uint32Array(len));
  return Array.from(buf, n => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('');
}
export function randomDisplayCode() {
  return String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));
}
function guestId() {
  let id = sessionStorage.getItem('sparkonGuestId');
  if (!id) {
    id = 'guest-' + crypto.randomUUID();
    sessionStorage.setItem('sparkonGuestId', id);
  }
  return id;
}
export function currentPlayerId() {
  const u = getAuth()?.currentUser;
  return u ? u.uid : guestId();
}
export function isGuest() {
  const u = getAuth()?.currentUser;
  return !u || !!u.isAnonymous;
}

export async function ensureUserProfile(user) {
  await whenReady();
  const f = fsMod(), db = getDb();
  if (!user) return;
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
          publicState: { answeredCount: 0, readyCount: 0, displayCount: 0, displayCount: 0 },
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
  if (approved.length >= MAX_PLAYERS) throw new Error('Room is full (5 players).');
  const nick = (nickname || 'Player').trim().slice(0, 24) || 'Player';
  // Host must approve joiners (link/code discovery is not membership). Cap checked on approve too.
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
  const f = fsMod(), db = getDb();
  await f.updateDoc(f.doc(db, ROOMS, roomId, 'members', memberId), { ready: !!ready, connected: true });
}

export async function approveMember(roomId, memberId, approved = true) {
  await whenReady();
  const f = fsMod(), db = getDb();
  if (approved) {
    const membersSnap = await f.getDocs(f.collection(db, ROOMS, roomId, 'members'));
    const approvedCount = membersSnap.docs.filter(d => d.data().approved).length;
    if (approvedCount >= MAX_PLAYERS) throw new Error('Room is full (5 players).');
  }
  await f.updateDoc(f.doc(db, ROOMS, roomId, 'members', memberId), { approved: !!approved });
}

export async function registerDisplayPairing() {
  await whenReady();
  const f = fsMod(), db = getDb();
  const displayId = sessionStorage.getItem('sparkonDisplayId') || crypto.randomUUID();
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
  const f = fsMod(), db = getDb();
  const code = String(displayCode || '').trim();
  const codeRef = f.doc(db, DISPLAY_CODES, code);
  const snap = await f.getDoc(codeRef);
  if (!snap.exists() || snap.data().status !== 'waiting') throw new Error('Display code not found or already paired.');
  if (snap.data().expiresAt && Date.now() > snap.data().expiresAt) throw new Error('Display code expired. Refresh the TV.');
  const displays = await f.getDocs(f.collection(db, ROOMS, roomId, 'displays'));
  if (displays.size >= MAX_DISPLAYS) throw new Error('Already have 2 displays paired.');
  const displayId = snap.data().displayId;
  await f.setDoc(f.doc(db, ROOMS, roomId, 'displays', displayId), {
    pairedAt: f.serverTimestamp(),
    readOnly: true,
    label: `TV ${displays.size + 1}`
  });
  await f.updateDoc(codeRef, { status: 'paired', roomId, pairedAt: f.serverTimestamp() });
  return { displayId };
}

export function watchDisplayPairing(code, onUpdate) {
  const f = fsMod(), db = getDb();
  return f.onSnapshot(f.doc(db, DISPLAY_CODES, code), (snap) => {
    if (snap.exists()) onUpdate(snap.data());
  });
}

export function watchRoom(roomId, handlers) {
  const f = fsMod(), db = getDb();
  const unsubs = [];
  unsubs.push(f.onSnapshot(f.doc(db, ROOMS, roomId), (snap) => {
    if (snap.exists()) handlers.onRoom?.({ id: snap.id, ...snap.data() });
  }, (err) => handlers.onError?.(err)));
  unsubs.push(f.onSnapshot(f.collection(db, ROOMS, roomId, 'members'), (snap) => {
    handlers.onMembers?.(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => handlers.onError?.(err)));
  unsubs.push(f.onSnapshot(f.collection(db, ROOMS, roomId, 'displays'), (snap) => {
    handlers.onDisplays?.(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => handlers.onError?.(err)));
  unsubs.push(f.onSnapshot(f.collection(db, ROOMS, roomId, 'answers'), (snap) => {
    handlers.onAnswers?.(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => handlers.onError?.(err)));
  return () => unsubs.forEach(u => u && u());
}

export async function hostAdvance(roomId, expectedRevision, patch) {
  await whenReady();
  const f = fsMod(), db = getDb();
  const ref = f.doc(db, ROOMS, roomId);
  await f.runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Room missing');
    const data = snap.data();
    if (data.revision !== expectedRevision) throw new Error('Stale revision — refresh and try again.');
    const hostId = currentPlayerId();
    if (data.hostUid !== hostId) throw new Error('Only the host can advance the game.');
    tx.update(ref, {
      ...patch,
      revision: data.revision + 1,
      updatedAt: f.serverTimestamp()
    });
  });
}

export async function submitAnswer(roomId, roundId, { conceptId, optionId }) {
  await whenReady();
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

export { MAX_PLAYERS, MAX_DISPLAYS };
