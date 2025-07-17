chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "fetch") {
        fetch(message.url, {
            method: message.options.method || "GET",
            headers: message.options.headers || {},
            body: message.options.body || null,
        })
        .then(async (response) => {
            const text = await response.text();
            sendResponse({ ok: response.ok, status: response.status, text: text });
        })
        .catch((error) => {
            sendResponse({ ok: false, status: 0, text: "", error: error.toString() });
        });
        return true;
    }
});