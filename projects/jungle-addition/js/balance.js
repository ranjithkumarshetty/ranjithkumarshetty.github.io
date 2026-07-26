/* balance.js — Balance the Scale.
   One pan holds a sum; he picks the single weight that makes both sides equal.
   He sees the answer as a physical imbalance rather than a blank in an equation
   — and on a `compound` stop the other pan starts part-loaded, so both sides
   are sums and he has to add twice before he can compare.

   Draws and reports. games.js owns the wrong-answer ladder. */
window.Balance = (function () {
  'use strict';

  const WEIGHT_COUNT = 6;
  const MAX_TILT = 18;        // degrees — enough to read, never enough to spill
  const BOUNCE_MS = 650;      // how long a wrong weight sits on the pan

  function show(api) {
    const { host, stop, problem, index, total } = api;
    /* A plain stop weighs the whole sum against one stone: the left pan holds
       the addends, the right pan is empty, so finding the weight *is* the
       addition. A `compound` stop starts the right pan part-loaded, so both
       sides are sums and he has to add twice before he can compare. */
    const preload = stop.compound ? preloadFor(problem) : 0;
    const needed = problem.answer - preload;
    const leftFace = problem.addends.join(' + ');
    const spoken = problem.addends.join(' plus ');
    const rightFace = preload
      ? `${preload} + <em class="pan-slot">?</em>`
      : '<em class="pan-slot">?</em>';
    const solution = preload
      ? `${leftFace} = ${preload} + ${needed}`
      : `${leftFace} = ${needed}`;

    /* On a compound stop the fact he actually reads and solves is the right
       pan, not the left, so that is the one worth recording against him. */
    if (preload) problem.key = Facts.factKey([preload, needed]);

    host.innerHTML = `
      <section class="balance" data-target="${problem.answer}"
               data-preload="${preload}" data-needed="${needed}"
               data-solution="${solution}">
        <div class="scale" style="--tilt:0deg">
          <div class="beam">
            <div class="pan pan-left">
              <span class="pan-load">${leftFace}</span>
            </div>
            <div class="pan pan-right">
              <span class="pan-load">${rightFace}</span>
            </div>
          </div>
          <div class="scale-post"></div>
        </div>
        <p class="balance-ask">Make both sides the same. Step ${index + 1} of ${total}</p>
        <div class="weight-row">
          ${weightsFor(problem, needed).map(weightMarkup).join('')}
        </div>
        <div class="hint-area balance-hint" hidden></div>
      </section>`;

    tilt(host, preload - problem.answer);
    Sound.speak(preload
      ? `Which weight makes ${spoken} equal ${preload} plus something?`
      : `Which weight balances ${spoken}?`);

    host.querySelectorAll('.weight').forEach(weight => {
      weight.addEventListener('click', () => tap(api, host, weight));
    });
  }

  function weightMarkup(value) {
    return `
      <button class="weight" type="button" data-value="${value}"
              aria-label="Weight of ${value}">
        <span class="weight-face">🪨</span>
        <span class="weight-value">${value}</span>
      </button>`;
  }

  function tap(api, host, weight) {
    if (weight.disabled) return;
    const board = host.querySelector('.balance');
    const preload = Number(board.dataset.preload);
    const value = Number(weight.dataset.value);
    const slot = host.querySelector('.pan-slot');

    slot.textContent = String(value);

    if (value === Number(board.dataset.needed)) {
      host.querySelectorAll('.weight').forEach(other => { other.disabled = true; });
      weight.classList.add('landed');
      board.classList.add('balanced');
      tilt(host, 0);
      Celebrate.leafPuff(host.querySelector('.pan-right'));
      api.solve();
      return;
    }

    weight.disabled = true;
    weight.classList.add('spent');
    tilt(host, preload + value - api.problem.answer);
    Celebrate.pulse(host.querySelector('.scale'), 'wobble', 500);

    /* Let the wrong weight sit long enough to see the beam swing, then take it
       back off so the pan reads as a question again. Deferred through the api
       so leaving the level cancels it — games.js owns every timer. */
    api.defer(() => {
      if (!host.querySelector('.pan-slot') || board.classList.contains('balanced')) return;
      slot.textContent = '?';
      tilt(host, preload - api.problem.answer);
    }, BOUNCE_MS);

    api.miss({
      hint: () => showGap(host, api.problem, preload),
      reveal: () => revealWeight(host)
    });
  }

  /* Positive difference tips right, negative tips left. Level pops the beam so
     "equal" has its own visible moment. */
  function tilt(host, difference) {
    const scale = host.querySelector('.scale');
    if (!scale) return;
    const degrees = Math.max(-MAX_TILT, Math.min(MAX_TILT, difference * 3));
    scale.style.setProperty('--tilt', `${degrees}deg`);
    if (difference === 0) Celebrate.pulse(scale, 'scale-pop', 700);
  }

  /* Second miss: both sides as countable dots. The answer is how many dots the
     right row is short — he still has to work it out, but now he can count it. */
  function showGap(host, problem, preload) {
    const area = host.querySelector('.balance-hint');
    area.hidden = false;
    area.innerHTML = `
      <div class="gap-row">${dots(problem.answer, 0)}</div>
      <div class="gap-row">${dots(preload, 1)}${dots(problem.answer - preload, 1, true)}</div>`;
  }

  function dots(count, group, hollow) {
    return Array.from({ length: Math.max(0, count) },
      () => `<span class="dot dot-g${group} ${hollow ? 'dot-hollow' : ''}"></span>`).join('');
  }

  function revealWeight(host) {
    host.querySelectorAll('.weight').forEach(w => { w.disabled = true; });
    const board = host.querySelector('.balance');
    const needed = Number(board.dataset.needed);
    const right = host.querySelector(`.weight[data-value="${needed}"]`);
    if (right) {
      right.classList.remove('spent');
      right.classList.add('landed', 'revealed');
    }
    host.querySelector('.pan-slot').textContent = String(needed);
    board.classList.add('balanced');
    tilt(host, 0);
    host.querySelector('.balance-ask').textContent = board.dataset.solution;
  }

  /* Compound stops only — the weight already sitting on the right pan. Roughly
     half the target, nudged by the problem so the split does not always read
     the same. Kept strictly inside 1..answer-1 so the sought weight is always a
     real addend. */
  function preloadFor(problem) {
    const half = Math.floor(problem.answer / 2);
    const nudge = (problem.addends[0] % 3) - 1;
    return Math.min(problem.answer - 2, Math.max(2, half + nudge));
  }

  /* Six weights closing in on the answer from both sides, so the row cannot be
     solved by picking the biggest or the smallest stone. */
  function weightsFor(problem, needed) {
    const values = [needed];
    for (let gap = 1; values.length < WEIGHT_COUNT; gap++) {
      [needed - gap, needed + gap].forEach(v => {
        if (v >= 1 && v <= 20 && values.indexOf(v) === -1 && values.length < WEIGHT_COUNT) {
          values.push(v);
        }
      });
    }
    return shuffle(values);
  }

  function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  return { show, preloadFor, weightsFor };
})();
