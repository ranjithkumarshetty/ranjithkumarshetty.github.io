/* main.js — screens, level flow and the grown-up corner.
   This is the only file that knows about the whole app at once; every other
   module stays ignorant of the ones around it. */
window.Main = (function () {
  'use strict';

  const GROWNUP_HOLD_MS = 2000;
  const STREAK_FOR_CHEER = 3;

  const el = {};
  let level = null;          // the level in progress, or null on the map
  let lastRun = null;        // the stop just cleared, kept for the share button

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
      applySettings();
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

      setupBody: byId('setup-body'),

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
      swapButton: byId('btn-swap'),
      swapLabel: byId('swap-label'),

      overlayClear: byId('overlay-clear'),
      clearTitle: byId('clear-title'),
      clearFriend: byId('clear-friend'),
      clearStars: byId('clear-stars'),
      clearNote: byId('clear-note'),
      clearScore: byId('clear-score'),
      clearShare: byId('btn-clear-share'),
      clearShareNote: byId('clear-share-note'),
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
      musicButton: byId('btn-music'),
      grownupLeaf: byId('grownup-leaf'),
      confetti: byId('confetti'),
      balloons: byId('balloons')
    });
  }

  function wireChrome() {
    /* The first tap is the only chance to start audio, so it also decides
       whether the child goes to the wizard or straight back to the trail. */
    el.startButton.addEventListener('click', () => {
      Sound.unlock();
      if (!Progress.settings().done) return openSetup();
      Sound.speak('Welcome back, explorer!');
      openMap();
    });

    el.backButton.addEventListener('click', leaveLevel);
    el.swapButton.addEventListener('click', swapQuestion);
    el.muteButton.addEventListener('click', toggleMute);
    el.musicButton.addEventListener('click', toggleMusic);
    el.clearShare.addEventListener('click', shareLevel);

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
    Sound.setMood('jungle');
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
    Profile.render(el.profileBody, { onShare: shareAdventure, onSettings: openSetup });
    show('profile');
    Sound.speak(`You are a ${Character.stageInfo(Progress.get().stage).label}.`);
  }

  /* ---- setup ---------------------------------------------------------------- */

  /* The three saved choices reach three different modules, so one place applies
     them all — at boot, after the wizard, and after a restore. */
  function applySettings() {
    const settings = Progress.settings();
    Facts.setDifficulty(settings.difficulty);
    Character.setAvatar(settings.avatar);
    Sound.setMusicOn(settings.music);
    syncMusicButton();
  }

  function openSetup() {
    Setup.open(el.setupBody, Progress.settings(), chosen => {
      Progress.updateSettings(chosen);
      applySettings();
      Sound.speak("Great choice! Let's explore!");
      openMap();
    });
    show('setup');
  }

  /* ---- playing a level ------------------------------------------------------ */

  function startLevel(stopId) {
    const stop = Facts.stop(stopId);
    if (!stop || !Progress.isUnlocked(stopId)) return;

    const problems = Facts.generateStop(stopId, Progress.get().facts);

    level = {
      stop, problems,
      streak: 0, correctFirstTry: 0,
      rules: Score.rulesFrom(Progress.settings()),
      startedAt: Date.now(),
      askedAt: Date.now(),      // when the question on screen appeared
      wrongs: 0,                // wrong tries on that question alone
      points: 0
    };

    /* A rescue is a chase, so the tune becomes one. */
    Sound.setMood(stop.frame === 'rescue' ? 'chase' : 'jungle');

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
        onQuestionShown: handleQuestionShown,
        onCorrect: handleCorrect,
        onWrong: handleWrong,
        onQuestionDone: handleQuestionDone,
        onSwap: syncSwapButton,
        onComplete: finishLevel
      }
    });

    syncSwapButton();
  }

  /* Swapping is free by design: no step taken, no mistake logged, and the clock
     for the speed bonus restarts with the new question via onQuestionShown.
     The new question reads itself out, so nothing is said about the swap. */
  function swapQuestion() {
    Games.swapQuestion();
  }

  function syncSwapButton() {
    const left = Games.swapsLeft();
    el.swapButton.disabled = left === 0;
    el.swapLabel.textContent = left
      ? `Swap this question — ${left} left`
      : 'Swap used for this stop';
    el.swapButton.setAttribute('aria-label', left
      ? `Swap this question for a different one. ${left} swap left at this stop.`
      : 'No swaps left at this stop');
  }

  function renderPips(done) {
    const total = level ? level.problems.length : Facts.QUESTIONS_PER_STOP;
    let html = '';
    for (let i = 0; i < total; i++) {
      html += `<span class="pip${i < done ? ' pip-done' : ''}"></span>`;
    }
    el.pips.innerHTML = html;
  }

  /* The clock for the speed bonus starts when the question lands on screen, not
     when the level did, so the pause after the previous answer costs nothing. */
  function handleQuestionShown() {
    if (!level) return;
    level.askedAt = Date.now();
    level.wrongs = 0;
  }

  function handleCorrect(problem, element, attempts) {
    if (!level) return;
    level.streak = attempts === 0 ? level.streak + 1 : 0;
    if (attempts === 0) level.correctFirstTry += 1;

    Celebrate.pulse(el.levelCub, 'cub-happy', 700);

    if (level.streak > 0 && level.streak % STREAK_FOR_CHEER === 0) {
      Celebrate.confetti(30);
      Celebrate.starBurst(el.levelCub);
      Celebrate.pulse(el.levelCub, 'cub-cheer', 800);
      Celebrate.bigText(level.streak >= STREAK_FOR_CHEER * 2 ? 'On fire! 🔥' : 'Streak!');
    }
  }

  function handleWrong() {
    if (!level) return;
    level.streak = 0;
    level.wrongs += 1;
    Celebrate.pulse(el.levelCub, 'cub-sad', 600);
  }

  function handleQuestionDone(problem, missedFirstTry, stepsDone) {
    Progress.recordAnswer(problem.key, missedFirstTry);
    awardPoints(problem);
    renderPips(stepsDone);
    Rescue.advance(stepsDone);
    if (level) level.askedAt = Date.now();      // match boards never re-announce
  }

  /* Points are scored here rather than on the answer itself, so a question that
     ended in a reveal still pays something — the promise is that finishing is
     always worth more than giving up. */
  function awardPoints(problem) {
    if (!level) return;
    const earned = Score.forQuestion(problem, level.stop, {
      attempts: level.wrongs + 1,
      elapsedMs: Date.now() - level.askedAt
    }, level.rules);

    level.points += earned.points;
    Progress.addScore(earned.points);
    Celebrate.floatText(el.levelCub, floatLabel(earned), 'float-score');
  }

  /* "+18 Lightning fast" — the number, plus the one word that explains it. */
  function floatLabel(earned) {
    const extra = earned.parts.find(part => part.points > 0 && part.label !== 'Correct');
    return `+${earned.points}${extra ? ' ' + extra.label : ''}`;
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

    const bonus = Score.stopBonus(perfect, finished.rules);
    if (bonus) {
      finished.points += bonus;
      Progress.addScore(bonus);
    }
    Progress.save();

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
    el.clearScore.textContent = `🏅 ${finished.points} points${bonus ? ' — perfect-stop bonus!' : ''}`;
    el.clearNext.hidden = Progress.currentStop() === finished.stop.id;

    /* Held for the share button, which is tapped by a grown-up after the cub has
       already run off to the next stop. */
    lastRun = runSummary(finished, stars);
    el.clearShareNote.textContent = '';

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

  /* ---- sharing --------------------------------------------------------------- */

  /* Everything Share needs about a finished stop, gathered while it is still in
     memory — Progress keeps totals, not the story of one run. */
  function runSummary(finished, stars) {
    const avatar = Character.avatarInfo(Progress.settings().avatar);
    return {
      stopId: finished.stop.id,
      stopName: finished.stop.title,
      difficulty: Progress.settings().difficulty,
      avatarName: avatar.name,
      avatarEmoji: avatar.emoji,
      solved: finished.problems.length,
      mistakes: finished.problems.length - finished.correctFirstTry,
      elapsedMs: Date.now() - finished.startedAt,
      points: finished.points,
      stars: stars
    };
  }

  function shareLevel() {
    if (!lastRun) return;
    sendShare(Share.levelSummary(lastRun), el.clearShareNote);
  }

  function shareAdventure(note) {
    const state = Progress.get();
    const avatar = Character.avatarInfo(state.settings.avatar);
    /* Share renders; it does not go looking. The rank and the avatar's name live
       in Character, so they are folded in here rather than looked up there. */
    const decorated = Object.assign({}, state, {
      rank: Character.stageInfo(state.stage).label,
      settings: Object.assign({}, state.settings,
        { avatarName: avatar.name, avatarEmoji: avatar.emoji })
    });
    sendShare(Share.adventureSummary(decorated, Progress.stats(), Facts.STOPS.length), note);
  }

  function sendShare(text, note) {
    Share.send(text).then(result => {
      if (note) note.textContent = shareOutcome(result);
    });
  }

  function shareOutcome(result) {
    if (!result.ok) return result.how === 'cancelled' ? '' : 'Could not share from this browser.';
    return result.how === 'shared' ? 'Shared! 📣' : 'Copied — paste it anywhere. 📋';
  }

  /* ---- mute, music and the grown-up corner ----------------------------------- */

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

  /* Music has its own switch: the tune is the first thing a grown-up wants gone,
     and losing it should not take the spoken questions with it. */
  function toggleMusic() {
    const on = Sound.setMusicOn(!Sound.isMusicOn());
    Progress.updateSettings({ music: on });
    syncMusicButton();
  }

  function syncMusicButton() {
    const on = Sound.isMusicOn();
    el.musicButton.textContent = on ? '🎵' : '🎶';
    el.musicButton.classList.toggle('off', !on);
    el.musicButton.setAttribute('aria-label', on ? 'Turn music off' : 'Turn music on');
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
      applySettings();
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
    applySettings();                    // back to the defaults, wizard and all
    hide(el.overlayGrownup);
    el.startButton.textContent = 'Start the adventure 🌿';
    show('start');
  }

  return { boot, openMap, startLevel };
})();

document.addEventListener('DOMContentLoaded', Main.boot);
