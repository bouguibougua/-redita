"use strict";
// Outil hors application : capture le rendu Three.js puis encode avec ImageIO (macOS).
// Aucune dépendance npm ; Chrome/Chromium et Swift sont nécessaires pour l'export.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startStaticServer() {
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".json": "application/json" };
  const server = http.createServer((request, response) => {
    let relative;
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (!pathname.startsWith("/-redita/")) return response.writeHead(404).end();
      relative = pathname.slice("/-redita/".length) || "index.html";
    } catch (_) { return response.writeHead(400).end(); }
    const target = path.resolve(root, relative);
    const fromRoot = path.relative(root, target);
    if (!["GET", "HEAD"].includes(request.method) || fromRoot.startsWith("..") || path.isAbsolute(fromRoot) ||
      !(fromRoot === "index.html" || ["css", "js", "assets"].includes(fromRoot.split(path.sep)[0]))) return response.writeHead(403).end();
    fs.readFile(target, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { "Content-Type": mime[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store" });
      response.end(request.method === "HEAD" ? undefined : data);
    });
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return { server, url: `http://127.0.0.1:${server.address().port}/-redita/` };
}

async function startBrowser(extraArgs = []) {
  const executable = process.env.EREDITA_BROWSER || (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : "/usr/bin/chromium");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "eredita-menu-browser-"));
  const browser = spawn(executable, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-first-run", "--mute-audio",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--window-size=1440,900", "--remote-debugging-port=0", `--user-data-dir=${profile}`, ...extraArgs, "about:blank"], { stdio: "ignore" });
  let spawnError;
  browser.once("error", (error) => { spawnError = error; });
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnError) throw spawnError;
    try { port = Number(fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]); } catch (_) {}
    if (port) break;
    await delay(100);
  }
  if (!port) { browser.kill(); throw new Error("Chrome/Chromium n'a pas ouvert son port CDP."); }
  const sockets = [];
  async function connect(page) {
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    sockets.push(socket);
    const pending = new Map(), errors = [], badResponses = [], consoleErrors = [];
    let id = 0;
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const request = pending.get(message.id); pending.delete(message.id); clearTimeout(request.timeout);
        if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
      if (message.method === "Network.responseReceived" && message.params.response.status >= 400) badResponses.push(`${message.params.response.status} ${message.params.response.url}`);
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") consoleErrors.push(message.params.args.map((arg) => arg.value || arg.description).join(" "));
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const messageId = ++id;
      const timeout = setTimeout(() => { pending.delete(messageId); reject(new Error(`Délai CDP dépassé : ${method}`)); }, 15000);
      pending.set(messageId, { resolve, reject, timeout }); socket.send(JSON.stringify({ id: messageId, method, params }));
    });
    const evaluate = async (expression) => {
      const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
      return response.result.value;
    };
    const waitFor = async (expression, timeout = 15000) => {
      for (let attempt = 0; attempt < Math.ceil(timeout / 100); attempt++) { if (await evaluate(expression)) return; await delay(100); }
      throw new Error(`Condition non atteinte : ${expression}\n${JSON.stringify(errors)}`);
    };
    const click = async (selector) => {
      const point = await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('Élément absent'); el.scrollIntoView({block:'center',inline:'nearest'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
    };
    await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
    return { send, evaluate, waitFor, click, errors, badResponses, consoleErrors };
  }
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const page = await connect(pages.find((entry) => entry.type === "page"));
  const newPage = async () => connect(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json()));
  const close = async () => {
    sockets.forEach((socket) => socket.close()); browser.kill(); await delay(350);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); } catch (_) {}
  };
  return { page, newPage, close };
}

async function exportGif() {
  if (process.platform !== "darwin") throw new Error("Cet export sans dépendance utilise Swift/ImageIO sur macOS.");
  const output = path.resolve(process.argv[2] || path.join(root, "assets", "menu-animated.gif"));
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), "eredita-menu-frames-"));
  const staticSite = await startStaticServer();
  let browser;
  try {
    browser = await startBrowser();
    await browser.page.send("Page.navigate", { url: `${staticSite.url}?intro=0` });
    await browser.page.waitFor("window.Eredita?.MenuScene?.diagnostics.ready && Eredita.MenuScene.diagnostics.textureLoaded && typeof Eredita.MenuScene.captureFrame === 'function'", 30000);
    const config = await browser.page.evaluate("({duration: Eredita.Config.menu.animationSeconds, fps: Eredita.Config.menu.gifFps || 12, width: Eredita.Config.menu.gifWidth || 960, height: Eredita.Config.menu.gifHeight || 480})");
    const { fps, width, height } = config;
    const frameCount = Math.round(config.duration * fps);
    for (let index = 0; index < frameCount; index++) {
      const data = await browser.page.evaluate(`Eredita.MenuScene.captureFrame(${index / fps},${width},${height})`);
      if (typeof data !== "string" || !data.startsWith("data:image/png;base64,")) throw new Error("captureFrame doit fournir une image PNG encodée en base64.");
      fs.writeFileSync(path.join(frames, `${String(index).padStart(3, "0")}.png`), Buffer.from(data.split(",")[1], "base64"));
    }
    const swift = path.join(frames, "encode.swift");
    fs.writeFileSync(swift, `import Foundation
import ImageIO
import UniformTypeIdentifiers
let input = CommandLine.arguments[1]
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let count = Int(CommandLine.arguments[3])!
let fps = Double(CommandLine.arguments[4])!
guard let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.gif.identifier as CFString, count, nil) else { fatalError("Destination GIF inaccessible") }
CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
for index in 0..<count {
  let sourceURL = URL(fileURLWithPath: input).appendingPathComponent(String(format: "%03d.png", index))
  guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fatalError("Frame PNG invalide") }
  // Le GIF mesure en centièmes : répartir 8/9 cs pour conserver la durée à 12 images/s.
  let delay = (round(Double(index + 1) * 100 / fps) - round(Double(index) * 100 / fps)) / 100
  CGImageDestinationAddImage(destination, image, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: delay, kCGImagePropertyGIFUnclampedDelayTime: delay]] as CFDictionary)
}
guard CGImageDestinationFinalize(destination) else { fatalError("Encodage GIF échoué") }
print("GIF animé : \\(count) images, \\(fps) images/s, boucle infinie.")
`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    await new Promise((resolve, reject) => {
      const encoder = spawn("/usr/bin/swift", ["-module-cache-path", path.join(os.tmpdir(), "eredita-swift-module-cache"), swift, frames, output, String(frameCount), String(fps)], { stdio: "inherit" });
      encoder.once("error", reject); encoder.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`ImageIO : code ${code}`)));
    });
    console.log(`${output} (${(fs.statSync(output).size / 1048576).toFixed(1)} Mo)`);
  } finally {
    await browser?.close(); await new Promise((resolve) => staticSite.server.close(resolve)); fs.rmSync(frames, { recursive: true, force: true });
  }
}

module.exports = { startStaticServer, startBrowser, delay };
if (require.main === module) exportGif().catch((error) => { console.error(error); process.exitCode = 1; });
