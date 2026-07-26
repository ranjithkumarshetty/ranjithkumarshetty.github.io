/* rescue.js — the "save the puppy" frame.
   Not a game: a strip that sits above whatever mechanic the stop uses. Every
   question answered weaves one more rung of the vine ladder, and the last one
   brings the puppy down. Because it is driven purely by the question counter it
   layers over any mechanic without that mechanic knowing it exists. */
window.Rescue = (function () {
  'use strict';

  let host = null;
  let rungs = 0;

  function mount(element, totalQuestions) {
    host = element;
    rungs = Math.max(1, totalQuestions || 1);
    if (!host) return;

    host.hidden = false;
    host.dataset.rungs = String(rungs);
    host.dataset.woven = '0';
    host.style.setProperty('--climb', '0');
    host.innerHTML = `
      <div class="rescue-scene" role="img"
           aria-label="A puppy stuck on a ledge. Weave the ladder to reach it.">
        <span class="rescue-puppy">🐶</span>
        <div class="rescue-ladder">
          ${Array.from({ length: rungs },
            (unused, i) => `<span class="rung" data-rung="${i + 1}"></span>`).join('')}
        </div>
        <span class="rescue-climber">🐯</span>
      </div>
      <p class="rescue-line">Weave the vine ladder — ${rungs} rungs to go!</p>`;

    Sound.speak('A puppy is stuck up there! Answer to weave the ladder.');
  }

  /* `woven` is the running question count, so a revealed answer still earns its
     rung — the ladder measures effort, not accuracy. Clamped and monotonic, so
     it can never slip backwards however it is called. */
  function advance(woven) {
    if (!host || host.hidden) return;

    const done = Math.max(Number(host.dataset.woven) || 0, Math.min(rungs, woven || 0));
    host.dataset.woven = String(done);
    host.style.setProperty('--climb', String(done / rungs));

    host.querySelectorAll('.rung').forEach(rung => {
      if (Number(rung.dataset.rung) <= done) rung.classList.add('woven');
    });

    const line = host.querySelector('.rescue-line');
    const left = rungs - done;

    if (left === 0) {
      host.querySelector('.rescue-scene').classList.add('rescued');
      host.querySelector('.rescue-puppy').textContent = '🐕';
      line.textContent = 'You reached the puppy! 🎉';
      Celebrate.starBurst(host.querySelector('.rescue-puppy'));
      Celebrate.emojiRain('🐾', 16);
      Celebrate.bigText('Puppy saved!');
      Sound.speak('You saved the puppy!');
      return;
    }

    line.textContent = left === 1 ? 'One more rung!' : `${left} rungs to go!`;
  }

  function clear() {
    if (!host) return;
    host.hidden = true;
    host.innerHTML = '';
    host.dataset.woven = '0';
  }

  return { mount, advance, clear };
})();
