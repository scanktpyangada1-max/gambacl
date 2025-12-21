/**
 * 👥 GAMBA UNIFIED - Account Manager
 * 
 * Multi-account system:
 * - Load cookies dari accounts/*.json
 * - Buka browser untuk setiap akun (visible)
 * - Auto-claim kode untuk SEMUA akun via API
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const telegram = require('./telegram.js');

puppeteer.use(StealthPlugin());

const ACCOUNTS_DIR = './accounts';
const HEADLESS = true; // Browser visible
const LAUNCH_DELAY = 10000; // 10 detik delay antar browser
const AUTO_REFRESH_INTERVAL = 20 * 60 * 1000; // 20 menit

// Proxy config
const PROXY = {
    host: 'gw-us.scrapeless.io',
    port: 8789,
    username: 'F8ECDC653D6D-proxy-country_JP-r_0m-s_z0BYlPV8qF',
    password: 'evan9090'
};

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

// Store active browsers
const activeBrowsers = [];

// Load semua akun dari folder accounts
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

            // Cari token dari cookies
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

// Launch browser untuk satu akun dengan retry
async function launchBrowser(account, index, retryCount = 0) {
    const MAX_RETRIES = 3;
    log(`🚀 Launching browser for: ${account.name}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`, colors.cyan);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: HEADLESS,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                `--proxy-server=http://${PROXY.host}:${PROXY.port}`,
                `--window-position=${100 + (index * 450)},100`
            ],
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();

        // Authenticate proxy
        await page.authenticate({
            username: PROXY.username,
            password: PROXY.password
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 720 });

        // Reload cookies from file (fresh)
        const cookiePath = path.join(ACCOUNTS_DIR, `${account.name}.json`);
        const freshCookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
        await page.setCookie(...freshCookies);

        await page.goto('https://gamba.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));

        // Fetch username via GraphQL API
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
                    return {
                        id: data.data.me.id,
                        username: data.data.me.username,
                        email: data.data.me.email,
                        vipLevel: data.data.me.vip_level_name
                    };
                }
                return null;
            } catch (e) {
                return null;
            }
        }, account.token);

        // Fetch wagered 7 day
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
                    return {
                        totalFiat: data.data.analyticsWageredGraph.fiat_value,
                        totalCrypto: data.data.analyticsWageredGraph.crypto_value
                    };
                }
                return null;
            } catch (e) {
                return null;
            }
        }, account.token);

        if (userInfo && userInfo.username) {
            account.username = userInfo.username;
            account.userId = userInfo.id;
            account.vipLevel = userInfo.vipLevel;

            // Format wagered info
            let wageredStr = '';
            if (wageredInfo && wageredInfo.totalFiat > 0) {
                account.wagered7d = wageredInfo.totalFiat;
                wageredStr = ` | 7d Wagered: $${wageredInfo.totalFiat.toFixed(2)}`;
            }

            log(`✅ [${userInfo.username}] Login! (VIP: ${userInfo.vipLevel}${wageredStr})`, colors.green);
        } else {
            log(`⚠️  [${account.name}] Mungkin perlu login ulang`, colors.yellow);
        }

        activeBrowsers.push({ browser, page, account });
        return { browser, page, account };

    } catch (error) {
        log(`❌ [${account.name}] Error: ${error.message}`, colors.red);

        // Close browser if exists
        if (browser) {
            try {
                await browser.close();
                log(`🔒 [${account.name}] Browser closed`, colors.yellow);
            } catch (e) { }
        }

        // Retry if under max retries
        if (retryCount < MAX_RETRIES) {
            log(`🔄 [${account.name}] Retrying in 5 seconds...`, colors.yellow);
            await new Promise(r => setTimeout(r, 5000));
            return await launchBrowser(account, index, retryCount + 1);
        } else {
            log(`❌ [${account.name}] Max retries reached, skipping`, colors.red);
            return null;
        }
    }
}

// Launch semua browsers secara parallel
async function launchAllBrowsers() {
    const accounts = loadAccounts();

    if (accounts.length === 0) {
        log('⚠️  Tidak ada akun. Letakkan file cookies di folder accounts/', colors.yellow);
        return;
    }

    log(`\n🚀 Launching ${accounts.length} browser(s) simultaneously...`, colors.cyan);

    // Launch semua browser sekaligus tanpa menunggu
    const launchPromises = accounts.map((account, index) => launchBrowser(account, index));
    await Promise.all(launchPromises);

    log(`\n✅ ${activeBrowsers.length} browser(s) ready!`, colors.green);

    // Start auto-refresh
    startAutoRefresh();
}

// Auto refresh semua browser setiap interval
function startAutoRefresh() {
    log(`🔄 Auto-refresh enabled: every ${AUTO_REFRESH_INTERVAL / 60000} minute(s)`, colors.cyan);

    setInterval(async () => {
        log(`\n🔄 Auto-refreshing ${activeBrowsers.length} browser(s) simultaneously...`, colors.cyan);

        // Refresh semua browser sekaligus (parallel)
        const refreshPromises = activeBrowsers.map(async ({ page, account }) => {
            try {
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
                const displayName = account.username || account.name;
                log(`✅ [${displayName}] Refreshed`, colors.green);
            } catch (e) {
                log(`❌ [${account.name}] Refresh failed: ${e.message}`, colors.red);
            }
        });

        await Promise.all(refreshPromises);
        log(`🔄 Refresh complete!`, colors.cyan);
    }, AUTO_REFRESH_INTERVAL);
}

// Claim kode via browser page (melalui proxy)
async function claimViaPage(page, token, code) {
    try {
        const result = await page.evaluate(async (token, code) => {
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
        }, token, code);

        return result;
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Fetch user balances via page
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

                if (data.errors) {
                    return { success: false, message: data.errors[0].message };
                }

                return { success: true, balances: data.data?.getUserBalances || [] };
            } catch (error) {
                return { success: false, message: error.message };
            }
        }, token);

        return result;
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Deposit to vault via page
async function depositToVault(page, token, currencyCode, amount) {
    try {
        const result = await page.evaluate(async (token, currencyCode, amount) => {
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

                if (data.errors) {
                    return { success: false, message: data.errors[0].message };
                }

                return { success: true, data: data.data?.depositToVault };
            } catch (error) {
                return { success: false, message: error.message };
            }
        }, token, currencyCode, amount);

        return result;
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Auto vault all available balances for one account
async function autoVaultAccount(page, token, displayName) {
    const balanceResult = await fetchUserBalances(page, token);

    if (!balanceResult.success) {
        log(`  ⚠️  [${displayName}] Fetch balance failed: ${balanceResult.message}`, colors.yellow);
        return { success: false, vaulted: [] };
    }

    const vaultedItems = [];

    for (const balance of balanceResult.balances) {
        if (balance.availableBalance > 0) {
            const startTime = Date.now();
            const vaultResult = await depositToVault(page, token, balance.currencyCode, balance.availableBalance);
            const duration = Date.now() - startTime;

            if (vaultResult.success) {
                log(`  💰 [${displayName}] Vaulted ${balance.availableBalance} ${balance.currencyCode} (${duration}ms)`, colors.green);
                vaultedItems.push({ currency: balance.currencyCode, amount: balance.availableBalance });

                // Send Telegram notification for vault
                telegram.notifyVault(displayName, balance.currencyCode, balance.availableBalance, duration);
            } else {
                log(`  ⚠️  [${displayName}] Vault ${balance.currencyCode} failed: ${vaultResult.message}`, colors.yellow);
            }
        }
    }

    return { success: true, vaulted: vaultedItems };
}

// Claim kode untuk SEMUA akun
async function claimForAllAccounts(code, source = 'unknown') {
    if (activeBrowsers.length === 0) {
        log('⚠️  Tidak ada browser aktif', colors.yellow);
        return;
    }

    log(`\n${'='.repeat(50)}`, colors.cyan);
    log(`🎯 Claiming code: ${code} [${source.toUpperCase()}]`, colors.cyan);
    log(`📊 Total accounts: ${activeBrowsers.length}`, colors.cyan);
    log(`${'='.repeat(50)}`, colors.cyan);

    const promises = activeBrowsers.map(async ({ account, page }) => {
        const startTime = Date.now();
        const result = await claimViaPage(page, account.token, code);
        const duration = Date.now() - startTime;

        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        const statusColor = result.success ? colors.green : colors.red;
        const message = result.success ? '' : ` - ${result.message}`;
        const displayName = account.username || account.name;
        log(`${status} [${displayName}] (${duration}ms)${message}`, statusColor);

        // Auto vault jika claim berhasil
        if (result.success) {
            await autoVaultAccount(page, account.token, displayName);
        }

        return { account: account.name, ...result, duration };
    });

    const allResults = await Promise.all(promises);
    const successCount = allResults.filter(r => r.success).length;
    log(`\n📊 Result: ${successCount}/${activeBrowsers.length} successful`, successCount > 0 ? colors.green : colors.red);

    // Log to files
    const logData = {
        code,
        source,
        timestamp: new Date().toISOString(),
        results: allResults.map(r => ({
            account: r.account,
            success: r.success,
            message: r.message || null,
            duration: r.duration
        }))
    };

    // Log success and failed separately
    for (const result of allResults) {
        const accountInfo = activeBrowsers.find(b => b.account.name === result.account)?.account;
        const displayName = accountInfo?.username || result.account;
        const entry = {
            timestamp: new Date().toISOString(),
            code,
            source,
            account: displayName,
            duration: result.duration,
            message: result.message || null
        };

        if (result.success) {
            logToFile('claim_success.log', entry);
        } else {
            logToFile('claim_failed.log', entry);
        }
    }

    // Send Telegram notification
    const telegramResults = allResults.map(r => {
        const accountInfo = activeBrowsers.find(b => b.account.name === r.account)?.account;
        return {
            ...r,
            displayName: accountInfo?.username || r.account
        };
    });
    telegram.notifyClaimResult(code, source, telegramResults);

    return allResults;
}

// Close all browsers
async function closeAllBrowsers() {
    log('🔒 Closing all browsers...', colors.yellow);
    for (const { browser } of activeBrowsers) {
        try {
            await browser.close();
        } catch (e) { }
    }
    activeBrowsers.length = 0;
}

// Claim weekly bonus for one account via page
async function claimWeeklyBonusViaPage(page, token) {
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

                if (data.errors) {
                    const msg = data.errors[0]?.message || 'Unknown error';
                    return { success: false, message: msg };
                }

                if (data.data?.claimWeeklyBonus) {
                    return { success: true, data: data.data.claimWeeklyBonus };
                }

                return { success: false, message: 'No data returned' };

            } catch (error) {
                return { success: false, message: error.message };
            }
        }, token);

        return result;
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Claim weekly bonus for ALL accounts
async function claimWeeklyBonusForAll() {
    if (activeBrowsers.length === 0) {
        log('⚠️  Tidak ada browser aktif', colors.yellow);
        return [];
    }

    log(`\n${'='.repeat(50)}`, colors.cyan);
    log(`🎁 Claiming Weekly Bonus for all accounts`, colors.cyan);
    log(`📊 Total accounts: ${activeBrowsers.length}`, colors.cyan);
    log(`${'='.repeat(50)}`, colors.cyan);

    const promises = activeBrowsers.map(async ({ account, page }) => {
        const startTime = Date.now();
        const result = await claimWeeklyBonusViaPage(page, account.token);
        const duration = Date.now() - startTime;

        const displayName = account.username || account.name;
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        const statusColor = result.success ? colors.green : colors.red;
        const message = result.success ? '' : ` - ${result.message}`;
        log(`${status} [${displayName}] (${duration}ms)${message}`, statusColor);

        return { account: displayName, success: result.success, message: result.message, duration };
    });

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    log(`\n📊 Result: ${successCount}/${activeBrowsers.length} successful`, successCount > 0 ? colors.green : colors.red);

    // Send Telegram notification
    telegram.notifyWeeklyBonus(results);

    return results;
}

// Auto vault for ALL accounts
async function autoVaultForAll() {
    if (activeBrowsers.length === 0) {
        log('⚠️  Tidak ada browser aktif', colors.yellow);
        return [];
    }

    log(`\n${'='.repeat(50)}`, colors.cyan);
    log(`🔐 Auto Vault Balance for all accounts`, colors.cyan);
    log(`📊 Total accounts: ${activeBrowsers.length}`, colors.cyan);
    log(`${'='.repeat(50)}`, colors.cyan);

    const results = [];

    for (const { account, page } of activeBrowsers) {
        const displayName = account.username || account.name;
        const vaultResult = await autoVaultAccount(page, account.token, displayName);

        if (vaultResult.vaulted.length === 0) {
            log(`ℹ️  [${displayName}] No balance to vault`, colors.cyan);
        }

        results.push({ account: displayName, ...vaultResult });
    }

    const totalVaulted = results.reduce((sum, r) => sum + r.vaulted.length, 0);
    log(`\n📊 Total currencies vaulted: ${totalVaulted}`, totalVaulted > 0 ? colors.green : colors.cyan);

    return results;
}

// Connect to server and register callback
function connectToServer() {
    try {
        const server = require('./server.js');
        server.setCodeCallback((code, source) => {
            claimForAllAccounts(code, source);
        });
        log('🔗 Connected to server, listening for codes...', colors.green);
        return true;
    } catch (e) {
        log('⚠️  Server not available, running standalone', colors.yellow);
        return false;
    }
}

// Get active browsers
function getActiveBrowsers() {
    return activeBrowsers;
}

// Check if browsers are ready
function isReady() {
    return activeBrowsers.length > 0;
}

// Export functions
module.exports = {
    loadAccounts,
    launchAllBrowsers,
    closeAllBrowsers,
    claimViaPage,
    claimForAllAccounts,
    claimWeeklyBonusViaPage,
    claimWeeklyBonusForAll,
    autoVaultAccount,
    autoVaultForAll,
    fetchUserBalances,
    depositToVault,
    connectToServer,
    getActiveBrowsers,
    isReady
};
