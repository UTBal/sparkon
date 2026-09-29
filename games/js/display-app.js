import { initialize, whenReady, ensureSignedIn, initErrorMessage } from './auth.js';
import {
  registerDisplayPairing, watchDisplayPairing, watchRoom,
  loadDisplayBind, saveDisplayBind, touchDisplay
} from './room.js';
import { loadCardArt, renderCardInstance } from './cards.js';

const $ = id => document.getElementById(id);
let pack = null;
let artReady = false;
let unsubRoom = null;
let heartbeatTimer = null;

async function loadPack() {
  const res = await fetch('/games/data/pack.public.json');
  pack = await res.json();
}

function cardMap() {
  return Object.fromEntries(pack.cards.map(c => [c.id, c]));
}

function showBoard(room, members, answers) {
  $('pair').classList.add('hide');
  $('board').classList.remove('hide');
  const phase = room.phase;
  $('phaseBadge').textContent = `Room ${room.code} · ${phase} · rev ${room.revision}`;
  $('conn').textContent = 'Live';
  const cards = cardMap();
  const round = pack.rounds.find(r => r.id === room.roundId);
  const extra = $('extra');
  extra.replaceChildren();
  $('scores').replaceChildren();

  if (phase === 'lobby') {
    $('title').textContent = 'Waiting in lobby';
    $('prompt').textContent = `${members.filter(m => m.approved).length} / 6 players · ${(room.publicState?.displayCount) || 0} displays`;
    const list = document.createElement('ul');
    members.filter(m => m.approved).forEach(m => {
      const li = document.createElement('li');
      li.textContent = `${m.nickname}${m.ready ? ' · ready' : ''}${m.isHost ? ' · host' : ''}`;
      list.append(li);
    });
    extra.append(list);
    return;
  }

  if (phase === 'question' || phase === 'locked') {
    $('title').textContent = round ? `Round ${(room.roundIndex || 0) + 1}: ${round.title}` : 'Round';
    $('prompt').textContent = round?.prompt || '';
    const players = members.filter(m => m.approved).length;
    // Prefer publicState (reveal-gated answers — TV cannot list others' answers mid-round)
    const count = room.publicState?.answeredCount ?? answers.filter(a => a.roundId === room.roundId && a.locked).length;
    extra.textContent = phase === 'locked'
      ? `Answers locked · ${count} / ${players} submitted`
      : `Answer on your phones · ${count} / ${players} submitted`;
    return;
  }

  if (phase === 'reveal' || phase === 'scores') {
    const rev = room.reveal || {};
    $('title').textContent = phase === 'reveal' ? 'Reveal' : 'Scores';
    $('prompt').textContent = '';
    if (rev.correctConcept && cards[rev.correctConcept]) {
      const p = document.createElement('p');
      p.innerHTML = `<strong>${cards[rev.correctConcept].title}</strong> · option ${rev.correctOption}`;
      extra.append(p);
    }
    if (rev.explanation) {
      const e = document.createElement('p');
      e.textContent = rev.explanation;
      extra.append(e);
    }
    if (artReady && rev.correctConcept) {
      const wrap = document.createElement('div');
      wrap.className = 'tv-reveal-card';
      wrap.append(renderCardInstance({
        instanceId: `tv-${rev.correctConcept}`,
        conceptId: rev.correctConcept,
        edition: 'standard'
      }, { compact: true }));
      extra.append(wrap);
    }
    if (round?.discussion) {
      const d = document.createElement('p');
      d.className = 'muted';
      d.textContent = 'Explain-it (not scored): ' + round.discussion;
      extra.append(d);
    }
    if (phase === 'scores' || room.scores) {
      const table = document.createElement('table');
      table.className = 'score-table';
      table.innerHTML = '<thead><tr><th>Player</th><th>Score</th></tr></thead>';
      const tb = document.createElement('tbody');
      const scores = room.scores || {};
      members.filter(m => m.approved).sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)).forEach(m => {
        const tr = document.createElement('tr');
        const tdNick = document.createElement('td');
        tdNick.textContent = m.nickname || '';
        const tdScore = document.createElement('td');
        tdScore.textContent = String(scores[m.id] || 0);
        tr.append(tdNick, tdScore);
        tb.append(tr);
      });
      table.append(tb);
      $('scores').append(table);
    }
    return;
  }

  if (phase === 'finished') {
    $('title').textContent = 'Spark on!';
    $('prompt').textContent = 'Final scores';
    const table = document.createElement('table');
    table.className = 'score-table';
    table.innerHTML = '<thead><tr><th>Player</th><th>Score</th></tr></thead>';
    const tb = document.createElement('tbody');
    const scores = room.scores || {};
    members.filter(m => m.approved).sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)).forEach(m => {
      const tr = document.createElement('tr');
      const tdNick = document.createElement('td');
      tdNick.textContent = m.nickname || '';
      const tdScore = document.createElement('td');
      tdScore.textContent = `${scores[m.id] || 0} / 16`;
      tr.append(tdNick, tdScore);
      tb.append(tr);
    });
    table.append(tb);
    $('scores').append(table);
  }
}

function attachRoomWatch(roomId, displayId) {
  if (unsubRoom) unsubRoom();
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  let room, members = [], answers = [];
  unsubRoom = watchRoom(roomId, {
    onRoom: (r) => { room = r; if (room) showBoard(room, members, answers); },
    onMembers: (m) => { members = m; if (room) showBoard(room, members, answers); },
    onDisplays: (d) => {
      if (room) {
        room.publicState = { ...(room.publicState || {}), displayCount: d.length };
        showBoard(room, members, answers);
      }
    },
    onAnswers: (a) => { answers = a; if (room) showBoard(room, members, answers); },
    onError: (err) => {
      $('reconnect').classList.remove('hide');
      console.warn(err);
    }
  });
  if (displayId) {
    touchDisplay(roomId, displayId);
    heartbeatTimer = setInterval(() => touchDisplay(roomId, displayId), 60_000);
  }
}

async function startPairingFlow() {
  const { code, displayId } = await registerDisplayPairing();
  $('pair').classList.remove('hide');
  $('board').classList.add('hide');
  $('pairCode').textContent = code;
  $('conn').textContent = 'Ready to pair';
  $('pairStatus').textContent = 'Waiting for host…';
  watchDisplayPairing(code, (data) => {
    if (data.status === 'paired' && data.roomId) {
      $('pairStatus').textContent = 'Paired! Loading room…';
      saveDisplayBind({
        displayId: data.displayId || displayId,
        roomId: data.roomId,
        code,
        status: 'paired',
        pairedAt: Date.now()
      });
      attachRoomWatch(data.roomId, data.displayId || displayId);
    }
  });
}

async function boot() {
  try {
    await initialize(() => {});
    await whenReady();
    await ensureSignedIn();
    await loadPack();
    try { await loadCardArt(); artReady = true; } catch { artReady = false; }

    const bind = loadDisplayBind();
    const user = (await ensureSignedIn());
    if (bind?.roomId && bind?.displayId && bind.displayId === user.uid) {
      // Resume mid-game without minting a new waiting code
      $('pairStatus').textContent = 'Resuming paired display…';
      $('conn').textContent = 'Resuming…';
      attachRoomWatch(bind.roomId, bind.displayId);
      return;
    }
    // Auth uid changed (new anon session) — need a fresh pair code; host can re-bind mid-game

    await startPairingFlow();
  } catch (e) {
    $('pairStatus').textContent = initErrorMessage(e) || e.message;
    $('conn').textContent = 'Error';
  }
}
boot();
