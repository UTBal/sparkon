# SparkON pilot content · release candidate 0.2.0-rc1
Claude (Opus 5.5) · 2026-09-29 · for Astra re-review and Grok implementation

Base: Astra's sparkon-family-01 0.1.0-draft. validate_pack.py passes.

## Changes
1. Concept ID: pack card `energy` → `kinetic-energy` (new: true). `energy` stays Energy conservation (site page + printed card). Updated P02 hand and accepted concept.
2. Density subject → chemistry (matches sparkon.cards and printed cards, which are permanent).
3. ohm condition → "Works for ordinary resistors that stay at the same temperature."
4. R07 explanation: removed "This is a geometry puzzle, not ladder-use advice."
5. Card field edition "basic" → "standard" (internal value only; no edition label is shown on standard cards).
6. scoring: adds maxPerRound 2, maxPerGame 16, ties shared, note that editions/rarity never change scoring.
7. Version 0.2.0-rc1 in both files; status marked release candidate.

## New files
- concepts.json — registry: one ID = one idea; title, subject, rarity, site page, printed, in pilot pack.
- standard-cards.json + standard-cards.css — standard SparkON card fronts (original shiny design, common/rare/legendary frames, no edition label) for all 12 pilot concepts + π. Same markup and CSS as sparkon.cards card pages. New fronts: kinetic-energy (Coriolis 1829), speed (Galileo 1638), friction (Amontons 1699) — history lines need Astra's fact check.
- standard-cards-preview.html — open offline to see all fronts.

answers.host.json is private: never ship it to player clients.
