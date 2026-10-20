(function () {
  'use strict';
  const E = window.Eredita;
  const copy = value => JSON.parse(JSON.stringify(value));
  function newEpoch() {
    return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  function activatable(legend) {
    if (legend?.gameplay.status !== 'confirmed' || !E.Mythology.categories.includes(legend.gameplay.category) ||
      !legend.gameplay.description || legend.implementation.status !== 'implemented' || !E.MythologyEffects.getBinding(legend.id)) return false;
    const parameters = E.Mythology.getGameplay(legend.id)?.parameters;
    const configured = value => value !== null && value !== undefined &&
      (typeof value === 'number' ? Number.isFinite(value) : typeof value === 'object' ? Object.values(value).every(configured) : true);
    return Boolean(parameters && typeof parameters === 'object' && Object.keys(parameters).length && configured(parameters));
  }
  // Stock privé indépendant des snapshots de la simulation. Même autorité en local et sur le relais.
  function createAuthority({ random = Math.random, includeUnconfigured = E.Config.reinforcements.development.includeUnconfigured,
    log = value => { if (E.Config.reinforcements.development.logs) console.debug('[renforts]', value); } } = {}) {
    const cfg = E.Config.reinforcements;
    if (cfg.pendingPolicy !== 'fifo') throw new TypeError('Politique de proposition non prise en charge : ' + cfg.pendingPolicy);
    if (!Number.isFinite(cfg.intervalSeconds) || cfg.intervalSeconds <= 0) throw new TypeError('Intervalle de renfort invalide');
    let epoch = null, phase = 'setup', paused = false, elapsed = 0, revision = 0;
    let players;
    const unavailableDue = new Map();
    function reset(nextEpoch = null) {
      epoch = nextEpoch; phase = 'setup'; paused = false; elapsed = 0; revision++;
      players = Object.fromEntries(['red', 'blue'].map(id => [id, { nextAt: 0, sequence: 0, queue: [], selections: [] }]));
      unavailableDue.clear();
    }
    reset();
    function sync(state) {
      if (!state || !['setup', 'running', 'ended'].includes(state.phase) || !Number.isFinite(state.elapsed) || state.elapsed < 0) return false;
      if (state.phase === 'setup') {
        if (epoch !== null) { reset(); return true; }
        return false;
      }
      if (typeof state.reinforcementEpoch !== 'string' || state.reinforcementEpoch.length > 100 || !state.reinforcementEpoch) return false;
      if (epoch !== state.reinforcementEpoch) {
        if (epoch !== null || state.phase !== 'running') return false; // Le nouveau match doit passer par la préparation initiale.
        reset(state.reinforcementEpoch);
      }
      if (phase === 'ended' && state.phase !== 'ended') return false;
      if (state.elapsed < elapsed) return false; // Une répétition ou un recul du snapshot ne réarme pas les échéances.
      if (phase !== state.phase || paused !== Boolean(state.paused)) revision++;
      phase = state.phase; paused = Boolean(state.paused); elapsed = state.elapsed;
      if (phase !== 'running' || paused) return false;
      let pool;
      let changed = false;
      for (const [playerId, player] of Object.entries(players)) {
        if (elapsed < player.nextAt) continue;
        pool ||= E.Mythology.all.filter(item => includeUnconfigured || activatable(item));
        if (pool.length < 2) {
          if (unavailableDue.get(playerId) !== player.nextAt) {
            log({ reason: 'not-enough-configured-legends', playerId, due: player.nextAt });
            unavailableDue.set(playerId, player.nextAt);
          }
          continue; // Garder l’échéance à traiter : aucune proposition n’est perdue si les données sont réparées.
        }
        unavailableDue.delete(playerId);
        const count = Math.floor((elapsed - player.nextAt) / cfg.intervalSeconds) + 1;
        for (let i = 0; i < count; i++) {
          const index = size => Math.max(0, Math.min(size - 1, Math.floor(random() * size)));
          const leftIndex = index(pool.length), remaining = pool.filter((_, i) => i !== leftIndex);
          const ids = [pool[leftIndex].id, remaining[index(remaining.length)].id];
          player.queue.push({ id: `${epoch}:${playerId}:${++player.sequence}`, legendIds: ids, availableAt: player.nextAt,
            developmentOnly: ids.some(id => !activatable(E.Mythology.get(id))) });
          player.nextAt += cfg.intervalSeconds;
        }
        changed = true; revision++;
      }
      return changed;
    }
    function view(playerId) {
      if (!players[playerId]) return null;
      const result = copy({ epoch, revision, playerId, phase, paused, ...players[playerId] });
      // Compatibilité avec le composant existant : pending désigne uniquement la tête FIFO.
      return { ...result, pending: result.queue[0] || null, pendingCount: result.queue.length };
    }
    function select(playerId, request) {
      const player = players[playerId];
      const reject = reason => ({ accepted: false, reason, offerId: request?.offerId || null });
      if (!player || !request || request.epoch !== epoch || !epoch) return reject('stale-match');
      if (phase !== 'running' || paused) return reject('match-inactive');
      const pending = player.queue[0];
      if (!pending || pending.id !== request.offerId) return reject('offer-unavailable');
      if (!pending.legendIds.includes(request.legendId)) return reject('legend-not-offered');
      const developmentOnly = !activatable(E.Mythology.get(request.legendId));
      if (developmentOnly && !includeUnconfigured) return reject('legend-not-configured');
      const selection = { offerId: pending.id, legendId: request.legendId, selectedAt: elapsed,
        status: developmentOnly ? 'development-only' : 'awaiting-activation', developmentOnly };
      player.selections.push(selection); player.queue.shift(); revision++;
      return { accepted: true, offerId: selection.offerId, selection: copy(selection) };
    }
    function requestActivation(playerId, request) {
      const reject = reason => ({ accepted: false, reason });
      if (!request || request.epoch !== epoch || !players[playerId]) return reject('stale-match');
      if (phase !== 'running' || paused) return reject('match-inactive');
      const selection = players[playerId].selections.find(item => item.offerId === request.offerId);
      if (!selection) return reject('selection-not-owned');
      if (selection.status === 'activation-pending') return { accepted: true, execution: copy(selection.execution) };
      if (selection.status !== 'awaiting-activation' || !activatable(E.Mythology.get(selection.legendId))) return reject('selection-unavailable');
      const target = request.target;
      if (!target || typeof target !== 'object' || Array.isArray(target) ||
        Object.keys(target).some(key => !['playerId', 'lane'].includes(key)) ||
        (Object.hasOwn(target, 'playerId') && !['red', 'blue'].includes(target.playerId)) ||
        (Object.hasOwn(target, 'lane') && (!Number.isInteger(target.lane) || target.lane < 0 || target.lane > 3))) return reject('invalid-target');
      selection.status = 'activation-pending';
      selection.execution = { epoch, playerId, offerId: selection.offerId, legendId: selection.legendId,
        activationId: `${selection.offerId}:activation`, target: copy(target) };
      revision++;
      return { accepted: true, execution: copy(selection.execution) };
    }
    function finishActivation(activationId, accepted, reason = '') {
      for (const [playerId, player] of Object.entries(players)) {
        const selection = player.selections.find(item => item.execution?.activationId === activationId);
        if (!selection || selection.status !== 'activation-pending') continue;
        selection.status = accepted ? 'activated' : 'awaiting-activation';
        if (accepted) selection.activatedAt = elapsed;
        else selection.lastError = String(reason).slice(0, 200);
        if (!accepted) delete selection.execution;
        revision++;
        return playerId;
      }
      return null;
    }
    return { sync, view, select, reset, requestActivation, finishActivation };
  }
  E.MythologyMatch = Object.freeze({ createAuthority, activatable, newEpoch });
}());
