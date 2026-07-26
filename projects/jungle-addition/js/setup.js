/* setup.js — the three questions asked once, before the first stop.
   Pick a cub, pick how tricky the sums are, pick whether points get clever.
   Everything here edits a draft copy; nothing is saved until the last step, so
   backing out of the wizard changes nothing. */
window.Setup = (function () {
  'use strict';

  const LEVELS = [
    { id: 'easy',   emoji: '🌱', name: 'Easy',   note: 'Two numbers to add, and the wrong answers sit further away' },
    { id: 'medium', emoji: '🌿', name: 'Medium', note: 'The whole trail as it was built' },
    { id: 'hard',   emoji: '🔥', name: 'Hard',   note: 'Three numbers and close answers — no guessing your way up' }
  ];

  const RULES = [
    { id: 'speed',    emoji: '⏱️', name: 'Speed bonus',     note: 'Quick answers earn extra points' },
    { id: 'mistakes', emoji: '💛', name: 'Mistakes count',  note: 'A wrong try costs a few points' },
    { id: 'bonus',    emoji: '⭐', name: 'Hard sums pay more', note: 'Bigger questions are worth extra' },
    { id: 'music',    emoji: '🎵', name: 'Jungle music',    note: 'A tune plays while you explore' }
  ];

  const STEPS = ['avatar', 'difficulty', 'scoring'];

  let host = null;
  let draft = null;
  let finish = null;
  let step = 0;

  /* `settings` is read, never written: the caller decides what to do with the
     copy handed back through onDone. */
  function open(hostElement, settings, onDone) {
    host = hostElement;
    draft = Object.assign({}, settings);
    finish = onDone;
    step = 0;
    host.onclick = handleClick;
    render();
  }

  function render() {
    host.innerHTML = `
      <div class="setup-step">
        ${stepMarkup()}
      </div>
      <div class="setup-dots" aria-hidden="true">
        ${STEPS.map((unused, i) => `<span class="setup-dot${i === step ? ' on' : ''}"></span>`).join('')}
      </div>
      <div class="setup-nav">
        ${step > 0 ? '<button class="ghost-button" type="button" data-nav="back">← Back</button>' : ''}
        <button class="big-button" type="button" data-nav="next">${step === STEPS.length - 1 ? "Let's go! 🌿" : 'Next →'}</button>
      </div>`;

    if (STEPS[step] === 'avatar') {
      Character.renderChoices(host.querySelector('#setup-avatars'), draft.avatar);
    }
  }

  function stepMarkup() {
    if (STEPS[step] === 'avatar') {
      return `
        <h2>Who is exploring?</h2>
        <p class="setup-note">This is you on the trail.</p>
        <div id="setup-avatars" class="avatar-grid"></div>`;
    }
    if (STEPS[step] === 'difficulty') {
      return `
        <h2>How tricky should the sums be?</h2>
        <p class="setup-note">You can change this later from your explorer card.</p>
        <div class="choice-list">${LEVELS.map(levelRow).join('')}</div>`;
    }
    return `
      <h2>Points and music</h2>
      <p class="setup-note">All optional — the trail plays just fine with everything off.</p>
      <div class="choice-list">${RULES.map(ruleRow).join('')}</div>`;
  }

  function levelRow(level) {
    const on = draft.difficulty === level.id;
    return `
      <button class="choice-row${on ? ' selected' : ''}" type="button"
              data-level="${level.id}" aria-pressed="${on}">
        <span class="choice-emoji" aria-hidden="true">${level.emoji}</span>
        <span class="choice-text">
          <strong>${level.name}</strong>
          <span>${level.note}</span>
        </span>
        <span class="choice-mark" aria-hidden="true">${on ? '✓' : ''}</span>
      </button>`;
  }

  function ruleRow(rule) {
    const on = !!draft[rule.id];
    return `
      <button class="choice-row${on ? ' selected' : ''}" type="button"
              data-rule="${rule.id}" aria-pressed="${on}">
        <span class="choice-emoji" aria-hidden="true">${rule.emoji}</span>
        <span class="choice-text">
          <strong>${rule.name}</strong>
          <span>${rule.note}</span>
        </span>
        <span class="choice-switch${on ? ' on' : ''}" aria-hidden="true"></span>
      </button>`;
  }

  function handleClick(event) {
    const target = event.target.closest('[data-avatar], [data-level], [data-rule], [data-nav]');
    if (!target) return;

    Sound.pop();

    if (target.dataset.avatar) {
      draft.avatar = target.dataset.avatar;
      Character.setAvatar(draft.avatar);          // so the preview redraws as chosen
      return render();
    }
    if (target.dataset.level) {
      draft.difficulty = target.dataset.level;
      return render();
    }
    if (target.dataset.rule) {
      draft[target.dataset.rule] = !draft[target.dataset.rule];
      if (target.dataset.rule === 'music') Sound.setMusicOn(draft.music);
      return render();
    }
    if (target.dataset.nav === 'back') {
      step = Math.max(0, step - 1);
      return render();
    }
    if (step < STEPS.length - 1) {
      step += 1;
      return render();
    }
    draft.done = true;
    finish(draft);
  }

  return { open };
})();
