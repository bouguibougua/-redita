'use strict';
const assert = require('node:assert/strict'), { spawn } = require('node:child_process');
const port = 8893, delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run() {
  const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  const sockets = [];
  async function connect() {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`); sockets.push(socket);
    const messages = [], waiters = [];
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data); messages.push(message);
      for (const waiter of [...waiters]) if (waiter.predicate(message)) { clearTimeout(waiter.timeout); waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(message); }
    });
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    return { messages, send: message => socket.send(JSON.stringify(message)), next(predicate) {
      return new Promise((resolve, reject) => { const waiter = { predicate, resolve, timeout: setTimeout(() => reject(new Error('Missing server message')), 5000) }; waiters.push(waiter); });
    }};
  }
  try {
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) { try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch (_) { await delay(50); } }
    assert.ok(ready);
    const host = await connect(); let pending = host.next(m => m.type === 'created'); host.send({ type: 'create' }); const created = await pending;
    const guest = await connect(); pending = guest.next(m => m.type === 'joined'); guest.send({ type: 'join', code: created.code }); await pending;
    let red = host.next(m => m.type === 'mythology' && m.view.pending), blue = guest.next(m => m.type === 'mythology' && m.view.pending);
    const state = { phase: 'running', paused: false, elapsed: 0, reinforcementEpoch: 'network-one' };
    host.send({ type: 'state', state }); red = (await red).view; blue = (await blue).view;
    assert.equal(red.playerId, 'red'); assert.equal(blue.playerId, 'blue');
    assert.ok(host.messages.filter(m => m.type === 'mythology').every(m => m.view.playerId === 'red'));
    assert.ok(guest.messages.filter(m => m.type === 'mythology').every(m => m.view.playerId === 'blue'));
    assert.ok(host.messages.every(m => !JSON.stringify(m).includes(blue.pending.id)), 'Host receives neither blue offer nor blue selection');
    assert.ok(guest.messages.every(m => !JSON.stringify(m).includes(red.pending.id)), 'Guest receives neither red offer nor red selection');
    const reject = async message => { const result = host.next(m => m.type === 'mythology' && m.accepted === false); host.send(message); return result; };
    assert.equal((await reject({ type: 'mythology-select', playerId: 'blue', epoch: blue.epoch, offerId: blue.pending.id, legendId: blue.pending.legendIds[0] })).reason, 'offer-unavailable');
    assert.equal((await reject({ type: 'mythology-select', epoch: red.epoch, offerId: red.pending.id, legendId: 'not-a-legend' })).reason, 'legend-not-offered');
    const forged = host.next(m => m.type === 'error'); host.send({ type: 'join', code: created.code }); await forged;
    const redQueue = host.next(m => m.type === 'mythology' && m.view.pendingCount === 3);
    const blueQueue = guest.next(m => m.type === 'mythology' && m.view.pendingCount === 3);
    state.elapsed = 240; host.send({ type: 'state', state });
    const redAccumulated = (await redQueue).view, blueAccumulated = (await blueQueue).view;
    assert.equal(redAccumulated.pending.id, red.pending.id); assert.equal(blueAccumulated.pending.id, blue.pending.id);
    assert.deepEqual(blueAccumulated.queue.map(p => p.availableAt), [0, 120, 240]);
    assert.ok(host.messages.filter(m => m.type === 'mythology').every(m => m.view.queue.every(p => p.id.includes(':red:'))));
    let result = guest.next(m => m.type === 'mythology' && m.accepted === false);
    guest.send({ type: 'mythology-select', epoch: blue.epoch, offerId: blueAccumulated.queue[1].id, legendId: blueAccumulated.queue[1].legendIds[0] });
    assert.equal((await result).reason, 'offer-unavailable', 'Only the oldest offer can be consumed');
    const request = { type: 'mythology-select', epoch: blue.epoch, offerId: blue.pending.id, legendId: blue.pending.legendIds[0] };
    result = guest.next(m => m.type === 'mythology' && m.accepted === true); guest.send(request); const selected = await result;
    assert.equal(selected.view.selections.length, 1); assert.equal(selected.view.selections[0].status, 'awaiting-activation');
    assert.equal(selected.view.pendingCount, 2); assert.equal(selected.view.pending.id, blueAccumulated.queue[1].id);
    result = guest.next(m => m.type === 'mythology' && m.accepted === false); guest.send(request); assert.equal((await result).reason, 'offer-unavailable');
    assert.ok(host.messages.filter(m => m.type === 'mythology').every(m =>
      m.view.playerId === 'red' && m.view.pending?.id !== blue.pending.id && m.view.selections.every(s => s.offerId !== blue.pending.id)));
    const next = selected.view.pending;
    result = guest.next(m => m.type === 'mythology' && m.accepted === true);
    guest.send({ type: 'mythology-select', epoch: blue.epoch, offerId: next.id, legendId: next.legendIds[1] });
    const second = (await result).view;
    assert.equal(second.pendingCount, 1); assert.equal(second.pending.id, blueAccumulated.queue[2].id);
    assert.equal(second.sequence, second.queue.length + second.selections.length);
    const publicMessage = guest.next(m => m.type === 'state' && m.state.elapsed === 240); host.send({ type: 'state', state });
    assert.deepEqual((await publicMessage).state, state, 'No private record is added to the public snapshot');
    // A guest cannot inject an execution or acknowledge its own activation.
    const executionCount = host.messages.filter(m => m.type === 'mythology-execute').length;
    guest.send({ type: 'mythology-execute', execution: { playerId: 'red', legendId: 'u-diavulu' } });
    // The genuine activation below provides an ordering barrier for the forged packet.
    const reserved = guest.next(m => m.type === 'mythology' && m.activation && m.accepted);
    const execution = host.next(m => m.type === 'mythology-execute');
    guest.send({ type: 'mythology-activate', epoch: blue.epoch, offerId: blue.pending.id, target: {} });
    const reservation = await reserved, trusted = (await execution).execution;
    assert.equal(reservation.view.selections[0].status, 'activation-pending');
    assert.equal(trusted.playerId, 'blue');assert.equal(trusted.legendId, request.legendId);
    assert.equal(host.messages.filter(m => m.type === 'mythology-execute').length, executionCount + 1);
    guest.send({ type: 'mythology-result', activationId: trusted.activationId, accepted: true });
    const retry = guest.next(m => m.type === 'mythology' && m.activation && m.accepted);
    const repeated = host.next(m => m.type === 'mythology-execute');
    guest.send({ type: 'mythology-activate', epoch: blue.epoch, offerId: blue.pending.id, target: { lane: 1 } });
    assert.equal((await retry).view.selections[0].status, 'activation-pending', 'Guest confirmation is ignored');
    assert.deepEqual((await repeated).execution, trusted, 'A retry keeps its original target and token');
    const confirmed = guest.next(m => m.type === 'mythology' && m.activation && m.view.selections[0].status === 'activated');
    host.send({ type: 'mythology-result', activationId: trusted.activationId, accepted: true });await confirmed;
    const denied = guest.next(m => m.type === 'mythology' && m.activation && !m.accepted);
    guest.send({ type: 'mythology-activate', epoch: blue.epoch, offerId: blue.pending.id, target: {} });
    assert.equal((await denied).reason, 'selection-unavailable');
    result = guest.next(m => m.type === 'mythology' && m.view.epoch === null); host.send({ type: 'state', state: { ...state, phase: 'setup', elapsed: 0 } }); await result;
    red = host.next(m => m.type === 'mythology' && m.view.epoch === 'network-two');
    host.send({ type: 'state', state: { ...state, reinforcementEpoch: 'network-two', elapsed: 0 } });
    const restarted = (await red).view;
    assert.equal(restarted.selections.length, 0); assert.equal(restarted.pendingCount, 1);
    console.log('Renforts réseau : FIFO privée, sélection unique, activation réservée, réessai identique, confirmations host seules, paquets forgés refusés et nouveau match validés.');
  } finally { sockets.forEach(socket => socket.close()); server.kill(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
