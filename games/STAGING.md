# SparkON `/games/` family pilot — staging report

**Test URL (Astra):** https://sparkon.cards/games/  
**Phone:** https://sparkon.cards/games/play.html  
**TV display:** https://sparkon.cards/games/display.html  
**Collection / skins:** https://sparkon.cards/games/collection.html  
**Host tools (do not share):** https://sparkon.cards/games/host/

## What works (intended after Auth domains + Firestore rules)

- On-demand rooms via 6-character codes; host + up to 5 players; 2 TV displays pair by 4-digit code
- Eight-round pack flow (lobby → question → lock → reveal → scores → next → finished)
- Google sign-in pattern reused from Whiteboard (`board-18d33`); UID-owned collection under `sparkonUsers/{uid}/collection`
- Guest path for play without Google (temporary)
- Original skin: site holographic card CSS + `logo-original.svg`
- Premium / Hero skins: Astra v6 art crops + new `logo.svg` only when unlocked
- Cosmetics do not affect scoring (concept + answer points only; no speed bonus)
- π excluded from cards and random packs (`energy` pack id → `kinetic-energy`; site `cards/energy.html` conservation unchanged)
- Quiet **Play** nav link; Eureka (`/eurekav1/`) untouched
- HOST-TRUSTED disclosure in UI + console when host loads answers

## HOST-TRUSTED (not production-ready)

- Answer key served from `/games/host/answers.host.json` and loaded only by the host client for grading
- Pack opens use **client CSPRNG** with provisional odds (mixed 5% Hero / 15% Premium / 80% Original; basic 10% one Premium). No Cloud Function deployed (Firebase CLI not authenticated for Functions)
- Room security rules must be deployed; until then client writes may fail — see blockers
- Do **not** claim ranked play, purchases, or valuable rewards

## Blockers — Alex console (required before Google login on sparkon.cards)

1. **Firebase Auth → Authorized domains:** add `sparkon.cards` (and `www.sparkon.cards` if used)
2. **GCP OAuth Web client → Authorized JavaScript origins:** add `https://sparkon.cards`  
   Keep redirect URI on `https://board-18d33.firebaseapp.com/__/auth/handler` — **do NOT** add a custom-domain auth handler
3. **Firestore rules:** merge `games/firestore.rules.snippet` so `sparkonUsers` / `sparkonRooms` / `sparkonCodes` / `sparkonDisplayCodes` work **without** changing `users/{uid}/notes` (Whiteboard)
4. Prefer deploying a **Cloud Function** for pack opens + scoring before any public/competitive use

## Pack content

- `energy` → `kinetic-energy` applied in public pack + host answers + collection concepts + Hero art map
- `density` subject remains **Physics** in pack
- π out of packs (and not in starter deck)

## Eureka

- `/eurekav1/` not modified by this pilot

## Security caveats (pilot)

Least-privilege client writes are best-effort; snippet rules are permissive for family staging. Host can inspect answers. Display clients are read-only by UX, not strong capability security, until rules + Functions land.

## Collection path fallback

Primary: `sparkonUsers/{uid}/collection`.
Fallback if permission-denied: `users/{uid}/sparkon/collection` (still never `notes`).
Rooms always use `sparkonRooms/*` and need rules.
