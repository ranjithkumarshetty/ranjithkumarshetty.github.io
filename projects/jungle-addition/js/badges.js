/* badges.js — challenges that sit alongside the trail.
   Clearing stops is the spine of the game; badges are the side quests, so there
   is something to chase even on a stop he has already beaten. Each badge is a
   one-line predicate over saved progress — nothing is tracked separately, so a
   badge can be added or retuned here without touching any other file. */
window.Badges = (function () {
  'use strict';

  const BADGES = [
    { id: 'first-steps', emoji: '🌱', title: 'First Steps',
      note: 'Clear your very first stop',
      test: state => state.clearedStops.length >= 1 },

    { id: 'perfect-stop', emoji: '🎯', title: 'Bullseye',
      note: 'Clear a stop with no mistakes',
      test: state => state.perfectStops >= 1 },

    { id: 'sharp-three', emoji: '⚡', title: 'Sharp Eyes',
      note: 'Three perfect stops',
      test: state => state.perfectStops >= 3 },

    { id: 'flawless-five', emoji: '💫', title: 'Flawless',
      note: 'Five perfect stops',
      test: state => state.perfectStops >= 5 },

    { id: 'region-1', emoji: '🌊', title: 'Riverbank Ranger',
      note: 'Clear the whole Riverbank',
      test: () => Progress.regionIsCleared(0) },

    { id: 'explorer-50', emoji: '📚', title: 'Fifty Sums',
      note: 'Answer 50 questions',
      test: () => Progress.stats().answered >= 50 },

    { id: 'explorer-150', emoji: '🧠', title: 'Number Brain',
      note: 'Answer 150 questions',
      test: () => Progress.stats().answered >= 150 },

    { id: 'friends-10', emoji: '🤝', title: 'Ten Friends',
      note: 'Find ten animal friends',
      test: state => state.friends >= 10 },

    { id: 'all-mechanics', emoji: '🎲', title: 'All-Rounder',
      note: 'Play every kind of game',
      test: state => Facts.gameTypes().every(game => clearedAny(state, s => s.game === game)) },

    { id: 'puppy', emoji: '🐶', title: 'Puppy Rescuer',
      note: 'Save a puppy from a ledge',
      test: state => clearedAny(state, s => s.frame === 'rescue') },

    { id: 'treasure', emoji: '💎', title: 'Treasure Hunter',
      note: 'Cross every treasure route',
      test: state => clearedAll(state, s => s.game === 'route') },

    { id: 'summit', emoji: '👑', title: 'Jungle Legend',
      note: 'Clear every stop on the map',
      test: state => state.clearedStops.length >= Facts.STOPS.length }
  ];

  function clearedAny(state, predicate) {
    return Facts.STOPS.some(s => predicate(s) && state.clearedStops.indexOf(s.id) !== -1);
  }

  function clearedAll(state, predicate) {
    return Facts.STOPS.filter(predicate)
      .every(s => state.clearedStops.indexOf(s.id) !== -1);
  }

  /* Award everything newly true and hand back only the fresh ones, so the
     caller celebrates each badge exactly once. Safe to call as often as you
     like — awardBadge is idempotent. */
  function check() {
    const state = Progress.get();
    return BADGES
      .filter(badge => !Progress.hasBadge(badge.id) && badge.test(state))
      .filter(badge => Progress.awardBadge(badge.id));
  }

  function byId(id) {
    return BADGES.find(badge => badge.id === id) || null;
  }

  function earnedCount() {
    return BADGES.filter(badge => Progress.hasBadge(badge.id)).length;
  }

  function total() { return BADGES.length; }

  /* The wall on the profile card: everything, with the unearned ones dimmed and
     still readable — a locked badge is a thing to aim at, not a secret. */
  function renderGrid(host) {
    host.innerHTML = BADGES.map(badge => {
      const earned = Progress.hasBadge(badge.id);
      return `
        <div class="badge ${earned ? 'earned' : 'locked'}">
          <span class="badge-emoji">${earned ? badge.emoji : '🔒'}</span>
          <span class="badge-title">${badge.title}</span>
          <span class="badge-note">${badge.note}</span>
        </div>`;
    }).join('');
    host.setAttribute('aria-label', `${earnedCount()} of ${BADGES.length} badges earned`);
  }

  /* ---- announcing --------------------------------------------------------- */

  /* Clearing the last stop can earn four badges at once. Showing them stacked
     would turn four wins into one blur, so they queue and take their turn. */
  const SHOW_MS = 2400;
  const GAP_MS = 320;

  let queue = [];
  let showing = false;
  let timer = null;

  function announce(host, earned) {
    if (!host || !earned || !earned.length) return;
    queue = queue.concat(earned);
    if (!showing) next(host);
  }

  function next(host) {
    const badge = queue.shift();
    if (!badge) { showing = false; host.hidden = true; return; }

    showing = true;
    host.hidden = false;
    host.innerHTML = `
      <span class="pop-emoji">${badge.emoji}</span>
      <span class="pop-copy">
        <strong class="pop-title">Badge earned!</strong>
        <span class="pop-name">${badge.title}</span>
      </span>`;
    Celebrate.pulse(host, 'pop-in', SHOW_MS);
    Celebrate.starBurst(host);
    Sound.speak(`Badge earned! ${badge.title}`);

    timer = setTimeout(() => next(host), SHOW_MS + GAP_MS);
  }

  /* A reset wipes the badges themselves, so anything still waiting to be
     announced is about a state that no longer exists. */
  function clearAnnouncements(host) {
    if (timer) { clearTimeout(timer); timer = null; }
    queue = [];
    showing = false;
    if (host) { host.hidden = true; host.innerHTML = ''; }
  }

  return {
    BADGES, check, byId, earnedCount, total, renderGrid, announce, clearAnnouncements
  };
})();
