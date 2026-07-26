#!/usr/bin/env node
/* Headless runner for the logic suite — the same tests tests.html shows in a
 * browser. Run from the project root:  node tools/run-tests.js
 *
 * The app ships as plain <script> tags with no build step, so there is nothing
 * to import: give the modules a `window` and eval them in order.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = global;

[
  /* First: facts.js signs every question off through it as it is built. */
  'js/verify.js',
  'js/facts.js',
  'js/progress.js',
  /* Pure arithmetic and pure string building — no DOM, no browser APIs. */
  'js/score.js',
  'js/share.js',
  /* character.js only touches the DOM through the markup string it returns. */
  'js/character.js',
  /* The three new mechanics only touch the DOM inside show(); their
     board-shaping helpers are pure, so they run fine with no jsdom. */
  'js/route.js',
  'js/build.js',
  'js/balance.js',
  'js/badges.js',
  'tests/suite.js'
].forEach(file => eval(fs.readFileSync(path.join(ROOT, file), 'utf8')));

let passed = 0, failed = 0;

TestSuite({
  test(name, fn) {
    try { fn(); passed++; console.log('  ok   ' + name); }
    catch (err) { failed++; console.log('  FAIL ' + name + '\n       ' + err.message); }
  },
  ok(cond, msg) { if (!cond) throw new Error(msg || 'expected truthy'); },
  eq(actual, expected, msg) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${msg ? msg + ': ' : ''}expected ${e}, got ${a}`);
  }
});

console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
