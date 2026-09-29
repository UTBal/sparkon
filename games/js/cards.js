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
  await Promise.all([loadStandardCards(), loadOriginalArt()]);
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
export function renderEditionCard(instance) {
  const c = CONCEPTS.find(x => x.id === instance.conceptId);
  if (!c) return el('div', '', 'Unknown');
  const edClass = (instance.edition === 'basic' || instance.edition === 'standard') ? 'standard' : instance.edition;
  const card = el('article', `science-card ${edClass} subject-${c.subject.toLowerCase()}`);
  const body = el('div', 'card-hit');
  const top = el('div', 'card-top');
  top.append(el('span', 'mini-wordmark', 'SPARK⏻N'), el('span', 'subject-name', c.subject.toUpperCase()));
  const art = el('div', 'art');
  art.setAttribute('aria-hidden', 'true');
  if (instance.edition === 'premium' && Number.isInteger(c.art)) {
    const img = document.createElement('img');
    img.src = '/games/assets/premium-concept.png';
    img.alt = '';
    img.loading = 'lazy';
    img.style.setProperty('--crop', `${-((28 + 438 * c.art) / 400) * 100}%`);
    art.append(img);
  } else if (instance.edition === 'hero' && HERO_COORDS[c.id]) {
    const [x, y] = HERO_COORDS[c.id];
    art.classList.add('hero-art');
    art.style.backgroundImage = 'url(/games/assets/hero-edition.png)';
    art.style.backgroundSize = `${1373 / 355 * 100}% ${1145 / 300 * 100}%`;
    art.style.backgroundPosition = `${x / (1373 - 355) * 100}% ${y / (1145 - 300) * 100}%`;
  } else {
    art.append(el('span', 'symbol', c.symbol));
  }
  const copy = el('div', 'card-copy');
  copy.append(el('h3', '', c.name), el('p', 'formula', c.formula));
  const foot = el('div', 'card-foot');
  foot.append(
    el('span', '', instance.edition === 'hero' ? '✧ Hero' : instance.edition === 'premium' ? '✦ Premium' : ''), // standard: site shiny, no edition label
    el('span', '', c.id)
  );
  body.append(top, art, copy, foot);
  card.append(body);
  return card;
}

export function renderCardInstance(instance, opts) {
  if (instance.edition === 'premium' || instance.edition === 'hero') {
    return renderEditionCard(instance);
  }
  return renderOriginalCard(instance.conceptId, opts);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
