/* main.js — screens, level flow and the grown-up corner.
   This is the only file that knows about the whole app at once; every other
   module stays ignorant of the ones around it. */
window.Main = (function () {
  'use strict';

  const GROWNUP_HOLD_MS = 2000;
  const STREAK_FOR_CHEER = 3;

  const el = {};
  let level = null;          // the level in progress, or null on the map

  /* ---- boot ---------------------------------------------------------------- */

  /* Buttons are wired before anything that can fail, so a missing browser API
     costs a feature rather than leaving a dead Start button on the screen. */
  function boot() {
    cacheElements();
    wireChrome();

    try {
      Progress.load();
      /* Award silently at boot so a save made before badges existed opens the
         explorer card already filled in, rather than firing a dozen banners the
         first time a stop is cleared. */
      Badges.check();
      Celebrate.init(el.confetti, el.balloons);
      Sound.setMuted(Progress.get().muted);
      syncMuteButton();
      el.startButton.textContent =
        Progress.get().clearedStops.length ? 'Keep exploring 🌿' : 'Start the adventure 🌿';
    } catch (err) {
      if (window.reportProblem) window.reportProblem('setup: ' + err.message);
    }

    show('start');
  }

  function cacheElements() {
    const byId = id => document.getElementById(id);
    Object.assign(el, {
      screens: Array.prototype.slice.call(document.querySelectorAll('.screen')),
      start: byId('screen-start'),
      map: byId('screen-map'),
      levelScreen: byId('screen-level'),

      startButton: byId('btn-start'),
      trail: byId('trail'),
      parade: byId('parade'),
      stageLabel: byId('stage-label'),
      profileChip: byId('btn-profile'),
      chipCub: byId('profile-chip-cub'),
      chipCounts: byId('chip-counts'),

      profileBody: byId('profile-body'),
      profileBack: byId('btn-profile-back'),
      badgePop: byId('badge-pop'),
      rescueStrip: byId('rescue-strip'),

      backButton: byId('btn-back'),
      levelStop: byId('level-stop'),
      levelName: byId('level-name'),
      pips: byId('level-pips'),
      levelCub: byId('level-cub'),
      gameHost: byId('game-host'),

      overlayClear: byId('overlay-clear'),
      clearTitle: byId('clear-title'),
      clearFriend: byId('clear-friend'),
      clearStars: byId('clear-stars'),
      clearNote: byId('clear-note'),
      clearNext: byId('btn-clear-next'),
      clearMap: byId('btn-clear-map'),

      overlayRegion: byId('overlay-region'),
      regionTitle: byId('region-title'),
      regionCub: byId('region-cub'),
      regionNote: byId('region-note'),
      regionOnward: byId('btn-region-onward'),

      overlayGrownup: byId('overlay-grownup'),
      grownupStats: byId('grownup-stats'),
      grownupFacts: byId('grownup-facts'),
      grownupClose: byId('btn-grownup-close'),
      grownupReset: byId('btn-grownup-reset'),
      grownupSave: byId('btn-grownup-save'),
      grownupRestore: byId('input-grownup-restore'),
      grownupSaveNote: byId('grownup-save-note'),

      muteButton: byId('btn-mute'),
      grownupLeaf: byId('grownup-leaf'),
      confetti: byId('confetti'),
      balloons: byId('balloons')
    });
  }

  function wireChrome() {
    el.startButton.addEventListener('click', () => {
      Sound.unlock();
      Sound.speak('Welcome back, explorer!');
      openMap();
    });

    el.backButton.addEventListener('click', leaveLevel);
    el.muteButton.addEventListener('click', toggleMute);

    el.profileChip.addEventListener('click', openProfile);
    el.profileBack.addEventListener('click', () => openMap());

    el.clearMap.addEventListener('click', () => { hide(el.overlayClear); Celebrate.clearAll(); });
    el.clearNext.addEventListener('click', () => {
      hide(el.overlayClear);
      Celebrate.clearAll();
      const next = Progress.currentStop();
      if (next) startLevel(next);
    });
    el.regionOnward.addEventListener('click', () => { hide(el.overlayRegion); Celebrate.clearAll(); });

    el.grownupClose.addEventListener('click', () => hide(el.overlayGrownup));
    el.grownupReset.addEventListener('click', confirmReset);
    el.grownupSave.addEventListener('click', downloadSave);
    el.grownupRestore.addEventListener('change', restoreSave);
    holdToOpen(el.grownupLeaf, openGrownup);
  }

  /* ---- screens ------------------------------------------------------------- */

  function show(name) {
    el.screens.forEach(screen => {
      screen.classList.toggle('active', screen.id === `screen-${name}`);
    });
  }

  function hide(overlay) { overlay.classList.remove('open'); }
  function open(overlay) { overlay.classList.add('open'); }

  function openMap(characterStop) {
    level = null;
    Games.stop();
    Rescue.clear();
    show('map');
    refreshMap(characterStop);
  }

  function refreshMap(characterStop) {
    const state = Progress.get();
    Map.render(el.trail, startLevel, characterStop);
    Character.renderParade(el.parade, state.friends);
    refreshChip(state);
  }

  /* The header chip is the door to the Explorer Card, so it carries the three
     numbers worth chasing. Seeing them tick up is what makes them worth it. */
  function refreshChip(state) {
    const info = Character.stageInfo(state.stage);
    Character.render(el.chipCub, state.stage);
    el.stageLabel.textContent = info.label;
    el.chipCounts.innerHTML = `
      <span class="count">${state.clearedStops.length}<i>/${Facts.STOPS.length}</i> 🗺️</span>
      <span class="count">${state.friends}<i>/${Character.FRIENDS.length}</i> 🐾</span>
      <span class="count">${Badges.earnedCount()}<i>/${Badges.total()}</i> 🏅</span>`;
    el.profileChip.setAttribute('aria-label',
      `Explorer card. ${info.label}. ${state.clearedStops.length} of ${Facts.STOPS.length} ` +
      `stops, ${state.friends} friends, ${Badges.earnedCount()} of ${Badges.total()} badges.`);
  }

  function openProfile() {
    Profile.render(el.profileBody);
    show('profile');
    Sound.speak(`You are a ${Character.stageInfo(Progress.get().stage).label}.`);
  }

  /* ---- playing a level ------------------------------------------------------ */

  function startLevel(stopId) {
    const stop = Facts.stop(stopId);
    if (!stop || !Progress.isUnlocked(stopId)) return;

    const problems = Facts.generateStop(stopId, Progress.get().facts);

    level = { stop, problems, streak: 0, correctFirstTry: 0 };

    el.levelStop.textContent = `Stop ${stop.id}`;
    el.levelName.textContent = stop.title;
    Character.render(el.levelCub, Progress.get().stage);
    renderPips(0);
    el.gameHost.innerHTML = '';

    /* The rescue frame is dressing over whatever mechanic the stop uses, so it
       mounts here and knows nothing about the game underneath it. */
    if (stop.frame === 'rescue') Rescue.mount(el.rescueStrip, problems.length);
    else Rescue.clear();

    show('level');

    Games.play({
      stop,
      problems,
      host: el.gameHost,
      hooks: {
        onCorrect: handleCorrect,
        onWrong: handleWrong,
        onQuestionDone: handleQuestionDone,
        onComplete: finishLevel
      }
    });
  }

  function renderPips(done) {
    const total = level ? level.problems.length : Facts.QUESTIONS_PER_STOP;
    let html = '';
    for (let i = 0; i < total; i++) {
      html += `<span class="pip${i < done ? ' pip-done' : ''}"></span>`;
    }
    el.pips.innerHTML = html;
  }

  function handleCorrect(problem, element, attempts) {
    if (!level) return;
    level.streak = attempts === 0 ? level.streak + 1 : 0;
    if (attempts === 0) level.correctFirstTry += 1;

    if (level.streak > 0 && level.streak % STREAK_FOR_CHEER === 0) {
      Celebrate.confetti(30);
      Celebrate.starBurst(el.levelCub);
      Celebrate.pulse(el.levelCub, 'cub-cheer', 800);
      Celebrate.bigText(level.streak >= STREAK_FOR_CHEER * 2 ? 'On fire! 🔥' : 'Streak!');
    }
  }

  function handleWrong() {
    if (level) level.streak = 0;
  }

  function handleQuestionDone(problem, missedFirstTry, stepsDone) {
    Progress.recordAnswer(problem.key, missedFirstTry);
    renderPips(stepsDone);
    Rescue.advance(stepsDone);
  }

  function leaveLevel() {
    Games.stop();
    Progress.save();          // keep the practice even if he wanders off early
    openMap();
  }

  /* ---- level completion ----------------------------------------------------- */

  function finishLevel() {
    if (!level) return;
    const finished = level;
    const stopId = finished.stop.id;

    Progress.save();
    const outcome = Progress.clearStop(stopId);

    Sound.levelClear();
    openMap(stopId);                    // draw him still standing on the stop he just beat

    const nextStop = Math.min(stopId + 1, Facts.STOPS.length);
    const walk = outcome.isNew && nextStop !== stopId ? Map.walkTo(nextStop) : Promise.resolve();

    walk.then(() => {
      refreshMap();
      Map.focusStop(outcome.isNew ? nextStop : stopId);
      showClearOverlay(finished, outcome);
    });
  }

  function showClearOverlay(finished, outcome) {
    const perfect = finished.correctFirstTry === finished.problems.length;
    const stars = starsFor(finished);

    /* Counted before the badge check, so a flawless run can earn its badge the
       same moment it happens. Only a first clear counts — otherwise replaying an
       easy stop would farm the perfect-stop badges. */
    if (perfect && outcome.isNew) Progress.recordPerfectStop();

    Celebrate.flash();
    Celebrate.confetti(perfect ? 110 : 80);
    Celebrate.balloons(perfect ? 7 : 4);
    if (perfect) {
      Celebrate.fireworks(3);
      Celebrate.bigText('Perfect! ⭐⭐⭐');
    }

    el.clearTitle.textContent = outcome.isNew
      ? `${finished.stop.title} cleared!`
      : `Great practice at ${finished.stop.title}!`;

    if (outcome.isNew) {
      const friend = Character.friendAt(finished.stop.id - 1);
      el.clearFriend.textContent = friend;
      el.clearFriend.hidden = false;
      el.clearNote.textContent = 'A new friend joined your parade!';
      Celebrate.emojiRain(friend, 14);
    } else {
      el.clearFriend.hidden = true;
      el.clearNote.textContent = 'You already had this one — nice keeping it sharp.';
    }

    el.clearStars.textContent = stars;
    el.clearNext.hidden = Progress.currentStop() === finished.stop.id;

    Sound.speak(perfect ? 'Perfect! Every single one!' : 'Level complete! Great work!');
    open(el.overlayClear);

    /* Badges land after the overlay so they read as a bonus on top of the win,
       and they queue themselves if several arrive at once. */
    setTimeout(() => Badges.announce(el.badgePop, Badges.check()), 1200);

    if (outcome.regionCleared) {
      setTimeout(() => showRegionOverlay(finished.stop.region), 2600);
    }
  }

  function starsFor(finished) {
    const misses = finished.problems.length - finished.correctFirstTry;
    const earned = misses === 0 ? 3 : misses <= 2 ? 2 : 1;
    return '⭐'.repeat(earned) + '☆'.repeat(3 - earned);
  }

  function showRegionOverlay(regionId) {
    hide(el.overlayClear);
    const region = Facts.REGIONS[regionId];
    const state = Progress.get();
    const info = Character.stageInfo(state.stage);

    el.regionTitle.textContent = `${region.emoji} ${region.name} conquered!`;
    Character.render(el.regionCub, state.stage);
    el.regionNote.textContent = `You are now a ${info.label}!`;

    Sound.regionClear();
    Celebrate.flash();
    Celebrate.confetti(120);
    Celebrate.balloons(8);
    Celebrate.fireworks(5);            // the biggest reward in the game
    Celebrate.emojiRain(region.emoji, 20);
    Celebrate.bigText(`${info.label}!`);
    Sound.speak(`Amazing! You finished the ${region.name}. You are now a ${info.label}!`);
    open(el.overlayRegion);
  }

  /* ---- mute and the grown-up corner ----------------------------------------- */

  function toggleMute() {
    const muted = Sound.setMuted(!Sound.isMuted());
    Progress.setMuted(muted);
    syncMuteButton();
  }

  function syncMuteButton() {
    const muted = Sound.isMuted();
    el.muteButton.textContent = muted ? '🔇' : '🔊';
    el.muteButton.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  }

  /* A two-second hold, so a curious five-year-old does not stumble in. */
  function holdToOpen(element, action) {
    let timer = null;
    const begin = () => {
      element.classList.add('holding');
      timer = setTimeout(() => { element.classList.remove('holding'); action(); }, GROWNUP_HOLD_MS);
    };
    const cancel = () => {
      element.classList.remove('holding');
      if (timer) { clearTimeout(timer); timer = null; }
    };

    element.addEventListener('pointerdown', begin);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(event =>
      element.addEventListener(event, cancel));
    element.addEventListener('contextmenu', event => event.preventDefault());
  }

  function openGrownup() {
    const stats = Progress.stats();
    const state = Progress.get();

    el.grownupStats.innerHTML = `
      <div class="stat"><span class="stat-num">${state.clearedStops.length}</span><span>stops cleared</span></div>
      <div class="stat"><span class="stat-num">${stats.answered}</span><span>questions answered</span></div>
      <div class="stat"><span class="stat-num">${stats.accuracy}%</span><span>right first try</span></div>`;

    const trouble = Progress.troubleFacts(8);
    el.grownupFacts.innerHTML = trouble.length
      ? `<h3>Facts worth practising</h3>
         <ul>${trouble.map(fact =>
           `<li><code>${fact.key}</code> — missed ${fact.missed} of ${fact.seen}</li>`).join('')}</ul>`
      : '<h3>Facts worth practising</h3><p>Nothing shaky yet. 🎉</p>';

    saveNote('');
    open(el.overlayGrownup);
  }

  /* A Blob and a download link: no server involved, so this works on the hosted
     copy and from file:// alike. */
  function downloadSave() {
    const url = URL.createObjectURL(
      new Blob([Progress.exportSave()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jungle-addition-progress.json';
    link.click();
    /* Revoked late: Safari starts the download after the click returns. */
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    saveNote('Saved. Keep the file somewhere safe.');
  }

  function restoreSave(event) {
    const file = event.target.files && event.target.files[0];
    /* Cleared either way, so picking the same file twice fires change again. */
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => saveNote('That file could not be read.');
    reader.onload = () => {
      if (!Progress.importSave(String(reader.result))) {
        saveNote('That is not a Jungle Addition save file.');
        return;
      }
      Badges.check();
      Sound.setMuted(Progress.get().muted);
      syncMuteButton();
      hide(el.overlayGrownup);
      openMap();
      saveNote('');
    };
    reader.readAsText(file);
  }

  function saveNote(message) { el.grownupSaveNote.textContent = message; }

  function confirmReset() {
    if (!window.confirm('Erase all progress and start the adventure over?')) return;
    Progress.reset();
    Badges.clearAnnouncements(el.badgePop);
    Sound.setMuted(false);
    syncMuteButton();
    hide(el.overlayGrownup);
    el.startButton.textContent = 'Start the adventure 🌿';
    show('start');
  }

  return { boot, openMap, startLevel };
})();

document.addEventListener('DOMContentLoaded', Main.boot);
