// database.js
// Database sederhana berbasis file JSON (pure JavaScript, TIDAK perlu compile native/C++,
// jadi langsung jalan di Windows/Mac/Linux manapun tanpa perlu install Visual Studio Build Tools dsb).

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const COLORS = ['#25D366', '#0A84FF', '#FF9F0A', '#FF453A', '#BF5AF2', '#64D2FF', '#30D158'];
function randomColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }

function nowStr() {
  // Format mirip 'YYYY-MM-DD HH:MM:SS' (UTC), dipakai frontend dengan new Date(iso + 'Z')
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// ---------- SETUP FILE DATABASE ----------
function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      users: [],
      friend_requests: [],
      messages: [],
      counters: { users: 0, friend_requests: 0, messages: 0 },
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }
}
ensureDb();

function readDb() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}
function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
function nextId(data, table) {
  data.counters[table] = (data.counters[table] || 0) + 1;
  return data.counters[table];
}

// ---------- USERS ----------
function createUser(username, password) {
  const data = readDb();
  const id = nextId(data, 'users');
  const user = {
    id,
    username,
    password_hash: bcrypt.hashSync(password, 10),
    avatar_color: randomColor(),
    is_online: 0,
    last_seen: nowStr(),
    created_at: nowStr(),
  };
  data.users.push(user);
  writeDb(data);
  return sanitizeUser(user);
}

function sanitizeUser(user) {
  if (!user) return null;
  const { id, username, avatar_color, is_online, last_seen } = user;
  return { id, username, avatar_color, is_online, last_seen };
}

function findUserByUsername(username) {
  const data = readDb();
  return data.users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
}

function getUserById(id) {
  const data = readDb();
  return sanitizeUser(data.users.find((u) => u.id === Number(id)));
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

function searchUsers(query, excludeUserId) {
  const data = readDb();
  const q = query.toLowerCase();
  return data.users
    .filter((u) => u.id !== Number(excludeUserId) && u.username.toLowerCase().includes(q))
    .slice(0, 20)
    .map(sanitizeUser);
}

function setOnline(userId, online) {
  const data = readDb();
  const user = data.users.find((u) => u.id === Number(userId));
  if (!user) return;
  user.is_online = online ? 1 : 0;
  user.last_seen = nowStr();
  writeDb(data);
}

// ---------- FRIEND REQUESTS ----------
function getFriendshipStatus(userA, userB) {
  const data = readDb();
  userA = Number(userA); userB = Number(userB);
  return data.friend_requests.find(
    (fr) =>
      (fr.from_user_id === userA && fr.to_user_id === userB) ||
      (fr.from_user_id === userB && fr.to_user_id === userA)
  );
}

function sendFriendRequest(fromId, toId) {
  const data = readDb();
  fromId = Number(fromId); toId = Number(toId);
  const existing = data.friend_requests.find(
    (fr) =>
      (fr.from_user_id === fromId && fr.to_user_id === toId) ||
      (fr.from_user_id === toId && fr.to_user_id === fromId)
  );
  if (existing) return existing;

  const request = {
    id: nextId(data, 'friend_requests'),
    from_user_id: fromId,
    to_user_id: toId,
    status: 'pending',
    created_at: nowStr(),
  };
  data.friend_requests.push(request);
  writeDb(data);
  return request;
}

function getIncomingRequests(userId) {
  const data = readDb();
  userId = Number(userId);
  return data.friend_requests
    .filter((fr) => fr.to_user_id === userId && fr.status === 'pending')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((fr) => {
      const user = data.users.find((u) => u.id === fr.from_user_id);
      return {
        id: fr.id,
        created_at: fr.created_at,
        user_id: user.id,
        username: user.username,
        avatar_color: user.avatar_color,
      };
    });
}

function respondFriendRequest(requestId, userId, accept) {
  const data = readDb();
  const req = data.friend_requests.find(
    (fr) => fr.id === Number(requestId) && fr.to_user_id === Number(userId)
  );
  if (!req) return null;
  req.status = accept ? 'accepted' : 'rejected';
  writeDb(data);
  return req;
}

function checkFriendship(userA, userB) {
  const data = readDb();
  userA = Number(userA); userB = Number(userB);
  return data.friend_requests.some(
    (fr) =>
      fr.status === 'accepted' &&
      ((fr.from_user_id === userA && fr.to_user_id === userB) ||
        (fr.from_user_id === userB && fr.to_user_id === userA))
  );
}

function getFriendsList(userId) {
  const data = readDb();
  userId = Number(userId);
  const friendIds = data.friend_requests
    .filter((fr) => fr.status === 'accepted' && (fr.from_user_id === userId || fr.to_user_id === userId))
    .map((fr) => (fr.from_user_id === userId ? fr.to_user_id : fr.from_user_id));

  const friends = friendIds.map((fid) => {
    const user = sanitizeUser(data.users.find((u) => u.id === fid));
    const convo = data.messages
      .filter(
        (m) =>
          (m.sender_id === userId && m.receiver_id === fid) ||
          (m.sender_id === fid && m.receiver_id === userId)
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const lastMessage = convo.length ? convo[convo.length - 1] : null;
    const unread = data.messages.filter(
      (m) => m.sender_id === fid && m.receiver_id === userId && m.is_read === 0
    ).length;
    return { ...user, lastMessage, unread };
  });

  return friends.sort((a, b) => {
    const ta = a.lastMessage ? a.lastMessage.created_at : '';
    const tb = b.lastMessage ? b.lastMessage.created_at : '';
    return tb.localeCompare(ta);
  });
}

// ---------- MESSAGES ----------
function saveMessage(senderId, receiverId, content) {
  const data = readDb();
  const msg = {
    id: nextId(data, 'messages'),
    sender_id: Number(senderId),
    receiver_id: Number(receiverId),
    content,
    is_read: 0,
    created_at: nowStr(),
  };
  data.messages.push(msg);
  writeDb(data);
  return msg;
}

function getMessages(userA, userB, limit = 100) {
  const data = readDb();
  userA = Number(userA); userB = Number(userB);
  const convo = data.messages
    .filter(
      (m) =>
        (m.sender_id === userA && m.receiver_id === userB) ||
        (m.sender_id === userB && m.receiver_id === userA)
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return convo.slice(Math.max(0, convo.length - limit));
}

function markAsRead(senderId, receiverId) {
  const data = readDb();
  senderId = Number(senderId); receiverId = Number(receiverId);
  let changed = false;
  data.messages.forEach((m) => {
    if (m.sender_id === senderId && m.receiver_id === receiverId && m.is_read === 0) {
      m.is_read = 1;
      changed = true;
    }
  });
  if (changed) writeDb(data);
}

module.exports = {
  createUser, findUserByUsername, getUserById, verifyPassword, searchUsers, setOnline,
  sendFriendRequest, getIncomingRequests, respondFriendRequest, checkFriendship,
  getFriendshipStatus, getFriendsList, saveMessage, getMessages, markAsRead,
};
