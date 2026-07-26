/* character.js — the tiger cub and his friend parade, drawn as inline SVG.
   Upgrades are additive layers so growth is a data change, not a redraw. */
window.Character = (function () {
  'use strict';

  /* One friend per stop cleared, in the order they join the parade. Positions
     16 and 20 are the two rescue stops, so the puppy and the guide dog land on
     exactly the stops where a dog is being saved — no special-casing needed. */
  const FRIENDS = [
    '🦜', '🐒', '🐸', '🐢', '🦥', '🦎', '🦋', '🐘', '🐍', '🐨',
    '🦩', '🐼', '🦉', '🐿️', '🦔', '🐶', '🐊', '🦚', '🦇', '🦮'
  ];

  const STAGES = [
    { scale: 1.00, label: 'Cub' },
    { scale: 1.06, label: 'Explorer' },   // + hat
    { scale: 1.18, label: 'Adventurer' }, // + backpack
    { scale: 1.30, label: 'Champion' },   // + medal, sparkle aura
    { scale: 1.42, label: 'Guardian' },   // + cape
    { scale: 1.52, label: 'Legend' }      // + crown, brighter aura
  ];

  function stageInfo(stage) {
    return STAGES[Math.max(0, Math.min(STAGES.length - 1, stage))];
  }

  /* Inner SVG content for a 100x100 viewBox, so the same markup nests inside
     the map SVG and stands alone on the level screen. */
  function markup(stage) {
    const s = Math.max(0, Math.min(STAGES.length - 1, stage || 0));
    return `
      <g class="cub cub-stage-${s}">
        ${s >= 3 ? aura() : ''}
        ${s >= 4 ? cape() : ''}
        ${s >= 2 ? backpack() : ''}
        ${tail()}
        ${body()}
        ${s >= 3 ? medal() : ''}
        ${head()}
        ${s >= 5 ? crown() : s >= 1 ? hat() : ''}
      </g>`;
  }

  function tail() {
    return `<path class="cub-tail" d="M72 78 q16 2 14 -12 q-1 -8 -8 -7"
              fill="none" stroke="#e8892b" stroke-width="6" stroke-linecap="round"/>`;
  }

  function body() {
    return `
      <ellipse cx="50" cy="74" rx="21" ry="18" fill="#f59b3c"/>
      <ellipse cx="50" cy="79" rx="12" ry="11" fill="#ffe2bd"/>
      <ellipse cx="34" cy="89" rx="7" ry="5" fill="#e8892b"/>
      <ellipse cx="66" cy="89" rx="7" ry="5" fill="#e8892b"/>`;
  }

  function head() {
    return `
      <g class="cub-head">
        <circle cx="33" cy="26" r="8.5" fill="#f59b3c"/>
        <circle cx="67" cy="26" r="8.5" fill="#f59b3c"/>
        <circle cx="33" cy="26" r="4"   fill="#ffb9b0"/>
        <circle cx="67" cy="26" r="4"   fill="#ffb9b0"/>

        <circle cx="50" cy="38" r="24" fill="#f9ad52"/>

        <path d="M38 20 q3 6 1 11" stroke="#4a2c14" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M50 17 q0 6 0 10"  stroke="#4a2c14" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M62 20 q-3 6 -1 11" stroke="#4a2c14" stroke-width="3" fill="none" stroke-linecap="round"/>

        <ellipse cx="50" cy="46" rx="13" ry="10" fill="#fff3e0"/>
        <circle class="cub-eye" cx="41" cy="36" r="4.2" fill="#3a2411"/>
        <circle class="cub-eye" cx="59" cy="36" r="4.2" fill="#3a2411"/>
        <circle cx="42.4" cy="34.6" r="1.5" fill="#fff"/>
        <circle cx="60.4" cy="34.6" r="1.5" fill="#fff"/>

        <path d="M46 43.5 h8 l-4 4 z" fill="#c9524a"/>
        <path class="cub-mouth" d="M50 48 q-5 5 -9 1 M50 48 q5 5 9 1"
              stroke="#8a4a2a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      </g>`;
  }

  function hat() {
    return `
      <g class="cub-hat">
        <ellipse cx="50" cy="18" rx="30" ry="7" fill="#c8a25f"/>
        <path d="M32 18 q2 -16 18 -16 q16 0 18 16 z" fill="#dfb974"/>
        <rect x="32" y="13" width="36" height="5" rx="2.5" fill="#8a6b34"/>
      </g>`;
  }

  function backpack() {
    return `
      <g class="cub-pack">
        <rect x="18" y="60" width="20" height="24" rx="7" fill="#7a5230"/>
        <rect x="18" y="68" width="20" height="5" fill="#5d3d22"/>
        <rect x="21" y="74" width="8" height="6" rx="2" fill="#c8a25f"/>
      </g>`;
  }

  function medal() {
    return `
      <g class="cub-medal">
        <path d="M45 62 l5 8 l5 -8" stroke="#e05a4f" stroke-width="4" fill="none"/>
        <circle cx="50" cy="76" r="7.5" fill="#ffd166" stroke="#e0a52e" stroke-width="2"/>
        <text x="50" y="80" text-anchor="middle" font-size="9" fill="#a8721a" font-weight="700">★</text>
      </g>`;
  }

  function aura() {
    return `
      <g class="cub-aura">
        <circle cx="16" cy="34" r="2.6" fill="#ffe680"/>
        <circle cx="86" cy="46" r="2.2" fill="#fff2b0"/>
        <circle cx="24" cy="82" r="2"   fill="#ffe680"/>
        <circle cx="82" cy="16" r="2.4" fill="#fff2b0"/>
      </g>`;
  }

  /* Drawn before the body, so the body covers the middle and only the flare
     shows — a cape rather than a bib. */
  function cape() {
    return `
      <g class="cub-cape">
        <path d="M50 52 q-26 6 -22 38 q22 8 44 0 q4 -32 -22 -38 z" fill="#2f7d5c"/>
        <path d="M50 52 q-14 3 -12 20 q12 4 24 0 q2 -17 -12 -20 z" fill="#3f9a72"/>
      </g>`;
  }

  function crown() {
    return `
      <g class="cub-crown">
        <path d="M30 18 l5 -14 l7 9 l8 -13 l8 13 l7 -9 l5 14 z"
              fill="#ffd166" stroke="#e0a52e" stroke-width="1.5"/>
        <circle cx="50" cy="6" r="2.4" fill="#ff6b6b"/>
        <rect x="30" y="17" width="40" height="5" rx="2.5" fill="#e0a52e"/>
      </g>`;
  }

  /* ---- rendering helpers -------------------------------------------------- */

  /* A standalone character, sized in CSS by the caller. */
  function render(host, stage) {
    host.innerHTML =
      `<svg class="character-svg" viewBox="0 0 100 100" aria-hidden="true">${markup(stage)}</svg>`;
  }

  /* The conga line of friends earned so far — the always-visible trophy case. */
  function renderParade(host, friendCount) {
    const count = Math.max(0, Math.min(FRIENDS.length, friendCount || 0));
    host.innerHTML = FRIENDS.slice(0, count)
      .map((emoji, i) =>
        `<span class="friend" style="animation-delay:${(i * 0.13).toFixed(2)}s">${emoji}</span>`)
      .join('');
    host.setAttribute('aria-label', `${count} animal friends`);
  }

  /* The full roster with the not-yet-earned slots showing as empty paw prints —
     the parade shows what he has, this shows what is still out there. */
  function renderCollection(host, friendCount) {
    const count = Math.max(0, Math.min(FRIENDS.length, friendCount || 0));
    host.innerHTML = FRIENDS
      .map((emoji, i) => i < count
        ? `<span class="collect-slot earned" title="Stop ${i + 1}">${emoji}</span>`
        : `<span class="collect-slot locked" title="Stop ${i + 1}">🐾</span>`)
      .join('');
    host.setAttribute('aria-label', `${count} of ${FRIENDS.length} animal friends found`);
  }

  function friendAt(index) {
    return FRIENDS[index % FRIENDS.length];
  }

  return { FRIENDS, STAGES, stageInfo, markup, render, renderParade, renderCollection, friendAt };
})();
