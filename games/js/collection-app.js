import { initialize, whenReady, signIn, signOut, getAuth, initErrorMessage } from './auth.js';
import {
  loadOrCreateCollection, watchCollection, loadProfile, setThemePref, openPackPilot,
  hasPremium, hasHero, resolvedTheme, guestStarter
} from './deck.js';
import { loadCardArt, renderCardInstance } from './cards.js';
import { ensureUserProfile } from './room.js';

const $ = id => document.getElementById(id);
let cards = [];
let themePref = 'basic';
let unsub = null;

function applySkin() {
  const theme = resolvedTheme(themePref, cards); // basic|premium|hero
  document.documentElement.dataset.theme = theme === 'basic' ? 'original' : theme;
  const logo = theme === 'basic' ? '/games/assets/logo-original.svg' : '/games/assets/logo.svg';
  $('logo').src = logo;
  $('skinOriginal').setAttribute('aria-pressed', String(theme === 'basic'));
  $('skinPremium').setAttribute('aria-pressed', String(theme === 'premium'));
  $('skinHero').setAttribute('aria-pressed', String(theme === 'hero'));
  $('skinPremium').disabled = !hasPremium(cards);
  $('skinHero').disabled = !hasHero(cards);
  $('skinHelp').textContent = theme === 'basic'
    ? 'Original skin: Claude shiny cards + classic logo. Gameplay unchanged.'
    : `${theme === 'hero' ? 'Hero' : 'Premium'} skin unlocked. Logo updated. Scoring unchanged.`;
}

function render() {
  applySkin();
  const prem = cards.filter(c => c.edition === 'premium').length;
  const hero = cards.filter(c => c.edition === 'hero').length;
  $('collectionCount').textContent = `${cards.length} cards · ${prem} Premium · ${hero} Hero · π not in packs`;
  const box = $('cards');
  box.replaceChildren();
  cards.slice().reverse().forEach(inst => box.append(renderCardInstance(inst)));
}

async function bindUser(user) {
  if (unsub) { unsub(); unsub = null; }
  if (!user) {
    cards = guestStarter();
    themePref = 'basic';
    $('authStatus').textContent = 'Guest deck (temporary). Sign in to save across devices.';
    render();
    return;
  }
  $('authStatus').textContent = 'Loading your collection…';
  await ensureUserProfile(user);
  await loadOrCreateCollection(user.uid);
  const profile = await loadProfile(user.uid);
  themePref = profile.themePref || 'basic';
  unsub = await watchCollection(user.uid, (list) => {
    cards = list;
    $('authStatus').textContent = 'Saved to your Google account (Firestore · not Drive).';
    render();
  }, (err) => {
    $('authStatus').textContent = 'Collection sync error: ' + err.message;
  });
}

$('btnSignIn').onclick = async () => {
  try { await signIn(); } catch (e) { $('authStatus').textContent = e.message || initErrorMessage(e); }
};
$('btnSignOut').onclick = () => signOut();

$('skinOriginal').onclick = async () => {
  themePref = 'basic';
  const u = getAuth()?.currentUser;
  if (u) await setThemePref(u.uid, 'basic');
  render();
};
$('skinPremium').onclick = async () => {
  if (!hasPremium(cards)) return;
  themePref = 'premium';
  const u = getAuth()?.currentUser;
  if (u) await setThemePref(u.uid, 'premium');
  render();
};
$('skinHero').onclick = async () => {
  if (!hasHero(cards)) return;
  themePref = 'hero';
  const u = getAuth()?.currentUser;
  if (u) await setThemePref(u.uid, 'hero');
  render();
};

document.querySelectorAll('.open-pack').forEach(btn => {
  btn.onclick = async () => {
    const u = getAuth()?.currentUser;
    if (!u) {
      $('authStatus').textContent = 'Sign in with Google to open packs into a saved collection.';
      return;
    }
    try {
      const granted = await openPackPilot(u.uid, btn.dataset.pack);
      $('revealTitle').textContent = 'Pack opened';
      $('revealMsg').textContent = 'Provisional client RNG · cosmetics only · no π. Same science either way.';
      const box = $('revealed');
      box.replaceChildren();
      granted.forEach(g => box.append(renderCardInstance(g)));
      $('reveal').showModal();
    } catch (e) {
      alert(e.message);
    }
  };
});

async function boot() {
  await loadCardArt();
  try {
    await initialize(user => {
      $('btnSignIn').classList.toggle('hide', !!user);
      $('btnSignOut').classList.toggle('hide', !user);
      bindUser(user);
    });
    await whenReady();
  } catch (e) {
    $('authStatus').textContent = initErrorMessage(e);
    cards = guestStarter();
    render();
  }
}
boot();
