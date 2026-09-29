# SparkON `/games/` family pilot — staging report

**Test URL (Astra):** https://sparkon.cards/games/  
**Phone:** https://sparkon.cards/games/play.html  
**Practice (offline):** https://sparkon.cards/games/practice.html  
**TV display:** https://sparkon.cards/games/display.html  
**Collection / skins:** https://sparkon.cards/games/collection.html  
**Host tools (do not share):** https://sparkon.cards/games/host/

Pack: **0.2.0-rc1** (`games/data/pack.public.json`). Host answers: `games/host/answers.host.json` only. Concepts catalog: `games/data/concepts.json`.

## What works (intended after Auth domains + Firestore rules)

- On-demand rooms via 6-character codes; 2–6 players (start from 2); host must **approve** joiners; 2 TV displays pair by 4-digit code
- Eight-round main flow R01–R08 (lobby → question → lock → reveal → scores → next → finished); P01–P04 practice
- Scoring: 1 pt concept + 1 pt answer independent; max 2/round, 16/game; no speed points; ties shared; both correct → **Spark on!** badge
- Explain-it rotates among approved players; not scored
- End score table + Play again
- Free 12-card standard deck; mixed pack only (mostly standard, occasional premium/hero); π out of packs; stakes/transfers later
- Edition field **standard** (site shiny, no edition label); Premium/Hero = Astra cosmetics when unlocked
- `density` subject = **chemistry**; `kinetic-energy` id (site `cards/energy.html` conservation page unchanged)
- Google sign-in pattern reused from Whiteboard (`board-18d33`); UID-owned collection under `sparkonUsers/{uid}/collection`
- Guest path for play without Google (temporary)
- HOST-TRUSTED disclosure in UI + console when host loads answers
- Quiet **Play** nav link; Eureka (`/eurekav1/`) untouched

## Offline practice vs cloud

- **Offline / practice:** `/games/practice.html` embeds public pack + answer key for solo rehearsal on-device. Works without Firebase. Do not use for competitive multiplayer.
- **Cloud path:** `/games/play.html` → Google or guest → create/join room code → host approve → pair TVs via `/games/display.html` → host advances phases; host client loads `/games/host/answers.host.json` to grade (HOST-TRUSTED).

## HOST-TRUSTED (not production-ready)

- Answer key served from `/games/host/answers.host.json` and loaded only by the host client for grading
- Pack opens use **client CSPRNG** with provisional odds. No Cloud Function deployed
- Room security rules must be deployed; until then client writes may fail — see blockers
- Do **not** claim ranked play, purchases, or valuable rewards; do not claim public until Astra reviews

## Blockers — Alex / Builder console (required before Google login on sparkon.cards)

1. **Firebase Auth → Authorized domains:** add `sparkon.cards` (and `www.sparkon.cards` if used)
2. **GCP OAuth Web client → Authorized JavaScript origins:** add `https://sparkon.cards`  
   Keep redirect URI on `https://board-18d33.firebaseapp.com/__/auth/handler` — **do NOT** add a custom-domain auth handler
3. **Firestore rules:** merge `games/firestore.rules.snippet` so `sparkonUsers` / `sparkonRooms` / `sparkonCodes` / `sparkonDisplayCodes` work **without** changing `users/{uid}/notes` (Whiteboard). Allow edition `standard`.
4. Prefer deploying a **Cloud Function** for pack opens + scoring before any public/competitive use

Static + local practice ships regardless; cloud login may fail until Auth domains are finished.

## Standard card fronts (RC1 zip)

- Installed from `sparkon-pilot-content-rc1.zip`: `games/data/standard-cards.json` + `games/css/standard-cards.css`
- `games/js/cards.js` prefers Claude HTML fronts from `standard-cards.json` for Standard/Original; Premium/Hero still use Astra edition crops; falls back to `original-art.json` only if a concept is missing
- Preview (Astra, not required in public nav): https://sparkon.cards/games/standard-cards-preview.html
- Pack notes / validator: `games/content-rc1/CHANGES.md`, `games/content-rc1/validate_pack.py`
- π front exists in `standard-cards.json` for collection later; π stays out of packs

## Eureka

- `/eurekav1/` not modified by this pilot
