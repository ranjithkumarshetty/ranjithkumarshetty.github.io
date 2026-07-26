/* map.js — the winding jungle trail.
   The map is the spine of the game: one SVG, one node per stop in the roster,
   the cub standing on the furthest one he has unlocked. Everything is redrawn
   from progress state, so there is no partial-update logic to get wrong. */
window.Map = (function () {
  'use strict';

  const VIEW_WIDTH = 100;

  /* The trail is generated from the roster, so adding stops to facts.js extends
     the map with no edit here. Bottom to top, so walking up the screen means
     going deeper into the jungle. */
  const TOP_MARGIN = 26;
  const BOTTOM_MARGIN = 24;
  const SPACING = 27;
  const X_CYCLE = [24, 50, 76, 50];   // left, centre, right, centre — a switchback

  const VIEW_HEIGHT = TOP_MARGIN + BOTTOM_MARGIN + (Facts.STOPS.length - 1) * SPACING;

  const NODES = Facts.STOPS.map((stop, i) => ({
    id: stop.id,
    x: X_CYCLE[i % X_CYCLE.length],
    y: VIEW_HEIGHT - BOTTOM_MARGIN - i * SPACING
  }));

  /* One band per region, spanning from half a step below its first stop to half
     a step above its last — the outermost regions run to the SVG edges. */
  const BANDS = Facts.REGIONS.map((region, index) => {
    const ys = region.stops.map(id => nodeFor(id).y);
    const top = index === Facts.REGIONS.length - 1 ? 0 : Math.min(...ys) - SPACING / 2;
    const bottom = index === 0 ? VIEW_HEIGHT : Math.max(...ys) + SPACING / 2;
    return { region: region.id, top, height: bottom - top };
  });

  const CHARACTER_SCALE = 0.34;

  let host = null;
  let onSelect = null;

  function nodeFor(stopId) {
    return NODES[stopId - 1];
  }

  /* ---- rendering ----------------------------------------------------------- */

  /* `characterStop` overrides where the cub is drawn — used right after a level
     so he starts on the stop he just finished and can then walk forward. */
  function render(svgHost, handler, characterStop) {
    host = svgHost;
    if (handler) onSelect = handler;

    const state = Progress.get();
    const current = Progress.currentStop();
    const standingOn = characterStop || current;

    host.setAttribute('viewBox', `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`);
    host.innerHTML =
      bandsMarkup() +
      sceneryMarkup() +
      trailMarkup(current) +
      NODES.map(node => nodeMarkup(node, state, current)).join('') +
      characterMarkup(standingOn, state.stage);

    scrollTo(standingOn);

    host.querySelectorAll('.map-node').forEach(group => {
      const stopId = Number(group.dataset.stop);
      group.addEventListener('click', () => {
        if (!Progress.isUnlocked(stopId)) {
          Celebrate.pulse(group, 'wobble', 500);
          Sound.speak('Finish the stop before this one first!');
          return;
        }
        Sound.pop();
        if (onSelect) onSelect(stopId);
      });
    });
  }

  function bandsMarkup() {
    return BANDS.map(band => {
      const region = Facts.REGIONS[band.region];
      const cleared = Progress.regionIsCleared(band.region);
      return `
        <g class="map-band band-${band.region} ${cleared ? 'band-cleared' : ''}">
          <rect x="0" y="${band.top}" width="${VIEW_WIDTH}" height="${band.height}"/>
          <text class="band-label" x="4" y="${band.top + 9}">
            ${region.emoji} ${region.name}${cleared ? ' ✓' : ''}
          </text>
        </g>`;
    }).join('');
  }

  /* Purely decorative, but derived from the node rows so a longer trail gets
     more jungle instead of a bare strip at the top. */
  function sceneryMarkup() {
    const peaks = `
      <path class="peak" d="M2 44 L16 14 L30 44 Z"/>
      <path class="peak" d="M70 40 L84 8 L98 40 Z"/>
      <path class="peak peak-far" d="M34 46 L50 20 L66 46 Z"/>`;

    /* A tree beside every other stop, alternating sides, skipping the peaks. */
    const trees = NODES
      .filter((node, i) => i % 2 === 1 && node.y > 100)
      .map((node, i) => [i % 2 ? 92 : 8, node.y - 12])
      .map(([x, y]) => `
      <g class="tree" transform="translate(${x} ${y})">
        <rect x="-1.2" y="0" width="2.4" height="9" rx="1"/>
        <circle cx="0" cy="-2" r="6"/>
        <circle cx="-4" cy="1" r="4.2"/>
        <circle cx="4" cy="1" r="4.2"/>
      </g>`).join('');

    const river = `<path class="river" d="M0 ${VIEW_HEIGHT - 6} q26 -8 50 0 q24 8 50 0
                     L100 ${VIEW_HEIGHT} L0 ${VIEW_HEIGHT} Z"/>`;

    return peaks + trees + river;
  }

  function trailMarkup(current) {
    const full = smoothPath(NODES);
    const walked = smoothPath(NODES.slice(0, Math.max(1, current)));

    return `
      <path class="trail trail-base" d="${full}"/>
      <path class="trail trail-dots" d="${full}"/>
      ${current > 1 ? `<path class="trail trail-walked" d="${walked}"/>` : ''}`;
  }

  /* Catmull-Rom through the stop centres, so the path actually touches every
     node instead of merely passing near it. */
  function smoothPath(points) {
    if (points.length < 2) return `M ${points[0].x} ${points[0].y}`;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  function nodeMarkup(node, state, current) {
    const cleared = state.clearedStops.includes(node.id);
    const unlocked = Progress.isUnlocked(node.id);
    const isCurrent = node.id === current;
    const stop = Facts.stop(node.id);

    const classes = ['map-node'];
    if (cleared) classes.push('node-cleared');
    if (!unlocked) classes.push('node-locked');
    if (isCurrent) classes.push('node-current');

    const face = cleared
      ? `<text class="node-friend" x="${node.x}" y="${node.y + 3.4}">${Character.friendAt(node.id - 1)}</text>`
      : unlocked
        ? `<text class="node-number" x="${node.x}" y="${node.y + 3.2}">${node.id}</text>`
        : `<text class="node-lock" x="${node.x}" y="${node.y + 2.8}">🔒</text>`;

    return `
      <g class="${classes.join(' ')}" data-stop="${node.id}" role="button" tabindex="0"
         aria-label="Stop ${node.id}: ${stop.title}${cleared ? ', cleared' : unlocked ? '' : ', locked'}">
        ${isCurrent ? `<circle class="node-halo" cx="${node.x}" cy="${node.y}" r="12"/>` : ''}
        <circle class="node-disc" cx="${node.x}" cy="${node.y}" r="8.5"/>
        ${face}
        ${cleared ? `<circle class="node-tick" cx="${node.x + 6}" cy="${node.y - 6}" r="3"/>
                     <text class="node-tick-mark" x="${node.x + 6}" y="${node.y - 4.9}">✓</text>` : ''}
      </g>`;
  }

  function characterMarkup(stopId, stage) {
    const node = nodeFor(stopId);
    const offset = 50 * CHARACTER_SCALE;   // centre a 100x100 cub on the node
    return `
      <g id="map-character" class="map-character"
         style="transform: translate(${(node.x - offset).toFixed(1)}px, ${(node.y - offset - 9).toFixed(1)}px) scale(${CHARACTER_SCALE})">
        ${Character.markup(stage)}
      </g>`;
  }

  /* ---- the walk between stops ---------------------------------------------- */

  /* Slide the cub to a stop and resolve when he lands, so the caller can
     sequence a celebration after the walk rather than on top of it. */
  function walkTo(stopId) {
    return new Promise(resolve => {
      const group = host && host.querySelector('#map-character');
      const node = nodeFor(stopId);
      if (!group || !node) { resolve(); return; }

      const offset = 50 * CHARACTER_SCALE;
      scrollTo(stopId);
      group.classList.add('walking');
      group.style.transform =
        `translate(${(node.x - offset).toFixed(1)}px, ${(node.y - offset - 9).toFixed(1)}px) scale(${CHARACTER_SCALE})`;

      const done = () => { group.classList.remove('walking'); resolve(); };
      if (Celebrate.reducedMotion()) { done(); return; }
      setTimeout(done, 1000);
    });
  }

  /* The trail is taller than any screen, so keep the cub in view. */
  function scrollTo(stopId) {
    const frame = host && host.parentElement;
    const node = nodeFor(stopId);
    if (!frame || !node) return;

    requestAnimationFrame(() => {
      const drawnHeight = host.getBoundingClientRect().height;
      if (!drawnHeight) return;
      const y = (node.y / VIEW_HEIGHT) * drawnHeight;
      frame.scrollTop = Math.max(0, y - frame.clientHeight / 2);
    });
  }

  function focusStop(stopId) {
    const group = host && host.querySelector(`.map-node[data-stop="${stopId}"]`);
    if (group) Celebrate.pulse(group, 'node-pop', 700);
  }

  return { NODES, render, walkTo, focusStop, scrollTo, nodeFor };
})();
