"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

const port = 8876;
const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function openSocket() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
}

function nextMessage(socket, type) {
  return new Promise((resolve) => socket.addEventListener("message", function listener(event) {
    const message = JSON.parse(event.data);
    if (message.type !== type) return;
    socket.removeEventListener("message", listener);
    resolve(message);
  }));
}

(async () => {
  try {
    await delay(300);
    const host = await openSocket();
    host.send(JSON.stringify({ type: "create" }));
    const created = await nextMessage(host, "created");
    assert.match(created.code, /^[A-Z2-9]{5}$/);
    assert.equal(created.playerId, "red");

    const guest = await openSocket();
    guest.send(JSON.stringify({ type: "join", code: created.code }));
    assert.equal((await nextMessage(guest, "joined")).playerId, "blue");
    await nextMessage(host, "peer");

    const commandPromise = nextMessage(host, "command");
    guest.send(JSON.stringify({ type: "command", method: "sell", args: ["ble"], view: { selectedVillage: { playerId: "blue", lane: 0 } } }));
    const command = await commandPromise;
    assert.equal(command.playerId, "blue");
    assert.equal(command.method, "sell");

    const statePromise = nextMessage(guest, "state");
    host.send(JSON.stringify({ type: "state", state: { phase: "setup", marker: 42 } }));
    assert.equal((await statePromise).state.marker, 42);
    host.close();
    guest.close();
    console.log("Serveur multijoueur valide : salon, rôles, commandes et synchronisation.");
  } finally {
    server.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
