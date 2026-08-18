# 💬 PulseChat — Real-Time Chat App with Socket.IO

A secure, scalable real-time chat platform built with **Node.js, Express, and Socket.IO**. Supports authenticated users, public chat rooms, private 1:1 messaging, live typing indicators, and online presence — with persisted chat history.

![Node](https://img.shields.io/badge/Node.js-22-green) ![Express](https://img.shields.io/badge/Express-4-black) ![Socket.IO](https://img.shields.io/badge/Socket.IO-4-blue) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Abstract

Real-time communication is one of the most common requirements in modern web applications, from customer support widgets to team collaboration tools. This project implements a full-stack chat platform that demonstrates the core mechanics of building such a system from scratch: bidirectional WebSocket communication, stateless JWT authentication, room-based message broadcasting, targeted private messaging, and live UX signals like typing indicators and presence — all without relying on a third-party chat SaaS.

## Introduction

PulseChat lets users register an account, log in, and join topic-based chat rooms (`#general`, `#random`, `#tech-talk`) where messages broadcast instantly to everyone present. Users can also click on any online participant to open a private, encrypted-in-transit direct message thread. The app tracks who's online in real time and shows a "user is typing…" indicator so conversations feel alive rather than static.

The backend is intentionally built with a storage abstraction layer (`server/db.js`) so it runs immediately with zero external services (using local JSON-file storage) while remaining a drop-in fit for MongoDB in a production deployment — the exact Mongoose schemas are documented inline.

## Tools Used

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Server framework | Express.js |
| Real-time engine | Socket.IO (WebSocket transport with polling fallback) |
| Auth | JSON Web Tokens (`jsonwebtoken`) + password hashing (`bcryptjs`) |
| Persistence | File-based JSON store (swappable for MongoDB) |
| Frontend | Vanilla HTML/CSS/JavaScript (no framework — keeps the Socket.IO event flow transparent) |

## Features

- 🔐 **Authentication** — Register/login with hashed passwords and JWT session tokens (verified on both REST calls and the Socket.IO handshake).
- 🏠 **Chat rooms** — Join/leave rooms; messages broadcast live to everyone in the room; history loads on join.
- ✉️ **Private messaging** — Click any online user to open a 1:1 DM thread with its own persisted history.
- ⌨️ **Typing indicators** — Real-time "X is typing…" for both rooms and DMs.
- 🟢 **Presence** — Live online user list, updated the instant someone connects or disconnects.
- 💾 **Persisted history** — Messages survive server restarts (stored under `/data`).

## Steps Involved in Building the Project

1. **Scaffolded the Express server** and mounted a static file server for the frontend.
2. **Built JWT-based authentication** — `/api/auth/register` and `/api/auth/login` routes hash passwords with bcrypt and issue signed JWTs.
3. **Wired up Socket.IO** with a handshake middleware (`io.use`) that verifies the JWT before allowing any socket to connect, attaching the authenticated user to `socket.user`.
4. **Implemented room broadcasting** — `room:join`, `room:message`, and `room:leave` events, with server-side history persisted per room and replayed to a user when they join.
5. **Implemented private messaging** — a `dm:message` event that looks up the recipient's live socket (if online) and delivers instantly, alongside a `dm:history` request/response for loading past conversation.
6. **Added typing indicators and presence** — lightweight `typing` and `presence:update` events broadcast to the relevant room or user only (not globally), keeping bandwidth low.
7. **Built the frontend** as a single-page app: an auth screen (login/register tabs) that swaps to a Slack-style three-pane chat UI (rooms + online users sidebar, message thread, composer) once authenticated.
8. **Persisted state client-side** via `localStorage` for the JWT so refreshing the page keeps the user logged in and reconnects the socket automatically.

## Project Structure

```
realtime-chat-app/
├── server/
│   ├── index.js          # Express + Socket.IO server, all real-time event handlers
│   ├── config.js         # JWT secret, default rooms
│   ├── db.js             # File-based persistence layer (MongoDB-ready schema in comments)
│   └── routes/
│       ├── auth.js       # /api/auth/register, /api/auth/login
│       └── rooms.js      # /api/rooms
├── public/
│   ├── index.html        # Auth screen + chat UI shell
│   ├── style.css          # Dark-mode UI styling
│   └── client.js          # Socket.IO client logic, DOM rendering
├── data/                  # Auto-created JSON "database" files (gitignored)
├── package.json
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
git clone <this-repo-url>
cd realtime-chat-app
npm install
```

### Run the app

```bash
npm start
```

Then open **http://localhost:3000** in two different browser windows (or one normal + one incognito) to simulate two users chatting with each other in real time.

### Environment variables (optional)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | `dev-secret-change-in-production` | Secret used to sign JWTs — **set this in production** |

## How It Works (Architecture Notes)

- **Auth handshake:** the client stores its JWT in `localStorage` and passes it as `socket.handshake.auth.token` when connecting. The server's `io.use()` middleware verifies it before the connection is accepted — an invalid/expired token is rejected at the transport layer, not per-message.
- **Rooms vs. DMs:** rooms use Socket.IO's built-in room feature (`socket.join(room)`) so broadcasting is a single `io.to(room).emit(...)` call. DMs instead look up the recipient's live socket ID from an in-memory `Map` of online users, so delivery is targeted rather than broadcast.
- **Swappable storage:** every persistence call goes through `server/db.js`. Swapping the JSON-file implementation for MongoDB/Mongoose only requires changing that one file — no changes to routes or socket handlers.

## Future Improvements

- Move persistence to MongoDB (schema already documented in `db.js`) for concurrent-write safety at scale.
- Add message read receipts and unread badges.
- Add file/image sharing.
- Rate-limit message sends per socket to prevent spam.
- Add Redis adapter for Socket.IO to support horizontal scaling across multiple server instances.

## Conclusion

This project demonstrates a working, end-to-end real-time chat system covering authentication, WebSocket-based bidirectional communication, room and private messaging patterns, live presence, and persisted history — the same core patterns used in production tools like Slack or Discord. It's built to be run and demoed with zero external dependencies, while the storage layer is deliberately structured for a clean upgrade path to MongoDB in a production setting.

## Interview Talking Points

- Why Socket.IO over raw WebSockets (auto-reconnect, fallback transport, room abstraction).
- How authentication is enforced on the socket handshake, not just REST routes.
- The tradeoff between broadcasting (rooms) vs. targeted delivery (DMs) and how online-user lookup works.
- How the storage layer is abstracted for easy database swaps.

---

*Built as part of the Elevate Labs internship project phase.*
