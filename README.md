# 🎮 Gamba Unified

Gabungan dari **gamba-account-manager** dan **GambaClaimer** menjadi satu project terintegrasi.

## Features

- 📡 **Discord Listener** - Dengarkan kode promo dari channel Discord
- 🥾 **Kick.com Listener** - Dengarkan kode promo dari Kick chat
- 👥 **Multi-Account Claim** - Auto claim untuk semua akun via API
- 🔌 **Chrome Extension** - UI claim di browser biasa

## Quick Start

```bash
# Install dependencies
npm install

# Jalankan semua service
npm start
```

## Struktur Folder

```
gamba-unified/
├── accounts/          # Letakkan file cookies (.json) di sini
├── extension/         # Chrome Extension
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   ├── popup.js
│   └── icon.png
├── index.js           # Entry point (npm start)
├── server.js          # Discord + Kick listener
├── account-manager.js # Multi-account claim logic
├── token.txt          # Discord token
└── package.json
```

## Setup

### 1. Discord Token
Edit `token.txt` dan masukkan Discord token Anda.

### 2. Account Cookies
Letakkan file cookies (.json) di folder `accounts/`.

Format cookies bisa diekspor dari browser menggunakan extension "Export Cookies".

### 3. Chrome Extension
1. Buka `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Pilih folder `extension/`

## Cara Kerja

```
┌─────────────────┐     ┌─────────────────────────────────────┐
│ Discord / Kick  │────▶│           server.js                 │
│ (Code Drop)     │     │                                     │
└─────────────────┘     │  1. Broadcast ke Extension          │
                        │  2. Trigger account-manager.js      │
                        │     untuk claim di SEMUA akun       │
                        └─────────────────────────────────────┘
                              │
                              ▼
       ┌──────────────────────┴──────────────────────┐
       │                                              │
       ▼                                              ▼
┌─────────────────┐                          ┌─────────────────┐
│ Chrome Extension│                          │ account-manager │
│ (Claim di UI)   │                          │ (API claim all) │
└─────────────────┘                          └─────────────────┘
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Jalankan semua (server + account manager) |
| `npm run server` | Jalankan server saja |
| `npm run accounts` | Jalankan account manager saja |

## License

ISC
