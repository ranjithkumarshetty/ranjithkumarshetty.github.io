/* character.js — the cub and his friend parade, drawn as inline SVG.
   Upgrades are additive layers so growth is a data change, not a redraw, and
   the cub himself is one rig in five coats: picking an avatar swaps a palette
   and two shapes, never the drawing. */
window.Character = (function () {
  'use strict';

  /* Same rig, different animal. `ear` and `marks` name a shape; everything
     else is colour. Adding a sixth cub is one row here. */
  const AVATARS = [
    { id: 'tiger',   name: 'Tiger',   emoji: '🐯', ear: 'round',   marks: 'stripes',
      fur: '#f59b3c', dark: '#e8892b', face: '#f9ad52', belly: '#ffe2bd',
      muzzle: '#fff3e0', inner: '#ffb9b0', mark: '#4a2c14', nose: '#c9524a' },
    { id: 'panda',   name: 'Panda',   emoji: '🐼', ear: 'round',   marks: 'patches',
      fur: '#f7f5ef', dark: '#ded9d0', face: '#fffdf8', belly: '#ffffff',
      muzzle: '#ffffff', inner: '#6f6a66', mark: '#2f2b28', nose: '#2f2b28',
      earFill: '#2f2b28' },
    { id: 'fox',     name: 'Fox',     emoji: '🦊', ear: 'pointed', marks: 'none',
      fur: '#ef7a45', dark: '#d95f2e', face: '#f58b58', belly: '#ffe9d6',
      muzzle: '#fff6ec', inner: '#ffc4ae', mark: '#6b3218', nose: '#43261a' },
    { id: 'koala',   name: 'Koala',   emoji: '🐨', ear: 'fluffy',  marks: 'none',
      fur: '#9fb0bb', dark: '#86969f', face: '#a9bac5', belly: '#e6edf1',
      muzzle: '#f2f6f8', inner: '#cfd8de', mark: '#44515a', nose: '#3b464e' },
    { id: 'leopard', name: 'Leopard', emoji: '🐆', ear: 'round',   marks: 'spots',
      fur: '#f2c14e', dark: '#d9a838', face: '#f6cc63', belly: '#fff0c9',
      muzzle: '#fff8e4', inner: '#ffd9a8', mark: '#4a3312', nose: '#8a4a2a' }
  ];

  let avatarId = AVATARS[0].id;

  function setAvatar(id) {
    avatarId = AVATARS.some(a => a.id === id) ? id : AVATARS[0].id;
    return avatarId;
  }

  function getAvatar() { return avatarId; }

  function avatarInfo(id) {
    return AVATARS.find(a => a.id === (id || avatarId)) || AVATARS[0];
  }

  function palette() { return avatarInfo(avatarId); }

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
    const p = palette();
    return `<path class="cub-tail" d="M72 78 q16 2 14 -12 q-1 -8 -8 -7"
              fill="none" stroke="${p.dark}" stroke-width="6" stroke-linecap="round"/>`;
  }

  function body() {
    const p = palette();
    return `
      <ellipse cx="50" cy="74" rx="21" ry="18" fill="${p.fur}"/>
      <ellipse cx="50" cy="79" rx="12" ry="11" fill="${p.belly}"/>
      <ellipse cx="34" cy="89" rx="7" ry="5" fill="${p.dark}"/>
      <ellipse cx="66" cy="89" rx="7" ry="5" fill="${p.dark}"/>`;
  }

  function head() {
    const p = palette();
    return `
      <g class="cub-head">
        ${ears(p)}

        <circle cx="50" cy="38" r="24" fill="${p.face}"/>

        ${marks(p)}

        <ellipse cx="50" cy="46" rx="13" ry="10" fill="${p.muzzle}"/>
        <circle class="cub-eye" cx="41" cy="36" r="4.2" fill="${p.mark}"/>
        <circle class="cub-eye" cx="59" cy="36" r="4.2" fill="${p.mark}"/>
        <circle cx="42.4" cy="34.6" r="1.5" fill="#fff"/>
        <circle cx="60.4" cy="34.6" r="1.5" fill="#fff"/>

        <path d="M46 43.5 h8 l-4 4 z" fill="${p.nose}"/>
        <path class="cub-mouth" d="M50 48 q-5 5 -9 1 M50 48 q5 5 9 1"
              stroke="${p.mark}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      </g>`;
  }

  /* Ears and markings are the only shape that changes between avatars, so each
     is one small dispatcher rather than five copies of the whole head. */
  function ears(p) {
    const outer = p.earFill || p.fur;
    if (p.ear === 'pointed') {
      return `
        <path d="M26 32 L30 10 L45 24 Z" fill="${outer}"/>
        <path d="M74 32 L70 10 L55 24 Z" fill="${outer}"/>
        <path d="M31 28 L33 18 L40 25 Z" fill="${p.inner}"/>
        <path d="M69 28 L67 18 L60 25 Z" fill="${p.inner}"/>`;
    }
    if (p.ear === 'fluffy') {
      return `
        <circle cx="28" cy="27" r="12" fill="${outer}"/>
        <circle cx="72" cy="27" r="12" fill="${outer}"/>
        <circle cx="28" cy="27" r="7"  fill="${p.inner}"/>
        <circle cx="72" cy="27" r="7"  fill="${p.inner}"/>`;
    }
    return `
      <circle cx="33" cy="26" r="8.5" fill="${outer}"/>
      <circle cx="67" cy="26" r="8.5" fill="${outer}"/>
      <circle cx="33" cy="26" r="4"   fill="${p.inner}"/>
      <circle cx="67" cy="26" r="4"   fill="${p.inner}"/>`;
  }

  function marks(p) {
    if (p.marks === 'spots') {
      return `
        <circle cx="36" cy="26" r="2.6" fill="${p.mark}" opacity=".55"/>
        <circle cx="50" cy="22" r="2.2" fill="${p.mark}" opacity=".55"/>
        <circle cx="64" cy="26" r="2.6" fill="${p.mark}" opacity=".55"/>
        <circle cx="31" cy="40" r="2.4" fill="${p.mark}" opacity=".45"/>
        <circle cx="69" cy="40" r="2.4" fill="${p.mark}" opacity=".45"/>`;
    }
    /* The white discs keep the eyes readable: they are drawn in the mark colour
       further down, which on a panda is the patch colour too. */
    if (p.marks === 'patches') {
      return `
        <ellipse cx="41" cy="36" rx="8" ry="9" fill="${p.mark}" transform="rotate(-14 41 36)"/>
        <ellipse cx="59" cy="36" rx="8" ry="9" fill="${p.mark}" transform="rotate(14 59 36)"/>
        <circle cx="41" cy="36" r="5" fill="#fff"/>
        <circle cx="59" cy="36" r="5" fill="#fff"/>`;
    }
    if (p.marks === 'stripes') {
      return `
        <path d="M38 20 q3 6 1 11" stroke="${p.mark}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M50 17 q0 6 0 10"  stroke="${p.mark}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M62 20 q-3 6 -1 11" stroke="${p.mark}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
    return '';
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

  /* Draw any avatar without disturbing the chosen one — the picker needs all
     five at once, and every drawing function reads the module's current pick. */
  function markupFor(id, stage) {
    const previous = avatarId;
    avatarId = avatarInfo(id).id;
    const svg = markup(stage);
    avatarId = previous;
    return svg;
  }

  /* The picker shows the real rig rather than an emoji stand-in, so the child
     chooses the cub they will actually play as. */
  function renderChoices(host, selectedId) {
    host.innerHTML = AVATARS.map(a => `
      <button class="avatar-option${a.id === selectedId ? ' selected' : ''}" type="button"
              data-avatar="${a.id}" aria-pressed="${a.id === selectedId}">
        <svg class="avatar-svg" viewBox="0 0 100 100" aria-hidden="true">${markupFor(a.id, 0)}</svg>
        <span class="avatar-name">${a.name}</span>
      </button>`).join('');
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

  return {
    FRIENDS,
    STAGES,
    AVATARS,
    stageInfo,
    setAvatar,
    getAvatar,
    avatarInfo,
    markup,
    markupFor,
    render,
    renderChoices,
    renderParade,
    renderCollection,
    friendAt
  };
})();
