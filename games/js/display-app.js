import { initialize, whenReady, initErrorMessage } from './auth.js';
import { registerDisplayPairing, watchDisplayPairing, watchRoom } from './room.js';

const $ = id => document.getElementById(id);
let pack = null;
let unsubRoom = null;

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
    $('prompt').textContent = `${members.filter(m => m.approved).length} / 5 players · ${(room.publicState?.displayCount) || 0} displays`;
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
    const count = answers.filter(a => a.roundId === room.roundId && a.locked).length;
    const players = members.filter(m => m.approved).length;
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

async function boot() {
  try {
    await initialize(() => {});
    await whenReady();
    await loadPack();
    const { code } = await registerDisplayPairing();
    $('pairCode').textContent = code;
    $('conn').textContent = 'Ready to pair';
    watchDisplayPairing(code, (data) => {
      if (data.status === 'paired' && data.roomId) {
        $('pairStatus').textContent = 'Paired! Loading room…';
        if (unsubRoom) unsubRoom();
        let room, members = [], answers = [];
        unsubRoom = watchRoom(data.roomId, {
          onRoom: (r) => { room = r; if (room) showBoard(room, members, answers); },
          onMembers: (m) => { members = m; if (room) showBoard(room, members, answers); },
          onDisplays: (d) => { if (room) { room.publicState = { ...(room.publicState || {}), displayCount: d.length }; showBoard(room, members, answers); } },
          onAnswers: (a) => { answers = a; if (room) showBoard(room, members, answers); },
          onError: (err) => {
            $('reconnect').classList.remove('hide');
            console.warn(err);
          }
        });
      }
    });
  } catch (e) {
    $('pairStatus').textContent = initErrorMessage(e) || e.message;
    $('conn').textContent = 'Error';
  }
}
boot();
