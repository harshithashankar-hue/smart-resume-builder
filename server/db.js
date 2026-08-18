/**
 * db.js
 * -----
 * A tiny file-based persistence layer so the app runs with zero external
 * services out of the box. Every function here maps 1:1 to what you'd write
 * with Mongoose against MongoDB — see the comment block at the bottom for
 * the drop-in schema if you want to swap storage engines for production.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ROOM_MSG_FILE = path.join(DATA_DIR, 'room_messages.json');
const DM_FILE = path.join(DATA_DIR, 'direct_messages.json');

function ensureFile(file, fallback) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
  }
}

ensureFile(USERS_FILE, []);
ensureFile(ROOM_MSG_FILE, []);
ensureFile(DM_FILE, []);

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let messageCounter = Math.max(
  0,
  ...readJSON(ROOM_MSG_FILE).map(m => m.id),
  ...readJSON(DM_FILE).map(m => m.id),
  0
);

// ---------- Users ----------
function getUserByUsername(username) {
  return readJSON(USERS_FILE).find(u => u.username === username);
}

function createUser(user) {
  const users = readJSON(USERS_FILE);
  users.push(user);
  writeJSON(USERS_FILE, users);
  return user;
}

// ---------- Room messages ----------
function saveRoomMessage(message) {
  const messages = readJSON(ROOM_MSG_FILE);
  messages.push(message);
  writeJSON(ROOM_MSG_FILE, messages);
}

function getRoomHistory(room, limit = 50) {
  const messages = readJSON(ROOM_MSG_FILE).filter(m => m.room === room);
  return messages.slice(-limit);
}

// ---------- Direct messages ----------
function saveDirectMessage(message) {
  const messages = readJSON(DM_FILE);
  messages.push(message);
  writeJSON(DM_FILE, messages);
}

function getDirectHistory(userA, userB, limit = 50) {
  const messages = readJSON(DM_FILE).filter(
    m => (m.from === userA && m.to === userB) || (m.from === userB && m.to === userA)
  );
  return messages.slice(-limit);
}

function nextMessageId() {
  messageCounter += 1;
  return messageCounter;
}

module.exports = {
  getUserByUsername,
  createUser,
  saveRoomMessage,
  getRoomHistory,
  saveDirectMessage,
  getDirectHistory,
  nextMessageId,
};

/**
 * ---------------------------------------------------------------
 * MongoDB / Mongoose equivalent (for production use):
 *
 * const userSchema = new mongoose.Schema({
 *   username: { type: String, unique: true, required: true },
 *   passwordHash: { type: String, required: true },
 *   createdAt: { type: Date, default: Date.now },
 * });
 *
 * const messageSchema = new mongoose.Schema({
 *   room: String,          // present for room messages
 *   to: String,            // present for direct messages
 *   from: String,
 *   fromId: mongoose.Schema.Types.ObjectId,
 *   text: String,
 *   ts: { type: Date, default: Date.now },
 * });
 *
 * Swap every function above for the equivalent Model.find/create call
 * and the rest of the app (routes, socket handlers) needs no changes.
 * ---------------------------------------------------------------
 */
