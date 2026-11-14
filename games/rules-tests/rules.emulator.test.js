/**
 * Emulator-oriented deny/allow tests (requires Java + firebase emulators).
 * Run from games/rules-tests:
 *   firebase emulators:exec --only firestore "node rules.emulator.test.js"
 */
const fs = require('fs');
const path = require('path');

async function main() {
  let testing;
  try {
    testing = require('@firebase/rules-unit-testing');
  } catch {
    console.error('Install deps: cd games/rules-tests && npm i');
    process.exit(2);
  }
  const { initializeTestEnvironment, assertFails, assertSucceeds } = testing;
  const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'rules', 'merged.rules'), 'utf8');
  const env = await initializeTestEnvironment({
    projectId: 'sparkon-rules-test',
    firestore: { rules, host: '127.0.0.1', port: 8080 }
  });

  const host = env.authenticatedContext('host1').firestore();
  const guest = env.authenticatedContext('guest1').firestore();
  const guest2 = env.authenticatedContext('guest2').firestore();
  const other = env.authenticatedContext('other1').firestore();
  const tv = env.authenticatedContext('tv1').firestore();
  const unauth = env.unauthenticatedContext().firestore();

  const roomDoc = {
    code: 'ROOM1', hostUid: 'host1', phase: 'lobby', revision: 0,
    publicState: { answeredCount: 0 }, scores: {}
  };
  const memberHost = { nickname: 'Host', approved: true, isHost: true, ready: false };
  const memberGuest = { nickname: 'G', approved: false, isHost: false, ready: false };

  // P1 create room as signed-in host (anonymous auth is also request.auth != null)
  await assertSucceeds(host.doc('sparkonRooms/ROOM1').set(roomDoc));
  await assertSucceeds(host.doc('sparkonRooms/ROOM1/members/host1').set(memberHost));
  await assertSucceeds(host.doc('sparkonCodes/ROOM1').set({ roomId: 'ROOM1', createdAt: new Date() }));

  // Unauthenticated must not list or get rooms, members, answers, codes, or TV codes
  await assertFails(unauth.collection('sparkonRooms').get());
  await assertFails(unauth.doc('sparkonRooms/ROOM1').get());
  await assertFails(unauth.collection('sparkonRooms/ROOM1/members').get());
  await assertFails(unauth.doc('sparkonRooms/ROOM1/members/host1').get());
  await assertFails(unauth.collection('sparkonRooms/ROOM1/answers').get());
  await assertFails(unauth.collection('sparkonCodes').get());
  await assertFails(unauth.doc('sparkonCodes/ROOM1').get());
  await assertFails(unauth.collection('sparkonDisplayCodes').get());

  // Even signed-in users cannot list the rooms or code directories
  await assertFails(guest.collection('sparkonRooms').get());
  await assertFails(guest.collection('sparkonCodes').get());
  await assertFails(guest.collection('sparkonDisplayCodes').get());

  // Signed-in get-by-id of a known code and room is allowed (join flow)
  await assertSucceeds(guest.doc('sparkonCodes/ROOM1').get());
  await assertSucceeds(guest.doc('sparkonRooms/ROOM1').get());

  // N3 wrong hostUid
  await assertFails(guest.doc('sparkonRooms/ROOMX').set({
    code: 'ROOMX', hostUid: 'host1', phase: 'lobby'
  }));

  // P2 join self
  await assertSucceeds(guest.doc('sparkonRooms/ROOM1/members/guest1').set(memberGuest));
  await assertSucceeds(guest2.doc('sparkonRooms/ROOM1/members/guest2').set({
    nickname: 'G2', approved: false, isHost: false, ready: false
  }));

  // N6 non-host approve
  await assertFails(guest.doc('sparkonRooms/ROOM1/members/guest1').update({ approved: true }));

  // P3 host approve
  await assertSucceeds(host.doc('sparkonRooms/ROOM1/members/guest1').update({ approved: true }));
  await assertSucceeds(host.doc('sparkonRooms/ROOM1/members/guest2').update({ approved: true }));

  // Members in the room can list members; uninvolved signed-in user cannot
  await assertSucceeds(guest.collection('sparkonRooms/ROOM1/members').get());
  await assertFails(other.collection('sparkonRooms/ROOM1/members').get());

  // N8 other cannot read guest answer in question; host can
  await assertSucceeds(host.doc('sparkonRooms/ROOM1').update({ phase: 'question', roundId: 'R01', revision: 1 }));
  await assertSucceeds(guest.doc('sparkonRooms/ROOM1/answers/R01_guest1').set({
    uid: 'guest1', roundId: 'R01', conceptId: 'c1', optionId: 'a', locked: true, lockedAt: new Date()
  }));
  await assertFails(other.doc('sparkonRooms/ROOM1/answers/R01_guest1').get());
  await assertFails(unauth.doc('sparkonRooms/ROOM1/answers/R01_guest1').get());
  await assertSucceeds(host.doc('sparkonRooms/ROOM1/answers/R01_guest1').get());
  await assertSucceeds(guest.doc('sparkonRooms/ROOM1/answers/R01_guest1').get());

  // Locks: each member writes their own marker; no shared room counter required
  await assertSucceeds(guest.doc('sparkonRooms/ROOM1/locks/R01_guest1').set({
    uid: 'guest1', roundId: 'R01', at: new Date()
  }));
  await assertFails(guest.doc('sparkonRooms/ROOM1/locks/R01_guest2').set({
    uid: 'guest2', roundId: 'R01', at: new Date()
  }));
  await assertFails(other.doc('sparkonRooms/ROOM1/locks/R01_other1').set({
    uid: 'other1', roundId: 'R01', at: new Date()
  }));
  await assertFails(unauth.doc('sparkonRooms/ROOM1/locks/R01_x').set({
    uid: 'x', roundId: 'R01', at: new Date()
  }));

  // Concurrent second member answer + lock (no contention on the room doc)
  await Promise.all([
    assertSucceeds(guest2.doc('sparkonRooms/ROOM1/answers/R01_guest2').set({
      uid: 'guest2', roundId: 'R01', conceptId: 'c1', optionId: 'b', locked: true, lockedAt: new Date()
    })),
    assertSucceeds(guest2.doc('sparkonRooms/ROOM1/locks/R01_guest2').set({
      uid: 'guest2', roundId: 'R01', at: new Date()
    }))
  ]);
  await assertSucceeds(host.collection('sparkonRooms/ROOM1/locks').get());
  await assertSucceeds(guest.collection('sparkonRooms/ROOM1/locks').get());
  await assertFails(other.collection('sparkonRooms/ROOM1/locks').get());
  await assertFails(unauth.collection('sparkonRooms/ROOM1/locks').get());

  // TV pairing: signed-in (anonymous) display can create + get a code; unauth cannot
  await assertSucceeds(tv.doc('sparkonDisplayCodes/TVCODE').set({
    displayId: 'tv1', status: 'waiting', roomId: null, createdAt: new Date(), expiresAt: new Date()
  }));
  await assertSucceeds(tv.doc('sparkonDisplayCodes/TVCODE').get());
  await assertSucceeds(host.doc('sparkonDisplayCodes/TVCODE').get());
  await assertFails(unauth.doc('sparkonDisplayCodes/TVCODE').get());
  await assertFails(unauth.collection('sparkonDisplayCodes').get());

  // After reveal, host and members can read answers; still no unauth read
  await assertSucceeds(host.doc('sparkonRooms/ROOM1').update({ phase: 'reveal', revision: 2 }));
  await assertSucceeds(guest.doc('sparkonRooms/ROOM1/answers/R01_guest2').get());
  await assertFails(unauth.doc('sparkonRooms/ROOM1/answers/R01_guest2').get());

  // Whiteboard keep
  await assertSucceeds(host.doc('users/host1/notes/n1').set({ text: 'hi' }));
  await assertFails(guest.doc('users/host1/notes/n1').get());
  await assertFails(unauth.doc('users/host1/notes/n1').get());

  // Alternate collection root stays self-only
  await assertSucceeds(host.doc('users/host1/sparkon/profile').set({ ok: true }));
  await assertFails(guest.doc('users/host1/sparkon/profile').get());

  await env.cleanup();
  console.log('OK: emulator rules cases passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
