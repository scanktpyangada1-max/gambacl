/**
 * 🔌 GAMBA UNIFIED SERVER
 * 
 * Combined listener for:
 * - Discord Gateway (promo codes)
 * - Kick.com Pusher (promo codes)
 * - WebSocket server for Chrome extension
 * - Auto-claim for multi-accounts
 */

const WebSocket = require('ws');
const Pusher = require('pusher-js');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const WS_PORT = 8080;
const TARGET_CHANNEL_ID = '1442273829534830682';
const GATEWAY_URL = 'wss://gateway.discord.gg/?v=9&encoding=json';
const TOKEN_FILE = 'token.txt';
const PUSHER_APP_KEY = '32cbd69e4b950bf97679';
const PUSHER_CLUSTER = 'us2';

// Kick Channels to Monitor
const KICK_CHANNELS = [
    { username: 'fxy0z', id: 72940405 },
    { username: 'omane544', id: 72940405 } // ⚠️ USER MUST UPDATE THIS ID
];

// Colors for console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m'
};

function log(msg, color = colors.reset) {
    console.log(`${color}[${new Date().toLocaleTimeString()}] [SERVER] ${msg}${colors.reset}`);
}

// --- WEBSOCKET SERVER ---
const wss = new WebSocket.Server({ port: WS_PORT });
log(`WebSocket Server started on port ${WS_PORT}`, colors.green);

const broadcastedCodes = new Map();
const CODE_CACHE_DURATION = 5 * 60 * 1000;
const orderedClients = [];
const BROADCAST_DELAY_MS = 200;

// Callback untuk account manager
let onCodeReceived = null;

function setCodeCallback(callback) {
    onCodeReceived = callback;
}

wss.on('connection', (ws) => {
    log('Extension connected!', colors.green);
    orderedClients.push(ws);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'CLAIM_RESULT') {
                const { code, result, timing, source } = data;
                const statusColor = result.success ? colors.green : colors.red;
                const statusText = result.success ? "SUCCESS" : "FAILED";
                const sourceLabel = source ? `[${source.toUpperCase()}]` : '';

                console.log(`\n${colors.cyan}=== CLAIM REPORT ${sourceLabel} ===${colors.reset}`);
                console.log(`Code: ${colors.yellow}${code}${colors.reset}`);
                console.log(`Status: ${statusColor}${statusText}${colors.reset}`);

                if (timing) {
                    console.log(`Speed: ${colors.magenta}${timing.totalMs}ms total${colors.reset} (${timing.claimMs}ms claim)`);
                }
                if (result.data) {
                    console.log(`Response: ${JSON.stringify(result.data, null, 2)}`);
                }
                if (result.message) {
                    console.log(`Message: ${colors.red}${result.message}${colors.reset}`);
                }
                console.log(`${colors.cyan}============================${colors.reset}\n`);
            }
        } catch (e) {
            log('Error parsing extension message: ' + e.message, colors.red);
        }
    });

    ws.on('close', () => {
        log('Extension disconnected', colors.yellow);
        const index = orderedClients.indexOf(ws);
        if (index > -1) {
            orderedClients.splice(index, 1);
        }
    });
});

async function broadcastCode(code, source = 'unknown') {
    const now = Date.now();

    for (const [cachedCode, timestamp] of broadcastedCodes.entries()) {
        if (now - timestamp > CODE_CACHE_DURATION) {
            broadcastedCodes.delete(cachedCode);
        }
    }

    if (broadcastedCodes.has(code)) {
        const timeSince = now - broadcastedCodes.get(code);
        log(`⚠️  Duplicate code ignored: ${code} (broadcasted ${Math.round(timeSince / 1000)}s ago)`, colors.yellow);
        return;
    }

    broadcastedCodes.set(code, now);
    log(`Broadcasting code: ${code} [${source.toUpperCase()}]`, colors.cyan);

    // Trigger account manager claim
    if (onCodeReceived) {
        onCodeReceived(code, source);
    }

    // Send to extension clients
    let sentCount = 0;
    for (const client of orderedClients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'NEW_CODE', code: code, source: source }));
            sentCount++;

            if (sentCount < orderedClients.length) {
                await new Promise(resolve => setTimeout(resolve, BROADCAST_DELAY_MS));
            }
        }
    }
}

// --- DISCORD LISTENER ---
class DiscordListener {
    constructor(token) {
        this.token = token;
        this.ws = null;
        this.heartbeatInterval = null;
        this.reconnectAttempts = 0;
    }

    connect() {
        log('🔷 Connecting to Discord Gateway...', colors.blue);
        this.ws = new WebSocket(GATEWAY_URL);

        this.ws.on('open', () => {
            log('✅ Connected to Discord!', colors.green);
            this.reconnectAttempts = 0;
        });

        this.ws.on('message', (data) => {
            try {
                const payload = JSON.parse(data);
                this.handlePayload(payload);
            } catch (e) {
                log('Discord Parse Error: ' + e.message, colors.red);
            }
        });

        this.ws.on('close', (code, reason) => {
            log(`Discord Closed: ${code} - ${reason}`, colors.red);
            this.cleanup();
            setTimeout(() => this.connect(), 5000);
        });
    }

    cleanup() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.ws = null;
    }

    handlePayload(payload) {
        const { op, d, t } = payload;

        switch (op) {
            case 10:
                this.startHeartbeat(d.heartbeat_interval);
                this.identify();
                break;
            case 0:
                if (t === 'READY') {
                    log(`🔷 Discord: Logged in as ${d.user.username}`, colors.blue);
                } else if (t === 'MESSAGE_CREATE') {
                    this.handleMessage(d);
                }
                break;
        }
    }

    startHeartbeat(interval) {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ op: 1, d: null }));
            }
        }, interval);
    }

    identify() {
        this.ws.send(JSON.stringify({
            op: 2,
            d: {
                token: this.token,
                properties: { $os: 'windows', $browser: 'chrome', $device: 'pc' }
            }
        }));
    }

    handleMessage(msg) {
        if (msg.channel_id !== TARGET_CHANNEL_ID) return;

        const content = msg.content;
        log(`🔷 Discord Message: ${content}`, colors.blue);

        const explicitMatch = content.match(/code\s*:\s*([a-zA-Z0-9]+)/i);

        if (explicitMatch) {
            const code = explicitMatch[1];
            log(`🎉 Discord Code Found: ${code}`, colors.green);
            broadcastCode(code, 'discord');
            return;
        }

        if (content.length < 20 && /^[a-zA-Z0-9]+$/.test(content.trim())) {
            broadcastCode(content.trim(), 'discord');
            return;
        }
    }
}

// --- KICK LISTENER ---
class KickListener {
    constructor() {
        this.waitingForCode = false;
        this.messagesSincePromo = 0;
        this.lastPromoTime = 0;
        this.pusher = null;
        this.channels = [];
    }

    connect() {
        log('🥾 Connecting to Kick.com Pusher...', colors.magenta);

        this.pusher = new Pusher(PUSHER_APP_KEY, {
            cluster: PUSHER_CLUSTER,
            forceTLS: true,
            enabledTransports: ['ws', 'wss'],
            wsHost: `ws-${PUSHER_CLUSTER}.pusher.com`,
            httpHost: `sockjs-${PUSHER_CLUSTER}.pusher.com`,
            disableStats: true
        });

        this.pusher.connection.bind('state_change', (states) => {
            log(`🔄 Kick Connection: ${states.previous} -> ${states.current}`, colors.cyan);
        });

        // Subscribe to all configured channels
        KICK_CHANNELS.forEach(target => {
            if (!target.id) {
                log(`⚠️  Skipping ${target.username}: Chat ID not set! Please update server.js`, colors.yellow);
                return;
            }

            const channelName = `chatrooms.${target.id}.v2`;
            const channel = this.pusher.subscribe(channelName);

            channel.bind('pusher:subscription_succeeded', () => {
                log(`✅ Connected to Kick chat: @${target.username}`, colors.green);
            });

            channel.bind('pusher:subscription_error', (error) => {
                log(`❌ Error connecting to @${target.username}: ` + JSON.stringify(error), colors.red);
            });

            channel.bind('App\\Events\\ChatMessageEvent', (data) => {
                try {
                    const sender = data.sender?.username?.toLowerCase();
                    const content = data.content || '';

                    if (sender === target.username.toLowerCase()) {
                        log(`🥾 @${target.username}: ${content}`, colors.magenta);
                        this.processMessage(content, target.username);
                    }
                } catch (error) {
                    log('Error processing Kick message: ' + error.message, colors.red);
                }
            });

            this.channels.push(channel);
        });
    }

    processMessage(content, sourceUser) {
        const promoPattern = /\$.*CLAIMS.*Wager/i;
        const codePattern = /^[a-zA-Z0-9]{5,20}$/;
        const trimmed = content.trim();

        if (promoPattern.test(content)) {
            log(`🎯 [${sourceUser}] Promo announcement detected! Waiting for code...`, colors.yellow);
            this.waitingForCode = true;
            this.messagesSincePromo = 0;
            this.lastPromoTime = Date.now();
            return;
        }

        if (this.waitingForCode) {
            this.messagesSincePromo++;

            if (Date.now() - this.lastPromoTime > 60000) {
                log('⏰ Kick Code wait timeout. Resetting...', colors.red);
                this.waitingForCode = false;
                return;
            }

            if (codePattern.test(trimmed)) {
                log(`🎉 KICK CODE FOUND (after promo): ${trimmed}`, colors.green);
                broadcastCode(trimmed, 'kick');
                this.waitingForCode = false;
                return;
            }

            if (this.messagesSincePromo > 5) {
                log('❌ Kick: No code found in next 5 messages. Resetting...', colors.red);
                this.waitingForCode = false;
            }
            return;
        }

        if (codePattern.test(trimmed)) {
            log(`🎁 KICK CODE DROP (direct): ${trimmed}`, colors.green);
            broadcastCode(trimmed, 'kick');
        }
    }

    disconnect() {
        if (this.pusher) {
            this.pusher.disconnect();
        }
    }
}

// --- STARTUP ---
let discordToken = '';
if (fs.existsSync(TOKEN_FILE)) {
    discordToken = fs.readFileSync(TOKEN_FILE, 'utf-8').trim().replace(/"/g, '');
} else {
    log(`⚠️  Discord token file '${TOKEN_FILE}' not found! Discord listener disabled.`, colors.yellow);
}

if (discordToken) {
    const discordListener = new DiscordListener(discordToken);
    discordListener.connect();
} else {
    log('⚠️  Discord listener skipped (no token).', colors.yellow);
}

const kickListener = new KickListener();
kickListener.connect();

// Export for index.js
module.exports = {
    broadcastCode,
    setCodeCallback,
    wss
};
