/** UID-owned collection — never users/{uid}/notes. */
import { whenReady, getDb, fsMod } from './auth.js';
import { USERS, USER_SPARKON } from './paths.js';
import { starterCollection, hasPremium, hasHero, resolvedTheme, previewTheme, themeAsEdition, drawPack } from './collection.mjs';

function profileRef(f, db, uid) {
  // Primary isolated root
  return f.doc(db, USERS, uid);
}
function collectionCol(f, db, uid) {
  return f.collection(db, USERS, uid, 'collection');
}
function altProfileRef(f, db, uid) {
  return f.doc(db, 'users', uid, USER_SPARKON, 'profile');
}
function altCollectionCol(f, db, uid) {
  return f.collection(db, 'users', uid, USER_SPARKON, 'collection');
}

async function tryWrite(primaryFn, altFn) {
  try {
    return await primaryFn();
  } catch (e) {
    const msg = String(e.message || e);
    if (/permission|insufficient|PERMISSION/i.test(msg) || e.code === 'permission-denied') {
      console.warn('[SparkON] primary path denied, trying users/{uid}/sparkon/', e);
      return await altFn();
    }
    throw e;
  }
}

export async function loadOrCreateCollection(uid) {
  await whenReady();
  const f = fsMod(), db = getDb();

  async function loadFrom(col, profile) {
    const snap = await f.getDocs(col);
    if (snap.empty) {
      const starter = starterCollection(uid);
      const batch = f.writeBatch(db);
      for (const card of starter) {
        batch.set(f.doc(col, card.instanceId), { ...card, createdAt: f.serverTimestamp() });
      }
      batch.set(profile, {
        themePref: 'basic',
        entitlements: { premiumTheme: false, heroTheme: false },
        packVersion: '0.2.0-rc1',
        updatedAt: f.serverTimestamp()
      }, { merge: true });
      await batch.commit();
      return starter;
    }
    return snap.docs.map(d => ({ instanceId: d.id, ...d.data() }));
  }

  return tryWrite(
    () => loadFrom(collectionCol(f, db, uid), profileRef(f, db, uid)),
    () => loadFrom(altCollectionCol(f, db, uid), altProfileRef(f, db, uid))
  );
}

export async function watchCollection(uid, onCards, onError) {
  await whenReady();
  const f = fsMod(), db = getDb();
  try {
    return f.onSnapshot(collectionCol(f, db, uid), (snap) => {
      onCards(snap.docs.map(d => ({ instanceId: d.id, ...d.data() })));
    }, async (err) => {
      if (/permission|PERMISSION/i.test(String(err.message)) || err.code === 'permission-denied') {
        return f.onSnapshot(altCollectionCol(f, db, uid), (snap) => {
          onCards(snap.docs.map(d => ({ instanceId: d.id, ...d.data() })));
        }, onError);
      }
      onError(err);
    });
  } catch (e) {
    onError(e);
  }
}

export async function loadProfile(uid) {
  await whenReady();
  const f = fsMod(), db = getDb();
  try {
    const snap = await f.getDoc(profileRef(f, db, uid));
    if (snap.exists()) return snap.data();
  } catch { /* fall through */ }
  try {
    const snap = await f.getDoc(altProfileRef(f, db, uid));
    return snap.exists() ? snap.data() : { themePref: 'basic', entitlements: {} };
  } catch {
    return { themePref: 'basic', entitlements: {} };
  }
}

export async function setThemePref(uid, pref) {
  await whenReady();
  const f = fsMod(), db = getDb();
  await tryWrite(
    () => f.setDoc(profileRef(f, db, uid), { themePref: pref, updatedAt: f.serverTimestamp() }, { merge: true }),
    () => f.setDoc(altProfileRef(f, db, uid), { themePref: pref, updatedAt: f.serverTimestamp() }, { merge: true })
  );
}

export async function openPackPilot(uid, kind) {
  await whenReady();
  const f = fsMod(), db = getDb();
  const granted = drawPack(kind);
  if (granted.some(c => c.conceptId === 'pi')) throw new Error('π excluded from packs');

  async function mint(col, profile, existing) {
    const batch = f.writeBatch(db);
    for (const card of granted) {
      batch.set(f.doc(col, card.instanceId), {
        ...card,
        createdAt: f.serverTimestamp(),
        pilotClientMint: true,
        trustNote: 'HOST-TRUSTED / client RNG — not production-secure'
      });
    }
    const all = [...existing, ...granted];
    batch.set(profile, {
      entitlements: { premiumTheme: hasPremium(all), heroTheme: hasHero(all) },
      updatedAt: f.serverTimestamp()
    }, { merge: true });
    await batch.commit();
    return granted;
  }

  const existing = await loadOrCreateCollection(uid);
  return tryWrite(
    () => mint(collectionCol(f, db, uid), profileRef(f, db, uid), existing),
    () => mint(altCollectionCol(f, db, uid), altProfileRef(f, db, uid), existing)
  );
}

export function guestStarter() {
  const gid = sessionStorage.getItem('sparkonGuestId') || 'guest-local';
  return starterCollection(gid);
}

export { hasPremium, hasHero, resolvedTheme, previewTheme, themeAsEdition, drawPack };
