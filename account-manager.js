/**
 * 👥 GAMBA UNIFIED - Account Manager (Playwright Optimized)
 * 
 * Optimization:
 * - Single Browser Instance (One Chrome process)
 * - Multiple Contexts (One per account)
 * - Resource Blocking (Images, Fonts, CSS blocked)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const telegram = require('./telegram.js');

const ACCOUNTS_DIR = './accounts';
const HEADLESS = true; // Optimized for RDP
const LAUNCH_DELAY = 3000;
const AUTO_REFRESH_INTERVAL = 20 * 60 * 1000;

// GLOBAL BROWSER INSTANCE
let globalBrowser = null;

// Proxy config (Oxylabs Rotation)
const PROXY_LIST = [
    { host: 'dc.oxylabs.io', port: 8001 },
    { host: 'dc.oxylabs.io', port: 8002 },
    { host: 'dc.oxylabs.io', port: 8003 },
    { host: 'dc.oxylabs.io', port: 8004 },
    { host: 'dc.oxylabs.io', port: 8005 }
];

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
    magenta: '\x1b[35m'
};

function log(msg, color = colors.reset) {
    console.log(`${color}[${new Date().toLocaleTimeString()}] [ACCOUNTS] ${msg}${colors.reset}`);
}

// Log to file
const LOG_DIR = './logs';
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

function logToFile(filename, data) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${JSON.stringify(data)}\n`;
    fs.appendFileSync(path.join(LOG_DIR, filename), logLine);
}

// Store active contexts (mapped to accounts)
const activeContexts = [];

function loadAccounts() {
    if (!fs.existsSync(ACCOUNTS_DIR)) {
        log(`⚠️  Folder '${ACCOUNTS_DIR}' tidak ditemukan, membuat folder...`, colors.yellow);
        fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
        return [];
    }

    const files = fs.readdirSync(ACCOUNTS_DIR).filter(f => f.endsWith('.json'));
    const accounts = [];

    for (const file of files) {
        try {
            const cookiePath = path.join(ACCOUNTS_DIR, file);
            const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
            const accountName = file.replace('.json', '');

            const tokenCookie = cookies.find(c => c.name === 'apollo:default.token');
            if (tokenCookie) {
                let token = decodeURIComponent(tokenCookie.value);
                if (token.includes('%7C')) {
                    token = token.replace('%7C', '|');
                }
                accounts.push({ name: accountName, token, cookies });
            } else {
                log(`⚠️  Account ${accountName}: Token tidak ditemukan`, colors.yellow);
            }
        } catch (e) {
            log(`❌ Error loading ${file}: ${e.message}`, colors.red);
        }
    }
    return accounts;
}

// Initialize Global Browser
async function initGlobalBrowser() {
    if (globalBrowser) return globalBrowser;

    log('🚀 Initializing Global Browser (optimized settings)...', colors.cyan);

    globalBrowser = await chromium.launch({
        headless: HEADLESS,
        executablePath: undefined, // Use bundled playwright chromium
        channel: 'chrome', // Try to use installed chrome if available, or fallback to bundled
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu' // Critical for RDP
        ]
    });
    return globalBrowser;
}

// Create Context for an Account
async function createAccountContext(account, proxy, useProxy = true) {
    const accountName = account.username || account.name;
    const MAX_RETRIES = 100; // Keep high retry count

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (!globalBrowser) await initGlobalBrowser();

        const proxyInfo = (useProxy && proxy) ? `${proxy.host}:${proxy.port}` : 'Direct';
        log(`👤 Creating Context: ${accountName} (${proxyInfo}) [Attempt ${attempt}/${MAX_RETRIES}]`, colors.cyan);

        let context;
        let page;

        try {
            const contextOptions = {
                viewport: { width: 1280, height: 720 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                deviceScaleFactor: 1,
            };

            if (useProxy && proxy) {
                contextOptions.proxy = {
                    server: `http://${proxy.host}:${proxy.port}`,
                    username: 'user-pukii_Cou33',
                    password: '=QM6qrBrLC0tH7vL'
                };
            }

            context = await globalBrowser.newContext(contextOptions);

            // Load Cookies
            const cookiePath = path.join(ACCOUNTS_DIR, `${account.name}.json`);
            const freshCookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8')).map(c => {
                if (c.sameSite === 'no_restriction') c.sameSite = 'None';
                return c;
            });
            await context.addCookies(freshCookies);

            page = await context.newPage();

            // === RESOURCE BLOCKING (CPU SAVER) ===
            await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,css,woff,woff2,mp4,mp3,ico}', route => route.abort());

            await page.goto('https://gamba.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
            // Minimal wait
            await page.waitForTimeout(2000);

            // Fetch User Info
            const userInfo = await page.evaluate(async (token) => {
                try {
                    const response = await fetch("https://gamba.com/_api/@", {
                        method: "POST",
                        headers: {
                            "accept": "*/*",
                            "content-type": "application/json",
                            "authorization": `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            operationName: "me",
                            variables: {},
                            query: `query me { me { id username email vip_level_name __typename } }`
                        })
                    });
                    const data = await response.json();
                    if (data.data?.me) {
                        return { id: data.data.me.id, username: data.data.me.username, vipLevel: data.data.me.vip_level_name };
                    }
                    return null;
                } catch (e) { return null; }
            }, account.token);

            // Fetch Wager
            const wageredInfo = await page.evaluate(async (token) => {
                try {
                    const url = `https://gamba.com/_api/@?operationName=analyticsWageredGraph&variables=${encodeURIComponent(JSON.stringify({ dateFilter: "WEEK", startDate: "", endDate: "" }))}&extensions=${encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: "a5e9028dbbd1fc289d984fd7efa6377bccfe4df25b2b61f60b9ca6baf6b235d2" } }))}`;
                    const response = await fetch(url, {
                        method: "GET",
                        headers: {
                            "accept": "*/*",
                            "content-type": "application/json",
                            "authorization": `Bearer ${token}`,
                        }
                    });
                    const data = await response.json();
                    if (data.data?.analyticsWageredGraph) {
                        return { totalFiat: data.data.analyticsWageredGraph.fiat_value };
                    }
                    return null;
                } catch (e) { return null; }
            }, account.token);

            if (userInfo && userInfo.username) {
                account.username = userInfo.username;
                account.userId = userInfo.id;
                account.vipLevel = userInfo.vipLevel;

                let wageredStr = '';
                if (wageredInfo && wageredInfo.totalFiat > 0) {
                    account.wagered7d = wageredInfo.totalFiat;
                    wageredStr = ` | 7d: $${wageredInfo.totalFiat.toFixed(2)}`;
                }

                log(`✅ [${userInfo.username}] Ready! (VIP: ${userInfo.vipLevel}${wageredStr})`, colors.green);

                activeContexts.push({ context, page, account });
                return { context, page, account };
            } else {
                log(`⚠️  [${account.name}] Validasi login via API gagal.`, colors.yellow);
                // Kita anggap sukses buka browser tapi login session mungkin expired
                activeContexts.push({ context, page, account });
                return { context, page, account };
            }

        } catch (error) {
            log(`❌ [${accountName}] Error (Attempt ${attempt}/${MAX_RETRIES}): ${error.message}`, colors.red);
            if (context) await context.close().catch(() => { });

            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 2000));
            } else {
                return null;
            }
        }
    }
}

async function launchAllBrowsers(useProxy = true) {
    const accounts = loadAccounts();
    if (accounts.length === 0) {
        log('⚠️  Tidak ada akun.', colors.yellow);
        return;
    }

    // 1. Init Global Browser
    await initGlobalBrowser();

    log(`\n🚀 Creating ${accounts.length} contexts in ONE browser...`, colors.cyan);

    // 2. Create Contexts Sequentially (to avoid spike)
    // or Promise.all if machine can handle contextual creation
    const launchPromises = accounts.map(async (account, index) => {
        // Small stagger to prevent CPU spike
        await new Promise(r => setTimeout(r, index * 1000));
        const proxy = PROXY_LIST[index % PROXY_LIST.length];
        return createAccountContext(account, proxy, useProxy);
    });

    await Promise.all(launchPromises);

    log(`\n✅ ${activeContexts.length} contexts ready! CPU usage should be minimal.`, colors.green);
    startAutoRefresh();
}

function startAutoRefresh() {
    log(`🔄 Auto-refresh enabled: every ${AUTO_REFRESH_INTERVAL / 60000} minute(s)`, colors.cyan);

    setInterval(async () => {
        log(`\n🔄 Auto-refreshing ${activeContexts.length} contexts...`, colors.cyan);

        // Sequential refresh to save CPU
        for (const { page, account } of activeContexts) {
            try {
                // Short timeout, reload
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
                // Re-block resources just in case (though route persists on page)

                const displayName = account.username || account.name;
                log(`✅ [${displayName}] Refreshed`, colors.green);
                await new Promise(r => setTimeout(r, 1000)); // 1s delay per refresh
            } catch (e) {
                log(`❌ [${account.name}] Refresh failed: ${e.message}`, colors.red);
            }
        }
        log(`🔄 Refresh complete!`, colors.cyan);
    }, AUTO_REFRESH_INTERVAL);
}

// === CLAIM & VAULT UTILS (Compatible with Page) ===

async function claimViaPage(page, token, code) {
    try {
        const result = await page.evaluate(async ({ token, code }) => {
            const body = JSON.stringify({
                operationName: "applyPromoCode",
                variables: { code: code },
                query: "mutation applyPromoCode($code: String!) {\n  applyPromoCode(code: $code) {\n    id\n    code\n    __typename\n  }\n}"
            });
            try {
                const response = await fetch("https://gamba.com/_api/@", {
                    method: "POST",
                    headers: {
                        "accept": "*/*",
                        "content-type": "application/json",
                        "authorization": `Bearer ${token}`,
                    },
                    body: body
                });
                const data = await response.json();
                if (data.errors) {
                    const msg = data.errors[0]?.extensions?.validation?.code?.[0] || data.errors[0].message;
                    return { success: false, message: msg };
                }
                return { success: true, data: data };
            } catch (error) {
                return { success: false, message: error.message };
            }
        }, { token, code });
        return result;
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function fetchUserBalances(page, token) {
    try {
        const result = await page.evaluate(async (token) => {
            try {
                const response = await fetch("https://gamba.com/_api/@", {
                    method: "POST",
                    headers: {
                        "accept": "*/*",
                        "content-type": "application/json",
                        "authorization": `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        operationName: "getUserBalances",
                        variables: {},
                        query: "query getUserBalances {\n  getUserBalances {\n    currencyCode\n    balance\n    availableBalance\n    vaultedBalance\n    lockedBalance\n    __typename\n  }\n}"
                    })
                });
                const data = await response.json();
                if (data.errors) return { success: false, message: data.errors[0].message };
                return { success: true, balances: data.data?.getUserBalances || [] };
            } catch (error) { return { success: false, message: error.message }; }
        }, token);
        return result;
    } catch (error) { return { success: false, message: error.message }; }
}

async function depositToVault(page, token, currencyCode, amount) {
    try {
        const result = await page.evaluate(async ({ token, currencyCode, amount }) => {
            try {
                const response = await fetch("https://gamba.com/_api/@", {
                    method: "POST",
                    headers: {
                        "accept": "*/*",
                        "content-type": "application/json",
                        "authorization": `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        operationName: "depositToVault",
                        variables: { currencyCode, amount },
                        query: "mutation depositToVault($currencyCode: String!, $amount: Float!) {\n  depositToVault(input: {currencyCode: $currencyCode, amount: $amount}) {\n    title\n    __typename\n  }\n}"
                    })
                });
                const data = await response.json();
                if (data.errors) return { success: false, message: data.errors[0].message };
                return { success: true, data: data.data?.depositToVault };
            } catch (error) { return { success: false, message: error.message }; }
        }, { token, currencyCode, amount });
        return result;
    } catch (error) { return { success: false, message: error.message }; }
}

async function autoVaultAccount(page, token, displayName) {
    const balanceResult = await fetchUserBalances(page, token);
    if (!balanceResult.success) {
        log(`  ⚠️  [${displayName}] Fetch balance failed: ${balanceResult.message}`, colors.yellow);
        return { success: false, vaulted: [] };
    }
    const vaultedItems = [];
    for (const balance of balanceResult.balances) {
        if (balance.availableBalance > 0) {
            const vaultResult = await depositToVault(page, token, balance.currencyCode, balance.availableBalance);
            if (vaultResult.success) {
                log(`  💰 [${displayName}] Vaulted ${balance.availableBalance} ${balance.currencyCode}`, colors.green);
                vaultedItems.push({ currency: balance.currencyCode, amount: balance.availableBalance });
                telegram.notifyVault(displayName, balance.currencyCode, balance.availableBalance, 0);
            } else {
                log(`  ⚠️  [${displayName}] Vault ${balance.currencyCode} failed: ${vaultResult.message}`, colors.yellow);
            }
        }
    }
    return { success: true, vaulted: vaultedItems };
}

async function claimForAllAccounts(code, source = 'unknown') {
    if (activeContexts.length === 0) {
        log('⚠️  Tidak ada browser aktif', colors.yellow);
        return;
    }

    log(`\n${'='.repeat(50)}`, colors.cyan);
    log(`🎯 Claiming code: ${code} [${source.toUpperCase()}]`, colors.cyan);
    log(`${'='.repeat(50)}`, colors.cyan);

    const promises = activeContexts.map(async ({ account, page }) => {
        const startTime = Date.now();
        const result = await claimViaPage(page, account.token, code);
        const duration = Date.now() - startTime;

        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        const color = result.success ? colors.green : colors.red;
        const displayName = account.username || account.name;
        log(`${status} [${displayName}] (${duration}ms)${result.success ? '' : ' - ' + result.message}`, color);

        if (result.success) await autoVaultAccount(page, account.token, displayName);

        return { account: account.name, ...result, duration };
    });

    const allResults = await Promise.all(promises);
    const successCount = allResults.filter(r => r.success).length;
    log(`\n📊 Result: ${successCount}/${activeContexts.length} successful`, successCount > 0 ? colors.green : colors.red);

    // Logging & Telegram (Simplified)
    for (const result of allResults) {
        if (result.success) logToFile('claim_success.log', { code, source, ...result });
        else logToFile('claim_failed.log', { code, source, ...result });
    }

    // Construct telegram results compatible format
    const telegramResults = allResults.map(r => {
        const accountInfo = activeContexts.find(b => b.account.name === r.account)?.account;
        return { ...r, displayName: accountInfo?.username || r.account };
    });
    telegram.notifyClaimResult(code, source, telegramResults);

    return allResults;
}

async function closeAllBrowsers() {
    log('🔒 Closing global browser...', colors.yellow);
    if (globalBrowser) {
        await globalBrowser.close();
        globalBrowser = null;
    }
    activeContexts.length = 0;
}

// === EXPORTS ===
// We keep function signatures compatible with index.js calls
module.exports = {
    loadAccounts,
    launchAllBrowsers,
    closeAllBrowsers,
    claimForAllAccounts,
    autoVaultForAll: async () => {
        const results = [];
        for (const { page, account } of activeContexts) {
            const displayName = account.username || account.name;
            results.push({ account: displayName, ...(await autoVaultAccount(page, account.token, displayName)) });
        }
        return results;
    },
    checkWagerForAll: async () => {
        if (activeContexts.length === 0) {
            log('⚠️  Tidak ada browser aktif', colors.yellow);
            return [];
        }

        log(`\n${'='.repeat(50)}`, colors.cyan);
        log(`📊 Checking 7-Day Wager for all accounts`, colors.cyan);
        log(`${'='.repeat(50)}`, colors.cyan);

        const results = [];

        for (const { account, page } of activeContexts) {
            const displayName = account.username || account.name;
            try {
                const wageredInfo = await page.evaluate(async (token) => {
                    try {
                        const url = `https://gamba.com/_api/@?operationName=analyticsWageredGraph&variables=${encodeURIComponent(JSON.stringify({ dateFilter: "WEEK", startDate: "", endDate: "" }))}&extensions=${encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: "a5e9028dbbd1fc289d984fd7efa6377bccfe4df25b2b61f60b9ca6baf6b235d2" } }))}`;
                        const response = await fetch(url, {
                            method: "GET",
                            headers: {
                                "accept": "*/*",
                                "content-type": "application/json",
                                "authorization": `Bearer ${token}`,
                            }
                        });
                        const data = await response.json();
                        if (data.data?.analyticsWageredGraph) {
                            return { totalFiat: data.data.analyticsWageredGraph.fiat_value };
                        }
                        return null;
                    } catch (e) { return null; }
                }, account.token);

                if (wageredInfo && wageredInfo.totalFiat >= 0) {
                    log(`💰 [${displayName}] $${wageredInfo.totalFiat.toFixed(2)} | VIP: ${account.vipLevel}`, colors.green);
                    results.push({ account: displayName, wager: wageredInfo.totalFiat, vipLevel: account.vipLevel, success: true });
                } else {
                    log(`ℹ️  [${displayName}] Failed to fetch wager`, colors.yellow);
                    results.push({ account: displayName, success: false });
                }
            } catch (error) {
                log(`❌ [${displayName}] Error: ${error.message}`, colors.red);
                results.push({ account: displayName, success: false, error: error.message });
            }
        }

        const totalWager = results.filter(r => r.success).reduce((sum, r) => sum + (r.wager || 0), 0);
        log(`\n📊 Total 7-day wager: $${totalWager.toFixed(2)}`, colors.cyan);
        return results;
    },
    getActiveBrowsers: () => activeContexts,
    isReady: () => activeContexts.length > 0,
    connectToServer: () => {
        try {
            const server = require('./server.js');
            server.setCodeCallback((code, source) => claimForAllAccounts(code, source));
            log('🔗 Connected to server.', colors.green);
            return true;
        } catch (e) { return false; }
    },
    claimWeeklyBonusForAll: async () => {
        if (activeContexts.length === 0) {
            log('⚠️  Tidak ada browser aktif', colors.yellow);
            return [];
        }

        log(`\n${'='.repeat(50)}`, colors.cyan);
        log(`🎁 Claiming Weekly Bonus for all accounts`, colors.cyan);
        log(`${'='.repeat(50)}`, colors.cyan);

        const promises = activeContexts.map(async ({ account, page }) => {
            const startTime = Date.now();
            const displayName = account.username || account.name;

            try {
                const result = await page.evaluate(async (token) => {
                    try {
                        const response = await fetch("https://gamba.com/_api/@", {
                            method: "POST",
                            headers: {
                                "accept": "*/*",
                                "content-type": "application/json",
                                "authorization": `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                                operationName: "claimWeeklyBonus",
                                variables: {},
                                query: "mutation claimWeeklyBonus {\n  claimWeeklyBonus {\n    id\n    __typename\n  }\n}"
                            })
                        });
                        const data = await response.json();
                        if (data.errors) return { success: false, message: data.errors[0]?.message || 'Unknown error' };
                        if (data.data?.claimWeeklyBonus) return { success: true, data: data.data.claimWeeklyBonus };
                        return { success: false, message: 'No data returned' };
                    } catch (e) { return { success: false, message: e.message }; }
                }, account.token);

                const duration = Date.now() - startTime;
                const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
                const color = result.success ? colors.green : colors.red;
                log(`${status} [${displayName}] (${duration}ms)${result.success ? '' : ' - ' + result.message}`, color);

                return { account: displayName, success: result.success, message: result.message, duration };
            } catch (e) {
                return { account: displayName, success: false, message: e.message, duration: 0 };
            }
        });

        const results = await Promise.all(promises);
        const successCount = results.filter(r => r.success).length;
        log(`\n📊 Result: ${successCount}/${activeContexts.length} successful`, successCount > 0 ? colors.green : colors.red);
        telegram.notifyWeeklyBonus(results);
        return results;
    }
};
