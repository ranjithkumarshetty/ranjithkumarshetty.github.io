/* share.js — turn a finished stop, or the whole adventure, into a few lines a
   grown-up can send to a grandparent. Building the text is pure and testable;
   getting it out of the browser is three fallbacks deep, because the share
   sheet, the clipboard API and file:// pages disagree about what exists. */
window.Share = (function () {
  'use strict';

  const HOME = 'https://ranjithkumarshetty.github.io/projects/jungle-addition/';
  const TITLE = 'Jungle Addition Adventure';

  /* One cleared stop, told in the order a parent reads it: what, how well,
     how long. `session` is what the level screen tracked while playing. */
  function levelSummary(session) {
    const s = session || {};
    const lines = [
      `🌿 ${TITLE} — Stop ${s.stopId}: ${s.stopName}`,
      `${s.avatarEmoji || '🐯'} ${s.avatarName || 'Tiger'} · ${titleCase(s.difficulty || 'medium')}`,
      [
        `🧮 ${count(s.solved, 'sum')} solved`,
        `⏱ ${formatDuration(s.elapsedMs)}`,
        `❌ ${count(s.mistakes, 'slip')}`
      ].join(' · ')
    ];
    if (s.stars) lines.push(`⭐ ${s.stars}`);
    if (s.points) lines.push(`🏅 ${s.points} points this stop`);
    lines.push(`Play along: ${HOME}`);
    return lines.join('\n');
  }

  /* Everything so far — the version worth sending once, at the end of a week. */
  function adventureSummary(state, stats, totalStops) {
    const s = state || {};
    const totals = stats || { answered: 0, missed: 0, accuracy: 100 };
    const settings = s.settings || {};
    return [
      `🌿 ${TITLE}`,
      `${settings.avatarEmoji || '🐯'} ${settings.avatarName || 'Tiger'} the ${s.rank || 'Cub'} · ${titleCase(settings.difficulty || 'medium')}`,
      `🗺 ${(s.clearedStops || []).length} of ${totalStops || 20} stops cleared`,
      `🧮 ${count(totals.answered, 'sum')} solved · ✅ ${totals.accuracy}% first try · ❌ ${count(totals.missed, 'slip')}`,
      `🏅 ${s.score || 0} points · 🐾 ${count(s.friends, 'friend')} · 🎖 ${count((s.badges || []).length, 'badge')}`,
      `Play along: ${HOME}`
    ].join('\n');
  }

  /* Short and spoken-sounding: "48s", "2m 14s", "1h 3m". */
  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round((ms || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  /* Native share sheet first — on a tablet that is the whole point. Clipboard
     next, and a hidden textarea last for file:// pages where neither exists.
     Resolves with how it went so the caller can say the right thing. */
  function send(text) {
    if (navigator.share) {
      return navigator.share({ title: TITLE, text })
        .then(() => ({ ok: true, how: 'shared' }))
        .catch(err => (err && err.name === 'AbortError')
          ? { ok: false, how: 'cancelled' }
          : copy(text));
    }
    return copy(text);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text)
        .then(() => ({ ok: true, how: 'copied' }))
        .catch(() => legacyCopy(text));
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      const box = document.createElement('textarea');
      box.value = text;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      const done = document.execCommand('copy');
      box.remove();
      return { ok: done, how: done ? 'copied' : 'failed' };
    } catch (err) {
      return { ok: false, how: 'failed' };
    }
  }

  function count(value, noun) {
    const n = value || 0;
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
  }

  function titleCase(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  return { HOME, levelSummary, adventureSummary, formatDuration, send };
})();
