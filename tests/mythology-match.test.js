'use strict';
const assert = require('node:assert/strict'), { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function fixture() {
  const context = vm.createContext({ window: {}, console });
  for (const name of ['config', 'mythology-data', 'mythology-effects', 'mythology-match']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8'), context);
  }
  const E = context.window.Eredita, logs = [];
  const authority = E.MythologyMatch.createAuthority({ random: () => .5, log: item => logs.push(item) });
  const state = { reinforcementEpoch: 'match-one', phase: 'running', elapsed: 0, paused: false, preparationRemaining: 60 };
  return { E, authority, logs, state };
}
function choose(authority, playerId, overrides = {}) {
  const view = authority.view(playerId);
  return authority.select(playerId, { epoch: view.epoch, offerId: view.pending?.id, legendId: view.pending?.legendIds[0], ...overrides });
}
test('start, preparation, pause and the 120-second combat boundary use the match clock', () => {
  const { authority: a, state } = fixture();
  a.sync({ ...state, phase: 'setup' }); assert.equal(a.view('red').pending, null);
  a.sync(state);
  for (const id of ['red', 'blue']) {
    const v = a.view(id); assert.equal(v.pending.availableAt, 0); assert.equal(v.nextAt, 120);
    assert.equal(v.pendingCount, 1); assert.equal(v.queue[0].id, v.pending.id);
    assert.equal(new Set(v.pending.legendIds).size, 2); assert.equal(v.pending.developmentOnly, false);
  }
  const first = a.view('red').pending.id;
  a.sync({ ...state, preparationRemaining: 0 }); assert.equal(a.view('red').pending.id, first);
  a.sync({ ...state, paused: true }); assert.equal(choose(a, 'red').reason, 'match-inactive');
  a.sync(state); assert.equal(choose(a, 'red').accepted, true);
  state.elapsed = 119.999; a.sync(state); assert.equal(a.view('red').pending, null);
  state.elapsed = 120; a.sync(state); assert.equal(a.view('red').pending.availableAt, 120);
  assert.notEqual(a.view('red').pending.id, first);
  const count = a.view('red').sequence; a.sync(state); a.sync(state); assert.equal(a.view('red').sequence, count);
});
test('three proposals accumulate FIFO and selections consume only the head, independently for each player', () => {
  const { authority: a, state, logs } = fixture(); a.sync(state);
  const original = JSON.stringify(a.view('red').pending);
  state.elapsed = 120; a.sync(state); a.sync(state);
  assert.equal(JSON.stringify(a.view('red').pending), original); assert.equal(a.view('red').pendingCount, 2);
  state.elapsed = 240; a.sync(state); a.sync(state);
  const red = a.view('red'), blue = a.view('blue');
  assert.equal(red.pendingCount, 3); assert.equal(new Set(red.queue.map(p => p.id)).size, 3);
  assert.deepEqual(Array.from(red.queue, p => p.availableAt), [0, 120, 240]);
  for (const proposal of [...red.queue, ...blue.queue]) assert.equal(new Set(proposal.legendIds).size, 2);
  assert.equal(choose(a, 'red', { offerId: red.queue[1].id, legendId: red.queue[1].legendIds[0] }).reason, 'offer-unavailable');
  assert.equal(a.view('red').pendingCount, 3, 'A later proposal cannot bypass the head');
  state.elapsed = 270; a.sync(state);
  const first = choose(a, 'red'); assert.equal(first.accepted, true); assert.equal(first.selection.offerId, red.queue[0].id);
  assert.equal(a.view('red').pending.id, red.queue[1].id); assert.equal(a.view('red').pendingCount, 2);
  assert.equal(choose(a, 'red', { offerId: red.queue[0].id }).accepted, false, 'Replayed head cannot consume its successor');
  state.elapsed = 280; a.sync(state); const second = choose(a, 'red');
  assert.equal(second.selection.offerId, red.queue[1].id); assert.equal(a.view('red').pendingCount, 1);
  assert.equal(a.view('red').pending.id, red.queue[2].id);
  assert.equal(JSON.stringify(a.view('blue').queue), JSON.stringify(blue.queue));
  assert.equal(a.view('red').sequence, a.view('red').queue.length + a.view('red').selections.length, 'Every issued proposal is pending or consumed once');
  assert.equal(logs.length, 0, 'An occupied queue no longer causes dropped deadlines or warnings');
});
test('a clock jump preserves every due proposal exactly once and keeps the original open head', () => {
  const { authority: a, state } = fixture(); a.sync(state);
  const original = JSON.stringify(a.view('red').pending);
  state.elapsed = 600; a.sync(state); a.sync(state);
  const v = a.view('red'); assert.equal(v.pendingCount, 6); assert.equal(v.nextAt, 720);
  assert.deepEqual(Array.from(v.queue, p => p.availableAt), [0, 120, 240, 360, 480, 600]);
  assert.equal(JSON.stringify(v.pending), original);
  while (a.view('red').pending) assert.equal(choose(a, 'red').accepted, true);
  assert.equal(a.view('red').pendingCount, 0); assert.equal(a.view('red').selections.length, 6);
  assert.equal(a.view('blue').pendingCount, 6);
});
test('temporarily invalid configuration postpones scheduling instead of dropping proposals', () => {
  const { E, authority: a, state, logs } = fixture();
  const originalEffects = E.MythologyEffects;
  E.MythologyEffects = { ...originalEffects, getBinding: () => null };
  a.sync(state); a.sync(state); assert.equal(a.view('red').pendingCount, 0); assert.equal(a.view('red').nextAt, 0);
  assert.equal(logs.length, 2, 'One configuration warning per player, without repeated spam');
  state.elapsed = 240; a.sync(state);
  E.MythologyEffects = originalEffects;
  a.sync(state); assert.equal(a.view('red').pendingCount, 3);
  assert.deepEqual(Array.from(a.view('red').queue, p => p.availableAt), [0, 120, 240]);
});
test('membership, owner, epoch and single use are validated; future selections never activate powers', () => {
  const { authority: a, E, state } = fixture(); a.sync(state);
  const before = JSON.stringify(a.view('red'));
  assert.equal(choose(a, 'red', { legendId: 'not-a-legend' }).reason, 'legend-not-offered');
  assert.equal(choose(a, 'red', { offerId: a.view('blue').pending.id }).reason, 'offer-unavailable');
  assert.equal(choose(a, 'red', { epoch: 'old-match' }).reason, 'stale-match');
  assert.equal(JSON.stringify(a.view('red')), before);
  const request = { epoch: a.view('red').epoch, offerId: a.view('red').pending.id, legendId: a.view('red').pending.legendIds[0] };
  const blueBefore = JSON.stringify(a.view('blue').pending);
  assert.equal(a.select('red', request).accepted, true); assert.equal(a.select('red', request).accepted, false);
  assert.equal(a.view('red').selections.length, 1); assert.equal(a.view('red').selections[0].status, 'awaiting-activation');
  assert.equal(JSON.stringify(a.view('blue').pending), blueBefore);
  assert.equal(E.MythologyEffects.apply, undefined); assert.equal(state.players, undefined);
  const external = a.view('blue'); external.pending.legendIds[0] = 'u-stregu';
  assert.notEqual(a.view('blue').pending.legendIds[0], 'u-stregu', 'Views are detached from authority records');
});
test('end, clock rewind, restart and old requests do not generate or reuse offers', () => {
  const { authority: a, state } = fixture(); a.sync(state); choose(a, 'red');
  state.elapsed = 120; a.sync(state); const old = a.view('red');
  a.sync({ ...state, reinforcementEpoch: 'forged-reroll' });
  assert.equal(a.view('red').epoch, old.epoch, 'An epoch change without a new setup cannot reroll proposals');
  a.sync({ ...state, elapsed: 119 }); assert.equal(a.view('red').pending.id, old.pending.id);
  a.sync({ ...state, phase: 'ended', elapsed: 240 });
  assert.equal(a.view('red').sequence, old.sequence); assert.equal(choose(a, 'red').reason, 'match-inactive');
  a.sync({ ...state, elapsed: 300 }); assert.equal(a.view('red').phase, 'ended', 'A finished match cannot resume by replaying a running snapshot');
  a.sync({ ...state, phase: 'setup', elapsed: 0 }); assert.equal(a.view('red').selections.length, 0); assert.equal(a.view('red').pendingCount, 0);
  state.reinforcementEpoch = 'match-two'; state.elapsed = 0; a.sync(state);
  assert.equal(a.view('red').pending.availableAt, 0); assert.equal(a.view('red').selections.length, 0);
  assert.equal(a.view('red').pendingCount, 1);
  assert.equal(a.select('red', { epoch: old.epoch, offerId: old.pending.id, legendId: old.pending.legendIds[0] }).accepted, false);
});
test('only configured legends are eligible; explicit development mode safely includes unknown powers', () => {
  const { E, state } = fixture();
  const configured = E.Mythology.all.filter(E.MythologyMatch.activatable); assert.equal(configured.length, 16);
  for (let seed = 0; seed < 50; seed++) {
    const a = E.MythologyMatch.createAuthority({ random: () => seed / 50, log() {} }); a.sync(state);
    for (const id of ['red', 'blue']) for (const legendId of a.view(id).pending.legendIds) assert.ok(configured.some(l => l.id === legendId));
  }
  const originalEffects = E.MythologyEffects;
  E.MythologyEffects = { ...originalEffects, getBinding: () => null };
  const dev = E.MythologyMatch.createAuthority({ random: () => .15, includeUnconfigured: true, log() {} }); dev.sync(state);
  assert.equal(dev.view('red').pending.developmentOnly, true);
  const result = choose(dev, 'red'); assert.equal(result.accepted, true); assert.equal(result.selection.status, 'development-only');
  E.Config.reinforcements.pendingPolicy = 'unknown'; assert.throws(() => E.MythologyMatch.createAuthority());
});

test('activation reservation is private, one-use, retry-idempotent and never accepts another player selection', () => {
  const { authority:a,state }=fixture();a.sync(state);choose(a,'red');const v=a.view('red'),owned=v.selections[0];
  const request={epoch:v.epoch,offerId:owned.offerId,target:{}};
  assert.equal(a.requestActivation('blue',request).accepted,false);
  const accepted=a.requestActivation('red',request);assert.equal(accepted.accepted,true);
  assert.equal(a.view('red').selections[0].status,'activation-pending');
  assert.equal(a.requestActivation('red',{...request,target:{lane:1}}).execution.activationId,accepted.execution.activationId);
  assert.deepEqual(JSON.parse(JSON.stringify(a.requestActivation('red',request).execution.target)),{});
  assert.equal(a.finishActivation(accepted.execution.activationId,true),'red');
  assert.equal(a.requestActivation('red',request).accepted,false);assert.equal(a.finishActivation(accepted.execution.activationId,true),null);
  assert.equal(a.view('red').selections[0].status,'activated');assert.equal(a.view('blue').selections.length,0);
});
