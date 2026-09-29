# SparkON Firestore rules — deny/allow cases

**Source of truth:** `firestore.rules.merged` (Whiteboard notes keep + SparkON least-privilege).  
**Snippet:** `firestore.rules.snippet` (paste section only).  
**Deploy:** Alex/Builder must publish in Firebase Console on `board-18d33`. This box cannot deploy.

## Emulator status (2026-09-29)

- `firebase` CLI is present (`13.35.1`).
- **Java/JRE is not available** on the box (`java: command not found`; apt mirror 500), so `firebase emulators:exec` / `@firebase/rules-unit-testing` cannot run here.
- Static checks: `node games/rules-tests/validate-rules.js` (structure + required deny markers).
- When Java is available: `cd games/rules-tests && npm i && npm test` (uses emulator + rules-unit-testing).

## Negative cases (must DENY)

| # | Actor | Op | Path | Why |
|---|-------|----|------|-----|
| N1 | unauthenticated | read | `sparkonRooms/{id}` | `signedIn()` required |
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

## Positive cases (must ALLOW)

| # | Actor | Op | Path |
|---|-------|----|------|
| P1 | anon/Google | create | room with `hostUid==auth.uid` + own member doc |
| P2 | anon/Google | create | `sparkonCodes` + join `members/{self}` pending |
| P3 | host | update | room phase / scores / reveal |
| P4 | host | update | `members/{other}.approved` |
| P5 | self | update | own `ready` / `nickname` / `connected` |
| P6 | self | create | locked own answer `{roundId}_{uid}` |
| P7 | host / reveal phase | read | all answers |
| P8 | anon TV | create | `sparkonDisplayCodes` status=waiting, `displayId==auth.uid` |
| P9 | host | update | display code waiting→paired + create `displays/{displayId}` |
| P10 | paired TV | update | own `displays/{uid}.lastSeen` |
| P11 | member | update | room `publicState` + `updatedAt` only (answeredCount bump) |

## Client alignment (JS)

- `ensureSignedIn()` before create/join/display (anon OK).
- `hostUid` / member ids / `displayId` = `auth.uid` (never `guest-*`).
- TV: sessionStorage bind `{displayId,roomId,status:'paired'}`; resume skips new code.
- Host: Pair TV in lobby **and** during play (`phase != finished`).
- Answers watch: host/reveal → collection; else `where('uid','==',self)`. Counts via `publicState.answeredCount`.
