document.getElementById('claimBtn').addEventListener('click', async () => {
    const code = document.getElementById('code').value;
    const statusDiv = document.getElementById('status');

    if (!code) {
        statusDiv.textContent = "Please enter a code!";
        return;
    }

    statusDiv.textContent = "Claiming...";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes("gamba.com")) {
        statusDiv.textContent = "Not on Gamba.com!";
        return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "claim", code: code }, (response) => {
        if (chrome.runtime.lastError) {
            statusDiv.textContent = "Error: Refresh page";
        } else if (response && response.status) {
            statusDiv.textContent = response.status;
        }
    });
});
