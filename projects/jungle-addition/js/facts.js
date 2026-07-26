/* facts.js — addition problem generation.
   Pure logic: no DOM, no storage, no side effects. Everything here is covered
   by tests.html, because a bug in this file puts wrong math in front of a kid. */
window.Facts = (function () {
  'use strict';

  const QUESTIONS_PER_STOP = 6;
  const MAX_OPTION = 25;

  /* Distractors are near-misses in priority order, so guessing doesn't pay. */
  const DISTRACTOR_OFFSETS = [1, -1, 2, -2, 3, -3, 10, -10];

  const REGIONS = [
    { id: 0, name: 'Riverbank',      emoji: '🌊',  stops: [1, 2, 3, 4] },
    { id: 1, name: 'Deep Jungle',    emoji: '🌴',  stops: [5, 6, 7, 8] },
    { id: 2, name: 'Misty Mountain', emoji: '⛰️',  stops: [9, 10, 11, 12] },
    { id: 3, name: 'Temple Ruins',   emoji: '🏺', stops: [13, 14, 15, 16] },
    { id: 4, name: 'Crystal Caves',  emoji: '💎', stops: [17, 18, 19, 20] }
  ];

  /* ---- fact sets --------------------------------------------------------
     Each returns an array of addend arrays in canonical (ascending) order. */

  function pairsWhere(predicate) {
    const out = [];
    for (let a = 0; a <= 20; a++) {
      for (let b = a; a + b <= 20 && b <= 20; b++) {
        if (predicate(a, b)) out.push([a, b]);
      }
    }
    return out;
  }

  function sumsTo(max, allowZero) {
    return pairsWhere((a, b) =>
      a + b <= max && !(a === 0 && b === 0) && (a >= 1 || allowZero));
  }

  function sumsBetween(lo, hi) {
    return pairsWhere((a, b) => a >= 1 && a + b >= lo && a + b <= hi);
  }

  function doubles(max) {
    const out = [];
    for (let a = 1; a <= max; a++) out.push([a, a]);
    return out;
  }

  /* Both addends single-digit, total over ten — the "make a ten" bridge. */
  function makeATen(lo, hi) {
    return pairsWhere((a, b) =>
      a >= 1 && a <= 9 && b <= 9 && a + b >= Math.max(lo, 11) && a + b <= hi);
  }

  function threeAddends(min, max) {
    const out = [];
    for (let a = 1; a <= max; a++) {
      for (let b = a; a + b <= max; b++) {
        for (let c = b; a + b + c <= max; c++) {
          if (a + b + c >= min) out.push([a, b, c]);
        }
      }
    }
    return out;
  }

  /* ---- the stop roster --------------------------------------------------
     The whole difficulty ladder lives in this one table. Retuning a stop for
     a particular kid is a one-line edit here; nothing else needs to change.
     `min`/`max` declare the answer range and are enforced by the tests. */

  const STOPS = [
    { id: 1,  region: 0, game: 'critters', title: 'Riverbank Steps',   min: 1,  max: 6,  build: () => sumsTo(6, true) },
    { id: 2,  region: 0, game: 'critters', title: 'Lily Pad Hop',      min: 2,  max: 10, build: () => sumsTo(10, false) },
    { id: 3,  region: 0, game: 'quick',    title: 'Parrot Cove',       min: 2,  max: 10, build: () => sumsTo(10, false) },
    { id: 4,  region: 0, game: 'match',    title: 'Vine Bridge',       min: 2,  max: 10, build: () => sumsTo(10, false) },
    { id: 5,  region: 1, game: 'quick',    title: 'Twin Falls',        min: 2,  max: 14, build: () => doubles(7) },
    { id: 6,  region: 1, game: 'critters', title: 'Monkey Canopy',     min: 11, max: 15, build: () => makeATen(11, 15) },
    { id: 7,  region: 1, game: 'missing',  title: 'Hidden Grove',      min: 5,  max: 12, build: () => sumsBetween(5, 12) },
    { id: 8,  region: 1, game: 'match',    title: 'Firefly Hollow',    min: 6,  max: 15, build: () => sumsBetween(6, 15) },
    { id: 9,  region: 2, game: 'quick',    title: 'Cloud Ridge',       min: 11, max: 20, build: () => sumsBetween(11, 20) },
    { id: 10, region: 2, game: 'missing',  title: 'Echo Caves',        min: 11, max: 20, build: () => sumsBetween(11, 20) },
    { id: 11, region: 2, game: 'quick',    title: 'Three Peaks',       min: 10, max: 20, build: () => threeAddends(10, 20) },
    { id: 12, region: 2, game: 'match',    title: 'Summit Temple',     min: 10, max: 20, build: () => sumsBetween(10, 20) },

    /* Regions 3 and 4 hold the math ceiling steady and raise difficulty
       structurally instead: tighter distractors, three addends, compound
       equality. `pick`/`stones`/`tight`/`compound` are read by the mechanic
       that owns the stop; `frame` is dramatic dressing over any of them. */
    { id: 13, region: 3, game: 'build',   title: 'Fruit Vault',    min: 8,  max: 15, pick: 2, build: () => sumsBetween(8, 15) },
    { id: 14, region: 3, game: 'route',   title: 'Treasure Trail', min: 8,  max: 15, stones: 3, build: () => sumsBetween(8, 15) },
    { id: 15, region: 3, game: 'balance', title: 'Stone Scales',   min: 10, max: 18, build: () => sumsBetween(10, 18) },
    { id: 16, region: 3, game: 'route',   title: 'Idol Chamber',   min: 10, max: 20, stones: 3, frame: 'rescue', build: () => sumsBetween(10, 20) },
    { id: 17, region: 4, game: 'build',   title: 'Sky Orchard',    min: 12, max: 20, pick: 3, build: () => threeAddends(12, 20) },
    { id: 18, region: 4, game: 'balance', title: 'Twin Scales',    min: 12, max: 20, compound: true, build: () => sumsBetween(12, 20) },
    { id: 19, region: 4, game: 'route',   title: 'Cliff Crossing', min: 12, max: 20, stones: 3, tight: true, build: () => sumsBetween(12, 20) },
    { id: 20, region: 4, game: 'build',   title: 'Storm Summit',   min: 12, max: 20, pick: 3, tight: true, frame: 'rescue', build: () => threeAddends(12, 20) }
  ];

  /* Every distinct game type, in roster order — the All-Rounder badge and the
     profile card both need this without hardcoding a second list. */
  function gameTypes() {
    return STOPS.map(s => s.game).filter((g, i, all) => all.indexOf(g) === i);
  }

  const poolCache = {};

  function stop(id) {
    const found = STOPS.find(s => s.id === id);
    if (!found) throw new Error('unknown stop ' + id);
    return found;
  }

  function poolForStop(id) {
    if (!poolCache[id]) poolCache[id] = stop(id).build();
    return poolCache[id];
  }

  function regionOf(stopId) {
    return REGIONS[stop(stopId).region];
  }

  /* ---- selection --------------------------------------------------------- */

  function factKey(addends) {
    return addends.slice().sort((a, b) => a - b).join('+');
  }

  function sum(addends) {
    return addends.reduce((a, b) => a + b, 0);
  }

  function shuffle(list, rng) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /* Facts he has missed before carry more weight, so they resurface. */
  function weightOf(addends, missCounts) {
    const record = missCounts[factKey(addends)];
    return 1 + 2 * ((record && record.missed) || 0);
  }

  function pickWeighted(candidates, missCounts, rng) {
    const weights = candidates.map(f => weightOf(f, missCounts));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * total;
    for (let i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return i;
    }
    return candidates.length - 1;
  }

  /* Sample without replacement. `isAcceptable` lets match stops demand
     distinct answers so a board never has two cards with the same sum. */
  function sampleFacts(pool, count, missCounts, rng, isAcceptable) {
    const remaining = pool.slice();
    const chosen = [];

    while (chosen.length < count && remaining.length) {
      const eligible = remaining.filter(f => isAcceptable(f, chosen));
      if (!eligible.length) break;
      const picked = eligible[pickWeighted(eligible, missCounts, rng)];
      remaining.splice(remaining.indexOf(picked), 1);
      chosen.push(picked);
    }

    /* Pool too small for a full stop: allow repeats, but never back-to-back. */
    while (chosen.length < count) {
      const last = chosen[chosen.length - 1];
      const eligible = pool.filter(f => !last || factKey(f) !== factKey(last));
      chosen.push(eligible.length
        ? eligible[pickWeighted(eligible, missCounts, rng)]
        : pool[0]);
    }
    return chosen;
  }

  /* Split a total into two addends — the sum a stepping stone or a scale
     weight carries as its label. Never yields a zero, so every label is
     something worth adding. */
  function decompose(total, rng) {
    rng = rng || Math.random;
    if (total < 2) return [total, 0];
    const first = 1 + Math.floor(rng() * (total - 1));
    return [first, total - first];
  }

  /* ---- answer options ---------------------------------------------------- */

  function buildOptions(answer, rng) {
    rng = rng || Math.random;
    const options = [answer];

    for (const offset of DISTRACTOR_OFFSETS) {
      if (options.length === 4) break;
      const candidate = answer + offset;
      if (candidate < 0 || candidate > MAX_OPTION) continue;
      if (options.includes(candidate)) continue;
      options.push(candidate);
    }

    /* Unreachable for answers in 0..25, but never ship a short option list. */
    for (let filler = 0; options.length < 4; filler++) {
      if (!options.includes(filler)) options.push(filler);
    }
    return shuffle(options, rng);
  }

  /* ---- public ------------------------------------------------------------ */

  function generateStop(stopId, missCounts, rng) {
    rng = rng || Math.random;
    missCounts = missCounts || {};
    const config = stop(stopId);

    /* Match boards must not show two cards with the same sum. Route forks read
       their wrong stones off `options`, so distinct targets keep a stop from
       asking for the same total twice in a row. */
    const needsDistinctAnswers = ['match', 'route'].includes(config.game);
    const isAcceptable = needsDistinctAnswers
      ? (fact, chosen) => !chosen.some(c => sum(c) === sum(fact))
      : () => true;

    return sampleFacts(poolForStop(stopId), QUESTIONS_PER_STOP, missCounts, rng, isAcceptable)
      .map(addends => ({
        addends: shuffle(addends, rng),   // presentation order varies, key does not
        answer: sum(addends),
        key: factKey(addends),
        options: buildOptions(sum(addends), rng)
      }));
  }

  return {
    QUESTIONS_PER_STOP,
    REGIONS,
    STOPS,
    stop,
    regionOf,
    poolForStop,
    factKey,
    gameTypes,
    decompose,
    buildOptions,
    generateStop
  };
})();
