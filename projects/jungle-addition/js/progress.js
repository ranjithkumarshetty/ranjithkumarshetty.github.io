/* progress.js — localStorage persistence.
   Every read and write is defensive: a broken save must never surface an
   error to a five-year-old, it just quietly starts fresh. */
window.Progress = (function () {
  'use strict';

  const KEY = 'jungleAddition.v1';
  const VERSION = 1;

  let storage = realStorage();
  let state = blank();

  /* Fields added after launch default to empty here and are tolerated as absent
     in decode(), so VERSION stays at 1 and an existing save is never wiped. */
  function blank() {
    return {
      version: VERSION,
      clearedStops: [],
      friends: 0,
      stage: 0,
      muted: false,
      badges: [],        // earned badge ids, in the order they were earned
      perfectStops: 0,   // stops cleared without a single mistake
      score: 0,          // lifetime points, only ever added to
      settings: blankSettings(),
      facts: {}          // "7+8" -> { seen, missed }
    };
  }

  /* Chosen once in the setup wizard and changeable from the explorer card.
     Flat on purpose: one shape to default, decode and round-trip. */
  function blankSettings() {
    return {
      done: false,          // has the child been through the wizard yet
      avatar: 'tiger',
      difficulty: 'medium',
      music: true,
      speed: false,         // faster answers score more — introduces a timer
      mistakes: false,      // wrong answers cost points
      bonus: true           // harder questions pay extra
    };
  }

  /* Private browsing can throw on any localStorage access, so probe once and
     fall back to an in-memory shim. The game stays playable either way. */
  function realStorage() {
    try {
      const probe = '__jungle_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (err) {
      return memoryStorage();
    }
  }

  function memoryStorage() {
    const map = {};
    return {
      getItem: k => (k in map ? map[k] : null),
      setItem: (k, v) => { map[k] = String(v); },
      removeItem: k => { delete map[k]; }
    };
  }

  function decode(raw) {
    if (!raw) return blank();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return blank();
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return blank();
    if (parsed.version !== VERSION) return blank();

    const fresh = blank();
    return {
      version: VERSION,
      clearedStops: Array.isArray(parsed.clearedStops)
        ? parsed.clearedStops.filter(Number.isInteger) : fresh.clearedStops,
      friends: Number.isInteger(parsed.friends) ? parsed.friends : fresh.friends,
      stage: Number.isInteger(parsed.stage) ? parsed.stage : fresh.stage,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : fresh.muted,
      badges: Array.isArray(parsed.badges)
        ? parsed.badges.filter(id => typeof id === 'string') : fresh.badges,
      perfectStops: Number.isInteger(parsed.perfectStops)
        ? parsed.perfectStops : fresh.perfectStops,
      score: Number.isInteger(parsed.score) ? parsed.score : fresh.score,
      settings: decodeSettings(parsed.settings, fresh.settings),
      facts: (parsed.facts && typeof parsed.facts === 'object' && !Array.isArray(parsed.facts))
        ? parsed.facts : fresh.facts
    };
  }

  /* Key by key against the blank, so a save written before a setting existed —
     or hand-edited afterwards — can only ever supply values the game knows, and
     always in the same order the blank declares them. */
  function decodeSettings(raw, fresh) {
    const given = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const merged = {};
    Object.keys(fresh).forEach(key => {
      merged[key] = typeof given[key] === typeof fresh[key] ? given[key] : fresh[key];
    });
    return merged;
  }

  function load() {
    let raw = null;
    try {
      raw = storage.getItem(KEY);
    } catch (err) {
      raw = null;
    }
    state = decode(raw);
    return state;
  }

  function save() {
    try {
      storage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      /* Out of quota or blocked — keep playing from memory. */
    }
  }

  function reset() {
    state = blank();
    save();
    return state;
  }

  /* A save file is exactly what the browser holds, so a copy taken today can be
     poured back into any browser later. Safari erases site storage after about
     a week of not visiting, and a new tablet starts empty either way — this is
     the only road back from either. */
  function exportSave() { return JSON.stringify(state); }

  /* Guard before decoding: decode() answers a wrong version with a blank state,
     which would quietly erase the save the file was meant to rescue. */
  function importSave(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return false;
    }
    if (!parsed || typeof parsed !== 'object' || parsed.version !== VERSION) return false;

    state = decode(raw);
    save();
    return true;
  }

  /* ---- queries ----------------------------------------------------------- */

  function get() { return state; }

  function isCleared(stopId) { return state.clearedStops.includes(stopId); }

  function isUnlocked(stopId) { return stopId === 1 || isCleared(stopId - 1); }

  /* Where the character stands on the map: the furthest unlocked stop. */
  function currentStop() {
    for (let id = Facts.STOPS.length; id >= 1; id--) {
      if (isUnlocked(id)) return id;
    }
    return 1;
  }

  function regionIsCleared(regionId) {
    return Facts.REGIONS[regionId].stops.every(isCleared);
  }

  function stageForClearedStops() {
    return Facts.REGIONS.filter(r => r.stops.every(isCleared)).length;
  }

  function stats() {
    const facts = Object.values(state.facts);
    const answered = facts.reduce((total, f) => total + (f.seen || 0), 0);
    const missed = facts.reduce((total, f) => total + (f.missed || 0), 0);
    return {
      answered,
      missed,
      accuracy: answered ? Math.round(((answered - missed) / answered) * 100) : 100
    };
  }

  /* Shakiest facts first — the only thing the grown-up panel really needs. */
  function troubleFacts(limit) {
    return Object.keys(state.facts)
      .map(key => Object.assign({ key }, state.facts[key]))
      .filter(f => f.missed > 0)
      .sort((a, b) => b.missed - a.missed || b.seen - a.seen)
      .slice(0, limit || 10);
  }

  /* ---- mutations --------------------------------------------------------- */

  /* Called once per question, at the moment it completes. `missedFirstTry`
     is true if the very first attempt was wrong — later wrong attempts on the
     same question do not count again. Deliberately does not save; main.js
     saves at level end to limit write churn. */
  function recordAnswer(factKey, missedFirstTry) {
    const record = state.facts[factKey] || { seen: 0, missed: 0 };
    record.seen += 1;
    if (missedFirstTry) record.missed += 1;
    state.facts[factKey] = record;
  }

  function clearStop(stopId) {
    const isNew = !isCleared(stopId);

    if (isNew) {
      state.clearedStops.push(stopId);
      state.clearedStops.sort((a, b) => a - b);
      state.friends = state.clearedStops.length;
      state.stage = stageForClearedStops();
    }
    save();

    return {
      isNew,
      regionCleared: isNew && regionIsCleared(Facts.stop(stopId).region)
    };
  }

  function hasBadge(id) { return state.badges.indexOf(id) !== -1; }

  /* Returns true only the first time, so the caller knows when to celebrate. */
  function awardBadge(id) {
    if (hasBadge(id)) return false;
    state.badges.push(id);
    save();
    return true;
  }

  function recordPerfectStop() {
    state.perfectStops += 1;
    save();
    return state.perfectStops;
  }

  function setMuted(muted) {
    state.muted = !!muted;
    save();
    return state.muted;
  }

  function settings() { return state.settings; }

  function updateSettings(patch) {
    state.settings = decodeSettings(Object.assign({}, state.settings, patch), blankSettings());
    save();
    return state.settings;
  }

  /* Points only ever go up, and never below zero even if a rule takes some off.
     Like recordAnswer, this leaves saving to the end of the level. */
  function addScore(points) {
    state.score = Math.max(0, state.score + (points || 0));
    return state.score;
  }

  return {
    KEY,
    load,
    save,
    reset,
    exportSave,
    importSave,
    get,
    stats,
    troubleFacts,
    isCleared,
    isUnlocked,
    currentStop,
    regionIsCleared,
    recordAnswer,
    clearStop,
    hasBadge,
    awardBadge,
    recordPerfectStop,
    setMuted,
    settings,
    updateSettings,
    addScore,

    /* Test seam: swap the backend so tests never touch real progress. */
    __test: {
      blank,
      blankSettings,
      decode,
      useStorage(fake) { storage = fake || realStorage(); }
    }
  };
})();
