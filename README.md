# ChatApp Real-Time

Website chat real-time dengan tema dark ala WhatsApp/iOS: login & register, cari teman by username,
kirim permintaan pertemanan, terima/tolak, lalu chat real-time (via Socket.io) dengan indikator online & sedang mengetik.
Semua data (user, pertemanan, pesan) disimpan di **database file JSON** (`data/db.json`, dibuat otomatis),
pure JavaScript tanpa perlu compile native — jadi langsung jalan di Windows/Mac/Linux tanpa install
Visual Studio Build Tools atau tools tambahan lainnya.

## Struktur Project
```
realtime-chat/
├── server.js          # Server utama: Express + Socket.io
├── database.js        # Semua fungsi database (file JSON)
├── data/db.json        # Isi database (otomatis dibuat saat pertama jalan)
├── package.json
└── public/
    ├── login.html
    ├── register.html
    ├── chat.html
    ├── css/style.css
    └── js/chat.js
```

## Cara Menjalankan di Komputer (localhost)

1. Pastikan sudah install **Node.js** (versi 18 ke atas): https://nodejs.org
2. Buka folder ini di terminal, lalu jalankan:
   ```
   npm install
   npm start
   ```
3. Buka browser ke `http://localhost:3000`
4. Daftar akun baru → login → cari username teman (harus buka di browser/device lain dengan akun berbeda) → kirim permintaan → terima → mulai chat!

Selama masih `localhost`, chat ini **hanya real-time di komputer/device yang sama** (beda tab/browser boleh, tapi tetap 1 komputer).

## Supaya Bisa Diakses dari Jaringan Manapun (bukan cuma 1 jaringan)

Karena ini web app dengan server + database asli, dia butuh **di-hosting di server yang selalu menyala**
supaya dua orang dari jaringan/lokasi berbeda bisa chat real-time satu sama lain. Beberapa opsi gratis/mudah:

1. **Railway** (railway.app) – upload project ini, otomatis jalan `npm install && npm start`.
2. **Render** (render.com) – pilih "Web Service", hubungkan repo, start command `npm start`.
3. **Glitch** (glitch.com) – import project, langsung online.

Setelah dideploy, kamu akan dapat URL publik (misal `https://chatapp-kamu.up.railway.app`) yang bisa
dibuka siapa saja dari jaringan manapun — itu baru benar-benar "real-time tanpa batas 1 jaringan".

> Catatan: kalau mau coba dulu dari HP di WiFi yang sama (1 jaringan) tanpa deploy, jalankan `npm start`
> di laptop, lalu di HP buka `http://<IP-laptop-kamu>:3000` (cari IP laptop dengan `ipconfig`/`ifconfig`).

## Catatan Keamanan (untuk versi produksi nanti)
- Ganti `secret` di `server.js` (bagian `session(...)`) dengan string acak yang panjang.
- Password sudah di-hash pakai bcrypt (aman, tidak disimpan plain text).
- Untuk produksi sungguhan, sebaiknya tambahkan HTTPS, rate limiting, dan validasi input lebih ketat.

## Fitur yang Sudah Ada
- ✅ Register & Login dengan password ter-hash
- ✅ Cari user lain berdasarkan username
- ✅ Kirim permintaan pertemanan, terima/tolak
- ✅ Chat real-time (Socket.io) hanya dengan yang sudah berteman
- ✅ Status online/offline & indikator "sedang mengetik"
- ✅ Riwayat pesan tersimpan di database SQLite
- ✅ Badge pesan belum dibaca
- ✅ Tema dark ala Apple/WhatsApp
