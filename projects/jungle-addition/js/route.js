/* route.js — Treasure Route.
   A fork in the trail: three stepping stones, each labelled with a small sum.
   Only the stone whose sum matches the signpost reaches the chest. Same maths as
   a quick-answer bubble, but he has to add the stone before he can compare it,
   so the answer cannot be spotted without doing the work.

   Draws and reports. games.js owns the wrong-answer ladder. */
window.Route = (function () {
  'use strict';

  const STONE_EMOJI = '🪨';

  function show(api) {
    const { host, stop, problem, index, total } = api;
    const target = problem.answer;
    const stones = stonesFor(stop, problem);

    Verify.report(`stop ${stop.id} route fork`, Verify.routeStones(stones, target));

    host.innerHTML = `
      <section class="route" data-target="${target}">
        <div class="route-sign">
          <span class="sign-post">🪧</span>
          <span class="sign-text">Cross to <strong>${target}</strong></span>
        </div>
        <div class="route-stones">
          ${stones.map(stone => stoneMarkup(stone, target)).join('')}
        </div>
        <div class="route-chest">
          <span class="chest">🧰</span>
          <span class="chest-hint">Step ${index + 1} of ${total}</span>
        </div>
        <div class="hint-area route-hint" hidden></div>
      </section>`;

    Sound.speak(`Which stones add up to ${target}?`);

    host.querySelectorAll('.stone').forEach(stone => {
      stone.addEventListener('click', () => tap(api, host, stone));
    });
  }

  /* The fork as data: each stone is a value and the split printed on it. The
     winning stone is given the problem's own split rather than a fresh one, so
     the fact he practises here is the fact recorded against him. */
  function stonesFor(stop, problem) {
    const target = problem.answer;
    const stones = [{ value: target, addends: problem.addends }].concat(
      distractorsFor(stop, problem).map(value => ({
        value: value,
        addends: Facts.decompose(value)
      })));
    return shuffle(stones);
  }

  /* Every stone shows its two addends, so reading it is the addition. */
  function stoneMarkup(stone, target) {
    const parts = stone.addends;
    return `
      <button class="stone" type="button" data-value="${stone.value}"
              data-correct="${stone.value === target}"
              aria-label="${parts.join(' plus ')}">
        <span class="stone-face">${STONE_EMOJI}</span>
        <span class="stone-expr">${parts.join(' + ')}</span>
      </button>`;
  }

  function tap(api, host, stone) {
    if (stone.disabled) return;

    if (stone.dataset.correct === 'true') {
      host.querySelectorAll('.stone').forEach(other => { other.disabled = true; });
      stone.classList.add('stone-landed');
      host.querySelector('.route-chest').classList.add('chest-open');
      host.querySelector('.chest').textContent = '💎';
      Celebrate.leafPuff(stone);
      api.solve();
      return;
    }

    stone.disabled = true;
    stone.classList.add('stone-sunk');
    Celebrate.pulse(stone, 'wobble', 500);
    api.miss({
      hint: () => showCounters(host, api.problem.answer),
      reveal: () => revealCorrect(host)
    });
  }

  /* Second miss: the target as countable dots, the same hint every other
     mechanic gives. */
  function showCounters(host, target) {
    const area = host.querySelector('.route-hint');
    area.hidden = false;
    area.innerHTML = Array.from({ length: target },
      (unused, i) => `<span class="dot dot-g${i % 3}"></span>`).join('');
  }

  function revealCorrect(host) {
    host.querySelectorAll('.stone').forEach(stone => { stone.disabled = true; });
    const right = host.querySelector('.stone[data-correct="true"]');
    if (right) {
      right.classList.add('stone-landed', 'revealed');
      right.classList.remove('stone-sunk');
    }
  }

  /* Wrong stones are the problem's own distractors — never the answer itself,
     which would put a second correct stone on the fork. Anything below 2 is
     dropped because it could not be split into two real addends.

     `options` always arrives clustered within two of the answer, so without a
     floor on the gap every fork would be equally tight and the roster's
     difficulty ramp would do nothing. A `tight` stop takes the nearest values
     it can find; an ordinary one refuses anything within one of the answer. */
  function distractorsFor(stop, problem) {
    const answer = problem.answer;
    const wanted = Math.max(1, (stop.stones || 3) - 1);
    const minGap = stop.tight ? 1 : 2;
    const usable = problem.options
      .filter(v => v !== answer && v >= 2 && Math.abs(v - answer) >= minGap)
      .sort((a, b) => Math.abs(a - answer) - Math.abs(b - answer));
    const chosen = (stop.tight ? usable : usable.reverse()).slice(0, wanted);

    /* Top up when `options` ran short at this gap floor, widening outwards so
       the fork keeps the width the roster asked for. */
    for (let gap = minGap; chosen.length < wanted && gap <= 20; gap++) {
      [answer - gap, answer + gap].forEach(v => {
        if (v >= 2 && v !== answer && chosen.indexOf(v) === -1 && chosen.length < wanted) {
          chosen.push(v);
        }
      });
    }
    return chosen;
  }

  function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  return { show, stonesFor, distractorsFor };
})();
