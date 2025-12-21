// Connect to Combined Listener (Discord + Kick)
const WS_URL = 'ws://localhost:8080'; // Local server

let ws = null;
let heartbeatInterval = null;

function connect() {
    console.log("Background: Connecting to Combined Listener (Discord + Kick)...");
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log("Background: ✅ Connected to Combined Listener");
        startHeartbeat();
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'NEW_CODE' && data.code) {
                const detectTime = Date.now();
                const source = data.source || 'unknown';
                console.log(`Background: Received code from ${source.toUpperCase()}:`, data.code);
                triggerClaim(data.code, detectTime, source);
            }
        } catch (e) {
            console.error("Background: Parse error", e);
        }
    };

    ws.onclose = () => {
        console.log("Background: ❌ Disconnected. Reconnecting in 3s...");
        stopHeartbeat();
        setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
        console.error("Background: WebSocket error", err);
    };
}

function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
        }
    }, 30000); // Ping every 30s
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

async function triggerClaim(code, detectTime, source = 'unknown') {
    const tabs = await chrome.tabs.query({ url: "*://gamba.com/*" });

    if (tabs.length === 0) {
        console.log("Background: No Gamba tab found!");
        return;
    }

    for (const tab of tabs) {
        console.log(`Background: Sending code to tab ${tab.id}`);
        try {
            await chrome.tabs.sendMessage(tab.id, { action: "claim", code: code, detectTime: detectTime, source: source });
        } catch (err) {
            console.log(`Background: Content script not ready, injecting...`);
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });

                await new Promise(resolve => setTimeout(resolve, 500));

                await chrome.tabs.sendMessage(tab.id, { action: "claim", code: code, detectTime: detectTime, source: source });
                console.log(`Background: Successfully sent after injection`);
            } catch (injectErr) {
                console.error(`Background: Failed to inject/send:`, injectErr);
            }
        }
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "log_result") {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'CLAIM_RESULT',
                code: request.code,
                result: request.result,
                timing: request.timing,
                source: request.source || 'unknown'
            }));
        }
    }
});

// Start connection to Combined Listener
connect();
