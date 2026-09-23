// chat.js
// Logika utama halaman chat: memuat data, real-time via Socket.io, kirim/terima pesan.

let me = null;
let activeFriend = null;
let typingTimeout = null;
const socket = io();

// ---------- ELEMEN ----------
const viewChats = document.getElementById('viewChats');
const viewFriends = document.getElementById('viewFriends');
const viewProfile = document.getElementById('viewProfile');
const chatsList = document.getElementById('chatsList');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const requestsList = document.getElementById('requestsList');
const requestsLabel = document.getElementById('requestsLabel');
const friendsNavBtn = document.getElementById('friendsNavBtn');
const friendsDot = document.getElementById('friendsDot');
const pageTitle = document.getElementById('pageTitle');
const profileAvatar = document.getElementById('profileAvatar');
const profileName = document.getElementById('profileName');

const chatWindow = document.getElementById('chatWindow');
const chatAvatar = document.getElementById('chatAvatar');
const chatName = document.getElementById('chatName');
const chatStatus = document.getElementById('chatStatus');
const messagesEl = document.getElementById('messagesEl');
const typingIndicator = document.getElementById('typingIndicator');
const messageInput = document.getElementById('messageInput');

function initials(name) { return name.slice(0, 2).toUpperCase(); }

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'Z');
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'baru saja';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}j`;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function formatClock(iso) {
  const d = new Date(iso + 'Z');
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// ---------- INIT ----------
async function init() {
  const res = await fetch('/api/me');
  if (!res.ok) { window.location.href = '/login.html'; return; }
  const data = await res.json();
  me = data.user;
  profileAvatar.style.background = me.avatar_color;
  profileAvatar.textContent = initials(me.username);
  profileName.textContent = me.username;
  loadFriends();
  loadRequests();
}
init();

// ---------- NAVIGASI BAWAH ----------
const views = { chats: viewChats, friends: viewFriends, profile: viewProfile };
const titles = { chats: 'Chats', friends: 'Cari Teman', profile: 'Profil' };

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;

    Object.entries(views).forEach(([key, el]) => {
      el.classList.toggle('hidden', key !== view);
    });
    pageTitle.textContent = titles[view];

    if (view === 'chats') loadFriends();
    if (view === 'friends') { loadRequests(); friendsDot.classList.remove('show'); }
  });
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

// ---------- DAFTAR TEMAN (VIEW CHATS) ----------
async function loadFriends() {
  const res = await fetch('/api/friends');
  const data = await res.json();
  renderFriends(data.friends);
}

function renderFriends(friends) {
  if (!friends.length) {
    chatsList.innerHTML = `<div class="empty-state">Belum ada teman.<br>Ketuk tab "Teman" untuk cari dan tambah teman baru.</div>`;
    return;
  }
  chatsList.innerHTML = friends.map((f) => `
    <div class="list-item" onclick="openChat(${f.id}, '${escapeHtml(f.username)}', '${f.avatar_color}', ${f.is_online})">
      <div class="avatar" style="background:${f.avatar_color}">
        ${initials(f.username)}
        <span class="dot ${f.is_online ? 'online' : ''}"></span>
      </div>
      <div class="list-item-content">
        <div class="list-item-top">
          <span class="name">${escapeHtml(f.username)}</span>
          <span class="time">${f.lastMessage ? timeAgo(f.lastMessage.created_at) : ''}</span>
        </div>
        <div class="list-item-sub">
          <span>${f.lastMessage ? escapeHtml(truncate(f.lastMessage.content, 32)) : 'Mulai mengobrol'}</span>
          ${f.unread > 0 ? `<span class="unread-pill">${f.unread}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function truncate(str, n) { return str.length > n ? str.slice(0, n) + '…' : str; }
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ---------- CARI TEMAN & PERMINTAAN (VIEW FRIENDS) ----------
let searchDebounce = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  const q = searchInput.value.trim();
  if (!q) { searchResults.innerHTML = ''; return; }
  searchDebounce = setTimeout(() => doSearch(q), 300);
});

async function doSearch(q) {
  const res = await fetch('/api/search?q=' + encodeURIComponent(q));
  const data = await res.json();
  renderSearchResults(data.results);
}

function renderSearchResults(results) {
  if (!results.length) {
    searchResults.innerHTML = `<div class="empty-state">Tidak ada user dengan nama itu.</div>`;
    return;
  }
  searchResults.innerHTML = results.map((u) => `
    <div class="list-item">
      <div class="avatar" style="background:${u.avatar_color}">${initials(u.username)}</div>
      <div class="list-item-content">
        <div class="name">${escapeHtml(u.username)}</div>
      </div>
      ${renderFriendActionButton(u)}
    </div>
  `).join('');
}

function renderFriendActionButton(u) {
  if (u.friendStatus === 'accepted') return `<span class="search-result-status">Sudah berteman</span>`;
  if (u.friendStatus === 'pending') return `<span class="search-result-status">Menunggu diterima</span>`;
  return `<button class="btn-add" onclick="addFriend(${u.id}, this)">+ Tambah</button>`;
}

async function addFriend(userId, btnEl) {
  btnEl.disabled = true;
  btnEl.textContent = 'Mengirim...';
  const res = await fetch('/api/friend-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toUserId: userId }),
  });
  if (res.ok) {
    btnEl.outerHTML = `<span class="search-result-status">Menunggu diterima</span>`;
  } else {
    btnEl.disabled = false;
    btnEl.textContent = '+ Tambah';
  }
}

async function loadRequests() {
  const res = await fetch('/api/friend-requests');
  const data = await res.json();
  renderRequests(data.requests);
}

function renderRequests(requests) {
  if (!requests.length) {
    requestsLabel.style.display = 'none';
    requestsList.innerHTML = '';
    return;
  }
  requestsLabel.style.display = 'block';
  requestsList.innerHTML = requests.map((r) => `
    <div class="list-item">
      <div class="avatar" style="background:${r.avatar_color}">${initials(r.username)}</div>
      <div class="list-item-content">
        <div class="name">${escapeHtml(r.username)}</div>
        <div class="list-item-sub"><span>Ingin berteman denganmu</span></div>
      </div>
      <div class="request-actions">
        <button class="btn-accept" onclick="respondRequest(${r.id}, true, this)">Terima</button>
        <button class="btn-reject" onclick="respondRequest(${r.id}, false, this)">Tolak</button>
      </div>
    </div>
  `).join('');
}

async function respondRequest(requestId, accept, btnEl) {
  const row = btnEl.closest('.list-item');
  await fetch(`/api/friend-request/${requestId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accept }),
  });
  row.remove();
  if (accept) loadFriends();
}

// ---------- CHAT WINDOW ----------
function openChat(id, username, color, isOnline) {
  activeFriend = { id, username, color };
  chatAvatar.style.background = color;
  chatAvatar.textContent = initials(username);
  chatName.textContent = username;
  chatStatus.textContent = isOnline ? 'online' : 'offline';
  chatWindow.classList.add('open');
  loadMessages(id);
  messageInput.focus();
}

document.getElementById('backBtn').addEventListener('click', () => {
  chatWindow.classList.remove('open');
  activeFriend = null;
  loadFriends();
});

async function loadMessages(friendId) {
  messagesEl.innerHTML = '<div class="empty-state">Memuat pesan...</div>';
  const res = await fetch('/api/messages/' + friendId);
  const data = await res.json();
  renderMessages(data.messages);
}

function renderMessages(messages) {
  if (!messages.length) {
    messagesEl.innerHTML = `<div class="empty-state">Belum ada pesan.<br>Kirim pesan pertama!</div>`;
    return;
  }
  messagesEl.innerHTML = messages.map(bubbleHtml).join('');
  scrollToBottom();
}

function bubbleHtml(msg) {
  const mine = msg.sender_id === me.id;
  return `
    <div class="bubble-row ${mine ? 'me' : 'them'}">
      <div class="bubble">
        ${escapeHtml(msg.content)}
        <span class="time">${formatClock(msg.created_at)}</span>
      </div>
    </div>
  `;
}

function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

document.getElementById('sendBtn').addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});
messageInput.addEventListener('input', () => {
  if (!activeFriend) return;
  socket.emit('typing', { toUserId: activeFriend.id });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit('stop_typing', { toUserId: activeFriend.id }), 1200);
});

function sendMessage() {
  const content = messageInput.value.trim();
  if (!content || !activeFriend) return;
  socket.emit('send_message', { toUserId: activeFriend.id, content });
  messageInput.value = '';
}

// ---------- SOCKET.IO EVENTS (REAL-TIME) ----------
socket.on('message_sent', (msg) => {
  if (activeFriend && (msg.receiver_id === activeFriend.id)) {
    messagesEl.insertAdjacentHTML('beforeend', bubbleHtml(msg));
    scrollToBottom();
  }
});

socket.on('new_message', (msg) => {
  if (activeFriend && msg.sender_id === activeFriend.id) {
    messagesEl.insertAdjacentHTML('beforeend', bubbleHtml(msg));
    scrollToBottom();
    fetch('/api/messages/' + activeFriend.id); // tandai terbaca
  } else {
    // notifikasi ringan kalau lagi tidak buka chat itu
    if (!chatWindow.classList.contains('open')) loadFriends();
  }
});

socket.on('presence', ({ userId, online }) => {
  if (activeFriend && activeFriend.id === userId) {
    chatStatus.textContent = online ? 'online' : 'offline';
  }
  if (!chatWindow.classList.contains('open')) loadFriends();
});

socket.on('typing', ({ fromUserId }) => {
  if (activeFriend && activeFriend.id === fromUserId) {
    typingIndicator.textContent = `${activeFriend.username} sedang mengetik...`;
  }
});

socket.on('stop_typing', ({ fromUserId }) => {
  if (activeFriend && activeFriend.id === fromUserId) {
    typingIndicator.textContent = '';
  }
});

socket.on('friend_request_incoming', () => {
  loadRequests();
  if (!viewFriends.classList.contains('hidden')) return; // lagi buka tab Teman, gak perlu badge
  friendsDot.classList.add('show');
});

socket.on('friend_request_accepted', () => {
  loadFriends();
});
