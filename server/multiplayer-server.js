const http = require("http");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3217);
const MAX_CLIENTS = Number(process.env.MAX_CLIENTS || 120);
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 60);
const MAX_ROOM_CLIENTS = Number(process.env.MAX_ROOM_CLIENTS || 4);
const MAX_MESSAGE_BYTES = Number(process.env.MAX_MESSAGE_BYTES || 8192);
const MAX_BUFFER_BYTES = Number(process.env.MAX_BUFFER_BYTES || 16384);
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 10000);
const MAX_MESSAGES_PER_WINDOW = Number(process.env.MAX_MESSAGES_PER_WINDOW || 40);
const MAX_UPGRADES_PER_MINUTE = Number(process.env.MAX_UPGRADES_PER_MINUTE || 30);
const CLIENT_IDLE_MS = Number(process.env.CLIENT_IDLE_MS || 30 * 60 * 1000);
const SERVER_TOKEN = process.env.SERVER_TOKEN || "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

const rooms = new Map();
const clients = new Map();
const ipUpgrades = new Map();

function makeId(prefix = "") {
  return `${prefix}${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

function makeRoomCode() {
  let code = "";
  do {
    code = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(code));
  return code;
}

function now() {
  return Date.now();
}

function wsAccept(key) {
  return crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ type: "error", message: "Could not encode server message." });
  }
}

function encodeFrame(payload) {
  const data = Buffer.from(payload);
  const header = [];
  header.push(0x81);
  if (data.length < 126) {
    header.push(data.length);
  } else if (data.length < 65536) {
    header.push(126, (data.length >> 8) & 255, data.length & 255);
  } else {
    header.push(127, 0, 0, 0, 0, (data.length >> 24) & 255, (data.length >> 16) & 255, (data.length >> 8) & 255, data.length & 255);
  }
  return Buffer.concat([Buffer.from(header), data]);
}

function encodeCloseFrame() {
  return Buffer.from([0x88, 0x00]);
}

function send(client, message) {
  if (!client || client.socket.destroyed) return;
  try {
    client.socket.write(encodeFrame(safeJson(message)));
  } catch {
    closeClient(client, "write failed");
  }
}

function closeClient(client, reason = "closed") {
  if (!client || client.closed) return;
  client.closed = true;
  leaveRoom(client, false);
  clients.delete(client.id);
  try {
    if (!client.socket.destroyed && client.socket.writable) client.socket.write(encodeCloseFrame());
    client.socket.end();
  } catch {
    try {
      client.socket.destroy();
    } catch {}
  }
  if (process.env.DEBUG_MULTIPLAYER) console.log(`Closed ${client.id}: ${reason}`);
}

function publicClientCount(room) {
  return room.clients.size;
}

function roomState(room) {
  return {
    type: "room-state",
    roomCode: room.code,
    hostId: room.hostId,
    clients: publicClientCount(room),
    maxClients: MAX_ROOM_CLIENTS
  };
}

function broadcastRoom(room, message, exceptId = "") {
  room.clients.forEach(clientId => {
    if (clientId === exceptId) return;
    const client = clients.get(clientId);
    if (client) send(client, message);
  });
}

function validRoomCode(code) {
  return /^[A-F0-9]{6}$/.test(code);
}

function joinRoom(client, code) {
  if (!validRoomCode(code)) {
    send(client, { type: "error", message: "Room code must be 6 letters/numbers." });
    return;
  }
  const room = rooms.get(code);
  if (!room) {
    send(client, { type: "error", message: "Room not found." });
    return;
  }
  if (room.clients.size >= MAX_ROOM_CLIENTS && !room.clients.has(client.id)) {
    send(client, { type: "error", message: "Room is full." });
    return;
  }
  leaveRoom(client, false);
  client.roomCode = code;
  room.clients.add(client.id);
  send(client, { type: "joined-room", roomCode: code });
  broadcastRoom(room, roomState(room));
}

function createRoom(client) {
  if (rooms.size >= MAX_ROOMS) {
    send(client, { type: "error", message: "Server is full. Try again later." });
    return;
  }
  leaveRoom(client, false);
  const code = makeRoomCode();
  rooms.set(code, { code, hostId: client.id, clients: new Set([client.id]), createdAt: now() });
  client.roomCode = code;
  send(client, { type: "room-created", roomCode: code });
  broadcastRoom(rooms.get(code), roomState(rooms.get(code)));
}

function leaveRoom(client, notify = true) {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (room) {
    room.clients.delete(client.id);
    if (room.clients.size === 0) {
      rooms.delete(room.code);
    } else {
      if (room.hostId === client.id) room.hostId = room.clients.values().next().value;
      broadcastRoom(room, roomState(room));
    }
  }
  client.roomCode = "";
  if (notify) send(client, { type: "left-room" });
}

function rateLimited(client) {
  const time = now();
  client.messageTimes = client.messageTimes.filter(stamp => time - stamp < RATE_WINDOW_MS);
  client.messageTimes.push(time);
  return client.messageTimes.length > MAX_MESSAGES_PER_WINDOW;
}

function cleanText(value, maxLength = 240) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, maxLength);
}

function sanitizePeerMessage(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (input.type === "table-log") {
    const message = cleanText(input.payload?.message, 280);
    if (!message) return null;
    return { type: "table-log", payload: { message } };
  }
  if (input.type === "table-sync") {
    const payload = input.payload || {};
    return {
      type: "table-sync",
      payload: {
        phase: cleanText(payload.phase, 40),
        turnNumber: Number.isFinite(Number(payload.turnNumber)) ? Math.max(0, Math.min(9999, Number(payload.turnNumber))) : 0,
        turn: cleanText(payload.turn, 40),
        deckMode: cleanText(payload.deckMode, 30),
        diceEnabled: Boolean(payload.diceEnabled),
        summary: cleanText(payload.summary, 320)
      }
    };
  }
  return null;
}

function handleMessage(client, raw) {
  client.lastSeen = now();
  if (raw.length > MAX_MESSAGE_BYTES) {
    send(client, { type: "error", message: "Message too large." });
    closeClient(client, "large message");
    return;
  }
  if (rateLimited(client)) {
    send(client, { type: "error", message: "Slow down. Too many messages." });
    closeClient(client, "rate limit");
    return;
  }

  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    send(client, { type: "error", message: "Bad JSON." });
    return;
  }
  if (!message || typeof message !== "object" || Array.isArray(message) || typeof message.type !== "string") {
    send(client, { type: "error", message: "Bad message." });
    return;
  }

  if (message.type === "hello-client") {
    send(client, { type: "hello", clientId: client.id });
    return;
  }

  if (message.type === "create-room") {
    createRoom(client);
    return;
  }

  if (message.type === "join-room") {
    joinRoom(client, cleanText(message.roomCode, 12).toUpperCase());
    return;
  }

  if (message.type === "leave-room") {
    leaveRoom(client);
    return;
  }

  if (message.type === "broadcast") {
    const room = rooms.get(client.roomCode);
    if (!room) {
      send(client, { type: "error", message: "Join a room before broadcasting." });
      return;
    }
    const peerMessage = sanitizePeerMessage(message.message);
    if (!peerMessage) {
      send(client, { type: "error", message: "Invalid broadcast." });
      return;
    }
    broadcastRoom(room, {
      type: "peer-message",
      from: client.id,
      message: peerMessage
    }, client.id);
    return;
  }

  if (message.type === "ping") {
    send(client, { type: "pong", at: now() });
    return;
  }

  send(client, { type: "error", message: "Unknown message type." });
}

function decodeFrames(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);
  if (client.buffer.length > MAX_BUFFER_BYTES) {
    closeClient(client, "buffer too large");
    return;
  }

  let offset = 0;
  while (offset + 2 <= client.buffer.length) {
    const first = client.buffer[offset];
    const second = client.buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let header = 2;

    if (length === 126) {
      if (offset + 4 > client.buffer.length) break;
      length = client.buffer.readUInt16BE(offset + 2);
      header = 4;
    } else if (length === 127) {
      if (offset + 10 > client.buffer.length) break;
      const bigLength = client.buffer.readBigUInt64BE(offset + 2);
      if (bigLength > BigInt(MAX_MESSAGE_BYTES)) {
        closeClient(client, "huge frame");
        return;
      }
      length = Number(bigLength);
      header = 10;
    }

    if (!masked) {
      closeClient(client, "unmasked client frame");
      return;
    }
    if (length > MAX_MESSAGE_BYTES) {
      closeClient(client, "message too large");
      return;
    }

    const maskOffset = offset + header;
    const payloadOffset = maskOffset + 4;
    if (payloadOffset + length > client.buffer.length) break;

    let payload = client.buffer.subarray(payloadOffset, payloadOffset + length);
    const mask = client.buffer.subarray(maskOffset, maskOffset + 4);
    payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));

    if (opcode === 0x1) {
      handleMessage(client, payload.toString("utf8"));
    } else if (opcode === 0x8) {
      closeClient(client, "client close frame");
      return;
    } else if (opcode !== 0x9 && opcode !== 0xA) {
      closeClient(client, "unsupported frame");
      return;
    }

    offset = payloadOffset + length;
  }
  client.buffer = client.buffer.subarray(offset);
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}

function checkUpgradeRate(ip) {
  const time = now();
  const stamps = (ipUpgrades.get(ip) || []).filter(stamp => time - stamp < 60000);
  stamps.push(time);
  ipUpgrades.set(ip, stamps);
  return stamps.length <= MAX_UPGRADES_PER_MINUTE;
}

function originAllowed(origin) {
  if (!ALLOWED_ORIGINS.length) return true;
  if (!origin && ALLOWED_ORIGINS.includes("null")) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function tokenAllowed(req) {
  if (!SERVER_TOKEN) return true;
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    return url.searchParams.get("token") === SERVER_TOKEN;
  } catch {
    return false;
  }
}

function rejectUpgrade(socket, status, message) {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify({
    ok: true,
    name: "Sir Autismos Tavern multiplayer server",
    rooms: rooms.size,
    clients: clients.size,
    secureMode: Boolean(SERVER_TOKEN || ALLOWED_ORIGINS.length)
  }));
});

server.on("upgrade", (req, socket) => {
  const ip = clientIp(req);
  const key = req.headers["sec-websocket-key"];
  const version = req.headers["sec-websocket-version"];

  if (!checkUpgradeRate(ip)) return rejectUpgrade(socket, 429, "Too Many Requests");
  if (clients.size >= MAX_CLIENTS) return rejectUpgrade(socket, 503, "Server Full");
  if (!key || version !== "13") return rejectUpgrade(socket, 400, "Bad WebSocket");
  if (!originAllowed(req.headers.origin || "")) return rejectUpgrade(socket, 403, "Origin Forbidden");
  if (!tokenAllowed(req)) return rejectUpgrade(socket, 401, "Token Required");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${wsAccept(key)}`,
    "",
    ""
  ].join("\r\n"));

  const client = {
    id: makeId("P"),
    socket,
    ip,
    roomCode: "",
    buffer: Buffer.alloc(0),
    messageTimes: [],
    lastSeen: now(),
    closed: false
  };
  clients.set(client.id, client);
  send(client, { type: "hello", clientId: client.id });

  socket.on("data", chunk => decodeFrames(client, chunk));
  socket.on("close", () => closeClient(client, "socket close"));
  socket.on("error", () => closeClient(client, "socket error"));
});

setInterval(() => {
  const cutoff = now() - CLIENT_IDLE_MS;
  clients.forEach(client => {
    if (client.lastSeen < cutoff) closeClient(client, "idle");
  });
  const upgradeCutoff = now() - 60000;
  ipUpgrades.forEach((stamps, ip) => {
    const fresh = stamps.filter(stamp => stamp > upgradeCutoff);
    if (fresh.length) ipUpgrades.set(ip, fresh);
    else ipUpgrades.delete(ip);
  });
}, 30000).unref();

server.listen(PORT, () => {
  console.log(`Sir Autismos Tavern multiplayer server listening on ws://localhost:${PORT}`);
  if (!SERVER_TOKEN) console.log("Security note: set SERVER_TOKEN for public hosting.");
  if (!ALLOWED_ORIGINS.length) console.log("Security note: set ALLOWED_ORIGINS for public hosting.");
});
