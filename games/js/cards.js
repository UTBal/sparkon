import { loadAstraContent, renderAstraCard } from './astra-cards.js';
/** Card rendering: Standard/Original prefer Claude standard-cards.json HTML fronts;
 *  Premium/Hero = Astra v6 art crops. Falls back to original-art.json if a concept is missing. */
import { CONCEPTS } from './collection.mjs';

let originalArt = null;
let standardFronts = null;

export async function loadOriginalArt() {
  if (originalArt) return originalArt;
  const res = await fetch('/games/data/original-art.json');
  originalArt = await res.json();
  return originalArt;
}

/** Load Claude RC1 HTML fronts (conceptId → card markup). Safe to call multiple times. */
export async function loadStandardCards() {
  if (standardFronts) return standardFronts;
  const res = await fetch('/games/data/standard-cards.json');
  const data = await res.json();
  standardFronts = data.fronts || {};
  return standardFronts;
}

/** Ensure both art sources are ready (standard preferred, original-art fallback). */
export async function loadCardArt() {
  await Promise.all([loadStandardCards(), loadOriginalArt(), loadAstraContent()]);
  return { standardFronts, originalArt };
}

const HERO_COORDS = {
  newton2: [505, 98],
  'kinetic-energy': [912, 98],
  pythagoras: [100, 610],
  dna: [505, 610],
  friction: [912, 610]
};

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/** Site-style Standard/Original card. Prefers standard-cards.json HTML; falls back to original-art. */
export function renderOriginalCard(conceptId, { compact = false } = {}) {
  const wrap = el('div', 'tilt sparkon-orig' + (compact ? ' compact' : ''));
  const html = standardFronts?.[conceptId];
  if (html) {
    wrap.innerHTML = html;
    return wrap;
  }

  const art = originalArt?.[conceptId];
  const concept = CONCEPTS.find(c => c.id === conceptId);
  if (!art || !concept) {
    const d = el('div', 'card-missing');
    d.textContent = conceptId;
    return d;
  }
  const card = el('div', `card front ${art.rarity}`);
  card.setAttribute('style', art.style);
  const frame = el('div', 'frame');
  if (art.rarity === 'r-legendary' || art.rarity === 'r-mystery') {
    frame.append(el('div', 'holo'));
  }
  const top = el('div', 'top');
  top.innerHTML = `<div><div class="name">${escapeHtml(art.packTitle || art.name)}</div><div class="sv">${escapeHtml(art.sv || '')}</div></div><div class="gem"><svg viewBox="0 0 10 10"><path d="M5 1.6 8.4 5 5 8.4 1.6 5z" fill="#636366"/></svg></div>`;
  const artDiv = el('div', 'art');
  artDiv.innerHTML = `<div class="glow"></div>${art.artSvg}<div class="holo"></div>`;
  const type = el('div', 'type');
  type.innerHTML = `<span>${escapeHtml(art.packSubject || art.subject)}</span><span>${escapeHtml(art.rarityLabel)}</span>`;
  const foot = el('div', 'foot');
  foot.innerHTML = `<b>${escapeHtml(art.footBold || '')}</b>${escapeHtml(art.footRest || '')}`;
  const set = el('div', 'set');
  set.innerHTML = `<span>${escapeHtml(art.setL)}</span><span>${escapeHtml(art.setR)}</span>`;
  frame.append(top, artDiv, type, foot, set);
  card.append(frame, el('div', 'shine'));
  wrap.append(card);
  return wrap;
}

/** Premium / Hero edition card (Astra v6 crops). Gameplay identical. */
export function renderEditionCard(instance) { return renderAstraCard(instance); }

export function renderCardInstance(instance, opts) {
  if (instance.edition === 'premium' || instance.edition === 'hero') {
    return renderEditionCard(instance);
  }
  return renderOriginalCard(instance.conceptId, opts);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
