// server.js
// Server utama: routing autentikasi, API pertemanan/pesan, dan Socket.io untuk real-time.

const express = require('express');
const session = require('express-session');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ---------- SESSION (dipakai bareng oleh Express & Socket.io) ----------
const sessionMiddleware = session({
  secret: 'ganti-string-rahasia-ini-di-produksi',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 hari
});

app.use(sessionMiddleware);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
io.engine.use(sessionMiddleware); // supaya socket.io tahu siapa yang login

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Belum login' });
  next();
}

// ---------- HALAMAN ----------
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/chat.html');
  res.redirect('/login.html');
});

app.get('/chat.html', (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// ---------- API: AUTH ----------
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username minimal 3 karakter' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }
  if (db.findUserByUsername(username)) {
    return res.status(400).json({ error: 'Username sudah dipakai' });
  }
  const user = db.createUser(username, password);
  req.session.userId = user.id;
  res.json({ user });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.findUserByUsername(username || '');
  if (!user || !db.verifyPassword(user, password || '')) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }
  req.session.userId = user.id;
  res.json({ user: db.getUserById(user.id) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', requireLogin, (req, res) => {
  res.json({ user: db.getUserById(req.session.userId) });
});

// ---------- API: CARI USER & PERTEMANAN ----------
app.get('/api/search', requireLogin, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  const results = db.searchUsers(q, req.session.userId).map((u) => {
    const status = db.getFriendshipStatus(req.session.userId, u.id);
    return { ...u, friendStatus: status ? status.status : null };
  });
  res.json({ results });
});

app.post('/api/friend-request', requireLogin, (req, res) => {
  const { toUserId } = req.body;
  if (!toUserId || toUserId === req.session.userId) {
    return res.status(400).json({ error: 'Permintaan tidak valid' });
  }
  const target = db.getUserById(toUserId);
  if (!target) return res.status(404).json({ error: 'User tidak ditemukan' });

  const request = db.sendFriendRequest(req.session.userId, toUserId);

  // beri tahu penerima secara real-time kalau dia online
  const targetSocketId = onlineUsers.get(Number(toUserId));
  if (targetSocketId && request.status === 'pending') {
    const me = db.getUserById(req.session.userId);
    io.to(targetSocketId).emit('friend_request_incoming', {
      id: request.id,
      user_id: me.id,
      username: me.username,
      avatar_color: me.avatar_color,
      created_at: request.created_at,
    });
  }
  res.json({ request });
});

app.get('/api/friend-requests', requireLogin, (req, res) => {
  res.json({ requests: db.getIncomingRequests(req.session.userId) });
});

app.post('/api/friend-request/:id/respond', requireLogin, (req, res) => {
  const { accept } = req.body;
  const request = db.respondFriendRequest(req.params.id, req.session.userId, !!accept);
  if (!request) return res.status(404).json({ error: 'Permintaan tidak ditemukan' });

  if (accept) {
    const me = db.getUserById(req.session.userId);
    const fromSocketId = onlineUsers.get(request.from_user_id);
    if (fromSocketId) {
      io.to(fromSocketId).emit('friend_request_accepted', { by: me });
    }
  }
  res.json({ ok: true });
});

app.get('/api/friends', requireLogin, (req, res) => {
  res.json({ friends: db.getFriendsList(req.session.userId) });
});

// ---------- API: PESAN ----------
app.get('/api/messages/:friendId', requireLogin, (req, res) => {
  const friendId = Number(req.params.friendId);
  if (!db.checkFriendship(req.session.userId, friendId)) {
    return res.status(403).json({ error: 'Kalian belum berteman' });
  }
  db.markAsRead(friendId, req.session.userId);
  res.json({ messages: db.getMessages(req.session.userId, friendId) });
});

// ---------- SOCKET.IO (REAL-TIME) ----------
const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  const sess = socket.request.session;
  if (!sess || !sess.userId) {
    socket.disconnect();
    return;
  }
  const userId = sess.userId;
  onlineUsers.set(userId, socket.id);
  db.setOnline(userId, true);
  socket.broadcast.emit('presence', { userId, online: true });

  socket.on('send_message', ({ toUserId, content }) => {
    content = (content || '').trim();
    if (!content || !toUserId) return;
    if (!db.checkFriendship(userId, toUserId)) return; // hanya boleh chat dengan teman

    const msg = db.saveMessage(userId, toUserId, content);
    const targetSocketId = onlineUsers.get(Number(toUserId));
    if (targetSocketId) {
      io.to(targetSocketId).emit('new_message', msg);
    }
    socket.emit('message_sent', msg); // konfirmasi balik ke pengirim
  });

  socket.on('typing', ({ toUserId }) => {
    const targetSocketId = onlineUsers.get(Number(toUserId));
    if (targetSocketId) io.to(targetSocketId).emit('typing', { fromUserId: userId });
  });

  socket.on('stop_typing', ({ toUserId }) => {
    const targetSocketId = onlineUsers.get(Number(toUserId));
    if (targetSocketId) io.to(targetSocketId).emit('stop_typing', { fromUserId: userId });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    db.setOnline(userId, false);
    socket.broadcast.emit('presence', { userId, online: false });
  });
});

server.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
