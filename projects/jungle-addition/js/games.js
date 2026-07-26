/* games.js — the mini-game renderers, and the session that runs them.
   Four are drawn here; the three newer ones live in their own files and are
   delegated to. Every one of them shares this file's wrong-answer ladder:
   wobble, then hint, then reveal.
   Nothing here reads or writes progress; it reports events and main.js decides. */
window.Games = (function () {
  'use strict';

  const CRITTERS = ['🦜', '🐸', '🐢', '🦋', '🐒', '🐞', '🐠', '🦎', '🐝', '🦆'];

  /* Mechanics that draw themselves. They get told about the problem and report
     back a solve or a miss; the ladder and the pacing stay here. */
  const DELEGATED = { route: 'Route', build: 'Build', balance: 'Balance' };

  const ADVANCE_AFTER_CORRECT = 950;
  const ADVANCE_AFTER_REVEAL = 2100;

  /* One "not this one" per stop. Enough to walk away from a question that has
     gone sour, few enough that it stays a choice rather than a way of skipping
     every sum he does not fancy. */
  const SWAPS_PER_STOP = 1;

  let active = null;   // the running session, or null between levels

  /* ---- session lifecycle --------------------------------------------------- */

  function play(config) {
    stop();
    active = {
      stop: config.stop,
      problems: config.problems,
      host: config.host,
      hooks: config.hooks || {},
      index: 0,
      attempts: 0,
      typed: '',
      stepsDone: 0,
      swapsLeft: SWAPS_PER_STOP,
      resolved: false,     // true between a right answer and the next question
      matched: {},         // match only: pairs already cleared on this board
      timers: []
    };

    document.addEventListener('keydown', onKeyDown);

    if (active.stop.game === 'match') showMatchBoard();
    else if (isDelegated(active.stop.game)) showDelegated();
    else showBubbleQuestion();
  }

  function stop() {
    if (!active) return;
    active.timers.forEach(clearTimeout);
    document.removeEventListener('keydown', onKeyDown);
    active = null;
  }

  function later(fn, delay) {
    if (!active) return;
    active.timers.push(setTimeout(() => { if (active) fn(); }, delay));
  }

  function hook(name) {
    const fn = active && active.hooks[name];
    if (fn) fn.apply(null, Array.prototype.slice.call(arguments, 1));
  }

  /* Every completed question — right or revealed — advances one step. */
  function completeQuestion(problem, missedFirstTry, delay) {
    active.stepsDone += 1;
    active.resolved = true;
    hook('onQuestionDone', problem, missedFirstTry, active.stepsDone);

    const finished = active.stepsDone >= active.problems.length;
    later(() => {
      if (finished) {
        const hooks = active.hooks;
        stop();
        if (hooks.onComplete) hooks.onComplete();
      } else if (active.stop.game === 'match') {
        /* match handles its own board transitions */
        active.resolved = false;
      } else {
        active.index += 1;
        active.attempts = 0;
        if (isDelegated(active.stop.game)) showDelegated();
        else showBubbleQuestion();
      }
    }, delay);
  }

  /* ---- delegated mechanics -------------------------------------------------
     route.js, build.js and balance.js draw their own boards. They receive the
     problem plus two callbacks and know nothing about progress, pacing or the
     hint ladder — so no mechanic can invent its own failure behaviour. */

  function isDelegated(game) {
    return !!DELEGATED[game];
  }

  function showDelegated() {
    const problem = active.problems[active.index];
    window[DELEGATED[active.stop.game]].show({
      host: active.host,
      stop: active.stop,
      problem: problem,
      index: active.index,
      total: active.problems.length,
      solve: () => solveDelegated(problem),
      miss: handlers => missDelegated(problem, handlers),
      /* Mechanics never hold their own timers: leaving the level must cancel
         every pending animation, and only stop() knows when that happens. */
      defer: (fn, delay) => later(fn, delay)
    });
    active.resolved = false;
    hook('onQuestionShown', problem, active.index);
  }

  function solveDelegated(problem) {
    if (!active) return;
    const missedFirstTry = active.attempts > 0;
    Sound.correct();
    Sound.praise();
    hook('onCorrect', problem, null, active.attempts);
    completeQuestion(problem, missedFirstTry, ADVANCE_AFTER_CORRECT);
  }

  /* Same thresholds as rejectBubble: encourage, then hint, then reveal. */
  function missDelegated(problem, handlers) {
    if (!active) return;
    active.attempts += 1;
    Sound.wrong();
    hook('onWrong', problem, null, active.attempts);

    if (active.attempts === 1) { Sound.encourage(); return; }

    if (active.attempts === 2) {
      handlers.hint();
      Sound.speak("Let's count together.");
      hook('onHint', problem);
      return;
    }

    handlers.reveal();
    hook('onReveal', problem);
    completeQuestion(problem, true, ADVANCE_AFTER_REVEAL);
  }

  /* ---- shared prompt pieces ------------------------------------------------ */

  /* What the bubbles are actually asking for. Missing Number asks for the
     hidden addend; every other game asks for the total. */
  function targetOf(problem, game) {
    return game === 'missing' ? problem.answer - problem.addends[0] : problem.answer;
  }

  function dots(count, groupIndex, hollow) {
    let out = '';
    for (let i = 0; i < count; i++) {
      out += `<span class="dot dot-g${groupIndex % 3}${hollow ? ' dot-hollow' : ''}"
                    style="animation-delay:${(i * 0.04).toFixed(2)}s"></span>`;
    }
    return out;
  }

  /* The second-chance hint: the same question, but countable. */
  function hintMarkup(problem, game) {
    if (game === 'missing') {
      const known = problem.addends[0];
      return `<div class="hint-frames">
                <div class="hint-group">
                  <div class="hint-dots">${dots(known, 0)}${dots(problem.answer - known, 1, true)}</div>
                  <div class="hint-num">${known} of ${problem.answer}</div>
                </div>
              </div>
              <div class="hint-tip">Count the empty ones!</div>`;
    }

    const groups = problem.addends.map((n, i) =>
      `<div class="hint-group">
         <div class="hint-dots">${dots(n, i)}</div>
         <div class="hint-num">${n}</div>
       </div>`);
    return `<div class="hint-frames">${groups.join('<div class="hint-plus">+</div>')}</div>
            <div class="hint-tip">Count them all!</div>`;
  }

  function equationMarkup(problem, game, revealed) {
    const parts = problem.addends.join(' <span class="op">+</span> ');

    if (game === 'missing') {
      const known = problem.addends[0];
      const hiddenValue = problem.answer - known;
      const slot = revealed
        ? `<span class="slot filled">${hiddenValue}</span>`
        : '<span class="slot">?</span>';
      return `${known} <span class="op">+</span> ${slot} <span class="op">=</span> ${problem.answer}`;
    }

    const result = revealed
      ? `<span class="slot filled">${problem.answer}</span>`
      : '<span class="slot">?</span>';
    return `${parts} <span class="op">=</span> ${result}`;
  }

  function crittersMarkup(problem, seedIndex) {
    const animal = CRITTERS[(seedIndex * 3 + problem.answer) % CRITTERS.length];
    let delay = 0;

    const groups = problem.addends.map((n, groupIndex) => {
      let critters = '';
      for (let i = 0; i < n; i++) {
        critters += `<span class="critter" style="animation-delay:${(delay += 0.07).toFixed(2)}s">${animal}</span>`;
      }
      return `<div class="critter-group group-${groupIndex}">${critters}</div>`;
    });

    return `<div class="critter-stage">${groups.join('<div class="critter-plus">+</div>')}</div>`;
  }

  /* ---- bubble games: Count the Critters, Quick Answer, Missing Number ------ */

  function showBubbleQuestion() {
    const problem = active.problems[active.index];
    const game = active.stop.game;
    active.typed = '';
    active.resolved = false;
    active.target = targetOf(problem, game);

    /* facts.js builds options around the total, which is the wrong quantity
       for Missing Number — rebuild them around the hidden addend. */
    const options = Verify.fixChoices(
      game === 'missing' ? Facts.buildOptions(active.target) : problem.options,
      active.target);

    Verify.report(`stop ${active.stop.id} question ${active.index + 1}`,
      Verify.question(problem, game).concat(Verify.choices(options, active.target)));

    active.host.innerHTML = `
      <div class="prompt">
        ${game === 'critters' ? crittersMarkup(problem, active.index) : ''}
        <div class="equation">${equationMarkup(problem, game, false)}</div>
        <div class="hint-area" hidden></div>
      </div>
      <div class="bubbles">
        ${options.map(value =>
          `<button class="bubble" type="button" data-value="${value}">${value}</button>`).join('')}
      </div>
      <div class="typed" hidden></div>`;

    active.host.querySelectorAll('.bubble').forEach(button => {
      button.addEventListener('click', () => chooseBubble(button, problem));
    });

    hook('onQuestionShown', problem, active.index);
    Sound.speakProblem(problem, game);
  }

  function chooseBubble(button, problem) {
    if (!active || button.disabled) return;

    if (Number(button.dataset.value) === active.target) {
      acceptBubble(button, problem);
    } else {
      rejectBubble(button, problem);
    }
  }

  function acceptBubble(button, problem) {
    const missedFirstTry = active.attempts > 0;

    active.host.querySelectorAll('.bubble').forEach(b => { b.disabled = true; });
    button.classList.add('correct');
    active.host.querySelector('.equation').innerHTML =
      equationMarkup(problem, active.stop.game, true);

    Sound.correct();
    Sound.praise();
    Celebrate.leafPuff(button);

    hook('onCorrect', problem, button, active.attempts);
    completeQuestion(problem, missedFirstTry, ADVANCE_AFTER_CORRECT);
  }

  function rejectBubble(button, problem) {
    active.attempts += 1;
    button.disabled = true;
    button.classList.add('spent');
    Celebrate.pulse(button, 'wobble', 500);
    Sound.wrong();

    hook('onWrong', problem, button, active.attempts);

    if (active.attempts === 1) {
      Sound.encourage();
      return;
    }
    if (active.attempts === 2) {
      showHint(problem);
      return;
    }
    revealAnswer(problem);
  }

  function showHint(problem) {
    const area = active.host.querySelector('.hint-area');
    if (!area) return;
    area.innerHTML = hintMarkup(problem, active.stop.game);
    area.hidden = false;
    Sound.speak("Let's count together.");
    hook('onHint', problem);
  }

  function revealAnswer(problem) {
    const game = active.stop.game;
    active.host.querySelectorAll('.bubble').forEach(b => {
      b.disabled = true;
      if (Number(b.dataset.value) === active.target) b.classList.add('revealed');
    });
    active.host.querySelector('.equation').innerHTML = equationMarkup(problem, game, true);

    const area = active.host.querySelector('.hint-area');
    if (area && area.hidden) { area.innerHTML = hintMarkup(problem, game); area.hidden = false; }

    Sound.speak(`It's ${active.target}! Let's remember that one.`);
    hook('onReveal', problem);
    completeQuestion(problem, true, ADVANCE_AFTER_REVEAL);
  }

  /* ---- Match the Sum -------------------------------------------------------- */

  /* Six pairs delivered as two boards of three, so each board stays readable. */
  function showMatchBoard() {
    const boardIndex = Math.floor(active.stepsDone / 3);
    const pairs = active.problems.slice(boardIndex * 3, boardIndex * 3 + 3);

    active.matchAttempts = {};
    active.selected = null;
    active.resolved = false;

    Verify.report(`stop ${active.stop.id} match board ${boardIndex + 1}`,
      Verify.matchBoard(pairs));

    const expressions = shuffled(pairs.map((p, i) => ({ pair: p, id: `${boardIndex}-${i}` })));
    const results = shuffled(pairs.map((p, i) => ({ pair: p, id: `${boardIndex}-${i}` })));

    active.host.innerHTML = `
      <div class="match-title">Match each sum to its answer</div>
      <div class="match-board">
        <div class="match-col">
          ${expressions.map(item =>
            cardMarkup(item, 'expr', item.pair.addends.join(' + '))).join('')}
        </div>
        <div class="match-col">
          ${results.map(item =>
            cardMarkup(item, 'result', item.pair.answer)).join('')}
        </div>
      </div>`;

    active.host.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => chooseCard(card));
    });

    Sound.speak('Match the sums!');
    hook('onQuestionShown', pairs[0], active.index);
  }

  /* A swap redraws the board mid-play, so pairs already cleared have to come
     back cleared — losing them would hand back progress he has already made. */
  function cardMarkup(item, kind, face) {
    const done = active.matched[item.id];
    return `
      <button class="card card-${kind}${done ? ' matched' : ''}" type="button"
              data-id="${item.id}" data-kind="${kind}"${done ? ' disabled' : ''}>
        ${face}
      </button>`;
  }

  function shuffled(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function chooseCard(card) {
    if (!active || card.disabled || card.classList.contains('matched')) return;

    const previous = active.selected;

    /* Nothing selected, or re-picking the same side: just move the selection. */
    if (!previous || previous.dataset.kind === card.dataset.kind) {
      if (previous) previous.classList.remove('selected');
      if (previous === card) { active.selected = null; return; }
      card.classList.add('selected');
      active.selected = card;
      Sound.pop();
      return;
    }

    const expression = previous.dataset.kind === 'expr' ? previous : card;
    const result = previous.dataset.kind === 'result' ? previous : card;
    active.selected = null;
    previous.classList.remove('selected');

    if (expression.dataset.id === result.dataset.id) {
      acceptMatch(expression, result);
    } else {
      rejectMatch(expression, result);
    }
  }

  function acceptMatch(expression, result) {
    const problem = problemForCardId(expression.dataset.id);
    const missedFirstTry = (active.matchAttempts[expression.dataset.id] || 0) > 0;

    [expression, result].forEach(card => {
      card.classList.remove('selected', 'hint-glow');
      card.classList.add('matched');
      card.disabled = true;
    });
    active.matched[expression.dataset.id] = true;

    Sound.correct();
    Sound.praise();
    Celebrate.leafPuff(result);
    hook('onCorrect', problem, result, active.matchAttempts[expression.dataset.id] || 0);

    const boardBefore = Math.floor(active.stepsDone / 3);
    completeQuestion(problem, missedFirstTry, 700);

    /* Board finished but level continuing: deal the next three pairs. */
    const boardAfter = Math.floor(active.stepsDone / 3);
    if (boardAfter !== boardBefore && active.stepsDone < active.problems.length) {
      later(showMatchBoard, 800);
    }
  }

  function rejectMatch(expression, result) {
    const id = expression.dataset.id;
    active.matchAttempts[id] = (active.matchAttempts[id] || 0) + 1;
    const attempts = active.matchAttempts[id];
    const problem = problemForCardId(id);

    Celebrate.pulse(expression, 'wobble', 500);
    Celebrate.pulse(result, 'wobble', 500);
    Sound.wrong();
    hook('onWrong', problem, result, attempts);

    if (attempts === 1) {
      Sound.encourage();
      return;
    }
    if (attempts === 2) {
      const correctResult = active.host.querySelector(`.card-result[data-id="${id}"]`);
      if (correctResult) correctResult.classList.add('hint-glow');
      Sound.speak('This one goes together.');
      return;
    }

    /* Third miss: snap the pair together so he never gets stuck on a board. */
    const correctResult = active.host.querySelector(`.card-result[data-id="${id}"]`);
    if (correctResult) {
      Sound.speak(`${problem.addends.join(' plus ')} makes ${problem.answer}.`);
      later(() => acceptMatch(expression, correctResult), 700);
    }
  }

  function problemForCardId(id) {
    const [boardIndex, pairIndex] = id.split('-').map(Number);
    return active.problems[boardIndex * 3 + pairIndex];
  }

  /* ---- keyboard (laptop convenience) ---------------------------------------- */

  function onKeyDown(event) {
    if (!active || active.stop.game === 'match' || isDelegated(active.stop.game)) return;
    const display = active.host.querySelector('.typed');
    if (!display) return;

    if (/^[0-9]$/.test(event.key)) {
      active.typed = (active.typed + event.key).slice(-2);
    } else if (event.key === 'Backspace') {
      active.typed = active.typed.slice(0, -1);
    } else if (event.key === 'Escape') {
      active.typed = '';
    } else if (event.key === 'Enter') {
      submitTyped();
      return;
    } else {
      return;
    }

    event.preventDefault();
    display.textContent = active.typed ? `${active.typed} ⏎` : '';
    display.hidden = !active.typed;
  }

  function submitTyped() {
    if (!active.typed) return;
    const target = active.host.querySelector(`.bubble[data-value="${Number(active.typed)}"]`);
    active.typed = '';
    const display = active.host.querySelector('.typed');
    if (display) { display.textContent = ''; display.hidden = true; }

    if (target && !target.disabled) {
      chooseBubble(target, active.problems[active.index]);
    }
  }

  /* ---- swapping a question -------------------------------------------------
     "I do not want this one" is a fair thing for a five-year-old to feel, and
     letting him act on it beats letting him stall. The swap costs nothing —
     no step, no mistake, no score — it simply deals a different sum. */

  function swapsLeft() {
    return active ? active.swapsLeft : 0;
  }

  function canSwap() {
    return !!active && active.swapsLeft > 0 && !active.resolved;
  }

  function swapQuestion() {
    if (!canSwap()) return false;

    active.swapsLeft -= 1;
    active.attempts = 0;

    if (active.stop.game === 'match') {
      swapMatchBoard();
    } else {
      active.problems[active.index] = replacementFor(active.index);
      if (isDelegated(active.stop.game)) showDelegated();
      else showBubbleQuestion();
    }

    Sound.pop();
    hook('onSwap', swapsLeft());
    return true;
  }

  /* Fresh, and still obeying the rules the stop was dealt under: no fact he has
     already met here, and — where the mechanic needs unique totals — no sum
     that clashes with the questions still on the board. */
  function replacementFor(index) {
    const distinct = Facts.needsDistinctAnswers(active.stop.game);
    return Facts.replacement(active.stop.id, {
      keys: active.problems.map(p => p.key),
      answers: distinct
        ? active.problems.filter((p, i) => i !== index).map(p => p.answer)
        : []
    });
  }

  /* On a match board the question is the whole board, so what changes is every
     pair still on the table; the ones already matched stay matched. */
  function swapMatchBoard() {
    const boardIndex = Math.floor(active.stepsDone / 3);

    for (let slot = 0; slot < 3; slot++) {
      const index = boardIndex * 3 + slot;
      if (index >= active.problems.length) break;
      if (active.matched[`${boardIndex}-${slot}`]) continue;
      active.problems[index] = replacementFor(index);
    }
    showMatchBoard();
  }

  return { play, stop, swapQuestion, swapsLeft };
})();
