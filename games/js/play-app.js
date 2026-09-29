import { ownedCardFor } from './owned-cards.mjs';
import {
  initialize, whenReady, signIn, signInAnonymously, ensureSignedIn, signOut, getAuth, initErrorMessage, redirectError, clearRedirectError
} from './auth.js';
import {
  createRoom, requestJoin, setReady, watchRoom, hostAdvance, submitAnswer,
  attachDisplayToRoom, markConnected, currentPlayerId, ensureUserProfile, MAX_PLAYERS, MIN_PLAYERS,
  approveMember
} from './room.js';
import { loadOrCreateCollection, loadProfile, setThemePref, previewTheme, themeAsEdition } from './deck.js';
import { loadCardArt, renderCardInstance } from './cards.js';
import { loadAnswerKey, gradeAll } from './host-score.js';

const $ = id => document.getElementById(id);
const views = ['home', 'lobby', 'round', 'end'];

let pack = null;
let room = null;
let members = [];
let displays = [];
let answers = [];
let unsub = null;
let selectedConcept = null;
let selectedOption = null;
let selectionRoundId = null;
let drawnHandRoundId = null;
let myLocked = false;
let answerKeyLoaded = false;
let themePref = sessionStorage.getItem('sparkonScreenSkin') || 'premium';
let artReady = false;
let ownedCards = [];
let accountGeneration = 0;

function show(view) {
  views.forEach(v => {
    const el = $('view-' + v);
    if (el) el.classList.toggle('hide', v !== view);
  });
}

async function loadPack() {
  const res = await fetch('/games/data/pack.public.json');
  pack = await res.json();
}
function cardsById() { return Object.fromEntries(pack.cards.map(c => [c.id, c])); }
function mainRounds() {
  return pack.mainRoundIds.map(id => pack.rounds.find(r => r.id === id));
}
function isHost() {
  return room && room.hostUid === currentPlayerId();
}
function me() {
  return members.find(m => m.id === currentPlayerId());
}

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

function applyThemeUI() {
  const theme = previewTheme(themePref);
  document.documentElement.dataset.theme = theme === 'basic' ? 'original' : theme;
  const logo = $('logo');
  if (logo) logo.src = theme === 'basic' ? '/games/assets/logo-original.svg' : '/games/assets/logo.svg';
  const orig = $('skinOriginal');
  const prem = $('skinPremium');
  const hero = $('skinHero');
  if (orig) orig.setAttribute('aria-pressed', String(theme === 'basic'));
  if (prem) {
    prem.setAttribute('aria-pressed', String(theme === 'premium'));
    prem.disabled = false;
  }
  if (hero) {
    hero.setAttribute('aria-pressed', String(theme === 'hero'));
    hero.disabled = false;
  }
  const help = $('skinHelp');
  if (help) {
    help.textContent = theme === 'basic'
      ? 'Original screen · cards keep their owned edition.'
      : `${theme === 'hero' ? 'Hero' : 'Premium'} screen · cards keep their owned edition.`;
  }
}

async function setSkin(pref) {
  themePref = pref;
  window.SparkONSkin?.set(pref);
  sessionStorage.setItem('sparkonScreenSkin', pref);
  applyThemeUI();
  const u = getAuth()?.currentUser;
  if (u && !u.isAnonymous) {
    try { await setThemePref(u.uid, pref); } catch { /* non-fatal */ }
  }
  // Remount hand so theme treatment refreshes
  if (room && room.phase === 'question' && !myLocked) {
    drawnHandRoundId = null;
    const rounds = mainRounds();
    const idx = room.roundIndex || 0;
    const round = pack.rounds.find(r => r.id === room.roundId) || rounds[idx];
    if (round) drawHand(round);
  }
}

function setAuthUI(user) {
  const generation = ++accountGeneration;
  ownedCards = [];
  const isAnon = !!(user && user.isAnonymous);
  $('btnSignIn').classList.toggle('hide', !!user && !isAnon);
  $('btnSignOut').classList.toggle('hide', !user || isAnon);
  updateAccountChip(user);
  if (user && !isAnon) {
    $('authStatus').textContent = `Signed in as ${user.displayName || user.email || 'Google'} · deck saves to your account`;
    ensureUserProfile(user).then(async () => {
      const loadedCards = await loadOrCreateCollection(user.uid);
      if (generation !== accountGeneration) return;
      ownedCards = loadedCards;
      const profile = await loadProfile(user.uid);
      if (generation !== accountGeneration) return;
      themePref = sessionStorage.getItem('sparkonScreenSkin') || 'premium';
      applyThemeUI();
    }).catch(e => {
      $('authStatus').textContent = 'Signed in, but collection sync failed: ' + e.message;
    });
  } else if (isAnon) {
    $('authStatus').textContent = 'Continuing as guest · deck will not sync across devices';
  } else {
    $('authStatus').textContent = 'Guest mode · progress is temporary unless you sign in';
  }
  applyThemeUI();
}

function renderLobby() {
  show('lobby');
  $('roomCodeLabel').textContent = room.code;
  const slots = $('playerSlots');
  slots.replaceChildren();
  const approved = members.filter(m => m.approved);
  const pending = members.filter(m => !m.approved);
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const m = approved[i];
    const div = document.createElement('div');
    div.className = 'slot' + (m ? ' filled' : '');
    if (m) {
      div.innerHTML = `<div class="nick"><span class="status-dot ${m.connected ? 'on' : ''}"></span>${escape(m.nickname)}</div>
        <div class="meta">${m.isHost ? 'Host · ' : ''}${m.ready ? 'Ready' : 'Not ready'}${m.homeLabel ? ' · Home ' + escape(m.homeLabel) : ''}${m.isGuest ? ' · guest' : ''}</div>`;
    } else {
      div.innerHTML = `<div class="muted">Open slot ${i + 1} / ${MAX_PLAYERS}</div>`;
    }
    slots.append(div);
  }
  const pendingBox = $('pendingJoiners');
  if (pendingBox) {
    pendingBox.replaceChildren();
    const host = isHost();
    if (pending.length) {
      const h = document.createElement('h2');
      h.textContent = host ? 'Waiting for your approve' : 'Pending';
      pendingBox.append(h);
      pending.forEach(m => {
        const row = document.createElement('div');
        row.className = 'slot';
        row.innerHTML = `<div class="nick">${escape(m.nickname)}</div><div class="meta">Waiting for host approve${m.homeLabel ? ' · Home ' + escape(m.homeLabel) : ''}</div>`;
        if (host) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'primary';
          btn.textContent = 'Approve';
          btn.onclick = async () => {
            try { await approveMember(room.id, m.id, true); }
            catch (e) { alert(e.message || String(e)); }
          };
          row.append(btn);
        }
        pendingBox.append(row);
      });
    }
  }
  $('displayCount').textContent = `${displays.length} / 2`;
  $('displayWarn').textContent = displays.length < 2
    ? 'Tip: pair both TVs when ready. Missing displays warn only.'
    : 'Both displays paired.';
  const host = isHost();
  $('btnStart').classList.toggle('hide', !host);
  $('btnPairTv').disabled = !host && displays.length >= 2;
  const enough = approved.length >= MIN_PLAYERS;
  const allReady = enough && approved.every(m => m.ready);
  $('btnStart').disabled = !(host && allReady);
  const self = me();
  if (self && !self.approved) {
    $('lobbyStatus').textContent = 'Waiting for the host to approve you…';
    $('btnReady').disabled = true;
  } else {
    $('btnReady').disabled = false;
    if (host) {
      if (pending.length) {
        $('lobbyStatus').textContent = `${pending.length} waiting for approve. Need ${MIN_PLAYERS}–${MAX_PLAYERS} ready to start.`;
      } else if (!enough) {
        $('lobbyStatus').textContent = `${approved.length} / ${MAX_PLAYERS} seated — need at least ${MIN_PLAYERS} approved & ready to start.`;
      } else if (allReady) {
        $('lobbyStatus').textContent = `${approved.length} ready — you can start (2–6).`;
      } else {
        $('lobbyStatus').textContent = 'Waiting for ready…';
      }
    } else {
      $('lobbyStatus').textContent = self?.ready ? 'Ready — waiting for host.' : "Tap I'm ready when you are.";
    }
  }
  $('btnReady').textContent = self?.ready ? 'Unready' : "I'm ready";
}

function renderRound() {
  show('round');
  const rounds = mainRounds();
  const idx = room.roundIndex || 0;
  const round = pack.rounds.find(r => r.id === room.roundId) || rounds[idx];
  if (!round) return;
  $('roundBadge').textContent = `Round ${idx + 1} of ${rounds.length} · ${room.phase}`;
  $('roundTitle').textContent = round.title;
  $('roundPrompt').textContent = round.prompt;

  const host = isHost();
  $('btnHostLock').classList.toggle('hide', !(host && room.phase === 'question'));
  $('btnHostReveal').classList.toggle('hide', !(host && (room.phase === 'locked' || room.phase === 'question')));
  $('btnHostNext').classList.toggle('hide', !(host && (room.phase === 'reveal' || room.phase === 'scores')));
  const pairPanel = $('pairTvDuringPlay');
  if (pairPanel) {
    pairPanel.classList.toggle('hide', !(host && room.phase !== 'finished'));
  }

  const myAns = answers.find(a => a.roundId === room.roundId && a.uid === currentPlayerId());
  myLocked = !!(myAns && myAns.locked);

  if (room.phase === 'question' && !myLocked) {
    $('playControls').classList.remove('hide');
    $('waitPanel').classList.add('hide');
    $('revealPanel').classList.add('hide');
    drawHand(round);
  } else if (room.phase === 'question' || room.phase === 'locked') {
    $('playControls').classList.add('hide');
    $('revealPanel').classList.add('hide');
    $('waitPanel').classList.remove('hide');
    const players = members.filter(m => m.approved).length;
    const count = isHost()
      ? answers.filter(a => a.roundId === room.roundId && a.locked).length
      : (room.publicState?.answeredCount ?? answers.filter(a => a.roundId === room.roundId && a.locked).length);
    const cards = cardsById();
    $('waitPanel').innerHTML = myLocked
      ? `<p>Submitted · you chose <strong>${escape(cards[myAns.conceptId]?.title || myAns.conceptId)}</strong> · option ${escape(myAns.optionId)}</p>
         <p class="muted">${count} / ${players} answered. Waiting for host…</p>`
      : `<p>Waiting… ${count} / ${players} answered.</p>`;
  } else if (room.phase === 'reveal' || room.phase === 'scores') {
    $('playControls').classList.add('hide');
    $('waitPanel').classList.add('hide');
    $('revealPanel').classList.remove('hide');
    const rev = room.reveal || {};
    const cards = cardsById();
    const opt = round.options.find(o => o.id === rev.correctOption);
    const mine = myAns ? gradeLocal(room.roundId, myAns) : null;
    const approvedPlayers = members.filter(m => m.approved);
    const explainer = approvedPlayers.length
      ? approvedPlayers[(idx || 0) % approvedPlayers.length]
      : null;
    const spark = mine && mine.total === 2;
    $('revealPanel').innerHTML = `
      <h2 class="${spark ? 'spark-on' : ''}">${mine ? (spark ? 'Spark on! +2' : `+${mine.total} point${mine.total === 1 ? '' : 's'}`) : 'Reveal'}</h2>
      <p><strong>Concept:</strong> ${escape(cards[rev.correctConcept]?.title || '')}</p>
      <p><strong>Answer:</strong> ${escape(opt?.text || rev.correctOption || '')}</p>
      <p>${escape(rev.explanation || '')}</p>
      <p class="muted">${escape(explainer ? ('Explain-it (not scored) · ' + explainer.nickname + ' — ' + (round.discussion || '')) : ('Explain-it (not scored): ' + (round.discussion || '')))}</p>`;
    if (artReady && rev.correctConcept) {
      const wrap = document.createElement('div');
      wrap.className = 'reveal-card';
      wrap.append(renderCardInstance({
        instanceId: `reveal-${rev.correctConcept}`,
        conceptId: rev.correctConcept,
        edition: ownedCardFor(ownedCards, rev.correctConcept).edition
      }, { compact: true }));
      $('revealPanel').append(wrap);
    }
    if (room.phase === 'scores') appendScoreTable($('revealPanel'));
    $('btnHostNext').textContent = idx >= rounds.length - 1 ? 'Host: finish' : 'Host: next round';
  }
}

function gradeLocal(roundId, ans) {
  const rev = room.reveal;
  if (!rev) return null;
  const conceptPoints = rev.correctConcept === ans.conceptId ? 1 : 0;
  const answerPoints = rev.correctOption === ans.optionId ? 1 : 0;
  return { total: conceptPoints + answerPoints };
}

function appendScoreTable(parent) {
  const table = document.createElement('table');
  table.className = 'score-table';
  table.innerHTML = '<thead><tr><th>Player</th><th>Score</th></tr></thead>';
  const tb = document.createElement('tbody');
  const scores = room.scores || {};
  members.filter(m => m.approved).sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)).forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escape(m.nickname)}</td><td>${scores[m.id] || 0}</td>`;
    tb.append(tr);
  });
  table.append(tb);
  parent.append(table);
}

function drawHand(round) {
  if (selectionRoundId !== round.id) {
    selectedConcept = null;
    selectedOption = null;
    selectionRoundId = round.id;
    drawnHandRoundId = null;
  }
  // Keep mounted hand when only answers update — but remount if theme forced clear
  if (drawnHandRoundId === round.id && $('hand')?.childElementCount) {
    updateLock();
    return;
  }
  drawnHandRoundId = round.id;
  myLocked = false;
  $('btnLock').disabled = true;
  $('submitStatus').textContent = '';
  const cards = cardsById();
  const hand = $('hand');
  hand.replaceChildren();
  hand.className = 'hand-cards';
  // Screen choice never changes the owned card variant.
  round.hand.forEach(id => {
    const c = cards[id];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `hand-pick ${c?.subject || ''}`;
    b.dataset.conceptId = id;
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', c?.title || id);
    if (artReady) {
      const front = renderCardInstance({
        instanceId: `hand-${id}`,
        conceptId: id,
        edition: ownedCardFor(ownedCards, id).edition
      }, { compact: true });
      front.setAttribute('aria-hidden', 'true');
      b.append(front);
      const caption = document.createElement('span');
      caption.className = 'hand-caption muted';
      caption.textContent = c?.title || id;
      b.append(caption);
    } else {
      b.className = `concept ${c?.subject || ''}`;
      b.innerHTML = `<span class="badge">${escape(c?.subject || '')}</span><div>${escape(c?.title || id)}</div>`;
    }
    b.onclick = () => {
      if (myLocked) return;
      selectedConcept = id;
      selectionRoundId = round.id;
      [...hand.children].forEach(n => n.setAttribute('aria-pressed', String(n === b)));
      $('rule').innerHTML = `<strong>${escape(c.title)}</strong><p>${escape(c.rule)}</p><p>${escape(c.example)}</p><p class="muted">${escape(c.condition)}</p>`;
      updateLock();
    };
    hand.append(b);
  });
  const opts = $('options');
  opts.replaceChildren();
  round.options.forEach(o => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = o.text;
    b.dataset.optionId = o.id;
    b.setAttribute('aria-pressed', 'false');
    b.onclick = () => {
      if (myLocked) return;
      selectedOption = o.id;
      selectionRoundId = round.id;
      [...opts.children].forEach(n => n.setAttribute('aria-pressed', String(n === b)));
      updateLock();
    };
    opts.append(b);
  });
  if (selectedConcept) {
    const c = cards[selectedConcept];
    const btn = [...hand.children].find(n => n.dataset.conceptId === selectedConcept);
    if (btn && c) {
      [...hand.children].forEach(n => n.setAttribute('aria-pressed', String(n === btn)));
      $('rule').innerHTML = `<strong>${escape(c.title)}</strong><p>${escape(c.rule)}</p><p>${escape(c.example)}</p><p class="muted">${escape(c.condition)}</p>`;
    }
  }
  if (selectedOption) {
    const btn = [...opts.children].find(n => n.dataset.optionId === selectedOption);
    if (btn) [...opts.children].forEach(n => n.setAttribute('aria-pressed', String(n === btn)));
  }
  updateLock();
}
function updateLock() {
  $('btnLock').disabled = !selectedConcept || !selectedOption || myLocked;
}

function renderEnd() {
  show('end');
  const box = $('finalScores');
  box.replaceChildren();
  appendScoreTable(box);
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = 'Max 16 points. Cosmetics never changed these scores. Choose one idea you can explain to someone else.';
  box.append(p);
}

function onState() {
  if (!room) return;
  $('reconnect').classList.add('hide');
  if (room.phase === 'lobby') renderLobby();
  else if (room.phase === 'finished') renderEnd();
  else renderRound();
}

function attachWatch(roomId) {
  if (unsub) unsub();
  unsub = watchRoom(roomId, {
    onRoom: (r) => { room = r; onState(); },
    onMembers: (m) => { members = m; onState(); },
    onDisplays: (d) => { displays = d; if (room?.phase === 'lobby') renderLobby(); },
    onAnswers: (a) => { answers = a; onState(); },
    onError: () => $('reconnect').classList.remove('hide')
  });
  try { markConnected(roomId, currentPlayerId()); } catch { /* not signed in yet */ }
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function ensureHostKey() {
  if (answerKeyLoaded) return;
  await loadAnswerKey();
  answerKeyLoaded = true;
  console.info('[SparkON] HOST-TRUSTED answer key active for this host session.');
}

// —— events ——
$('btnSignIn').onclick = async () => {
  try {
    await signIn();
  } catch (e) {
    $('authStatus').textContent = e.message || initErrorMessage(e);
  }
};
$('btnSignOut').onclick = () => signOut();
$('btnGuest').onclick = async () => {
  try {
    $('authStatus').textContent = 'Continuing as guest…';
    await signInAnonymously();
    $('authStatus').textContent = 'Continuing as guest · deck will not sync across devices';
  } catch (e) {
    $('authStatus').textContent = e.message || initErrorMessage(e);
  }
};

if ($('skinOriginal')) $('skinOriginal').onclick = () => setSkin('basic');
if ($('skinPremium')) $('skinPremium').onclick = () => setSkin('premium');
if ($('skinHero')) $('skinHero').onclick = () => setSkin('hero');

$('btnCreate').onclick = async () => {
  try {
    const nick = $('nick').value.trim() || 'Host';
    const { roomId } = await createRoom({ nickname: nick, homeLabel: $('home').value.trim() });
    if (getAuth()?.currentUser) await loadOrCreateCollection(getAuth().currentUser.uid);
    attachWatch(roomId);
  } catch (e) {
    alert(e.message || String(e));
  }
};

$('btnJoin').onclick = async () => {
  try {
    const joined = await requestJoin({
      code: $('joinCode').value,
      nickname: $('nick').value.trim() || 'Player',
      homeLabel: $('home').value.trim()
    });
    if (getAuth()?.currentUser) await loadOrCreateCollection(getAuth().currentUser.uid);
    attachWatch(joined.roomId);
    if (joined.pending) $('lobbyStatus') && ($('lobbyStatus').textContent = 'Joined — waiting for host approve…');
  } catch (e) {
    alert(e.message || String(e));
  }
};

$('btnReady').onclick = async () => {
  const m = me();
  if (!m || !room) return;
  await setReady(room.id, m.id, !m.ready);
};

async function pairTvFromInput(inputEl, statusEl) {
  if (!room || !isHost()) { alert('Only the host pairs TVs.'); return; }
  if (room.phase === 'finished') { alert('Game finished — start a new room to pair TVs.'); return; }
  try {
    await attachDisplayToRoom(room.id, inputEl.value);
    inputEl.value = '';
    if (statusEl) statusEl.textContent = 'TV paired.';
    if ($('lobbyStatus')) $('lobbyStatus').textContent = 'TV paired.';
  } catch (e) {
    alert(e.message || String(e));
  }
}
$('btnPairTv').onclick = () => pairTvFromInput($('tvCode'), $('lobbyStatus'));
const btnPairTvPlay = $('btnPairTvPlay');
if (btnPairTvPlay) {
  btnPairTvPlay.onclick = () => pairTvFromInput($('tvCodePlay'), $('pairTvPlayStatus'));
}

$('btnStart').onclick = async () => {
  if (!room || !isHost()) return;
  const approved = members.filter(m => m.approved);
  if (approved.length < MIN_PLAYERS) {
    alert(`Need at least ${MIN_PLAYERS} approved players to start.`);
    return;
  }
  if (!approved.every(m => m.ready)) {
    alert('Everyone approved must be ready.');
    return;
  }
  try {
    await ensureHostKey();
    const rounds = mainRounds();
    const first = rounds[0];
    await hostAdvance(room.id, room.revision, {
      phase: 'question',
      roundIndex: 0,
      roundId: first.id,
      reveal: null,
      scores: room.scores || {}
    });
  } catch (e) {
    alert(e.message || String(e));
  }
};

$('btnLock').onclick = async () => {
  if (!selectedConcept || !selectedOption || !room) return;
  $('btnLock').disabled = true;
  $('submitStatus').textContent = 'Submitting…';
  try {
    await submitAnswer(room.id, room.roundId, { conceptId: selectedConcept, optionId: selectedOption });
    $('submitStatus').textContent = 'Submitted';
    myLocked = true;
  } catch (e) {
    $('submitStatus').textContent = e.message;
    $('btnLock').disabled = false;
  }
};

$('btnHostLock').onclick = async () => {
  if (!isHost()) return;
  try {
    await hostAdvance(room.id, room.revision, { phase: 'locked' });
  } catch (e) { alert(e.message); }
};

$('btnHostReveal').onclick = async () => {
  if (!isHost()) return;
  try {
    await ensureHostKey();
    let rev = room.revision;
    if (room.phase === 'question') {
      await hostAdvance(room.id, rev, { phase: 'locked' });
      rev += 1;
    }
    const roundAnswers = answers.filter(a => a.roundId === room.roundId);
    const { results, summary } = gradeAll(room.roundId, roundAnswers);
    const scores = { ...(room.scores || {}) };
    for (const [uid, g] of Object.entries(results)) {
      scores[uid] = (scores[uid] || 0) + (g.total || 0);
    }
    await hostAdvance(room.id, rev, {
      phase: 'reveal',
      reveal: {
        correctConcept: summary.correctConcept,
        correctOption: summary.correctOption,
        explanation: summary.explanation,
        gradedAt: Date.now()
      },
      scores
    });
  } catch (e) { alert(e.message); }
};

$('btnHostNext').onclick = async () => {
  if (!isHost()) return;
  try {
    const rounds = mainRounds();
    const idx = room.roundIndex || 0;
    if (room.phase === 'reveal') {
      await hostAdvance(room.id, room.revision, { phase: 'scores' });
      return;
    }
    if (idx >= rounds.length - 1) {
      await hostAdvance(room.id, room.revision, { phase: 'finished' });
      return;
    }
    const next = rounds[idx + 1];
    await hostAdvance(room.id, room.revision, {
      phase: 'question',
      roundIndex: idx + 1,
      roundId: next.id,
      reveal: null
    });
    selectedConcept = null;
    selectedOption = null;
    selectionRoundId = null;
    drawnHandRoundId = null;
    myLocked = false;
  } catch (e) { alert(e.message); }
};

async function boot() {
  show('home');
  applyThemeUI();
  try {
    await loadCardArt();
    artReady = true;
  } catch (e) {
    console.warn('[SparkON] card art load failed; falling back to text hand', e);
    artReady = false;
  }
  try {
    await initialize((user) => setAuthUI(user));
    await whenReady();
    if (redirectError) {
      $('authStatus').textContent = initErrorMessage(redirectError);
      clearRedirectError();
    }
  } catch (e) {
    $('authStatus').textContent = initErrorMessage(e);
  }
  await loadPack();
  const rid = sessionStorage.getItem('sparkonRoomId');
  if (rid && getAuth()?.currentUser) {
    try { attachWatch(rid); } catch { /* fresh */ }
  } else if (rid) {
    try {
      await ensureSignedIn();
      attachWatch(rid);
    } catch { /* fresh home */ }
  }
}
boot();

window.addEventListener('sparkon:skinchange',e=>{themePref=e.detail.skin==='original'?'basic':e.detail.skin;applyThemeUI();});
