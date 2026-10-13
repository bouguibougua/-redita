"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function createBrowser({ url, serverPort = 8878, debugPort = 9446 } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "eredita-cards-"));
  const server = url ? null : spawn(process.execPath, ["server.js"], { cwd: path.join(__dirname, ".."), env: { ...process.env, PORT: String(serverPort) }, stdio: "ignore" });
  const browser = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-first-run", "--window-size=1440,1200", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let socket;
  async function close() {
    socket?.close(); browser.kill(); server?.kill(); await delay(400);
    const relative = path.relative(os.tmpdir(), profile);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  try {
    let page;
    for (let i = 0; i < 100 && !page; i++) {
      try { page = (await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r => r.json())).find(p => p.type === "page"); } catch (_) { /* Starting. */ }
      if (!page) await delay(100);
    }
    assert.ok(page, "Edge headless starts");
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    const pending = new Map(), exceptions = [], imageErrors = [];
    let id = 0;
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.method === "Network.responseReceived" && message.params.response.status >= 400 && /\/(assets|js|css)\//.test(message.params.response.url)) imageErrors.push(message.params.response.url);
    };
    function send(method, params = {}) {
      const messageId = ++id;
      const promise = new Promise((resolve, reject) => pending.set(messageId, { resolve, reject }));
      socket.send(JSON.stringify({ id: messageId, method, params })); return promise;
    }
    async function evaluate(expression) {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    async function waitFor(expression) {
      for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await delay(100); }
      throw new Error(`Condition non atteinte : ${expression}`);
    }
    async function click(selector) {
      const point = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || e.disabled) throw new Error('Bouton absent ou désactivé'); e.scrollIntoView({ block: 'center', inline: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()`);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 }); await delay(120);
    }
    async function screenshot(name, selector) {
      const folder = path.join(__dirname, "..", "output", "cards"); fs.mkdirSync(folder, { recursive: true });
      if (selector) await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'start' })`);
      await delay(250);
      const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      fs.writeFileSync(path.join(folder, name), Buffer.from(result.data, "base64"));
    }
    await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
    await send("Page.navigate", { url: url || `http://127.0.0.1:${serverPort}/` });
    await waitFor("document.readyState === 'complete' && !!window.Eredita?.GameView?.getState()");
    return { evaluate, send, waitFor, click, screenshot, close, exceptions, imageErrors };
  } catch (error) { await close(); throw error; }
}
module.exports = { createBrowser };
