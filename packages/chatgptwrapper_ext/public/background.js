// Open chat interface when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});

// Handle fetch proxy requests for AI Gateway (bypasses CORS)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'fetch-proxy') return;

  port.onMessage.addListener(async (request) => {
    if (request.type !== 'fetch') return;

    const { url, options } = request;
    console.log('[Background] Proxying fetch to:', url);

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        port.postMessage({
          type: 'error',
          status: response.status,
          statusText: response.statusText
        });
        return;
      }

      // Send response headers first
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      port.postMessage({
        type: 'headers',
        status: response.status,
        headers
      });

      // Stream the body
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          port.postMessage({ type: 'done' });
          break;
        }
        // Convert Uint8Array to array for messaging
        port.postMessage({ type: 'chunk', data: Array.from(value) });
      }
    } catch (error) {
      console.error('[Background] Fetch error:', error);
      port.postMessage({ type: 'error', message: error.message });
    }
  });
});
