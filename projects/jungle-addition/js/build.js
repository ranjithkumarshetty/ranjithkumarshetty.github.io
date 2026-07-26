/* build.js — Build the Sum.
   A tree of numbered fruit and a target. He picks the two (or three) fruit that
   add up to it. The other games hand him the answer and ask which one is right;
   this one makes him assemble the answer, which is the harder direction.

   Draws and reports. games.js owns the wrong-answer ladder. */
window.Build = (function () {
  'use strict';

  const TREE_SIZE = 6;
  const FRUIT = ['🍎', '🍌', '🥭', '🍐', '🍊', '🥥'];

  let picked = [];

  function show(api) {
    const { host, stop, problem, index, total } = api;
    const pick = stop.pick || 2;
    const values = treeFor(stop, problem);
    picked = [];

    host.innerHTML = `
      <section class="build" data-target="${problem.answer}" data-pick="${pick}">
        <div class="build-goal">
          <span class="goal-label">Fill the basket with ${pick}</span>
          <strong class="goal-total">${problem.answer}</strong>
        </div>
        <div class="build-tree">
          ${values.map((value, slot) => fruitMarkup(value, slot)).join('')}
        </div>
        <div class="build-basket">
          <span class="basket">🧺</span>
          <span class="basket-line">Make ${problem.answer}</span>
          <span class="basket-step">Step ${index + 1} of ${total}</span>
        </div>
        <div class="hint-area build-hint" hidden></div>
      </section>`;

    Sound.speak(`Pick ${pick} fruit that add up to ${problem.answer}.`);

    host.querySelectorAll('.fruit').forEach(fruit => {
      fruit.addEventListener('click', () => tap(api, host, fruit));
    });
  }

  function fruitMarkup(value, slot) {
    return `
      <button class="fruit" type="button" data-value="${value}" data-slot="${slot}"
              aria-label="Fruit worth ${value}">
        <span class="fruit-face">${FRUIT[slot % FRUIT.length]}</span>
        <span class="fruit-value">${value}</span>
      </button>`;
  }

  function tap(api, host, fruit) {
    if (fruit.disabled) return;
    const pick = api.stop.pick || 2;
    const slot = fruit.dataset.slot;

    /* Re-tapping returns the fruit to the tree. Changing your mind is not a
       mistake, so it never costs an attempt. */
    if (picked.some(p => p.slot === slot)) {
      picked = picked.filter(p => p.slot !== slot);
      fruit.classList.remove('picked');
      Sound.pop();
      updateBasket(host, api.problem.answer);
      return;
    }

    if (picked.length >= pick) return;
    picked.push({ slot, value: Number(fruit.dataset.value) });
    fruit.classList.add('picked');
    Sound.pop();
    updateBasket(host, api.problem.answer);

    if (picked.length < pick) return;

    const total = picked.reduce((sum, p) => sum + p.value, 0);
    if (total === api.problem.answer) {
      host.querySelectorAll('.fruit').forEach(other => { other.disabled = true; });
      host.querySelector('.build-basket').classList.add('basket-full');
      picked.forEach(p => host.querySelector(`.fruit[data-slot="${p.slot}"]`).classList.add('landed'));
      Celebrate.leafPuff(host.querySelector('.build-basket'));
      api.solve();
      return;
    }

    /* Empty the basket before reporting: a reveal repaints the picks, and doing
       it the other way round would immediately wipe them. */
    const basket = host.querySelector('.build-basket');
    returnAll(host, api.problem.answer);
    Celebrate.pulse(basket, 'wobble', 500);
    api.miss({
      hint: () => glowOneCorrect(host, api.problem),
      reveal: () => revealSet(host, api.problem)
    });
  }

  function updateBasket(host, target) {
    const line = host.querySelector('.basket-line');
    if (!picked.length) { line.textContent = `Make ${target}`; return; }
    line.textContent = `${picked.map(p => p.value).join(' + ')} + ? = ${target}`;
    if (picked.length >= Number(host.querySelector('.build').dataset.pick)) {
      line.textContent = `${picked.map(p => p.value).join(' + ')} = ?`;
    }
  }

  function returnAll(host, target) {
    picked = [];
    host.querySelectorAll('.fruit.picked').forEach(f => f.classList.remove('picked'));
    updateBasket(host, target);
  }

  /* Second miss: name one fruit that belongs in the basket and show the target
     as countable dots. He still has to find the rest. */
  function glowOneCorrect(host, problem) {
    const first = problem.addends[0];
    const fruit = Array.from(host.querySelectorAll('.fruit'))
      .find(f => Number(f.dataset.value) === first);
    if (fruit) Celebrate.pulse(fruit, 'hint-glow', 2400);

    const area = host.querySelector('.build-hint');
    area.hidden = false;
    area.innerHTML = problem.addends.map((addend, group) =>
      Array.from({ length: addend },
        () => `<span class="dot dot-g${group % 3}"></span>`).join('')).join('');
  }

  /* Third miss: drop the whole correct set into the basket so he sees the
     finished sum before moving on. */
  function revealSet(host, problem) {
    host.querySelectorAll('.fruit').forEach(f => { f.disabled = true; });
    const claimed = [];
    problem.addends.forEach(addend => {
      const fruit = Array.from(host.querySelectorAll('.fruit')).find(f =>
        Number(f.dataset.value) === addend && claimed.indexOf(f.dataset.slot) === -1);
      if (!fruit) return;
      claimed.push(fruit.dataset.slot);
      fruit.classList.add('picked', 'landed', 'revealed');
    });
    host.querySelector('.basket-line').textContent =
      `${problem.addends.join(' + ')} = ${problem.answer}`;
    host.querySelector('.build-basket').classList.add('basket-full');
  }

  /* Six fruit: the guaranteed solution plus fillers. A `tight` stop also gets a
     deliberate near-miss, so a set cannot be judged by rough size alone. Every
     filler stays below the target — a single fruit can never be the answer. */
  function treeFor(stop, problem) {
    const values = problem.addends.slice();

    if (stop.tight) {
      const near = nearMissFor(values, problem);
      if (near) values.push(near);
    }
    return shuffle(
      values.concat(fillersFor(values, problem.answer, TREE_SIZE - values.length)));
  }

  /* The closest number to the last addend that the tree does not already hold —
     searched outwards, because on a set like 9 + 2 + 1 the obvious neighbour is
     already hanging there, and a duplicate would make the reveal light the
     wrong fruit. Stays below the target so no single fruit is the answer. */
  function nearMissFor(values, problem) {
    const last = problem.addends[problem.addends.length - 1];
    for (let gap = 1; gap < problem.answer; gap++) {
      const found = [last + gap, last - gap].find(v =>
        v >= 1 && v <= problem.answer - 1 && values.indexOf(v) === -1);
      if (found) return found;
    }
    return 0;
  }

  /* Fillers never repeat a number already hanging on the tree: the reveal
     claims fruit by value, so a stray second 5 would light up the wrong one.
     The free numbers are rotated by the answer rather than taken from the
     bottom, so a board is not always the smallest fruit available. */
  function fillersFor(values, answer, count) {
    if (count <= 0) return [];

    const free = [];
    for (let v = 1; v < answer; v++) {
      if (values.indexOf(v) === -1) free.push(v);
    }
    const start = free.length ? answer % free.length : 0;
    return free.slice(start).concat(free.slice(0, start)).slice(0, count);
  }

  function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  return { show, treeFor };
})();
