"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { gzipSync } = require("node:zlib");
const { EventEmitter } = require("node:events");
const mythology = require('./server-mythology');

const port = Number(process.env.PORT) || 8765;
const root = __dirname;
const rooms = new Map();
const mimeTypes = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".wav": "audio/wav",
  ".mp4": "video/mp4", ".webm": "video/webm"
};
// Cache only text assets; audio/video files are streamed and images use browser caching.
const textCache = new Map();
const textCacheLimit = 4 * 1024 * 1024;
let textCacheBytes = 0;

function cacheText(filename, entry) {
  const previous = textCache.get(filename);
  if (previous) { textCacheBytes -= previous.bytes; textCache.delete(filename); }
  if (entry.bytes > textCacheLimit) return;
  while (textCacheBytes + entry.bytes > textCacheLimit) {
    const oldest = textCache.keys().next().value;
    textCacheBytes -= textCache.get(oldest).bytes; textCache.delete(oldest);
  }
  textCache.set(filename, entry); textCacheBytes += entry.bytes;
}

function serveFile(request, response, filename) {
  fs.stat(filename, (error, stat) => {
    if (error || !stat.isFile()) return response.writeHead(404).end("Introuvable");
    const ext = path.extname(filename), compressible = [".html", ".css", ".js", ".json", ".svg"].includes(ext);
    const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
    const headers = { "Content-Type":mimeTypes[ext] || "application/octet-stream", "Cache-Control":"no-cache", ETag:etag, "Last-Modified":stat.mtime.toUTCString() };
    if (compressible) headers.Vary = "Accept-Encoding";
    if ((request.headers["if-none-match"] || "").split(",").some(tag => tag.trim() === "*" || tag.trim().replace(/^W\//, "") === etag.slice(2))) return response.writeHead(304,headers).end();
    if ([".mp3", ".mp4", ".webm"].includes(ext)) {
      let start = 0, end = stat.size - 1, status = 200;
      headers["Accept-Ranges"] = "bytes";
      if (request.headers.range && !request.headers["if-range"]) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (range?.[1]) { start = Number(range[1]); end = range[2] ? Math.min(Number(range[2]),end) : end; }
        else if (range?.[2]) start = Math.max(0,stat.size - Number(range[2]));
        if (!range || (!range[1] && !range[2]) || start > end || start >= stat.size) return response.writeHead(416,{ ...headers,"Content-Range":`bytes */${stat.size}` }).end();
        status = 206; headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
      }
      headers["Content-Length"] = end - start + 1;
      response.writeHead(status,headers);
      if (request.method === "HEAD") return response.end();
      const stream = fs.createReadStream(filename,{ start,end });
      stream.on("error",() => response.destroy()); response.on("close",() => stream.destroy());
      return stream.pipe(response);
    }
    const reply = entry => {
      const gzip = /(?:^|,)\s*gzip(?:\s*;\s*q=([\d.]+))?(?:\s*,|\s*$)/i.exec(request.headers["accept-encoding"] || "");
      const data = entry.gzip && gzip && (gzip[1] === undefined || Number(gzip[1]) > 0) ? entry.gzip : entry.data;
      if (data === entry.gzip) headers["Content-Encoding"] = "gzip";
      headers["Content-Length"] = data.length;
      response.writeHead(200,headers).end(request.method === "HEAD" ? undefined : data);
    };
    const cached = textCache.get(filename);
    if (compressible && cached?.etag === etag) return reply(cached);
    fs.readFile(filename,(readError,data) => {
      if (readError) return response.writeHead(404).end("Introuvable");
      const zipped = compressible && data.length >= 1024 ? gzipSync(data) : null;
      const entry = { etag,data,gzip:zipped,bytes:data.length + (zipped?.length || 0) };
      if (compressible) cacheText(filename,entry);
      reply(entry);
    });
  });
}

function send(socket, message) {
  if (socket && !socket.destroyed) socket.send(JSON.stringify(message));
}

class WebSocketConnection extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    socket.on("data", (chunk) => this.read(chunk));
    socket.on("close", () => { this.destroyed = true; this.emit("close"); });
    socket.on("error", () => socket.destroy());
  }

  send(text) {
    const payload = Buffer.from(text);
    let header;
    if (payload.length < 126) header = Buffer.from([0x81, payload.length]);
    else if (payload.length < 65536) {
      header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    this.socket.write(Buffer.concat([header, payload]));
  }

  read(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const opcode = this.buffer[0] & 0x0f;
      const masked = Boolean(this.buffer[1] & 0x80);
      let length = this.buffer[1] & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2); offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        length = Number(this.buffer.readBigUInt64BE(2)); offset = 10;
      }
      const maskSize = masked ? 4 : 0;
      if (this.buffer.length < offset + maskSize + length) return;
      const mask = masked ? this.buffer.subarray(offset, offset + 4) : null;
      offset += maskSize;
      const payload = Buffer.from(this.buffer.subarray(offset, offset + length));
      this.buffer = this.buffer.subarray(offset + length);
      if (masked) for (let index = 0; index < payload.length; index++) payload[index] ^= mask[index % 4];
      if (opcode === 0x8) return this.socket.end();
      if (opcode === 0x9) { this.socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); continue; }
      if (opcode === 0x1) this.emit("message", payload);
    }
  }
}

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let relative;
  try { relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname); }
  catch (_) { response.writeHead(400).end("Adresse invalide"); return; }
  const filePath = path.resolve(root, `.${relative}`);
  const fromRoot = path.relative(root, filePath);
  const publicPath = fromRoot === "index.html" || ["css", "js", "assets"].includes(fromRoot.split(path.sep)[0]);
  if (!publicPath || fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) {
    response.writeHead(403).end("Interdit");
    return;
  }
  serveFile(request,response,filePath);
});

server.on("upgrade", (request, socket) => {
  if (request.url !== "/ws" || !request.headers["sec-websocket-key"]) return socket.destroy();
  const accept = crypto.createHash("sha1").update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const connection = new WebSocketConnection(socket);
  handleConnection(connection);
});

function handleConnection(socket) {
  socket.on("message", (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch (_) { return; }
    if (!message || typeof message !== 'object' || Array.isArray(message)) return;
    if (['create', 'join'].includes(message.type) && socket.roomCode) {
      send(socket, { type: 'error', message: 'Cette connexion appartient déjà à un salon.' });
      return;
    }

    if (message.type === "create") {
      const code = roomCode();
      rooms.set(code, { host: socket, guest: null, mythology: mythology.createAuthority() });
      socket.roomCode = code;
      socket.playerId = "red";
      send(socket, { type: "created", code, playerId: "red" });
      return;
    }

    if (message.type === "join") {
      const code = String(message.code || "").trim().toUpperCase();
      const room = rooms.get(code);
      if (!room || room.guest) {
        send(socket, { type: "error", message: room ? "Ce salon est déjà complet." : "Salon introuvable." });
        return;
      }
      room.guest = socket;
      socket.roomCode = code;
      socket.playerId = "blue";
      send(socket, { type: "joined", code, playerId: "blue" });
      send(socket, { type: 'mythology', view: room.mythology.view('blue') });
      send(room.host, { type: "peer", connected: true });
      send(room.host, { type: "state-request" });
      return;
    }

    const room = rooms.get(socket.roomCode);
    if (!room) return;
    // Le rôle vient de la connexion, jamais d’un identifiant fourni par le client.
    if (message.type === 'mythology-select' && (socket === room.host || socket === room.guest)) {
      const result = room.mythology.select(socket === room.host ? 'red' : 'blue', message);
      send(socket, { type: 'mythology', ...result, view: room.mythology.view(socket === room.host ? 'red' : 'blue') });
      return;
    }
    if (message.type === 'mythology-activate' && (socket === room.host || socket === room.guest)) {
      const playerId = socket === room.host ? 'red' : 'blue';
      const result = room.mythology.requestActivation(playerId, message);
      send(socket, { type: 'mythology', activation: true, accepted: result.accepted, reason: result.reason,
        view: room.mythology.view(playerId) });
      // Seule cette route privée du relais autorise une exécution chez l’hôte.
      // Le choix adverse n’est dévoilé qu’au moment de son utilisation.
      if (result.accepted) send(room.host, { type: 'mythology-execute', execution: result.execution });
      return;
    }
    if (message.type === 'mythology-result' && socket === room.host) {
      const playerId = room.mythology.finishActivation(message.activationId, message.accepted === true, message.reason);
      if (playerId) send(playerId === 'red' ? room.host : room.guest,
        { type: 'mythology', activation: true, accepted: message.accepted === true, reason: message.reason,
          view: room.mythology.view(playerId) });
      return;
    }
    if (message.type === "command" && socket === room.guest) {
      send(room.host, { ...message, playerId: "blue" });
    } else if (message.type === "state" && socket === room.host) {
      send(room.guest, message);
      const before = room.mythology.view('red').revision;
      room.mythology.sync(message.state);
      if (room.mythology.view('red').revision !== before) {
        send(room.host, { type: 'mythology', view: room.mythology.view('red') });
        send(room.guest, { type: 'mythology', view: room.mythology.view('blue') });
      }
    }
  });

  socket.on("close", () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    if (socket === room.host) {
      send(room.guest, { type: "peer", connected: false, message: "L’hôte a quitté la partie." });
      rooms.delete(socket.roomCode);
    } else if (socket === room.guest) {
      room.guest = null;
      send(room.host, { type: "peer", connected: false, message: "Le joueur bleu s’est déconnecté." });
    }
  });
}

server.listen(port, "0.0.0.0", () => {
  console.log(`Eredità disponible sur http://localhost:${port}`);
});
