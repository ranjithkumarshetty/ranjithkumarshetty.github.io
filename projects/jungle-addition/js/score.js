/* score.js — points for a question, as pure arithmetic.
   Three optional rules, all off-by-default except the bonus, because the game's
   promise is that trying again is free. Even with every rule switched on a
   question can never score less than MIN_POINTS, and the running total never
   goes down: scoring is a flourish on top of progress, never a punishment. */
window.Score = (function () {
  'use strict';

  const BASE = 10;
  const MIN_POINTS = 1;
  const MISTAKE_COST = 4;

  /* Answer inside this many seconds, take the bonus beside it. */
  const SPEED_TIERS = [
    { withinMs: 3000,  points: 8, label: 'Lightning fast' },
    { withinMs: 6000,  points: 4, label: 'Quick thinking' },
    { withinMs: 10000, points: 2, label: 'Good pace' }
  ];

  const BIG_ANSWER_BONUS = 3;
  const THREE_ADDEND_BONUS = 3;
  const TRICKY_STOP_BONUS = 2;
  const PERFECT_STOP_BONUS = 25;

  const DEFAULT_RULES = { speed: false, mistakes: false, bonus: true };

  function rulesFrom(settings) {
    const from = settings || {};
    return {
      speed: !!from.speed,
      mistakes: !!from.mistakes,
      bonus: from.bonus !== false
    };
  }

  /* `outcome` is { attempts, elapsedMs } as the game recorded it: attempts counts
     every try including the right one, elapsedMs is time on this question alone.
     Returns the total and the parts that made it, so the popup can say why. */
  function forQuestion(problem, config, outcome, rules) {
    const active = rules || DEFAULT_RULES;
    const tries = Math.max(1, (outcome && outcome.attempts) || 1);
    const parts = [{ label: 'Correct', points: BASE }];

    if (active.speed && tries === 1) {
      const tier = speedTier((outcome && outcome.elapsedMs) || Infinity);
      if (tier) parts.push({ label: tier.label, points: tier.points });
    }

    if (active.bonus) {
      hardBonuses(problem, config).forEach(part => parts.push(part));
    }

    if (active.mistakes && tries > 1) {
      parts.push({ label: 'Mistakes', points: -MISTAKE_COST * (tries - 1) });
    }

    const total = parts.reduce((sum, part) => sum + part.points, 0);
    return { points: Math.max(MIN_POINTS, total), parts };
  }

  /* A clean sweep of a stop is the one thing worth a lump sum: it is the only
     score the child can chase without being rushed or penalised. */
  function stopBonus(perfect, rules) {
    const active = rules || DEFAULT_RULES;
    return (active.bonus && perfect) ? PERFECT_STOP_BONUS : 0;
  }

  /* One line for the share card and the settings summary. */
  function describe(rules) {
    const active = rules || DEFAULT_RULES;
    const on = [];
    if (active.speed) on.push('speed bonus');
    if (active.mistakes) on.push('mistakes count');
    if (active.bonus) on.push('hard-question bonus');
    return on.length ? on.join(', ') : 'relaxed scoring';
  }

  function speedTier(elapsedMs) {
    return SPEED_TIERS.find(tier => elapsedMs <= tier.withinMs) || null;
  }

  /* The roster already knows which questions are the hard ones — read that
     judgement back out rather than inventing a second definition of hard. */
  function hardBonuses(problem, config) {
    const parts = [];
    if (!problem) return parts;
    if (problem.answer > 10) parts.push({ label: 'Big answer', points: BIG_ANSWER_BONUS });
    if (problem.addends && problem.addends.length > 2) {
      parts.push({ label: 'Three numbers', points: THREE_ADDEND_BONUS });
    }
    if (config && (config.tight || config.compound)) {
      parts.push({ label: 'Tricky stop', points: TRICKY_STOP_BONUS });
    }
    return parts;
  }

  return { BASE, MIN_POINTS, DEFAULT_RULES, rulesFrom, forQuestion, stopBonus, describe };
})();
