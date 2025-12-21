# 🎮 Gamba Unified - Multi-Account Auto Claimer

Multi-account automation bot untuk Gamba.com dengan fitur:
- Auto claim codes dari Discord & Kick.com
- Weekly bonus claim otomatis
- Auto vault balance
- Proxy rotation (Oxylabs support)
- Telegram notifications

## ✨ Features

- **Auto Claim Code**: Monitor Discord & Kick.com untuk code drops, claim otomatis untuk semua akun
- **Weekly Bonus**: Claim VIP weekly bonus untuk semua akun sekaligus
- **Auto Vault**: Transfer balance ke vault secara otomatis setelah claim
- **Proxy Rotation**: Rotasi 5 proxy Oxylabs untuk menghindari rate limit
- **Multi-Account**: Support unlimited accounts (sessions via cookies)
- **Telegram Alerts**: Notifikasi real-time untuk claim success/fail

## 📋 Requirements

- Node.js v16+
- npm atau yarn
- Oxylabs proxy credentials (optional tapi recommended)
- Telegram bot token (optional untuk notifikasi)

## 🚀 Quick Start

### Windows

```powershell
# Clone repository
git clone https://github.com/scanktpyangada1-max/gambacl.git
cd gambacl

# Install dependencies
npm install

# Setup cookies (buat folder accounts/, tambahkan account1.json, account2.json, dll)
# Format: lihat accounts/account2.json sebagai contoh

# Run
npm start
```

### Linux (Ubuntu/Debian)

```bash
# Install Node.js
sudo apt update
sudo apt install nodejs npm -y

# Install Puppeteer dependencies
sudo apt install -y \
  gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 \
  libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 \
  libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 \
  libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 \
  libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 \
  libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \
  fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

# Clone & install
git clone https://github.com/scanktpyangada1-max/gambacl.git
cd gambacl
npm install

# Run (headless mode sudah enabled by default)
npm start
```

### Linux (CentOS/RHEL)

```bash
# Install Node.js
sudo yum install nodejs npm -y

# Install dependencies
sudo yum install -y \
  pango.x86_64 libXcomposite.x86_64 libXcursor.x86_64 libXdamage.x86_64 \
  libXext.x86_64 libXi.x86_64 libXtst.x86_64 cups-libs.x86_64 \
  libXScrnSaver.x86_64 libXrandr.x86_64 GConf2.x86_64 alsa-lib.x86_64 \
  atk.x86_64 gtk3.x86_64 nss libdrm libgbm xorg-x11-fonts-100dpi \
  xorg-x11-fonts-75dpi xorg-x11-utils xorg-x11-fonts-cyrillic \
  xorg-x11-fonts-Type1 xorg-x11-fonts-misc

# Clone & install
git clone https://github.com/scanktpyangada1-max/gambacl.git
cd gambacl
npm install
npm start
```

### Debian Userland (Termux/PRoot/Minimal Environment)

Tutorial lengkap untuk environment Debian minimal seperti Termux (Android) atau PRoot containers:

```bash
# 1. Install Node.js dari NodeSource (versi terbaru)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt update
apt install nodejs -y

# Verifikasi instalasi
node -v   # Should show v18.x.x
npm -v    # Should show npm version

# 2. Install Git (jika belum ada)
apt install git -y

# 3. Install Chrome/Chromium dependencies untuk Puppeteer
# Ini wajib agar browser bisa berjalan
apt install -y \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libdbus-1-3 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2 \
  libatspi2.0-0 \
  fonts-liberation \
  ca-certificates

# 4. Clone repository
git clone https://github.com/scanktpyangada1-max/gambacl.git
cd gambacl

# 5. Install dependencies
npm install

# 6. Setup cookies
# Untuk Termux/userland tanpa GUI, gunakan cara manual:
# - Copy cookie JSON dari PC/browser lain
# - Paste ke accounts/account1.json

# Atau jika ada X11/VNC server:
node get-cookie.js

# 7. Jalankan (headless mode)
npm start
```

**Catatan Termux/Android:**
- Browser akan berjalan **headless** (tanpa tampilan)
- RAM minimal 2GB recommended
- Storage minimal 500MB untuk dependencies
- Jika error `EACCES`, jalankan: `termux-setup-storage`

**Troubleshooting Debian Userland:**

```bash
# Jika Chrome crash: "Failed to launch chrome"
# Set environment variable
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
npm install

# Jika masih error, install chromium manual
apt install chromium -y

# Test proxy connectivity (tanpa browser)
node test-proxy.js

# Jika npm install gagal dengan EACCES
npm config set unsafe-perm true
npm install
```

**Run as Background Service (Termux):**

```bash
# Install Termux:Boot dari F-Droid
# Buat script auto-start

mkdir -p ~/.termux/boot
cat > ~/.termux/boot/gamba.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
cd ~/gambacl
npm start > ~/gamba.log 2>&1 &
EOF

chmod +x ~/.termux/boot/gamba.sh

# Restart device, bot akan auto-run
```



## ⚙️ Configuration

### 1. Cookies Setup

Buat folder `accounts/` dan tambahkan file JSON untuk setiap akun:

**Format: `accounts/account1.json`**
```json
[
  {
    "name": "apollo:default.token",
    "value": "YOUR_TOKEN_HERE",
    "domain": "gamba.com",
    "path": "/"
  },
  {
    "name": "cf_clearance",
    "value": "YOUR_CF_CLEARANCE",
    "domain": ".gamba.com",
    "path": "/",
    "httpOnly": true,
    "secure": true
  }
  // ... cookies lainnya
]
```

**Cara mendapatkan cookies:**
```bash
# Jalankan tool helper
node get-cookie.js
```
Tool ini akan membuka browser, Anda login manual, lalu cookies akan otomatis disave.

### 2. Proxy Configuration

Edit `account-manager.js` line 24-31:

```javascript
const PROXY_LIST = [
    { host: 'dc.oxylabs.io', port: 8001 },
    { host: 'dc.oxylabs.io', port: 8002 },
    // ... tambahkan sesuai kebutuhan
];
```

Edit credentials di line 122-123:
```javascript
await page.authenticate({
    username: 'user-YOUR_USERNAME',  // Format: user-{username}
    password: 'YOUR_PASSWORD'
});
```

### 3. Discord/Kick Listener

Edit `server.js`:
```javascript
const DISCORD_TOKEN = 'your_discord_token';
const KICK_CHAT_ID = 12345678;
const KICK_TARGET_USERNAME = 'target_streamer';
```

### 4. Telegram Notifications (Optional)

Edit `telegram.js`:
```javascript
const TELEGRAM_BOT_TOKEN = 'your_bot_token';
const TELEGRAM_CHAT_ID = 'your_chat_id';
```

## 📖 Usage

```bash
npm start
```

**Menu Options:**
1. **Start Listener** - Aktifkan Discord + Kick code listener
2. **Claim Weekly Bonus** - Claim weekly VIP bonus untuk semua akun
3. **Auto Vault Balance** - Transfer semua balance ke vault
4. **Exit** - Tutup aplikasi

## 🐧 Linux VPS Deployment

Untuk deployment 24/7 di VPS:

```bash
# Install PM2
npm install -g pm2

# Start dengan PM2
pm2 start index.js --name gamba-claimer

# Auto-restart on reboot
pm2 startup
pm2 save

# View logs
pm2 logs gamba-claimer

# Stop
pm2 stop gamba-claimer
```

## 🔧 Troubleshooting

### Proxy Timeout
- Pastikan IP VPS sudah di-whitelist di dashboard Oxylabs
- Verifikasi credentials: username harus `user-{your_username}`

### Browser Crash
```bash
# Linux: Install missing dependencies
sudo apt install -y chromium-browser

# Atau test proxy connectivity
node test-proxy.js
```

### Cookies Invalid
- Cookies expire setiap ~2 minggu
- Jalankan `node get-cookie.js` untuk refresh

## 📁 Project Structure

```
gamba-unified/
├── accounts/           # Cookie files (account1.json, account2.json, ...)
├── logs/              # Claim logs
├── account-manager.js # Multi-account browser manager
├── server.js          # Discord/Kick listener
├── telegram.js        # Telegram notifications
├── index.js           # Main entry point
├── get-cookie.js      # Cookie extraction tool
└── test-proxy.js      # Proxy testing utility
```

## 🤝 Contributing

Pull requests welcome! Please test di Windows & Linux sebelum submit.

## 📄 License

MIT License - bebas digunakan untuk personal/commercial.

## ⚠️ Disclaimer

Tool ini untuk educational purposes. Gunakan dengan bijak dan patuhi ToS Gamba.com.
