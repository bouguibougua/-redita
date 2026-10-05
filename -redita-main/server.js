"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");

const port = Number(process.env.PORT) || 8765;
const root = __dirname;
const rooms = new Map();
const mimeTypes = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml"
};

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
  let relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(root, `.${relative}`);
  const fromRoot = path.relative(root, filePath);
  const publicPath = fromRoot === "index.html" || ["css", "js", "assets"].includes(fromRoot.split(path.sep)[0]);
  if (!publicPath || fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) {
    response.writeHead(403).end("Interdit");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404).end("Introuvable");
      return;
    }
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-cache" });
    response.end(data);
  });
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

    if (message.type === "create") {
      const code = roomCode();
      rooms.set(code, { host: socket, guest: null });
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
      send(room.host, { type: "peer", connected: true });
      send(room.host, { type: "state-request" });
      return;
    }

    const room = rooms.get(socket.roomCode);
    if (!room) return;
    if (message.type === "command" && socket === room.guest) {
      send(room.host, { ...message, playerId: "blue" });
    } else if (message.type === "state" && socket === room.host) {
      send(room.guest, message);
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
