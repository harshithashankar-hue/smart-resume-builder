(() => {
  const state = {
    token: localStorage.getItem('chat_token') || null,
    username: localStorage.getItem('chat_username') || null,
    socket: null,
    currentTarget: { type: 'room', name: 'general' }, // or { type: 'dm', name: username }
    rooms: [],
    onlineUsers: [],
    typingTimeout: null,
  };

  // ---------- DOM refs ----------
  const authScreen = document.getElementById('auth-screen');
  const chatScreen = document.getElementById('chat-screen');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const authError = document.getElementById('auth-error');
  const tabBtns = document.querySelectorAll('.tab-btn');

  const meUsername = document.getElementById('me-username');
  const logoutBtn = document.getElementById('logout-btn');
  const roomListEl = document.getElementById('room-list');
  const onlineListEl = document.getElementById('online-list');
  const onlineCountEl = document.getElementById('online-count');
  const currentTargetEl = document.getElementById('current-target');
  const typingIndicatorEl = document.getElementById('typing-indicator');
  const messagesEl = document.getElementById('messages');
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-input');

  // ---------- Tabs ----------
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      loginForm.classList.toggle('hidden', tab !== 'login');
      registerForm.classList.toggle('hidden', tab !== 'register');
      authError.classList.add('hidden');
    });
  });

  // ---------- Auth ----------
  async function apiRequest(path, body) {
    const res = await fetch(`/api/auth${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    try {
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const data = await apiRequest('/login', { username, password });
      onAuthSuccess(data);
    } catch (err) {
      showAuthError(err.message);
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    try {
      const username = document.getElementById('register-username').value.trim();
      const password = document.getElementById('register-password').value;
      const data = await apiRequest('/register', { username, password });
      onAuthSuccess(data);
    } catch (err) {
      showAuthError(err.message);
    }
  });

  function showAuthError(msg) {
    authError.textContent = msg;
    authError.classList.remove('hidden');
  }

  function onAuthSuccess({ token, username }) {
    state.token = token;
    state.username = username;
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_username', username);
    enterChat();
  }

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_username');
    if (state.socket) state.socket.disconnect();
    window.location.reload();
  });

  // ---------- Chat ----------
  async function enterChat() {
    authScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    meUsername.textContent = state.username;

    const res = await fetch('/api/rooms');
    const data = await res.json();
    state.rooms = data.rooms;
    renderRoomList();

    connectSocket();
  }

  function connectSocket() {
    state.socket = io({ auth: { token: state.token } });

    state.socket.on('connect_error', (err) => {
      if (err.message.includes('Authentication') || err.message.includes('Invalid')) {
        localStorage.removeItem('chat_token');
        localStorage.removeItem('chat_username');
        window.location.reload();
      }
    });

    state.socket.on('room:history', ({ room, messages }) => {
      if (state.currentTarget.type === 'room' && state.currentTarget.name === room) {
        messagesEl.innerHTML = '';
        messages.forEach(renderMessage);
        scrollToBottom();
      }
    });

    state.socket.on('room:message', (msg) => {
      if (state.currentTarget.type === 'room' && state.currentTarget.name === msg.room) {
        renderMessage(msg);
        scrollToBottom();
      }
    });

    state.socket.on('room:system', ({ room, text }) => {
      if (state.currentTarget.type === 'room' && state.currentTarget.name === room) {
        renderSystemMessage(text);
        scrollToBottom();
      }
    });

    state.socket.on('dm:message', (msg) => {
      const other = msg.from === state.username ? msg.to : msg.from;
      if (state.currentTarget.type === 'dm' && state.currentTarget.name === other) {
        renderMessage(msg);
        scrollToBottom();
      }
    });

    state.socket.on('presence:update', (usernames) => {
      state.onlineUsers = usernames.filter(u => u !== state.username);
      renderOnlineList();
    });

    state.socket.on('typing', (payload) => {
      const isForCurrentRoom = state.currentTarget.type === 'room' &&
        payload.room === state.currentTarget.name;
      const isForCurrentDm = state.currentTarget.type === 'dm' &&
        payload.fromUsername === state.currentTarget.name;

      if (isForCurrentRoom || isForCurrentDm) {
        const who = payload.username || payload.fromUsername;
        typingIndicatorEl.textContent = payload.isTyping ? `${who} is typing…` : '';
      }
    });

    state.socket.on('connect', () => {
      joinRoom(state.currentTarget.name);
    });
  }

  function renderRoomList() {
    roomListEl.innerHTML = '';
    state.rooms.forEach(room => {
      const li = document.createElement('li');
      li.textContent = `# ${room}`;
      li.dataset.room = room;
      if (state.currentTarget.type === 'room' && state.currentTarget.name === room) {
        li.classList.add('active');
      }
      li.addEventListener('click', () => switchToRoom(room));
      roomListEl.appendChild(li);
    });
  }

  function renderOnlineList() {
    onlineCountEl.textContent = state.onlineUsers.length;
    onlineListEl.innerHTML = '';
    state.onlineUsers.forEach(username => {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot';
      li.appendChild(dot);
      li.appendChild(document.createTextNode(username));
      if (state.currentTarget.type === 'dm' && state.currentTarget.name === username) {
        li.classList.add('active');
      }
      li.addEventListener('click', () => switchToDm(username));
      onlineListEl.appendChild(li);
    });
  }

  function switchToRoom(room) {
    state.currentTarget = { type: 'room', name: room };
    currentTargetEl.textContent = `# ${room}`;
    typingIndicatorEl.textContent = '';
    messagesEl.innerHTML = '';
    renderRoomList();
    renderOnlineList();
    joinRoom(room);
  }

  function joinRoom(room) {
    state.socket.emit('room:join', { room });
  }

  function switchToDm(username) {
    state.currentTarget = { type: 'dm', name: username };
    currentTargetEl.textContent = `@ ${username}`;
    typingIndicatorEl.textContent = '';
    messagesEl.innerHTML = '';
    renderRoomList();
    renderOnlineList();

    state.socket.emit('dm:history', { withUsername: username }, (history) => {
      history.forEach(renderMessage);
      scrollToBottom();
    });
  }

  function renderMessage(msg) {
    const div = document.createElement('div');
    const mine = msg.from === state.username;
    div.className = `msg ${mine ? 'mine' : ''}`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${msg.from} · ${new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const body = document.createElement('div');
    body.textContent = msg.text;

    div.appendChild(meta);
    div.appendChild(body);
    messagesEl.appendChild(div);
  }

  function renderSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'msg system';
    div.textContent = text;
    messagesEl.appendChild(div);
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value;
    if (!text.trim()) return;

    if (state.currentTarget.type === 'room') {
      state.socket.emit('room:message', { room: state.currentTarget.name, text });
    } else {
      state.socket.emit('dm:message', { toUsername: state.currentTarget.name, text });
    }

    messageInput.value = '';
    sendTyping(false);
  });

  messageInput.addEventListener('input', () => {
    sendTyping(true);
    clearTimeout(state.typingTimeout);
    state.typingTimeout = setTimeout(() => sendTyping(false), 1500);
  });

  function sendTyping(isTyping) {
    if (!state.socket) return;
    if (state.currentTarget.type === 'room') {
      state.socket.emit('typing', { room: state.currentTarget.name, isTyping });
    } else {
      state.socket.emit('typing', { toUsername: state.currentTarget.name, isTyping });
    }
  }

  // ---------- Boot ----------
  if (state.token && state.username) {
    enterChat();
  }
})();
