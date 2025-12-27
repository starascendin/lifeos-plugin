import { streamText } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import type { StreamCallbacks, XaiContext } from './types';

const VERCEL_API_KEY_STORAGE_KEY = 'vercel_ai_gateway_key';

/**
 * Get the Vercel AI Gateway API key from storage.
 */
export async function getVercelApiKey(): Promise<string | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(VERCEL_API_KEY_STORAGE_KEY, (result) => {
        const key = (result as Record<string, string | undefined>)[VERCEL_API_KEY_STORAGE_KEY];
        resolve(key || null);
      });
    });
  }
  return localStorage.getItem(VERCEL_API_KEY_STORAGE_KEY);
}

/**
 * Save the Vercel AI Gateway API key to storage.
 */
export async function setVercelApiKey(apiKey: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [VERCEL_API_KEY_STORAGE_KEY]: apiKey }, resolve);
    });
  }
  localStorage.setItem(VERCEL_API_KEY_STORAGE_KEY, apiKey);
}

/**
 * Remove the Vercel AI Gateway API key from storage.
 */
export async function removeVercelApiKey(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(VERCEL_API_KEY_STORAGE_KEY, resolve);
    });
  }
  localStorage.removeItem(VERCEL_API_KEY_STORAGE_KEY);
}

// Backwards compatibility aliases
export const getXaiApiKey = getVercelApiKey;
export const setXaiApiKey = setVercelApiKey;
export const removeXaiApiKey = removeVercelApiKey;

/**
 * Check if Vercel AI Gateway is configured (API key exists).
 */
export async function isVercelConfigured(): Promise<boolean> {
  const apiKey = await getVercelApiKey();
  return !!apiKey && apiKey.length > 0;
}

// Backwards compatibility alias
export const isXaiConfigured = isVercelConfigured;

/**
 * Check if running in Chrome extension context.
 */
function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.connect;
}

/**
 * Create a custom fetch that proxies through the background script.
 * This bypasses CORS restrictions in Chrome extensions.
 */
function createProxyFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();

    // Serialize headers
    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, init.headers);
      }
    }

    const options = {
      method: init?.method || 'GET',
      headers,
      body: init?.body
    };

    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: 'fetch-proxy' });

      let responseStatus = 200;
      let responseHeaders: Record<string, string> = {};
      const chunks: Uint8Array[] = [];
      let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
      let streamStarted = false;

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
        }
      });

      port.onMessage.addListener((message: {
        type: string;
        status?: number;
        statusText?: string;
        headers?: Record<string, string>;
        data?: number[];
        message?: string;
      }) => {
        if (message.type === 'headers') {
          responseStatus = message.status || 200;
          responseHeaders = message.headers || {};

          // Create and resolve with Response once we have headers
          if (!streamStarted) {
            streamStarted = true;
            const response = new Response(stream, {
              status: responseStatus,
              headers: responseHeaders
            });
            resolve(response);
          }
        } else if (message.type === 'chunk') {
          const uint8Array = new Uint8Array(message.data || []);
          if (streamController) {
            streamController.enqueue(uint8Array);
          } else {
            chunks.push(uint8Array);
          }
        } else if (message.type === 'done') {
          if (streamController) {
            streamController.close();
          }
          port.disconnect();
        } else if (message.type === 'error') {
          const error = new Error(message.message || `HTTP ${message.status}: ${message.statusText}`);
          if (streamController) {
            streamController.error(error);
          }
          port.disconnect();
          if (!streamStarted) {
            reject(error);
          }
        }
      });

      port.postMessage({
        type: 'fetch',
        url,
        options
      });
    });
  };
}

/**
 * Send a message to xAI via Vercel AI Gateway.
 * Uses the AI SDK with streaming.
 */
export async function sendXaiMessage(
  text: string,
  model: string,
  context: XaiContext,
  callbacks: StreamCallbacks
): Promise<XaiContext> {
  callbacks.onStatus?.('Checking API key...');

  const apiKey = await getVercelApiKey();
  if (!apiKey) {
    throw new Error('Vercel AI Gateway key not configured. Please add your API key in settings.');
  }

  callbacks.onStatus?.('Sending to Grok...');

  // Build messages array
  const messages = [
    ...context.conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    { role: 'user' as const, content: text }
  ];

  // Create gateway with custom fetch for CORS bypass in extension context
  const gatewayOptions: { apiKey: string; fetch?: typeof fetch } = { apiKey };
  if (isExtensionContext()) {
    gatewayOptions.fetch = createProxyFetch();
  }

  const gateway = createGateway(gatewayOptions);

  try {
    const result = await streamText({
      model: gateway(model),
      messages
    });

    let fullContent = '';

    for await (const chunk of result.textStream) {
      fullContent += chunk;
      callbacks.onToken(fullContent);
    }

    callbacks.onComplete();

    return {
      conversationHistory: [
        ...context.conversationHistory,
        { role: 'user', content: text },
        { role: 'assistant', content: fullContent }
      ]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Vercel AI Gateway error: ${errorMessage}`);
  }
}
