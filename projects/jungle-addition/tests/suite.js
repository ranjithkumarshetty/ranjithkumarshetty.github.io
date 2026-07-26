/* The logic suite, shared by both harnesses.
 *
 *   tests.html          runs it in a browser with real <script> tags
 *   tools/run-tests.js  runs it in node with the same files eval'd
 *
 * It touches only the pure modules — Facts, Progress, and the board-shaping
 * helpers of Route/Build/Balance/Badges — so it needs no DOM. The caller
 * supplies `test`, `ok` and `eq`; everything else it brings itself.
 */
(function () {
  'use strict';

  const ALL_STOPS = Array.from({ length: 20 }, (unused, i) => i + 1);

  window.TestSuite = function (harness) {
    const test = harness.test;
    const ok = harness.ok;
    const eq = harness.eq;

    /* ---- facts.js ------------------------------------------------------- */

    test('every stop has a non-empty candidate pool', () => {
      Facts.STOPS.forEach(stop => {
        ok(Facts.poolForStop(stop.id).length > 0, `stop ${stop.id} pool is empty`);
      });
    });

    test('every pool entry respects its stop declared answer range', () => {
      Facts.STOPS.forEach(stop => {
        Facts.poolForStop(stop.id).forEach(addends => {
          const sum = addends.reduce((a, b) => a + b, 0);
          ok(sum >= stop.min && sum <= stop.max,
            `stop ${stop.id}: ${addends.join('+')}=${sum} outside ${stop.min}..${stop.max}`);
        });
      });
    });

    test('no pool contains 0 + 0, and only stop 1 allows a zero addend', () => {
      Facts.STOPS.forEach(stop => {
        Facts.poolForStop(stop.id).forEach(addends => {
          ok(!addends.every(n => n === 0), `stop ${stop.id} contains 0+0`);
          if (stop.id !== 1) {
            ok(addends.every(n => n >= 1), `stop ${stop.id} contains a zero addend: ${addends.join('+')}`);
          }
        });
      });
    });

    test('generated problems always land inside the stop declared range', () => {
      Facts.STOPS.forEach(stop => {
        for (let run = 0; run < 25; run++) {
          Facts.generateStop(stop.id, {}, seeded(run + stop.id * 100)).forEach(p => {
            eq(p.answer, p.addends.reduce((a, b) => a + b, 0), `stop ${stop.id} answer mismatch`);
            ok(p.answer >= stop.min && p.answer <= stop.max,
              `stop ${stop.id}: answer ${p.answer} outside ${stop.min}..${stop.max}`);
          });
        }
      });
    });

    test('every stop generates exactly 6 questions', () => {
      Facts.STOPS.forEach(stop => {
        eq(Facts.generateStop(stop.id, {}, seeded(7)).length, 6, `stop ${stop.id}`);
      });
    });

    test('exactly one option is correct, and options are unique and in 0..25', () => {
      Facts.STOPS.forEach(stop => {
        for (let run = 0; run < 25; run++) {
          Facts.generateStop(stop.id, {}, seeded(run * 31 + stop.id)).forEach(p => {
            eq(p.options.length, 4, `stop ${stop.id} option count`);
            eq(new Set(p.options).size, 4, `stop ${stop.id} duplicate options: ${p.options}`);
            eq(p.options.filter(o => o === p.answer).length, 1,
              `stop ${stop.id} correct-option count for answer ${p.answer} in ${p.options}`);
            p.options.forEach(o => ok(o >= 0 && o <= 25, `stop ${stop.id} option ${o} out of 0..25`));
          });
        }
      });
    });

    test('buildOptions never emits a negative option, even for answer 0', () => {
      const opts = Facts.buildOptions(0, seeded(3));
      eq(opts.length, 4);
      opts.forEach(o => ok(o >= 0, `negative option ${o}`));
      ok(opts.indexOf(0) !== -1, 'answer missing from options');
    });

    test('a stop has no repeated facts when the pool is large enough', () => {
      Facts.STOPS.forEach(stop => {
        if (Facts.poolForStop(stop.id).length < 6) return;
        for (let run = 0; run < 25; run++) {
          const keys = Facts.generateStop(stop.id, {}, seeded(run + 1)).map(p => p.key);
          eq(new Set(keys).size, 6, `stop ${stop.id} repeated a fact: ${keys}`);
        }
      });
    });

    /* Match boards pair each sum with one answer tile, and route forks label
       every stone with its own sum — a duplicate answer would make either
       board ambiguous, with two "right" taps. */
    test('match and route stops produce 6 distinct answers', () => {
      Facts.STOPS.filter(s => s.game === 'match' || s.game === 'route').forEach(stop => {
        for (let run = 0; run < 25; run++) {
          const answers = Facts.generateStop(stop.id, {}, seeded(run * 17)).map(p => p.answer);
          eq(new Set(answers).size, 6, `stop ${stop.id} duplicate answers: ${answers}`);
        }
      });
    });

    test('weighted selection resurfaces missed facts more often', () => {
      // Stop 5 is doubles 1+1..7+7 — a 7-fact pool, so weighting is easy to observe.
      const target = '6+6';
      const missCounts = { '6+6': { seen: 9, missed: 9 } };
      let withWeight = 0, without = 0;
      for (let run = 0; run < 300; run++) {
        if (Facts.generateStop(5, missCounts, seeded(run)).some(p => p.key === target)) withWeight++;
        if (Facts.generateStop(5, {}, seeded(run)).some(p => p.key === target)) without++;
      }
      ok(withWeight > without,
        `weighting had no effect: ${withWeight} vs ${without} appearances in 300 runs`);
    });

    test('factKey is order-independent', () => {
      eq(Facts.factKey([8, 3]), Facts.factKey([3, 8]));
      eq(Facts.factKey([4, 2, 3]), '2+3+4');
    });

    test('stop roster is complete and regions partition it', () => {
      eq(Facts.STOPS.length, 20);
      eq(Facts.STOPS.map(s => s.id), ALL_STOPS);
      const inRegions = Facts.REGIONS.flatMap(r => r.stops).sort((a, b) => a - b);
      eq(inRegions, ALL_STOPS);
    });

    /* A typo in a stop's `game` would silently fall through to the default
       bubble board, so pin the roster to the set of boards that exist. */
    test('every game type is reachable and every stop asks for a real one', () => {
      const known = ['quick', 'missing', 'critters', 'match', 'route', 'build', 'balance'];
      Facts.gameTypes().forEach(g => ok(known.indexOf(g) !== -1, `unknown game type: ${g}`));
      known.forEach(g => ok(Facts.STOPS.some(s => s.game === g), `no stop uses game type: ${g}`));
    });

    /* ---- character.js --------------------------------------------------- */

    /* The two rewards that scale with the roster. Adding stops without adding
       friends would hand out the same animal twice; adding a region without a
       stage would leave the last region with nothing to grow into. */
    test('rewards keep pace with the roster', () => {
      eq(Character.FRIENDS.length, Facts.STOPS.length, 'one friend per stop');
      eq(new Set(Character.FRIENDS).size, Character.FRIENDS.length, 'duplicate friend');
      eq(Character.STAGES.length, Facts.REGIONS.length + 1, 'a stage per region, plus the cub');
    });

    test('the final stage is reachable and never overshoots', () => {
      const last = Character.STAGES.length - 1;
      eq(Character.stageInfo(last).label, 'Legend');
      eq(Character.stageInfo(last + 3).label, 'Legend', 'stage clamps at the top');
      eq(Character.stageInfo(-1).label, 'Cub', 'stage clamps at the bottom');
      ok(Character.markup(last).indexOf('cub-crown') !== -1, 'the top stage wears the crown');
    });

    /* ---- route.js / build.js / balance.js ------------------------------- */

    test('route forks are the declared width, distinct, and hold the answer', () => {
      Facts.STOPS.filter(s => s.game === 'route').forEach(stop => {
        for (let run = 0; run < 25; run++) {
          Facts.generateStop(stop.id, {}, seeded(run * 13 + stop.id)).forEach(p => {
            const stones = Route.distractorsFor(stop, p).concat(p.answer);
            eq(stones.length, stop.stones || 3, `stop ${stop.id} fork width: ${stones}`);
            eq(new Set(stones).size, stones.length, `stop ${stop.id} duplicate stones: ${stones}`);
            stones.forEach(v => ok(v >= 2, `stop ${stop.id} stone below 2: ${v}`));
          });
        }
      });
    });

    /* The two halves of the same rule: `tight` must be tight, and an ordinary
       stop must NOT be — otherwise the roster's difficulty ramp is decorative. */
    test('tight route stops keep every stone within one of the answer', () => {
      Facts.STOPS.filter(s => s.game === 'route' && s.tight).forEach(stop => {
        for (let run = 0; run < 25; run++) {
          Facts.generateStop(stop.id, {}, seeded(run * 5 + stop.id)).forEach(p => {
            Route.distractorsFor(stop, p).forEach(v =>
              ok(Math.abs(v - p.answer) <= 1, `stop ${stop.id} loose stone ${v} vs ${p.answer}`));
          });
        }
      });
    });

    test('ordinary route stops keep every stone at least two from the answer', () => {
      Facts.STOPS.filter(s => s.game === 'route' && !s.tight).forEach(stop => {
        for (let run = 0; run < 25; run++) {
          Facts.generateStop(stop.id, {}, seeded(run * 3 + stop.id)).forEach(p => {
            Route.distractorsFor(stop, p).forEach(v =>
              ok(Math.abs(v - p.answer) >= 2, `stop ${stop.id} tight stone ${v} vs ${p.answer}`));
          });
        }
      });
    });

    test('build trees hold a solution of exactly the size the stop asks for', () => {
      Facts.STOPS.filter(s => s.game === 'build').forEach(stop => {
        const pick = stop.pick || 2;
        for (let run = 0; run < 25; run++) {
          Facts.generateStop(stop.id, {}, seeded(run * 11 + stop.id)).forEach(p => {
            eq(p.addends.length, pick, `stop ${stop.id} addend count`);
            const tree = Build.treeFor(stop, p);
            eq(tree.length, 6, `stop ${stop.id} tree size`);
            tree.forEach(v => ok(v >= 1, `stop ${stop.id} non-positive fruit: ${v}`));
            ok(reachable(tree, p.answer, pick),
              `stop ${stop.id} cannot make ${p.answer} from ${pick} of ${tree}`);
          });
        }
      });
    });

    /* The only repeats a tree may hold are repeats the answer itself needs, as
       in 4 + 4 + 4 — a stray extra copy would make the reveal light the wrong
       fruit and could open a second, unintended solution. */
    test('build trees repeat a fruit only when the answer does', () => {
      Facts.STOPS.filter(s => s.game === 'build').forEach(stop => {
        for (let run = 0; run < 25; run++) {
          Facts.generateStop(stop.id, {}, seeded(run * 17 + stop.id)).forEach(p => {
            const tree = Build.treeFor(stop, p);
            eq(new Set(tree).size, new Set(p.addends).size + (tree.length - p.addends.length),
              `stop ${stop.id} unintended duplicate in ${tree} for ${p.addends}`);
          });
        }
      });
    });

    test('balance always leaves a gap one weight in the row can close', () => {
      Facts.STOPS.filter(s => s.game === 'balance').forEach(stop => {
        for (let run = 0; run < 25; run++) {
          Facts.generateStop(stop.id, {}, seeded(run * 7 + stop.id)).forEach(p => {
            /* A plain stop weighs the whole sum; only a compound one preloads. */
            const preload = stop.compound ? Balance.preloadFor(p) : 0;
            const needed = p.answer - preload;
            ok(needed >= 1, `stop ${stop.id} nothing left to weigh: ${preload}/${p.answer}`);
            const weights = Balance.weightsFor(p, needed);
            eq(weights.length, 6, `stop ${stop.id} weight count`);
            eq(new Set(weights).size, 6, `stop ${stop.id} duplicate weights: ${weights}`);
            ok(weights.indexOf(needed) !== -1, `stop ${stop.id} weights miss ${needed}: ${weights}`);
          });
        }
      });
    });

    test('a plain balance stop asks for the whole sum, a compound one for part', () => {
      const plain = Facts.STOPS.filter(s => s.game === 'balance' && !s.compound);
      const compound = Facts.STOPS.filter(s => s.game === 'balance' && s.compound);
      ok(plain.length && compound.length, 'the roster needs both balance shapes');

      plain.forEach(stop => {
        Facts.generateStop(stop.id, {}, seeded(stop.id)).forEach(p => {
          ok(Balance.weightsFor(p, p.answer).indexOf(p.answer) !== -1,
            `stop ${stop.id} cannot weigh ${p.addends.join('+')} in one stone`);
        });
      });
      compound.forEach(stop => {
        Facts.generateStop(stop.id, {}, seeded(stop.id)).forEach(p => {
          const preload = Balance.preloadFor(p);
          ok(preload >= 2 && preload <= p.answer - 2,
            `stop ${stop.id} preload ${preload} leaves no real second addend`);
        });
      });
    });

    /* ---- progress.js ---------------------------------------------------- */

    test('save then load round-trips state intact', () => {
      const store = fakeStorage();
      Progress.__test.useStorage(store);
      Progress.reset();
      Progress.clearStop(1);
      Progress.recordAnswer('7+8', true);
      Progress.setMuted(true);
      const before = JSON.parse(JSON.stringify(Progress.get()));

      Progress.__test.useStorage(fakeStorage(store._raw['jungleAddition.v1']));
      Progress.load();
      eq(Progress.get(), before);
    });

    test('corrupt JSON resets cleanly instead of throwing', () => {
      Progress.__test.useStorage(fakeStorage('{not json at all'));
      Progress.load();
      eq(Progress.get(), Progress.__test.blank());
    });

    test('a missing key resets cleanly', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.load();
      eq(Progress.get(), Progress.__test.blank());
    });

    test('a version mismatch resets cleanly', () => {
      Progress.__test.useStorage(fakeStorage(JSON.stringify({ version: 99, friends: 40, stage: 3 })));
      Progress.load();
      eq(Progress.get(), Progress.__test.blank());
    });

    test('non-object stored value resets cleanly', () => {
      Progress.__test.useStorage(fakeStorage('"just a string"'));
      Progress.load();
      eq(Progress.get(), Progress.__test.blank());
    });

    test('a save file round-trips into a fresh browser', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.reset();
      Progress.clearStop(1);
      Progress.awardBadge('first-friend');
      const file = Progress.exportSave();
      const before = JSON.parse(JSON.stringify(Progress.get()));

      const store = fakeStorage();
      Progress.__test.useStorage(store);
      Progress.load();
      ok(Progress.importSave(file), 'a save file should be accepted');
      eq(Progress.get(), before);
      eq(JSON.parse(store._raw['jungleAddition.v1']), before);
    });

    test('a file that is not a save leaves progress untouched', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.reset();
      Progress.clearStop(1);
      const before = JSON.parse(JSON.stringify(Progress.get()));

      ['{not json at all', '"just a string"', JSON.stringify({ version: 99 })]
        .forEach(bad => {
          ok(!Progress.importSave(bad), `${bad} should be rejected`);
          eq(Progress.get(), before);
        });
    });

    test('miss counts accumulate, and seen counts every answer', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.reset();
      Progress.recordAnswer('7+8', true);
      Progress.recordAnswer('7+8', false);
      Progress.recordAnswer('7+8', true);
      eq(Progress.get().facts['7+8'], { seen: 3, missed: 2 });
    });

    test('stops unlock strictly in order', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.reset();
      ok(Progress.isUnlocked(1), 'stop 1 should start unlocked');
      ok(!Progress.isUnlocked(2), 'stop 2 should start locked');
      Progress.clearStop(1);
      ok(Progress.isUnlocked(2), 'stop 2 should unlock after stop 1');
      ok(!Progress.isUnlocked(3), 'stop 3 should still be locked');
    });

    test('clearing a stop awards one friend; replaying awards none', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.reset();
      const first = Progress.clearStop(1);
      ok(first.isNew, 'first clear should be new');
      eq(Progress.get().friends, 1);

      const replay = Progress.clearStop(1);
      ok(!replay.isNew, 'replay should not be new');
      eq(Progress.get().friends, 1, 'replay must not award a friend');
    });

    test('character stage advances only when a whole region is cleared', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.reset();
      [1, 2, 3].forEach(id => Progress.clearStop(id));
      eq(Progress.get().stage, 0, 'stage should not move mid-region');

      const fourth = Progress.clearStop(4);
      ok(fourth.regionCleared, 'clearing stop 4 should complete Riverbank');
      eq(Progress.get().stage, 1);

      [5, 6, 7, 8].forEach(id => Progress.clearStop(id));
      eq(Progress.get().stage, 2);
      [9, 10, 11, 12].forEach(id => Progress.clearStop(id));
      eq(Progress.get().stage, 3);
      [13, 14, 15, 16].forEach(id => Progress.clearStop(id));
      eq(Progress.get().stage, 4);
      [17, 18, 19, 20].forEach(id => Progress.clearStop(id));
      eq(Progress.get().stage, 5);
      eq(Progress.get().friends, 20);
    });

    test('a throwing storage backend degrades to in-memory instead of crashing', () => {
      Progress.__test.useStorage({
        getItem() { throw new Error('blocked'); },
        setItem() { throw new Error('blocked'); },
        removeItem() { throw new Error('blocked'); }
      });
      Progress.load();
      Progress.clearStop(1);
      eq(Progress.get().friends, 1, 'in-memory state should still work');
    });

    test('stats report first-try accuracy', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.reset();
      Progress.recordAnswer('1+1', false);
      Progress.recordAnswer('2+2', false);
      Progress.recordAnswer('3+3', true);
      Progress.recordAnswer('4+4', true);
      const s = Progress.stats();
      eq(s.answered, 4);
      eq(s.missed, 2);
      eq(s.accuracy, 50);
    });

    /* ---- badges.js ------------------------------------------------------ */

    test('a blank save carries the badge fields', () => {
      const blank = Progress.__test.blank();
      eq(blank.badges, []);
      eq(blank.perfectStops, 0);
    });

    /* The save version was deliberately NOT bumped for badges — a mismatch
       wipes progress, and a child who already climbed the trail should not
       lose it to an update. Absent fields must simply default. */
    test('a save written before badges existed still loads', () => {
      const old = JSON.stringify({
        version: 1, stage: 1, friends: 4, clearedStops: [1, 2, 3, 4], facts: {}, muted: false
      });
      Progress.__test.useStorage(fakeStorage(old));
      Progress.load();
      eq(Progress.get().clearedStops, [1, 2, 3, 4], 'old progress must survive');
      eq(Progress.get().badges, []);
      eq(Progress.get().perfectStops, 0);
    });

    test('badges award once and only once', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.reset();
      ok(Progress.awardBadge('first-steps'), 'first award should stick');
      ok(!Progress.awardBadge('first-steps'), 'second award must be a no-op');
      ok(Progress.hasBadge('first-steps'));
      eq(Progress.get().badges, ['first-steps']);
    });

    test('the perfect-stop counter accumulates', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.reset();
      Progress.recordPerfectStop();
      Progress.recordPerfectStop();
      eq(Progress.get().perfectStops, 2);
    });

    test('Badges.check awards exactly the newly true badges', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.reset();
      eq(Badges.check().map(b => b.id), [], 'nothing earned on a blank save');
      Progress.clearStop(1);
      eq(Badges.check().map(b => b.id), ['first-steps']);
      eq(Badges.check().map(b => b.id), [], 'checking twice must not re-award');
    });

    /* Every badge must be winnable — an unreachable one is a promise the
       game cannot keep, and it would sit greyed out on the explorer card. */
    test('clearing every stop perfectly earns every badge', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.reset();
      ALL_STOPS.forEach(id => { Progress.clearStop(id); Progress.recordPerfectStop(); });
      for (let i = 0; i < 150; i++) Progress.recordAnswer('2+2', true);
      Badges.check();
      eq(Badges.earnedCount(), Badges.total(), 'unreachable badges: ' +
        Badges.BADGES.filter(b => !Progress.hasBadge(b.id)).map(b => b.id).join(', '));
    });

    /* ---- difficulty ------------------------------------------------------
       Every test here runs inside atDifficulty(), which puts the dial back
       where it found it — the rest of the suite reads the roster at medium. */

    test('an unknown difficulty falls back to medium', () => {
      atDifficulty('bananas', () => eq(Facts.getDifficulty(), 'medium'));
    });

    test('easy asks for two addends everywhere', () => {
      atDifficulty('easy', () => {
        Facts.STOPS.forEach(raw => {
          const config = Facts.stop(raw.id);
          ok(!config.pick || config.pick <= 2, `stop ${raw.id} still picks ${config.pick}`);
          ok(!config.compound, `stop ${raw.id} is still compound`);
          Facts.poolForStop(raw.id).forEach(addends => {
            eq(addends.length, 2, `stop ${raw.id}: ${addends.join('+')} is not a pair`);
          });
        });
      });
    });

    /* The gentler pool is a second source of facts, so it needs the same range
       check the medium pool gets — an easy stop must still be that stop. */
    test('the easy pool stays inside each stop declared answer range', () => {
      atDifficulty('easy', () => {
        Facts.STOPS.forEach(raw => {
          Facts.poolForStop(raw.id).forEach(addends => {
            const total = addends.reduce((a, b) => a + b, 0);
              ok(total >= raw.min && total <= raw.max,
              `stop ${raw.id}: ${addends.join('+')}=${total} outside ${raw.min}..${raw.max}`);
          });
        });
      });
    });

    test('hard puts near-miss distractors on every stop', () => {
      atDifficulty('hard', () => {
        Facts.STOPS.forEach(raw => ok(Facts.stop(raw.id).tight, `stop ${raw.id} is not tight`));
      });
    });

    test('easy spreads the wrong answers apart, hard crowds them in', () => {
      atDifficulty('easy', () => {
        Facts.buildOptions(10, seeded(3)).forEach(option => {
          ok(option === 10 || Math.abs(option - 10) >= 2, `${option} sits next to the answer`);
        });
      });
      atDifficulty('hard', () => {
        ok(Facts.buildOptions(10, seeded(3)).includes(11), 'hard must offer the near miss');
      });
    });

    test('an explicit spread overrides the difficulty default', () => {
      atDifficulty('easy', () => {
        ok(Facts.buildOptions(10, seeded(3), 'tight').includes(11));
      });
    });

    /* ---- avatars ---------------------------------------------------------- */

    test('setAvatar ignores an id that is not on the roster', () => {
      const before = Character.getAvatar();
      eq(Character.setAvatar('dragon'), 'tiger', 'unknown avatars fall back to the tiger');
      eq(Character.avatarInfo('panda').emoji, '🐼');
      Character.setAvatar(before);
    });

    test('every avatar draws every growth stage in its own colours', () => {
      const before = Character.getAvatar();
      Character.AVATARS.forEach(avatar => {
        for (let stage = 0; stage < Character.STAGES.length; stage++) {
          const svg = Character.markupFor(avatar.id, stage);
          ok(svg.indexOf(avatar.fur) !== -1, `${avatar.id} stage ${stage} lost its palette`);
          ok(svg.indexOf(`cub-stage-${stage}`) !== -1, `${avatar.id} stage ${stage} mislabelled`);
        }
        const top = Character.markupFor(avatar.id, Character.STAGES.length - 1);
        ok(top.indexOf('cub-crown') !== -1, `${avatar.id} never gets the crown`);
      });
      eq(Character.getAvatar(), before, 'drawing an avatar must not select it');
    });

    /* ---- score.js --------------------------------------------------------- */

    const EASY_SUM = { answer: 5, addends: [2, 3] };
    const HARD_SUM = { answer: 14, addends: [5, 4, 5] };
    const OFF = { speed: false, mistakes: false, bonus: false };

    test('with every rule off a question is worth the base, however it went', () => {
      eq(Score.forQuestion(EASY_SUM, {}, { attempts: 1, elapsedMs: 500 }, OFF).points, Score.BASE);
      eq(Score.forQuestion(HARD_SUM, { tight: true }, { attempts: 5, elapsedMs: 90000 }, OFF).points,
        Score.BASE, 'a slow, messy answer still pays the base');
    });

    test('the speed bonus pays only on a first-try answer', () => {
      const rules = { speed: true, mistakes: false, bonus: false };
      const quick = Score.forQuestion(EASY_SUM, {}, { attempts: 1, elapsedMs: 1000 }, rules);
      ok(quick.points > Score.BASE, 'a fast first try earns extra');
      eq(Score.forQuestion(EASY_SUM, {}, { attempts: 2, elapsedMs: 1000 }, rules).points, Score.BASE,
        'a fast second try earns nothing extra');
      eq(Score.forQuestion(EASY_SUM, {}, { attempts: 1, elapsedMs: 60000 }, rules).points, Score.BASE,
        'a slow first try earns nothing extra');
    });

    test('the hard-question bonus reads the roster judgement of what is hard', () => {
      const rules = { speed: false, mistakes: false, bonus: true };
      eq(Score.forQuestion(EASY_SUM, {}, { attempts: 1 }, rules).points, Score.BASE,
        'a small two-addend sum is not a hard question');
      const hard = Score.forQuestion(HARD_SUM, { tight: true }, { attempts: 1 }, rules);
      ok(hard.points > Score.BASE, 'a big three-addend sum on a tricky stop pays more');
      eq(hard.parts.filter(part => part.points > 0).length, 4,
        'base, big answer, three numbers and tricky stop');
    });

    /* The whole promise of the scoring: trying again is never worth nothing. */
    test('points never fall below the floor however many tries it took', () => {
      const rules = { speed: false, mistakes: true, bonus: false };
      eq(Score.forQuestion(EASY_SUM, {}, { attempts: 12 }, rules).points, Score.MIN_POINTS);
    });

    test('rulesFrom keeps the bonus on and the punishing rules off by default', () => {
      eq(Score.rulesFrom({}), { speed: false, mistakes: false, bonus: true });
      eq(Score.rulesFrom(), { speed: false, mistakes: false, bonus: true });
      eq(Score.rulesFrom({ speed: true, bonus: false, avatar: 'fox' }),
        { speed: true, mistakes: false, bonus: false }, 'unknown keys are dropped');
    });

    test('the perfect-stop bonus needs both a clean sweep and the bonus rule', () => {
      ok(Score.stopBonus(true, { bonus: true }) > 0);
      eq(Score.stopBonus(false, { bonus: true }), 0, 'a stop with a slip earns no lump sum');
      eq(Score.stopBonus(true, { bonus: false }), 0, 'the rule is off');
    });

    test('describe names the rules in play, or says the scoring is relaxed', () => {
      eq(Score.describe(OFF), 'relaxed scoring');
      eq(Score.describe({ speed: true, mistakes: false, bonus: true }),
        'speed bonus, hard-question bonus');
    });

    /* ---- share.js --------------------------------------------------------- */

    test('durations read the way they are spoken', () => {
      eq(Share.formatDuration(0), '0s');
      eq(Share.formatDuration(48000), '48s');
      eq(Share.formatDuration(134000), '2m 14s');
      eq(Share.formatDuration(3780000), '1h 3m');
      eq(Share.formatDuration(-500), '0s', 'a clock skew must not print a minus');
    });

    test('a stop summary carries the numbers a grown-up wants to send', () => {
      const text = Share.levelSummary({
        stopId: 3, stopName: 'Vine Bridge', avatarEmoji: '🦊', avatarName: 'Fox',
        difficulty: 'easy', solved: 6, mistakes: 1, elapsedMs: 95000, points: 72, stars: '⭐⭐⭐'
      });
      ok(text.indexOf('Stop 3: Vine Bridge') !== -1, 'names the stop');
      ok(text.indexOf('Easy') !== -1, 'names the difficulty');
      ok(text.indexOf('6 sums solved') !== -1, 'counts the sums');
      ok(text.indexOf('1 slip') !== -1, 'one slip, not one slips');
      ok(text.indexOf('1m 35s') !== -1, 'says how long it took');
      ok(text.indexOf(Share.HOME) !== -1, 'links back to the game');
    });

    test('an adventure summary reads sensibly from a blank save', () => {
      const text = Share.adventureSummary(Progress.__test.blank(),
        { answered: 0, missed: 0, accuracy: 100 }, 20);
      ok(text.indexOf('0 of 20 stops cleared') !== -1);
      ok(text.split('\n').length === 6, 'six lines, always');
    });

    /* ---- settings --------------------------------------------------------- */

    test('settings survive a save and a load', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.reset();
      Progress.updateSettings({ avatar: 'koala', difficulty: 'hard', speed: true, done: true });
      const saved = Progress.settings();
      Progress.load();
      eq(Progress.settings(), saved);
      eq(Progress.settings().avatar, 'koala');
    });

    test('a save cannot smuggle in settings the game does not know', () => {
      const decoded = Progress.__test.decode(JSON.stringify({
        version: 1,
        settings: { avatar: 'fox', difficulty: 7, hacked: true }
      }));
      eq(decoded.settings.avatar, 'fox', 'a known value of the right type is kept');
      eq(decoded.settings.difficulty, 'medium', 'a value of the wrong type falls back');
      eq(Object.keys(decoded.settings), Object.keys(Progress.__test.blankSettings()),
        'no extra keys, and always in the blank order');
    });

    test('the lifetime score only ever goes up', () => {
      Progress.__test.useStorage(fakeStorage());
      Progress.reset();
      Progress.addScore(30);
      eq(Progress.addScore(-100), 0, 'points can be taken off, but never past zero');
      eq(Progress.get().score, 0);
    });

    /* ---- verify.js -------------------------------------------------------- */

    test('a question is passed only when its arithmetic actually holds', () => {
      eq(Verify.question({ addends: [3, 4], answer: 7 }), []);
      ok(Verify.question({ addends: [3, 4], answer: 8 }).length, 'a wrong total is caught');
      ok(Verify.question({ addends: [3], answer: 3 }).length, 'one addend is not a sum');
      ok(Verify.question({ addends: [1.5, 1.5], answer: 3 }).length, 'halves are not counts');
      ok(Verify.question({ addends: [14, 12], answer: 26 }).length, 'off the number line');
    });

    /* The equation for Missing Number prints one addend, a blank and the total,
       so a third addend would vanish from the screen while still counting
       towards the sum — the blank would then have no right answer. */
    test('a missing-number question may only ever have two addends', () => {
      eq(Verify.question({ addends: [2, 3, 4], answer: 9 }, 'missing').length, 1);
      eq(Verify.question({ addends: [2, 3, 4], answer: 9 }, 'critters'), []);
    });

    test('a set of choices must hold the answer once, and once only', () => {
      eq(Verify.choices([4, 7, 9, 2], 7), []);
      ok(Verify.choices([4, 8, 9, 2], 7).length, 'the answer is missing');
      ok(Verify.choices([7, 7, 9, 2], 7).length, 'the answer is on two buttons');
      ok(Verify.choices([4, 4, 7, 2], 7).length, 'a wrong answer is on two buttons');
      ok(Verify.choices([], 7).length, 'nothing to tap');
    });

    test('a broken choice list is repaired, a sound one is left exactly as it was', () => {
      const sound = [4, 7, 9, 2];
      ok(Verify.fixChoices(sound, 7) === sound, 'same array, same shuffled order');

      const fixed = Verify.fixChoices([4, 8, 9, 2], 7);
      eq(fixed.length, 4, 'still four buttons');
      eq(Verify.choices(fixed, 7), [], 'and now solvable');
      ok(fixed[0] !== 7, 'the answer is not parked in the first slot');
    });

    test('every stone on a fork carries the sum it claims to', () => {
      eq(Verify.routeStones([
        { value: 7, addends: [3, 4] },
        { value: 5, addends: [1, 4] }
      ], 7), []);
      ok(Verify.routeStones([
        { value: 7, addends: [3, 4] },
        { value: 5, addends: [1, 3] }
      ], 7).length, 'a stone labelled with the wrong split is caught');
    });

    test('a fruit tree has to be fillable, and no single fruit may already be it', () => {
      eq(Verify.buildTree([2, 5, 1, 3, 4, 6], 7, 2), []);
      eq(Verify.buildTree([4, 4, 1, 2, 3, 5], 8, 2), [], 'doubles need two of the same fruit');
      ok(Verify.buildTree([1, 2, 3, 4, 5, 6], 7, 3).length === 0);
      ok(Verify.buildTree([1, 1, 1, 2, 2, 2], 9, 2).length, 'no two of these make nine');
      ok(Verify.buildTree([7, 1, 2, 3, 4, 5], 7, 2).length, 'a fruit worth the whole total');
    });

    test('a scale is only fair when both pans can be made to meet', () => {
      eq(Verify.balanceRow([3, 4, 5, 6], 5, 0, 5), []);
      eq(Verify.balanceRow([3, 4, 5, 6], 5, 4, 9), [], 'a compound stop preloads a pan');
      ok(Verify.balanceRow([3, 4, 6, 7], 5, 0, 5).length, 'the weight is not in the row');
      ok(Verify.balanceRow([3, 4, 5, 6], 5, 4, 8).length, 'the pans cannot be squared');
      ok(Verify.balanceRow([0, 1, 2, 3], 0, 5, 5).length, 'nothing left to add');
    });

    test('a match board may not show the same total twice', () => {
      eq(Verify.matchBoard([
        { addends: [1, 2], answer: 3 },
        { addends: [2, 2], answer: 4 }
      ]), []);
      ok(Verify.matchBoard([
        { addends: [1, 2], answer: 3 },
        { addends: [0, 3], answer: 3 }
      ]).length, 'two cards both make three');
    });

    test('report says yes to a clean board and no to a faulty one', () => {
      ok(Verify.report('nowhere', []) === true);
      const said = [];
      const wasReport = window.reportProblem, wasWarn = console.warn;
      window.reportProblem = message => said.push(message);
      console.warn = () => {};        // the fault is deliberate; do not shout about it
      try {
        ok(Verify.report('stop 1', ['1+1 makes 2, not 3']) === false);
      } finally {
        window.reportProblem = wasReport;
        console.warn = wasWarn;
      }
      eq(said.length, 1, 'the grown-up is told, loudly');
      ok(said[0].indexOf('stop 1') !== -1 && said[0].indexOf('not 3') !== -1,
        'and told where and what');
    });

    /* The whole point of the referee: nothing the roster can deal may fail it. */
    test('every question the roster can deal passes its own checks', () => {
      Facts.DIFFICULTIES.forEach(level => {
        atDifficulty(level, () => {
          Facts.STOPS.forEach(stop => {
            const config = Facts.stop(stop.id);
            for (let run = 0; run < 8; run++) {
              const problems = Facts.generateStop(stop.id, {}, seeded(run * 13 + stop.id));
              problems.forEach(p => {
                eq(Verify.question(p, config.game), [],
                  `${level} stop ${stop.id}: ${p.addends.join('+')}=${p.answer}`);
                eq(Verify.choices(p.options, p.answer), [],
                  `${level} stop ${stop.id} options ${p.options} for ${p.answer}`);
              });
              if (config.game === 'match') {
                eq(Verify.matchBoard(problems.slice(0, 3)), [], `${level} stop ${stop.id} board 1`);
                eq(Verify.matchBoard(problems.slice(3, 6)), [], `${level} stop ${stop.id} board 2`);
              }
            }
          });
        });
      });
    });

    test('every board the three drawn mechanics build passes its own checks', () => {
      Facts.DIFFICULTIES.forEach(level => {
        atDifficulty(level, () => {
          Facts.STOPS.forEach(stop => {
            const config = Facts.stop(stop.id);
            if (!['route', 'build', 'balance'].includes(config.game)) return;

            for (let run = 0; run < 8; run++) {
              Facts.generateStop(stop.id, {}, seeded(run * 3 + stop.id)).forEach(p => {
                const where = `${level} stop ${stop.id} for ${p.addends.join('+')}`;
                if (config.game === 'route') {
                  eq(Verify.routeStones(Route.stonesFor(config, p), p.answer), [], where);
                } else if (config.game === 'build') {
                  const pick = config.pick || 2;
                  eq(Verify.buildTree(Build.treeFor(config, p), p.answer, pick), [], where);
                } else {
                  const preload = config.compound ? Balance.preloadFor(p) : 0;
                  const needed = p.answer - preload;
                  eq(Verify.balanceRow(Balance.weightsFor(p, needed), needed, preload, p.answer),
                    [], where);
                }
              });
            }
          });
        });
      });
    });

    /* ---- swapping a question ---------------------------------------------- */

    test('a swap deals a sound question from the same stop', () => {
      Facts.STOPS.forEach(stop => {
        const config = Facts.stop(stop.id);
        const pool = Facts.poolForStop(stop.id).map(Facts.factKey);
        for (let run = 0; run < 5; run++) {
          const fresh = Facts.replacement(stop.id, {}, seeded(run * 5 + stop.id));
          eq(Verify.question(fresh, config.game), [], `stop ${stop.id} swap`);
          ok(pool.indexOf(fresh.key) !== -1, `stop ${stop.id} swapped outside its own pool`);
        }
      });
    });

    test('a swap avoids the facts and totals already on the board', () => {
      const asked = Facts.generateStop(4, {}, seeded(99));
      const keys = asked.map(p => p.key);
      const answers = asked.map(p => p.answer);

      for (let run = 0; run < 20; run++) {
        const fresh = Facts.replacement(4, { keys, answers }, seeded(run * 31 + 7));
        ok(keys.indexOf(fresh.key) === -1, `swapped back to ${fresh.key}`);
        ok(answers.indexOf(fresh.answer) === -1, `swapped to a repeated total ${fresh.answer}`);
      }
    });

    /* A pool can genuinely run out of unseen facts. Handing back nothing would
       leave the child staring at the question he asked to be rid of, so the
       rules are relaxed in turn instead. */
    test('a swap still deals something when every fact has been seen', () => {
      const everything = Facts.poolForStop(1);
      const fresh = Facts.replacement(1, {
        keys: everything.map(Facts.factKey),
        answers: everything.map(f => f.reduce((a, b) => a + b, 0))
      }, seeded(3));
      eq(Verify.question(fresh), [], 'and what it deals is still a real sum');
    });

    test('only route and match need their totals to stay unique', () => {
      eq(Facts.needsDistinctAnswers('match'), true);
      eq(Facts.needsDistinctAnswers('route'), true);
      eq(Facts.needsDistinctAnswers('critters'), false);
      eq(Facts.needsDistinctAnswers('build'), false);
    });
  };

  /* Run `fn` with the difficulty dial turned, then always turn it back. */
  function atDifficulty(level, fn) {
    const before = Facts.getDifficulty();
    try {
      Facts.setDifficulty(level);
      fn();
    } finally {
      Facts.setDifficulty(before);
    }
  }

  /* ---- helpers ---------------------------------------------------------- */

  /* Deterministic rng so option and sample tests can't flake. */
  function seeded(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function fakeStorage(initial) {
    const m = initial ? { 'jungleAddition.v1': initial } : {};
    return {
      getItem: k => (k in m ? m[k] : null),
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: k => { delete m[k]; },
      _raw: m
    };
  }

  /* Can exactly `size` of these fruit hit the target? Subset size matters: the
     basket holds a fixed number of fruit, so a tree that only reaches the
     target with four of them is a dead end on a two-fruit stop. */
  function reachable(values, target, size) {
    /* sums[k] = every total k of the fruit seen so far can make. */
    let sums = [new Set([0])];
    for (let k = 1; k <= size; k++) sums.push(new Set());

    values.forEach(v => {
      for (let k = size; k >= 1; k--) {
        sums[k - 1].forEach(s => { if (s + v <= target) sums[k].add(s + v); });
      }
    });
    return sums[size].has(target);
  }
}());
