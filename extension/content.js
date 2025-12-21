console.log("Gamba Claimer: Content Script Loaded & Ready!");

// --- FLOATING UI ---
let logContainer = null;

// Code deduplication cache (prevent re-claiming same code)
const claimedCodes = new Map(); // code -> timestamp
const CODE_CLAIM_COOLDOWN = 5 * 60 * 1000; // 5 minutes

function createFloatingUI() {
    if (document.getElementById('gamba-claimer-logs')) return;

    logContainer = document.createElement('div');
    logContainer.id = 'gamba-claimer-logs';
    logContainer.style.position = 'fixed';
    logContainer.style.bottom = '20px';
    logContainer.style.right = '20px';
    logContainer.style.width = '450px';
    logContainer.style.maxHeight = '400px';
    logContainer.style.overflowY = 'auto';
    logContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    logContainer.style.color = '#fff';
    logContainer.style.padding = '15px';
    logContainer.style.borderRadius = '12px';
    logContainer.style.zIndex = '99999';
    logContainer.style.fontFamily = 'monospace';
    logContainer.style.fontSize = '14px';
    logContainer.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
    logContainer.style.pointerEvents = 'none';

    const title = document.createElement('div');
    title.innerText = '🎰 Gamba Claimer';
    title.style.fontWeight = 'bold';
    title.style.borderBottom = '1px solid #444';
    title.style.marginBottom = '5px';
    title.style.paddingBottom = '5px';
    title.style.color = '#7aa2f7';
    logContainer.appendChild(title);

    document.body.appendChild(logContainer);
}

function addLog(msg, type = 'info') {
    if (!logContainer) createFloatingUI();

    const line = document.createElement('div');
    const time = new Date().toLocaleTimeString();

    let icon = '🔵';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';

    line.innerText = `${icon} [${time}] ${msg}`;
    line.style.marginBottom = '2px';

    if (type === 'success') line.style.color = '#9ece6a';
    else if (type === 'error') line.style.color = '#f7768e';
    else line.style.color = '#bb9af7';

    logContainer.appendChild(line);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Initialize UI when page loads
createFloatingUI();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "claim") {
        const receiveTime = Date.now();
        const networkLatency = request.detectTime ? receiveTime - request.detectTime : 0;

        addLog(`Code: ${request.code} (latency: ${networkLatency}ms)`, 'info');
        claimCode(request.code, request.detectTime, sendResponse);
        return true;
    }
});

function getAllElements(root = document) {
    const elements = [];
    const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode;
        elements.push(node);
        if (node.shadowRoot) {
            elements.push(...getAllElements(node.shadowRoot));
        }
    }
    return elements;
}

function getTokens() {
    let authToken = null;
    let csrfToken = null;

    const csrfMeta = document.querySelector('meta[name="csrf-token"]') || document.querySelector('meta[name="x-csrf-token"]');
    if (csrfMeta) {
        csrfToken = csrfMeta.content;
    }

    if (document.cookie) {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'apollo:default.token') {
                authToken = decodeURIComponent(value);
                break;
            }
        }
    }

    if (!authToken) {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const val = localStorage.getItem(key);
            if (typeof val === 'string' && val.length > 20 && (key.includes('token') || key.includes('auth'))) {
                authToken = val;
                try {
                    const parsed = JSON.parse(val);
                    if (parsed.token) authToken = parsed.token;
                    if (parsed.access_token) authToken = parsed.access_token;
                } catch (e) { }
                break;
            }
        }
    }

    return { authToken, csrfToken };
}

async function claimViaAPI(code, tokens, retryCount = 0) {
    const MAX_RETRIES = 15;
    const RETRY_DELAYS = [200, 500, 1000, 2000]; // ms, exponential backoff

    if (retryCount === 0) {
        addLog(`Claiming...`, 'info');
    } else {
        addLog(`Retry #${retryCount}...`, 'info');
    }

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
                "authorization": `Bearer ${tokens.authToken}`,
                "x-csrf-token": tokens.csrfToken || "",
            },
            body: body
        });

        const data = await response.json();
        console.log(`API Response (attempt ${retryCount + 1}):`, data);

        if (data.errors) {
            const validationMsg = data.errors[0]?.extensions?.validation?.code?.[0] || data.errors[0].message;
            const lowerMsg = validationMsg.toLowerCase();

            // Check if it's a retryable error (rate limit or lock)
            const isRetryable = lowerMsg.includes('slow down') ||
                lowerMsg.includes('rate limit') ||
                lowerMsg.includes('too many') ||
                lowerMsg.includes('acquire lock') ||
                lowerMsg.includes('could not acquire lock');

            if (isRetryable && retryCount < MAX_RETRIES) {
                // Calculate delay with exponential backoff
                const delayIndex = Math.min(retryCount, RETRY_DELAYS.length - 1);
                const delay = RETRY_DELAYS[delayIndex];

                // Determine error type for better logging
                const errorType = lowerMsg.includes('lock') ? 'Lock conflict' : 'Rate limit';
                addLog(`⏳ ${errorType}! Retrying in ${delay}ms...`, 'info');

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, delay));

                // Recursive retry
                return await claimViaAPI(code, tokens, retryCount + 1);
            }

            // Final response (not retryable) or max retries reached
            return { success: false, message: validationMsg, retries: retryCount };
        }

        // Success!
        return { success: true, data: data, retries: retryCount };

    } catch (error) {
        console.error("API Claim Error:", error);

        // Retry on network errors too
        if (retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
            addLog(`⏳ Network error! Retrying in ${delay}ms...`, 'info');
            await new Promise(resolve => setTimeout(resolve, delay));
            return await claimViaAPI(code, tokens, retryCount + 1);
        }

        return { success: false, message: error.message, retries: retryCount };
    }
}

async function claimCode(code, detectTime, sendResponse) {
    const now = Date.now();

    // Clean up old entries from cache
    for (const [cachedCode, timestamp] of claimedCodes.entries()) {
        if (now - timestamp > CODE_CLAIM_COOLDOWN) {
            claimedCodes.delete(cachedCode);
        }
    }

    // Check if code was recently attempted
    if (claimedCodes.has(code)) {
        const timeSince = now - claimedCodes.get(code);
        const secondsAgo = Math.round(timeSince / 1000);
        addLog(`⚠️ Skipping duplicate: ${code} (tried ${secondsAgo}s ago)`, 'info');
        sendResponse({ status: "DUPLICATE_SKIPPED" });
        return;
    }

    // Add to cache before attempting claim
    claimedCodes.set(code, now);

    const claimStartTime = Date.now();
    const tokens = getTokens();

    if (tokens.authToken) {
        const apiResult = await claimViaAPI(code, tokens);
        const claimEndTime = Date.now();

        // Calculate timings
        const totalTime = detectTime ? claimEndTime - detectTime : 0;
        const claimDuration = claimEndTime - claimStartTime;

        // Prepare retry info
        const retryInfo = apiResult.retries > 0 ? ` (${apiResult.retries} retries)` : '';

        try {
            chrome.runtime.sendMessage({
                action: "log_result",
                result: apiResult,
                code: code,
                timing: {
                    totalMs: totalTime,
                    claimMs: claimDuration
                }
            });
        } catch (e) {
            console.error("Failed to send log to background:", e);
        }

        if (apiResult.success) {
            addLog(`✅ BERHASIL!${retryInfo} (${totalTime}ms total, ${claimDuration}ms claim)`, 'success');
            sendResponse({ status: "SUCCESS!" });
            return;
        } else {
            addLog(`❌ GAGAL${retryInfo}: ${apiResult.message} (${totalTime}ms)`, 'error');
        }
    } else {
        addLog(`Token not found`, 'error');
    }

    sendResponse({ status: "Failed" });
}
