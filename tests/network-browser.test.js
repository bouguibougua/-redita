"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "eredita-network-browser-"));
const port = 9334;
const browser = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", [
  "--headless=new", "--no-first-run", `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, "about:blank"
], { stdio: "ignore" });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  let page;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      page = pages.find((entry) => entry.type === "page");
      if (page) break;
    } catch (_) { /* Le navigateur démarre. */ }
    await delay(100);
  }
  assert.ok(page, "Edge n'a pas démarré");
  const debuggerSocket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    debuggerSocket.onopen = resolve;
    debuggerSocket.onerror = reject;
  });
  let nextId = 0;
  const pending = new Map();
  const exceptions = [];
  debuggerSocket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message.result);
      pending.delete(message.id);
    } else if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
  };
  function send(method, params = {}) {
    const id = ++nextId;
    debuggerSocket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => pending.set(id, resolve));
  }
  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  await send("Runtime.enable");
  await send("Page.navigate", { url: "http://localhost:8765/" });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await evaluate("document.readyState === 'complete' && !!window.Eredita?.Network")) break;
    await delay(100);
  }
  await evaluate("(() => { const render = Eredita.UI.render; Eredita.UI.render = (state) => { window.testState = state; render(state); }; })()");
  await evaluate("document.querySelector('#play-solo').click()");
  assert.equal(await evaluate("Eredita.Network.mode"), "solo");
  assert.equal(await evaluate("testState.players.blue.setupConfirmed"), true);
  assert.equal(await evaluate("testState.players.red.setupConfirmed"), false);
  assert.equal(await evaluate("document.querySelector('#connection-screen').hidden"), true);
  await evaluate("document.querySelector('[data-setup-action=keep][data-player=red]').click()");
  await evaluate("document.querySelector('#start-game').click()");
  assert.equal(await evaluate("testState.phase"), "running");
  await evaluate("document.querySelector('#pause-game').click()");
  await evaluate("document.querySelector('[data-village-select][data-player=blue][data-lane=\"0\"]').click()");
  assert.equal(await evaluate("document.querySelector('#residents-panel').classList.contains('opponent-readonly')"), true);
  const blueGold = await evaluate("testState.players.blue.gold");
  await evaluate("document.querySelector('#residents-panel [data-build=artisanat]').click()");
  assert.equal(await evaluate("testState.players.blue.gold"), blueGold);
  await evaluate("document.querySelector('#restart-game').click()");
  assert.equal(await evaluate("testState.phase === 'setup' && testState.players.blue.setupConfirmed"), true);

  await send("Page.navigate", { url: "http://localhost:8765/" });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await evaluate("document.readyState === 'complete' && !!window.Eredita?.Network && Eredita.Network.mode === 'pending'")) break;
    await delay(100);
  }
  await evaluate("document.querySelector('#create-online').click()");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await evaluate("Eredita.Network.roomCode !== null")) break;
    await delay(100);
  }
  const result = await evaluate("({ code: Eredita.Network.roomCode, status: document.querySelector('#session-status').textContent, visible: !document.querySelector('#session-status').hidden, displayedCode: document.querySelector('#created-room-code').textContent, roomVisible: !document.querySelector('#created-room').hidden, screenHidden: document.querySelector('#connection-screen').hidden })");
  console.log(JSON.stringify({ ...result, exceptions }));
  assert.match(result.code || "", /^[A-Z2-9]{5}$/);
  assert.ok(result.status.includes(result.code));
  assert.equal(result.displayedCode, result.code);
  assert.equal(result.roomVisible, true);
  assert.equal(result.visible, true);
  assert.equal(result.screenHidden, false);
  await evaluate("document.querySelector('#continue-online').click()");
  assert.equal(await evaluate("document.querySelector('#connection-screen').hidden"), true);
  assert.deepEqual(exceptions, []);
  debuggerSocket.close();
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  browser.kill();
  await delay(300);
  const tempRoot = path.resolve(os.tmpdir());
  const profilePath = path.resolve(profile);
  if (profilePath.startsWith(`${tempRoot}${path.sep}`) && path.basename(profilePath).startsWith("eredita-network-browser-")) {
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});
