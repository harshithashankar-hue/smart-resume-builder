/**
 * Real-Time Chat App - Server
 * ---------------------------
 * Express + Socket.IO backend that powers:
 *  - JWT-based authentication (register/login)
 *  - Public chat rooms
 *  - Private 1:1 messaging
 *  - Typing indicators
 *  - Online/offline presence
 *  - Persisted chat history (JSON-file "database" via lowdb-style store,
 *    swappable for MongoDB — see db.js)
 */

const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const db = require('./db');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const { JWT_SECRET } = require('./config');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes(io));

// Track which socket belongs to which user, and who is online
const onlineUsers = new Map(); // userId -> { username, socketId }

function authenticateSocket(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = { id: payload.id, username: payload.username };
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
}

io.use(authenticateSocket);

io.on('connection', (socket) => {
  const { id: userId, username } = socket.user;
  onlineUsers.set(userId, { username, socketId: socket.id });
  io.emit('presence:update', Array.from(onlineUsers.values()).map(u => u.username));

  socket.on('room:join', ({ room }) => {
    socket.join(room);
    const history = db.getRoomHistory(room);
    socket.emit('room:history', { room, messages: history });
    socket.to(room).emit('room:system', {
      room,
      text: `${username} joined the room`,
      ts: Date.now(),
    });
  });

  socket.on('room:leave', ({ room }) => {
    socket.leave(room);
    socket.to(room).emit('room:system', {
      room,
      text: `${username} left the room`,
      ts: Date.now(),
    });
  });

  socket.on('room:message', ({ room, text }) => {
    if (!text || !text.trim()) return;
    const message = {
      id: db.nextMessageId(),
      room,
      from: username,
      fromId: userId,
      text: text.trim(),
      ts: Date.now(),
    };
    db.saveRoomMessage(message);
    io.to(room).emit('room:message', message);
  });

  socket.on('dm:message', ({ toUsername, text }) => {
    if (!text || !text.trim()) return;
    const target = Array.from(onlineUsers.entries())
      .find(([, u]) => u.username === toUsername);

    const message = {
      id: db.nextMessageId(),
      from: username,
      fromId: userId,
      to: toUsername,
      text: text.trim(),
      ts: Date.now(),
    };
    db.saveDirectMessage(message);

    // Echo back to sender
    socket.emit('dm:message', message);
    // Deliver to recipient if online
    if (target) {
      const [, u] = target;
      io.to(u.socketId).emit('dm:message', message);
    }
  });

  socket.on('dm:history', ({ withUsername }, callback) => {
    const history = db.getDirectHistory(username, withUsername);
    callback(history);
  });

  socket.on('typing', ({ room, toUsername, isTyping }) => {
    if (room) {
      socket.to(room).emit('typing', { room, username, isTyping });
    } else if (toUsername) {
      const target = Array.from(onlineUsers.entries())
        .find(([, u]) => u.username === toUsername);
      if (target) {
        const [, u] = target;
        io.to(u.socketId).emit('typing', { fromUsername: username, isTyping });
      }
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    io.emit('presence:update', Array.from(onlineUsers.values()).map(u => u.username));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
