/* profile.js — the Explorer Card.
   The map shows where he is going; this shows how far he has come. Everything
   on it already existed somewhere — the cub, the friends, the badges, the
   counts — it was just scattered across screens he only sees for a moment.
   Gathering it into one card he can open whenever he likes is the whole point:
   progress you can look at is progress worth chasing.

   Read-only. It renders from saved state and never writes any. */
window.Profile = (function () {
  'use strict';

  function render(host) {
    if (!host) return;
    const state = Progress.get();
    const stats = Progress.stats();
    const stage = Character.stageInfo(state.stage);
    const totalStops = Facts.STOPS.length;

    host.innerHTML = `
      <div class="explorer-card">
        <div class="card-cub" id="profile-cub"></div>
        <div class="card-titles">
          <p class="card-rank">${stage.label}</p>
          <h3 class="card-name">Jungle Explorer</h3>
          <p class="card-next">${nextRankLine(state)}</p>
        </div>
      </div>

      <div class="profile-bar" role="img"
           aria-label="${state.clearedStops.length} of ${totalStops} stops cleared">
        <div class="profile-bar-fill"
             style="width:${percent(state.clearedStops.length, totalStops)}%"></div>
        <span class="profile-bar-text">${state.clearedStops.length} / ${totalStops} stops</span>
      </div>

      <h4 class="profile-heading">Your jungle</h4>
      <ul class="region-list">${Facts.REGIONS.map(regionRow).join('')}</ul>

      <h4 class="profile-heading">
        Friends <span class="heading-count">${state.friends} / ${Character.FRIENDS.length}</span>
      </h4>
      <div class="collection" id="profile-friends"></div>

      <h4 class="profile-heading">
        Badges <span class="heading-count">${Badges.earnedCount()} / ${Badges.total()}</span>
      </h4>
      <div class="badge-grid" id="profile-badges"></div>

      <h4 class="profile-heading">Numbers</h4>
      <div class="stat-row">
        ${statTile('🧮', stats.answered, 'sums solved')}
        ${statTile('✅', stats.accuracy + '%', 'first-try right')}
        ${statTile('🎯', state.perfectStops, 'perfect stops')}
      </div>`;

    Character.render(host.querySelector('#profile-cub'), state.stage);
    Character.renderCollection(host.querySelector('#profile-friends'), state.friends);
    Badges.renderGrid(host.querySelector('#profile-badges'));
  }

  /* Rank comes from cleared regions, so the goal is always "finish the region
     you are standing in" — a target he can see on the map. */
  function nextRankLine(state) {
    const next = Character.STAGES[state.stage + 1];
    if (!next) return 'You have grown as big as the jungle! 👑';

    const region = Facts.REGIONS.find(r => !r.stops.every(Progress.isCleared));
    if (!region) return `Next rank: ${next.label}`;

    const left = region.stops.filter(id => !Progress.isCleared(id)).length;
    return `${left} more stop${left === 1 ? '' : 's'} in ${region.name} to become ${next.label}`;
  }

  function regionRow(region) {
    const cleared = region.stops.filter(Progress.isCleared).length;
    const done = cleared === region.stops.length;
    return `
      <li class="region-row ${done ? 'region-done' : ''}">
        <span class="region-emoji">${region.emoji}</span>
        <span class="region-name">${region.name}</span>
        <span class="region-pips">${region.stops.map(pip).join('')}</span>
        ${done ? '<span class="region-tick">★</span>' : ''}
      </li>`;
  }

  function pip(stopId) {
    const done = Progress.isCleared(stopId);
    return `<span class="pip ${done ? 'pip-done' : ''}" title="Stop ${stopId}"></span>`;
  }

  function statTile(emoji, value, label) {
    return `
      <div class="stat-tile">
        <span class="stat-emoji">${emoji}</span>
        <strong class="stat-value">${value}</strong>
        <span class="stat-label">${label}</span>
      </div>`;
  }

  function percent(part, whole) {
    return whole ? Math.round((part / whole) * 100) : 0;
  }

  return { render };
})();
