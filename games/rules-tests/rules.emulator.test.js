/**
 * Emulator-oriented deny/allow tests (requires Java + firebase emulators).
 * Run: firebase emulators:exec --only firestore "node rules.emulator.test.js"
 * Blocked on SparkON builder box (no JRE) as of 2026-09-29.
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
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules.merged'), 'utf8');
  const env = await initializeTestEnvironment({
    projectId: 'sparkon-rules-test',
    firestore: { rules, host: '127.0.0.1', port: 8080 }
  });

  const host = await env.authenticatedContext('host1').firestore();
  const guest = await env.authenticatedContext('guest1').firestore();
  const other = await env.authenticatedContext('other1').firestore();
  const unauth = env.unauthenticatedContext().firestore();

  // P1 create room as host
  await assertSucceeds(host.doc('sparkonRooms/ROOM1').set({
    code: 'ROOM1', hostUid: 'host1', phase: 'lobby', revision: 0,
    publicState: { answeredCount: 0 }, scores: {}
  }));
  await assertSucceeds(host.doc('sparkonRooms/ROOM1/members/host1').set({
    nickname: 'Host', approved: true, isHost: true, ready: false
  }));

  // N1 unauth room read
  await assertFails(unauth.doc('sparkonRooms/ROOM1').get());

  // N3 wrong hostUid
  await assertFails(guest.doc('sparkonRooms/ROOMX').set({
    code: 'ROOMX', hostUid: 'host1', phase: 'lobby'
  }));

  // P2 join self
  await assertSucceeds(guest.doc('sparkonRooms/ROOM1/members/guest1').set({
    nickname: 'G', approved: false, isHost: false, ready: false
  }));

  // N6 non-host approve
  await assertFails(guest.doc('sparkonRooms/ROOM1/members/guest1').update({ approved: true }));

  // P3 host approve
  await assertSucceeds(host.doc('sparkonRooms/ROOM1/members/guest1').update({ approved: true }));

  // N8 other cannot read guest answer in question
  await assertSucceeds(host.doc('sparkonRooms/ROOM1').update({ phase: 'question', roundId: 'R01', revision: 1 }));
  await assertSucceeds(guest.doc('sparkonRooms/ROOM1/answers/R01_guest1').set({
    uid: 'guest1', roundId: 'R01', conceptId: 'c1', optionId: 'a', locked: true, lockedAt: new Date()
  }));
  await assertFails(other.doc('sparkonRooms/ROOM1/answers/R01_guest1').get());
  await assertSucceeds(host.doc('sparkonRooms/ROOM1/answers/R01_guest1').get());

  // Whiteboard keep
  await assertSucceeds(host.doc('users/host1/notes/n1').set({ text: 'hi' }));
  await assertFails(guest.doc('users/host1/notes/n1').get());

  await env.cleanup();
  console.log('OK: emulator rules cases passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
