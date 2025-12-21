/**
 * 🎮 GAMBA UNIFIED - Main Entry Point
 * 
 * Browser di-launch SEKALI dan digunakan untuk semua fitur:
 * 1. Auto Claim Code (Discord/Kick listener)
 * 2. Claim Weekly Bonus
 * 3. Auto Vault Balance
 * 4. Exit
 */

const path = require('path');
const readline = require('readline');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m',
    white: '\x1b[37m',
    bold: '\x1b[1m'
};

function log(msg, color = colors.reset) {
    console.log(`${color}[${new Date().toLocaleTimeString()}] ${msg}${colors.reset}`);
}

function clearScreen() {
    console.clear();
}

function showBanner() {
    console.log(`
${colors.cyan}${colors.bold}
╔═══════════════════════════════════════════════════════════╗
║                     🎮 GAMBA UNIFIED                      ║
║           Multi-Account Manager + Auto Claimer            ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);
}

function showMenu() {
    console.log(`
${colors.white}╔═══════════════════════════════════════════════════════════╗
║                      SELECT AN OPTION                      ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   ${colors.green}[1]${colors.white}  🔊 Start Listener                               ║
║        (Discord + Kick code listener)                     ║
║                                                           ║
║   ${colors.yellow}[2]${colors.white}  🎁 Claim Weekly Bonus                           ║
║        (Claim weekly VIP bonus for all accounts)          ║
║                                                           ║
║   ${colors.blue}[3]${colors.white}  🔐 Auto Vault Balance                            ║
║        (Move all balance to vault for all accounts)       ║
║                                                           ║
║   ${colors.red}[4]${colors.white}  🚪 Exit                                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);
}

async function main() {
    const accountManager = require('./account-manager.js');

    clearScreen();
    showBanner();

    // Launch browsers SEKALI di awal
    log('🚀 Launching browsers for all accounts...', colors.yellow);
    console.log('='.repeat(60) + '\n');

    await accountManager.launchAllBrowsers();

    if (!accountManager.isReady()) {
        log('❌ Tidak ada browser yang berhasil diluncurkan. Pastikan folder accounts/ berisi file cookies.', colors.red);
        process.exit(1);
    }

    console.log('\n');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const askQuestion = (question) => {
        return new Promise((resolve) => {
            rl.question(question, resolve);
        });
    };

    let running = true;
    let listenerActive = false;

    while (running) {
        clearScreen();
        showBanner();

        const browserCount = accountManager.getActiveBrowsers().length;
        log(`✅ ${browserCount} browser(s) ready`, colors.green);

        if (listenerActive) {
            log(`🔊 Listener is ACTIVE - waiting for codes...`, colors.magenta);
        }

        showMenu();

        const choice = await askQuestion(`${colors.cyan}Enter your choice [1-4]: ${colors.reset}`);

        switch (choice.trim()) {
            case '1':
                if (!listenerActive) {
                    clearScreen();
                    showBanner();
                    log('🔊 Starting Discord + Kick Listener...', colors.green);
                    console.log('='.repeat(60) + '\n');

                    // Start server (listener)
                    require('./server.js');
                    accountManager.connectToServer();

                    listenerActive = true;
                    log('\n✅ Listener started! Waiting for codes...', colors.green);
                    log('💡 Press Ctrl+Z to return to menu', colors.cyan);
                    console.log('');

                    // Wait for Ctrl+Z to return to menu
                    await new Promise((resolve) => {
                        process.stdin.setRawMode(true);
                        process.stdin.resume();
                        process.stdin.once('data', (key) => {
                            process.stdin.setRawMode(false);
                            // Ctrl+Z is 0x1a (26)
                            if (key[0] === 26 || key.toString() === '\x1a') {
                                log('↩️  Returning to menu...', colors.yellow);
                            }
                            resolve();
                        });
                    });
                } else {
                    log('ℹ️  Listener sudah aktif!', colors.yellow);
                    log('💡 Press Ctrl+Z to return to menu', colors.cyan);
                    console.log('');

                    await new Promise((resolve) => {
                        process.stdin.setRawMode(true);
                        process.stdin.resume();
                        process.stdin.once('data', () => {
                            process.stdin.setRawMode(false);
                            resolve();
                        });
                    });
                }
                break;

            case '2':
                clearScreen();
                showBanner();
                log('🎁 Claim Weekly Bonus', colors.yellow);
                console.log('='.repeat(60) + '\n');

                await accountManager.claimWeeklyBonusForAll();

                console.log('');
                await askQuestion(`${colors.cyan}Press Enter to continue...${colors.reset}`);
                break;

            case '3':
                clearScreen();
                showBanner();
                log('🔐 Auto Vault Balance', colors.blue);
                console.log('='.repeat(60) + '\n');

                await accountManager.autoVaultForAll();

                console.log('');
                await askQuestion(`${colors.cyan}Press Enter to continue...${colors.reset}`);
                break;

            case '4':
                running = false;
                clearScreen();
                showBanner();
                log('🔒 Closing all browsers...', colors.yellow);
                await accountManager.closeAllBrowsers();
                console.log(`
${colors.green}
╔═══════════════════════════════════════════════════════════╗
║                      👋 GOODBYE!                          ║
║              Thanks for using Gamba Unified               ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);
                break;

            default:
                log('⚠️  Invalid option! Please enter 1-4', colors.red);
                await new Promise(r => setTimeout(r, 1500));
        }
    }

    rl.close();
    process.exit(0);
}

// Handle shutdown
process.on('SIGINT', async () => {
    console.log('\n');
    log('👋 Shutting down...', colors.yellow);
    try {
        const accountManager = require('./account-manager.js');
        await accountManager.closeAllBrowsers();
    } catch (e) { }
    process.exit(0);
});

// Start
main().catch(console.error);
