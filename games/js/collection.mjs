/** SparkON family pilot — collection / packs (Astra v6 + kinetic-energy rename). Cosmetics never change gameplay. π never in random packs. */
export const PACK_SIZE = 5;
export const BASIC_PREMIUM_CHANCE = 0.10; // provisional demo odds
export const CONCEPTS = [
  { id:'pythagoras', name:'Right triangles', subject:'Math', formula:'a² + b² = c²', rule:'For right-angled triangles; c is the longest side.', art:0, symbol:'△' },
  { id:'kinetic-energy', name:'Kinetic energy', subject:'Physics', formula:'Eₖ = ½mv²', rule:'For the same mass, double speed means four times the kinetic energy.', art:1, symbol:'Eₖ' },
  { id:'gold', name:'Gold', subject:'Chemistry', formula:'Au · 79 protons', rule:'Atomic number identifies the element.', art:2, symbol:'Au' },
  { id:'dna', name:'DNA', subject:'Biology', formula:'A ↔ T · C ↔ G', rule:'Complementary bases pair across the two DNA strands.', art:3, symbol:'DNA' },
  { id:'percent', name:'Percent', subject:'Math', formula:'25% = 25 / 100', rule:'A percentage change uses the stated starting amount.', symbol:'%' },
  { id:'newton2', name:'Force', subject:'Physics', formula:'Fnet = ma', rule:'Use the combined force on an object of constant mass.', symbol:'F' },
  { id:'ohm', name:'Ohm’s law', subject:'Physics', formula:'V = IR', rule:'An ohmic resistor under constant physical conditions.', symbol:'Ω' },
  { id:'density', name:'Density', subject:'Physics', formula:'ρ = m / V', rule:'Mass divided by volume; compare average densities for floating.', symbol:'ρ' },
  { id:'oxygen', name:'Oxygen', subject:'Chemistry', formula:'O₂ · two atoms', rule:'Each oxygen atom has 8 protons.', symbol:'O₂' },
  { id:'photosynthesis', name:'Photosynthesis', subject:'Biology', formula:'Light → chemical energy', rule:'Plants build sugars from carbon dioxide and water.', symbol:'☀' },
  { id:'speed', name:'Average speed', subject:'Physics', formula:'vavg = distance / time', rule:'Total distance divided by elapsed time.', symbol:'v' },
  { id:'friction', name:'Friction', subject:'Physics', formula:'Grip at the surface', rule:'Contact friction opposes relative sliding or its tendency.', symbol:'↔' },
];
export const HERO_POOL = CONCEPTS.filter(c => ['newton2','kinetic-energy','pythagoras','dna','friction'].includes(c.id));
export const PREMIUM_POOL = CONCEPTS.filter(c => Number.isInteger(c.art));
export function hasHero(cards){return cards.some(c=>c.edition==='hero');}
export function hasPremium(collection){return collection.some(c => c.edition === 'premium');}
/** Skin: Original (basic) / Premium / Hero — ownership unlocks; never changes scoring. */
export function resolvedTheme(preference, collection) {
  if(preference==='hero' && hasHero(collection)) return 'hero';
  if(preference === 'premium' && hasPremium(collection)) return 'premium';
  return 'basic'; // Original
}
export function random01() {
  const max = 0x100000000;
  return crypto.getRandomValues(new Uint32Array(1))[0] / max;
}
export function drawPack(kind, rng = random01, id = () => crypto.randomUUID()) {
  if (!['basic','premium','hero','mixed'].includes(kind)) throw new Error('Unknown pack');
  const mixedRoll=kind==='mixed'?rng():1;
  const mixedEdition=mixedRoll<.05?'hero':mixedRoll<.20?'premium':null; // provisional: 5% Hero, 15% Premium, 80% Original
  const bonus = kind === 'basic' && rng() < BASIC_PREMIUM_CHANCE;
  const bonusSlot = (bonus || mixedEdition) ? Math.floor(rng() * PACK_SIZE) : -1;
  return Array.from({length:PACK_SIZE}, (_, i) => {
    const edition = kind==='hero'?'hero':kind==='premium'?'premium':i===bonusSlot?(mixedEdition||'premium'):'basic';
    const pool = edition==='hero'?HERO_POOL:edition === 'premium' ? PREMIUM_POOL : CONCEPTS;
    const concept = pool[Math.floor(rng() * pool.length)];
    if (concept.id === 'pi') throw new Error('π must never enter random packs');
    return { instanceId:id(), conceptId:concept.id, edition, themeId:'sparkon', sourcePack:kind };
  });
}
export function starterCollection(uid) {
  return CONCEPTS.map(c => ({
    instanceId:`${uid}-${c.id}-starter`,
    conceptId:c.id,
    edition:'basic',
    themeId:'sparkon',
    sourcePack:'starter'
  }));
}
