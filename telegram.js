/**
 * 📱 TELEGRAM NOTIFIER
 * 
 * Mengirim notifikasi ke grup Telegram
 */

// ===== KONFIGURASI TELEGRAM =====
// Ganti dengan Bot Token dan Chat ID grup kamu
const TELEGRAM_BOT_TOKEN = '8294472425:AAG2pcbPuN2bArKmsNzw1qNU6LRH91bmRuM'; // Dapatkan dari @BotFather
const TELEGRAM_CHAT_ID = '@itsanuyulboyyy';     // Chat ID grup/channel

// ================================

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

function log(msg, color = colors.reset) {
    console.log(`${color}[${new Date().toLocaleTimeString()}] [TELEGRAM] ${msg}${colors.reset}`);
}

// Check if Telegram is configured
function isConfigured() {
    return TELEGRAM_BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE' &&
        TELEGRAM_CHAT_ID !== 'YOUR_CHAT_ID_HERE';
}

// Send message to Telegram
async function sendMessage(message, parseMode = 'HTML') {
    if (!isConfigured()) {
        return { success: false, message: 'Telegram not configured' };
    }

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: parseMode,
                disable_web_page_preview: true
            })
        });

        const data = await response.json();

        if (data.ok) {
            log('✅ Message sent to Telegram', colors.green);
            return { success: true };
        } else {
            log(`❌ Telegram error: ${data.description}`, colors.red);
            return { success: false, message: data.description };
        }

    } catch (error) {
        log(`❌ Telegram error: ${error.message}`, colors.red);
        return { success: false, message: error.message };
    }
}

// Notify single claim result
// Format: akun "username" telah sukses/failed mengklaim drop "kode" (delay ms)
async function notifyClaimResult(code, source, results) {
    if (!isConfigured()) return;

    for (const result of results) {
        const username = result.displayName || result.account;
        const status = result.success ? 'sukses' : 'failed';
        const emoji = result.success ? '✅' : '❌';
        const duration = result.duration ? ` (${result.duration}ms)` : '';

        let message = `${emoji} akun <b>${username}</b> telah <b>${status}</b> mengklaim drop "<code>${code}</code>"${duration}`;

        // Tambahkan error message jika failed
        if (!result.success && result.message) {
            message += `\n└ ${result.message}`;
        }

        await sendMessage(message);
    }
}

// Notify single vault result
// Format: akun "username" telah sukses vault "nominal" "currency" (delay ms)
async function notifyVault(username, currency, amount, durationMs) {
    if (!isConfigured()) return;

    const message = `💰 akun <b>${username}</b> telah sukses vault <b>${amount} ${currency}</b> (${durationMs}ms)`;
    await sendMessage(message);
}

// Notify weekly bonus claim
async function notifyWeeklyBonus(results) {
    if (!isConfigured()) return;

    for (const result of results) {
        const username = result.account;
        const status = result.success ? 'sukses' : 'failed';
        const emoji = result.success ? '🎁' : '❌';

        let message = `${emoji} akun <b>${username}</b> telah <b>${status}</b> mengklaim weekly bonus`;

        if (!result.success && result.message) {
            message += `\n└ ${result.message}`;
        }

        await sendMessage(message);
    }
}

// Test connection
async function testConnection() {
    if (!isConfigured()) {
        log('⚠️  Telegram not configured. Edit telegram.js to add your bot token and chat ID.', colors.yellow);
        return false;
    }

    const result = await sendMessage('🤖 <b>Gamba Unified Bot Connected!</b>\n\nBot siap menerima notifikasi.');
    return result.success;
}

module.exports = {
    isConfigured,
    sendMessage,
    notifyClaimResult,
    notifyVault,
    notifyWeeklyBonus,
    testConnection
};

