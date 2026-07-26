/* celebrate.js — the whole reward vocabulary: confetti, balloons, fireworks,
   leaf puffs, star bursts, screen flashes, emoji rain and big text.
   Tiered so small rewards stay cheap and big ones stay special — if everything
   is a party then nothing is. Every effect caps its particle count and honours
   prefers-reduced-motion. */
window.Celebrate = (function () {
  'use strict';

  const COLORS = ['#ffd166', '#ff9f45', '#ff6b6b', '#7ed957', '#4ecdc4', '#c77dff', '#fff8e7'];
  const BALLOON_COLORS = ['#ff6b6b', '#ffd166', '#7ed957', '#4ecdc4', '#c77dff', '#ff9f45'];
  const LEAF_GLYPHS = ['🍃', '✨'];
  const STAR_GLYPHS = ['⭐', '🌟', '💫', '✨'];

  const TAU = Math.PI * 2;
  const MAX_CONFETTI = 120;      // per confetti() call
  const MAX_PARTICLES = 280;     // the canvas ceiling, shared with fireworks
  const MAX_BALLOONS = 8;
  const MAX_SHELLS = 5;
  const MAX_RAIN = 26;
  const SHELL_GAP_MS = 320;

  let canvas = null;
  let ctx = null;
  let particles = [];
  let running = false;

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function scaled(count) {
    return reducedMotion() ? Math.ceil(count / 3) : count;
  }

  /* A browser that refuses a 2d context must cost us confetti, not the game. */
  function init(canvasEl, balloonLayerEl) {
    canvas = canvasEl;
    try {
      ctx = canvas && canvas.getContext('2d');
    } catch (err) {
      ctx = null;
    }
    Celebrate.balloonLayer = balloonLayerEl;
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- canvas particles ---------------------------------------------------- */

  /* Confetti and firework sparks share one physics loop; they differ only in
     these numbers, so a new canvas effect is a set of overrides rather than a
     second animation frame. */
  function spark(props) {
    return Object.assign({
      x: 0, y: 0, vx: 0, vy: 0,
      size: 8, color: COLORS[0],
      angle: 0, spin: 0, wobble: 0,
      gravity: 0.42, drag: 0.995, sway: 1.1,
      alpha: 1, fade: 0, round: false
    }, props);
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function confetti(count) {
    if (!ctx) return;
    const total = Math.min(scaled(count || 90), MAX_CONFETTI);
    const width = window.innerWidth;

    for (let i = 0; i < total; i++) {
      particles.push(spark({
        x: width * (0.15 + Math.random() * 0.7),
        y: window.innerHeight * (0.35 + Math.random() * 0.15),
        vx: (Math.random() - 0.5) * 11,
        vy: -9 - Math.random() * 11,
        size: 6 + Math.random() * 7,
        color: pick(COLORS),
        spin: (Math.random() - 0.5) * 0.35,
        angle: Math.random() * TAU,
        wobble: Math.random() * TAU
      }));
    }
    trim();
    start();
  }

  /* The biggest canvas reward: shells that go up one after another rather than
     all at once, so it reads as a display instead of one loud bang. */
  function fireworks(bursts) {
    if (!ctx) return;
    const shells = Math.min(scaled(bursts || 3), MAX_SHELLS);
    for (let i = 0; i < shells; i++) {
      setTimeout(shell, i * SHELL_GAP_MS);
    }
  }

  function shell() {
    if (!ctx) return;
    const originX = window.innerWidth * (0.2 + Math.random() * 0.6);
    const originY = window.innerHeight * (0.16 + Math.random() * 0.3);
    const color = pick(COLORS);
    const arms = scaled(22);

    for (let i = 0; i < arms; i++) {
      const angle = (i / arms) * TAU;
      const speed = 4.5 + Math.random() * 3;
      particles.push(spark({
        x: originX, y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 3,
        color: color,
        gravity: 0.11, drag: 0.965, sway: 0.2,
        fade: 0.016, round: true
      }));
    }
    trim();
    start();
  }

  /* Drop the oldest sparks rather than refusing the new ones, so a burst that
     arrives during a busy moment still shows up. */
  function trim() {
    if (particles.length > MAX_PARTICLES) particles = particles.slice(-MAX_PARTICLES);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(step);
  }

  function step() {
    if (!ctx) { running = false; return; }
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const height = window.innerHeight;
    particles = particles.filter(p => {
      p.vy += p.gravity;
      p.wobble += 0.12;
      p.x += p.vx + Math.sin(p.wobble) * p.sway;
      p.y += p.vy;
      p.vx *= p.drag;
      p.angle += p.spin;
      p.alpha -= p.fade;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();

      return p.alpha > 0.03 && p.y < height + 40;
    });

    if (particles.length) {
      requestAnimationFrame(step);
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      running = false;
    }
  }

  function clearConfetti() {
    particles = [];
    if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  /* ---- balloons ----------------------------------------------------------- */

  function balloons(count) {
    const layer = Celebrate.balloonLayer;
    if (!layer) return;
    const total = Math.min(scaled(count || 5), MAX_BALLOONS);

    for (let i = 0; i < total; i++) {
      const balloon = document.createElement('div');
      balloon.className = 'balloon';
      balloon.style.left = (4 + Math.random() * 92) + '%';
      balloon.style.setProperty('--balloon-color',
        BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)]);
      balloon.style.setProperty('--drift', ((Math.random() - 0.5) * 90).toFixed(0) + 'px');
      balloon.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
      balloon.style.animationDuration = (3.4 + Math.random() * 1.8).toFixed(2) + 's';
      balloon.addEventListener('animationend', () => balloon.remove());
      layer.appendChild(balloon);
    }
  }

  /* ---- small per-answer effects -------------------------------------------- */

  /* A puff of leaves at an element's centre — the cheap, frequent reward. */
  function leafPuff(element) {
    glyphBurst(element, LEAF_GLYPHS, 7, 170, 'leaf-bit');
  }

  /* The same puff turned up: bigger, brighter, wider. For the moments that
     deserve more than a leaf but less than the whole screen. */
  function starBurst(element) {
    glyphBurst(element, STAR_GLYPHS, 11, 240, 'leaf-bit star-bit');
  }

  function glyphBurst(element, glyphs, count, spread, className) {
    const layer = Celebrate.balloonLayer;
    if (!layer || !element) return;

    const box = element.getBoundingClientRect();
    const originX = box.left + box.width / 2;
    const originY = box.top + box.height / 2;
    const total = scaled(count);

    for (let i = 0; i < total; i++) {
      const bit = document.createElement('div');
      bit.className = className;
      bit.textContent = pick(glyphs);
      bit.style.left = originX + 'px';
      bit.style.top = originY + 'px';
      bit.style.setProperty('--dx', ((Math.random() - 0.5) * spread).toFixed(0) + 'px');
      bit.style.setProperty('--dy', (-40 - Math.random() * 110).toFixed(0) + 'px');
      bit.style.setProperty('--rot', ((Math.random() - 0.5) * 360).toFixed(0) + 'deg');
      bit.addEventListener('animationend', () => bit.remove());
      layer.appendChild(bit);
    }
  }

  /* ---- whole-screen effects ------------------------------------------------- */

  /* A single wash of warm light. Cheap, instant, and the one effect that reads
     even in peripheral vision — so it marks the moment something changed.
     Skipped entirely under reduced motion, where a flash is the worst offender. */
  function flash() {
    const layer = Celebrate.balloonLayer;
    if (!layer || reducedMotion()) return;
    layer.appendChild(disposable('flash-wash'));
  }

  /* Themed rain — 🐾 for a friend, 💎 for treasure. Says what was won in a way
     a five-year-old reads without any words at all. */
  function emojiRain(emoji, count) {
    const layer = Celebrate.balloonLayer;
    if (!layer) return;
    const total = Math.min(scaled(count || 14), MAX_RAIN);

    for (let i = 0; i < total; i++) {
      const drop = disposable('rain-drop');
      drop.textContent = emoji;
      drop.style.left = (2 + Math.random() * 96) + '%';
      drop.style.fontSize = (22 + Math.random() * 22).toFixed(0) + 'px';
      drop.style.setProperty('--drift', ((Math.random() - 0.5) * 120).toFixed(0) + 'px');
      drop.style.setProperty('--spin', ((Math.random() - 0.5) * 540).toFixed(0) + 'deg');
      drop.style.animationDelay = (Math.random() * 1.1).toFixed(2) + 's';
      drop.style.animationDuration = (2.6 + Math.random() * 1.6).toFixed(2) + 's';
      layer.appendChild(drop);
    }
  }

  /* Three or four words punched across the middle of the screen. He reads a
     little, so keep it short and keep it spoken elsewhere. */
  function bigText(text) {
    const layer = Celebrate.balloonLayer;
    if (!layer) return;
    const banner = disposable('big-text');
    banner.textContent = text;
    layer.appendChild(banner);
  }

  /* A small label that lifts off an element and fades — "+12", "Nice!". Anchored
     to the thing it is about, unlike bigText which owns the whole screen. */
  function floatText(element, text, className) {
    const layer = Celebrate.balloonLayer;
    if (!layer || !element || !text) return;

    const box = element.getBoundingClientRect();
    const label = disposable('float-label' + (className ? ' ' + className : ''));
    label.textContent = text;
    label.style.left = (box.left + box.width / 2) + 'px';
    label.style.top = (box.top + box.height / 4) + 'px';
    layer.appendChild(label);
  }

  /* Every screen effect is a one-shot div that sweeps itself up. */
  function disposable(className) {
    const node = document.createElement('div');
    node.className = className;
    node.addEventListener('animationend', () => node.remove());
    return node;
  }

  /* Restart a CSS animation class on an element. */
  function pulse(element, className, duration) {
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth;               // force reflow so the class re-triggers
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), duration || 700);
  }

  function clearAll() {
    clearConfetti();
    if (Celebrate.balloonLayer) Celebrate.balloonLayer.innerHTML = '';
  }

  return {
    init, pulse, clearConfetti, clearAll, reducedMotion,
    confetti, fireworks, balloons,
    leafPuff, starBurst,
    flash, emojiRain, bigText, floatText
  };
})();
