# Nongkrong.in ☕💬

> Aplikasi *real-time chat* modern dengan tema dark mode ala WhatsApp/iOS, dibangun menggunakan Node.js dan Socket.io.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Fitur Unggulan
* **Autentikasi Aman:** Sistem *Register & Login* lengkap dengan *password hashing* (`bcrypt`).
* **Sistem Pertemanan:** Cari teman berdasarkan *username*, kirim permintaan pertemanan, serta terima atau tolak undangan.
* **Real-Time Messaging:** Pesan terkirim secara instan menggunakan **Socket.io** (hanya bisa berkirim pesan dengan pengguna yang sudah berteman).
* **Indikator Interaktif:** Dilengkapi status *Online/Offline* dan indikator *“Sedang mengetik...”*.
* **Riwayat Pesan & Notifikasi:** Riwayat chat tersimpan otomatis dan dilengkapi badge penanda pesan belum dibaca.
* **Tanpa Ribet (Zero Native Dependencies):** Menggunakan database berbasis file JSON (`data/db.json`), sehingga bisa langsung dijalankan di Windows, Mac, atau Linux tanpa perlu menginstal *Visual Studio Build Tools* atau compiler C++ tambahan.

---

## 📂 Struktur Project
```text
realtime-chat/
├── server.js          # Server utama (Express + Socket.io)
├── database.js        # Modul pengelolaan database (file JSON)
├── data/db.json       # Tempat penyimpanan data (dibuat otomatis)
├── package.json       # Daftar dependencies project
└── public/            # Folder Frontend
    ├── login.html     # Halaman masuk
    ├── register.html  # Halaman pendaftaran
    ├── chat.html      # Ruang utama aplikasi chat
    ├── css/style.css  # Styling tema dark modern
    └── js/chat.js     # Logika frontend & Socket.io client
