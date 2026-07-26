/* verify.js — the maths referee.
   Every board is checked here before it is drawn. The generators are small and
   the roster is hand-written, so the failure worth guarding against is not a
   crash: it is a question quietly going up with no right answer on it, or with
   two. A five-year-old cannot tell the difference between "this is hard" and
   "this is broken", so the game has to.

   Pure functions, no DOM and no state, so the whole file runs in the suite. */
window.Verify = (function () {
  'use strict';

  const MAX_TOTAL = 20;        // the number line this game lives on

  /* ---- the checks ---------------------------------------------------------- */

  /* The question itself: does the arithmetic hold, and is the thing we are about
     to ask for a number he could actually give? */
  function question(problem, game) {
    const addends = problem && problem.addends;
    if (!Array.isArray(addends) || addends.length < 2) return ['no addends'];

    const faults = [];
    if (!addends.every(isCount)) faults.push('addends are not whole counts: ' + addends.join(','));
    if (total(addends) !== problem.answer) {
      faults.push(`${addends.join('+')} makes ${total(addends)}, not ${problem.answer}`);
    }
    if (problem.answer > MAX_TOTAL) faults.push(`answer ${problem.answer} is off the number line`);

    /* Missing Number shows the first addend, a blank and the total. A third
       addend would vanish from the equation while still counting towards the
       sum, leaving a question whose answer is not the one on the buttons. */
    if (game === 'missing' && addends.length !== 2) {
      faults.push(`missing-number question has ${addends.length} addends`);
    }
    return faults;
  }

  /* Whatever the board, the answer has to be on it exactly once. */
  function choices(values, target) {
    if (!Array.isArray(values) || !values.length) return ['no choices'];

    const faults = [];
    if (!values.every(isCount)) faults.push('choices are not whole counts: ' + values.join(','));

    const hits = values.filter(value => value === target).length;
    if (hits !== 1) faults.push(`${hits} of ${values.length} choices equal ${target}`);

    const repeats = repeated(values);
    if (repeats.length) faults.push('repeated choice: ' + repeats.join(','));
    return faults;
  }

  /* The one repair worth making automatically. A choice list that has lost its
     answer is the single failure a child cannot work around — every other flaw
     leaves the question solvable — so it is rebuilt rather than shown. Sound
     lists are returned untouched, keeping their shuffled order. */
  function fixChoices(values, target) {
    if (!choices(values, target).length) return values;

    const wanted = Array.isArray(values) && values.length ? values.length : 4;
    const others = [];
    (Array.isArray(values) ? values : []).forEach(value => {
      if (isCount(value) && value !== target && others.indexOf(value) === -1) others.push(value);
    });
    for (let filler = 0; others.length < wanted - 1; filler++) {
      if (filler !== target && others.indexOf(filler) === -1) others.push(filler);
    }

    /* Slotted by the answer rather than pushed to the front, so a repaired
       board does not advertise itself by always holding the answer first. */
    const fixed = others.slice(0, wanted - 1);
    fixed.splice(target % wanted, 0, target);
    return fixed;
  }

  /* Treasure Route stones carry their own sum, so each label has to be true as
     well as the fork having exactly one stone that crosses. */
  function routeStones(stones, target) {
    const faults = choices(stones.map(stone => stone.value), target);
    stones.forEach(stone => {
      if (!Array.isArray(stone.addends) || stone.addends.length < 2
          || !stone.addends.every(isCount)) {
        faults.push(`stone ${stone.value} has no readable sum`);
      } else if (total(stone.addends) !== stone.value) {
        faults.push(`stone ${stone.addends.join('+')} is labelled ${stone.value}`);
      }
    });
    return faults;
  }

  /* Build the Sum has no list of answers to check — the basket is fillable or it
     is not. Repeated fruit is fine and expected (a double needs two of them);
     what matters is that some handful of the right size makes the total, and
     that no single fruit is already it. */
  function buildTree(values, answer, pick) {
    const faults = [];
    if (!Array.isArray(values) || !values.length) return ['no fruit'];
    if (!values.every(isCount)) faults.push('fruit are not whole counts: ' + values.join(','));
    if (values.some(value => value < 1)) faults.push('a fruit is worth nothing');

    const tooBig = values.filter(value => value >= answer);
    if (tooBig.length) faults.push(`fruit ${tooBig.join(',')} already reach ${answer}`);
    if (!subsetExists(values, pick, answer)) {
      faults.push(`no ${pick} of ${values.join(',')} make ${answer}`);
    }
    return faults;
  }

  /* Both sides of the scale have to be able to meet: the missing weight must be
     a real one, and it must be in the row. */
  function balanceRow(values, needed, preload, answer) {
    const faults = choices(values, needed);
    if (preload + needed !== answer) {
      faults.push(`${preload} + ${needed} makes ${preload + needed}, not ${answer}`);
    }
    if (needed < 1) faults.push('nothing left to add to the pan');
    if (preload < 0) faults.push(`negative preload ${preload}`);
    return faults;
  }

  /* Two cards showing the same total would make one of the pairings arbitrary,
     and a board can only be finished if every pairing is forced. */
  function matchBoard(pairs) {
    const faults = [];
    pairs.forEach(pair => { push(faults, question(pair, 'match')); });

    const repeats = repeated(pairs.map(pair => pair.answer));
    if (repeats.length) faults.push('two sums on this board both make ' + repeats.join(','));
    return faults;
  }

  /* ---- reporting ----------------------------------------------------------- */

  /* None of this should ever fire. When it does the grown-up sees it, because a
     banner is easier to explain than a sum that will not come out. */
  function report(where, faults) {
    if (!faults.length) return true;
    const message = `maths check failed at ${where}: ${faults.join('; ')}`;
    if (typeof console !== 'undefined' && console.warn) console.warn(message);
    if (window.reportProblem) window.reportProblem(message);
    return false;
  }

  /* ---- helpers ------------------------------------------------------------- */

  function isCount(value) {
    return typeof value === 'number' && isFinite(value) && value >= 0 && value % 1 === 0;
  }

  function total(list) {
    return list.reduce((running, n) => running + n, 0);
  }

  function repeated(list) {
    return list.filter((value, i) => list.indexOf(value) !== i);
  }

  function push(faults, more) {
    more.forEach(fault => faults.push(fault));
  }

  /* Boards are six values and picks are two or three, so the plain recursive
     search is both the clearest way to say it and fast enough. */
  function subsetExists(values, size, wanted) {
    if (size === 0) return wanted === 0;
    if (size > values.length) return false;
    return values.some((value, i) => subsetExists(values.slice(i + 1), size - 1, wanted - value));
  }

  return {
    question, choices, fixChoices,
    routeStones, buildTree, balanceRow, matchBoard,
    subsetExists, report
  };
})();
