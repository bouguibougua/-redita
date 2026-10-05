"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9334;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "eredita-tutorial-"));
const browser = spawn(chrome, ["--headless=new", "--no-first-run", "--mute-audio", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  let page;
  for (let attempt = 0; attempt < 60 && !page; attempt += 1) {
    try { page = (await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())).find((entry) => entry.type === "page"); } catch (_) { await delay(100); }
  }
  assert.ok(page, "Chrome doit démarrer");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const promise = pending.get(message.id); pending.delete(message.id);
    message.error ? promise.reject(new Error(message.error.message)) : promise.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const messageId = ++id; pending.set(messageId, { resolve, reject }); socket.send(JSON.stringify({ id: messageId, method, params })); });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;
  async function waitFor(expression, timeout = 8000) { for (let i = 0; i < Math.ceil(timeout / 100); i += 1) { if (await evaluate(expression)) return; await delay(100); } const debug = await evaluate("Eredita.Tutorial?.debug"); throw new Error(`Condition non atteinte: ${expression}\n${JSON.stringify(debug)}`); }
  async function click(selector) { const result = await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return false; el.click(); return true; })()`); assert.equal(result, true, selector); await delay(80); }
  async function dialogue(manual) { await click("#tutorial-dialog"); if (manual) await click("#tutorial-dialog"); else await delay(750); }

  await send("Page.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:8765/" });
  await waitFor("document.readyState === 'complete'");
  await click('[data-menu-screen="tutorial"]');
  await waitFor("Eredita.Tutorial.dialogueActive");
  await dialogue(false);
  await dialogue(false);
  await waitFor("Eredita.Tutorial.stage === 'chooseDeck'");
  await click('[data-setup-deck="1"][data-player="red"]');
  for (let count = 0; count < 3; count += 1) await dialogue(true);
  await dialogue(false);
  await waitFor("Eredita.Tutorial.stage === 'exchange'");
  await click('[data-biome-choice][data-player="red"][data-lane="1"]');
  await click('[data-biome-choice][data-player="red"][data-lane="2"]');
  await click('[data-setup-action="exchange"][data-player="red"]');
  await dialogue(false);
  await waitFor("Eredita.Tutorial.stage === 'launch'");
  await click("#start-game");
  await dialogue(false);
  for (let count = 0; count < 4; count += 1) await dialogue(true);
  await dialogue(false);
  await waitFor("Eredita.Tutorial.stage === 'fields'");
  for (let index = 0; index < 4; index += 1) await click(`[data-slot-visual][data-player="red"][data-lane="0"][data-slot-index="${index}"]`);
  await waitFor("Eredita.Tutorial.dialogueActive");
  assert.equal(await evaluate("Eredita.Tutorial.stage"), "fields");
  assert.equal(await evaluate("document.querySelectorAll('.region.red .slot.crop-ble').length >= 4"), true);
  await dialogue(false);
  await waitFor("Eredita.Tutorial.stage === 'harvest'");
  await click('#residents-panel [data-select-resident][data-resident-state="disponible"]');
  await click('#residents-panel [data-resident-mission="agriculture"]');
  await waitFor("Eredita.Tutorial.dialogueActive");
  await dialogue(true);
  await dialogue(false);
  await waitFor("Eredita.Tutorial.stage === 'buildBergerie'");
  await click('#residents-panel [data-build="bergerie"]');
  await dialogue(false);
  await waitFor("Eredita.Tutorial.stage === 'profession'");
  await click('#residents-panel [data-select-resident][data-resident-state="agriculture"]');
  await click('#residents-panel [data-profession="agriculteur"]');
  await waitFor("Eredita.Tutorial.dialogueActive");
  await dialogue(true);
  await dialogue(false);
  await waitFor("Eredita.Tutorial.stage === 'defend'");
  await click('#residents-panel .resident-card.tutorial-highlight');
  await click('#residents-panel [data-resident-mission="attaque"]');
  await waitFor("Eredita.Tutorial.stage === 'counterDialogue'", 40000);
  await dialogue(true);
  await dialogue(false);
  await waitFor("Eredita.Tutorial.stage === 'buildArtisanat'");
  await click('#residents-panel [data-build="artisanat"]');
  await dialogue(false);
  await waitFor("Eredita.Tutorial.stage === 'warriors'");
  await click('#residents-panel [data-profession-all="guerrier"]');
  await dialogue(false);
  await waitFor("Eredita.Tutorial.stage === 'generalAttack'");
  await click('#residents-panel [data-assign-all="attaque"]');
  await waitFor("Eredita.Tutorial.stage === 'firstVillageDialogue'", 45000);
  await dialogue(true);
  await waitFor("Eredita.Tutorial.freePlay");
  await send("Page.navigate", { url: "http://127.0.0.1:8765/" });
  await waitFor("document.readyState === 'complete'");
  await click('[data-menu-screen="play"]');
  await click("#training-button");
  await waitFor("document.querySelector('#setup-screen').hidden === false");
  assert.equal(await evaluate("Eredita.Tutorial.active"), false);
  assert.equal(await evaluate("document.body.classList.contains('tutorial-guided')"), false);
  socket.close();
}

run().then(() => { browser.kill(); console.log("Tutoriel navigateur : parcours dirigé complet et déverrouillage validés."); }).catch((error) => { browser.kill(); console.error(error); process.exitCode = 1; });
