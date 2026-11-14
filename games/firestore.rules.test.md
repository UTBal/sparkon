# SparkON Firestore rules — deny/allow cases

**Source of truth:** `rules/merged.rules` (copied to `games/firestore.rules.merged`). Whiteboard `users/{userId}/notes` and `users/{uid}/sparkon` kept as-is.  
**Snapshot of what is live today:** `rules/deployed.rules` (board-18d33, 2026-11-14).  
**Snippet:** `games/firestore.rules.snippet` (paste section only, alongside Whiteboard notes).  
**Deploy:** publish `rules/merged.rules` in the Firebase Console on `board-18d33`. This box does not publish or deploy.

## Emulator status (2026-11-14)

- `firebase` CLI is present (`13.35.1`).
- Static checks: `node games/rules-tests/validate-rules.js`.
- Emulator suite: from `games/rules-tests`, `npm i && npm test` (needs a JRE on `PATH`, then `firebase emulators:exec`). All added deny/allow cases passed on 14 Nov 2026.

## Negative cases (must DENY)

| # | Actor | Op | Path | Why |
|---|-------|----|------|-----|
| N1 | unauthenticated | get or list | `sparkonRooms` / `{id}` | signed-in get-by-id only; no list |
| N1b | unauthenticated | get or list | `sparkonCodes` / `sparkonDisplayCodes` | signed-in get-by-id only; no list |
| N1c | signed-in, not a member | list | `sparkonRooms` or code directories | `allow list: if false` |
| N2 | unauthenticated | create | `sparkonCodes/{code}` | create requires auth |
| N3 | auth A | create | `sparkonRooms/{id}` with `hostUid=B` | hostUid must be auth.uid |
| N4 | auth A (not host) | update | `sparkonRooms/{id}` phase/scores | host-only room advances |
| N5 | auth A | create | `members/{B}` | self-only member create |
| N6 | auth A (member, not host) | update | `members/{B}.approved` | host-only approve |
| N7 | auth A | create | `answers/{id}` with `uid=B` or `locked=false` | self + locked |
| N8 | auth A (member, not host) | read | `answers/{other}` while phase=question | reveal-gated / host / own |
| N9 | auth A | update/delete | any `answers/{id}` | lock once |
| N10 | auth A | update/delete | `sparkonCodes/{code}` | immutable |
| N11 | auth A | create | `sparkonUsers/{B}/collection/{id}` | self-only |
| N12 | auth A | update/delete | `sparkonUsers/{A}/collection/{id}` | no update/delete |
| N13 | any | read/write | `users/{uid}/notes/{noteId}` as other uid | Whiteboard keep |
| N14 | auth A | update | `sparkonDisplayCodes/{code}` waiting→paired changing `displayId` | displayId immutable |
| N15 | unauthenticated | create/read | `sparkonRooms/{id}/locks/{id}` | signed-in members only |
| N16 | member A | create | `locks/{round}_{B}` or lock with `uid=B` | self id only |

## Positive cases (must ALLOW)

| # | Actor | Op | Path |
|---|-------|----|------|
| P1 | anon/Google | create | room with `hostUid==auth.uid` + own member doc |
| P2 | anon/Google | create | `sparkonCodes` + join `members/{self}` pending |
| P3 | host | update | room phase / scores / reveal |
| P4 | host | update | `members/{other}.approved` |
| P5 | self | update | own `ready` / `nickname` / `connected` |
| P6 | self | create | locked own answer `{roundId}_{uid}` |
| P6b | member | create | `locks/{roundId}_{uid}` (count marker, no answer content) |
| P7 | host / reveal phase | read | all answers |
| P8 | anon TV | create | `sparkonDisplayCodes` status=waiting, `displayId==auth.uid` |
| P9 | host | update | display code waiting→paired + create `displays/{displayId}` |
| P10 | paired TV | update | own `displays/{uid}.lastSeen` |
| P11 | member / host / paired TV | read | `locks` in their room |

## Client alignment (JS)

- `ensureSignedIn()` before create/join/display (anon OK).
- `hostUid` / member ids / `displayId` = `auth.uid` (never `guest-*`).
- TV: sessionStorage bind `{displayId,roomId,status:'paired'}`; resume skips new code.
- Host: Pair TV in lobby **and** during play (`phase != finished`).
- Answers watch: host/reveal → collection; else `where('uid','==',self)`.
- Answer counts come from `sparkonRooms/{id}/locks` snapshots, not a shared `publicState.answeredCount` write.
- Guests use `browserLocalPersistence` so a new tab keeps the same anonymous seat.
