import { initialize, whenReady, signIn, signOut, getAuth, initErrorMessage } from './auth.js';
import {
  loadOrCreateCollection, watchCollection, loadProfile, setThemePref, openPackPilot,
  previewTheme, themeAsEdition, guestStarter
} from './deck.js';
import { loadCardArt, renderCardInstance } from './cards.js';
import { ensureUserProfile } from './room.js';

const $ = id => document.getElementById(id);
let cards = [];
let themePref = sessionStorage.getItem('sparkonScreenSkin') || 'premium';
let unsub = null;

function updateAccountChip(user) {
  const chip = $('accountChip');
  if (!chip) return;
  if (user && !user.isAnonymous) {
    chip.textContent = user.displayName || user.email || 'Signed in';
    chip.title = user.email || user.displayName || '';
  } else {
    chip.textContent = 'Guest';
    chip.title = user?.isAnonymous ? 'Anonymous guest' : '';
  }
}

function applySkin() {
  const theme = previewTheme(themePref); // basic|premium|hero — preview unlocked tonight
  document.documentElement.dataset.theme = theme === 'basic' ? 'original' : theme;
  const logo = theme === 'basic' ? '/games/assets/logo-original.svg' : '/games/assets/logo.svg';
  $('logo').src = logo;
  $('skinOriginal').setAttribute('aria-pressed', String(theme === 'basic'));
  $('skinPremium').setAttribute('aria-pressed', String(theme === 'premium'));
  $('skinHero').setAttribute('aria-pressed', String(theme === 'hero'));
  $('skinPremium').disabled = false;
  $('skinHero').disabled = false;
  $('skinHelp').textContent = theme === 'basic'
    ? 'Original screen · your cards keep their own editions.'
    : `${theme === 'hero' ? 'Hero' : 'Premium'} screen · your cards keep their own editions.`;
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
  updateAccountChip(user);
  if (!user) {
    cards = guestStarter();
    themePref = sessionStorage.getItem('sparkonScreenSkin') || 'premium';
    $('authStatus').textContent = 'Guest deck (temporary). Sign in to save across devices.';
    render();
    return;
  }
  if (user.isAnonymous) {
    cards = guestStarter();
    themePref = sessionStorage.getItem('sparkonScreenSkin') || 'premium';
    $('authStatus').textContent = 'Guest · deck will not sync across devices.';
    render();
    return;
  }
  $('authStatus').textContent = 'Loading your collection…';
  await ensureUserProfile(user);
  await loadOrCreateCollection(user.uid);
  const profile = await loadProfile(user.uid);
  themePref = sessionStorage.getItem('sparkonScreenSkin') || 'premium';
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

async function setSkin(pref) {
  themePref = pref;
  sessionStorage.setItem('sparkonScreenSkin', pref);
  const u = getAuth()?.currentUser;
  if (u && !u.isAnonymous) await setThemePref(u.uid, pref);
  render();
}
$('skinOriginal').onclick = () => setSkin('basic');
$('skinPremium').onclick = () => setSkin('premium');
$('skinHero').onclick = () => setSkin('hero');

document.querySelectorAll('.open-pack').forEach(btn => {
  btn.onclick = async () => {
    const u = getAuth()?.currentUser;
    if (!u || u.isAnonymous) {
      $('authStatus').textContent = 'Sign in with Google to open packs into a saved collection.';
      return;
    }
    try {
      const kind = btn.dataset.pack || 'mixed';
      const granted = await openPackPilot(u.uid, kind);
      $('revealTitle').textContent = 'Mixed pack opened';
      $('revealMsg').textContent = 'Provisional client RNG · cosmetics only · no π. Same science either way. Stakes later.';
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
      const signed = !!(user && !user.isAnonymous);
      $('btnSignIn').classList.toggle('hide', signed);
      $('btnSignOut').classList.toggle('hide', !signed);
      bindUser(user);
    });
    await whenReady();
  } catch (e) {
    $('authStatus').textContent = initErrorMessage(e);
    updateAccountChip(null);
    cards = guestStarter();
    render();
  }
}
boot();
