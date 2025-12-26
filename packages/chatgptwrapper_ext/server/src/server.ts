/**
 * Council Server - HTTP + WebSocket server for remote council execution.
 *
 * Architecture:
 * - HTTP POST /prompt: Receives queries from iPhone (via Tailscale)
 * - WebSocket /ws: Connects to Chrome extension
 * - Forwards requests to extension, waits for response, returns to HTTP client
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import type {
  CouncilRequest,
  CouncilResponse,
  ProgressUpdate,
  WSMessage,
  PromptRequestBody,
  PromptResponse,
  HealthResponse,
  LLMAuthStatus,
} from './types.js';
import {
  saveRequest,
  updateRequest,
  getRequest,
  getRecentRequests,
  getActiveRequest,
  deleteRequest,
  cleanupOldRequests,
  type PersistedRequest
} from './persistence.js';

const DEFAULT_PORT = 3456;
const DEFAULT_TIMEOUT = 120000; // 2 minutes
const MAX_TIMEOUT = 300000; // 5 minutes

interface PendingRequest {
  requestId: string;
  resolve: (response: CouncilResponse) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
}

export function createCouncilServer(port: number = DEFAULT_PORT): { start: () => void } {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  // State
  let extensionSocket: WebSocket | null = null;
  const pendingRequests = new Map<string, PendingRequest>();
  const startTime = Date.now();

  // Pending requests for proxied calls (history, auth status)
  interface PendingProxyRequest {
    resolve: (data: unknown) => void;
    reject: (error: Error) => void;
    timeoutId: NodeJS.Timeout;
  }
  const pendingProxyRequests = new Map<string, PendingProxyRequest>();
  const PROXY_TIMEOUT = 10000; // 10 seconds

  // Helper to send request to extension and wait for response
  function requestFromExtension(type: WSMessage['type'], payload: unknown, requestId: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
        reject(new Error('Extension not connected'));
        return;
      }

      const timeoutId = setTimeout(() => {
        pendingProxyRequests.delete(requestId);
        reject(new Error('Request timed out'));
      }, PROXY_TIMEOUT);

      pendingProxyRequests.set(requestId, { resolve, reject, timeoutId });

      const message: WSMessage = { type, payload, requestId };
      extensionSocket.send(JSON.stringify(message));
    });
  }

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Serve static files (React build from dist-server)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // In production: server/dist/server.js -> look for ../dist-server (relative to server/)
  // In development: server/src/server.ts -> look for ../../dist-server
  let staticPath = join(__dirname, '..', '..', 'dist-server');

  // Check if dist-server exists
  if (!existsSync(staticPath)) {
    // Try alternative path for dev mode (when running from server/src)
    staticPath = join(__dirname, '..', 'dist-server');
  }

  if (!existsSync(staticPath)) {
    // Fallback: try root dist-server
    staticPath = join(__dirname, '..', '..', '..', 'dist-server');
  }

  console.log('[Server] Serving static files from:', staticPath);
  app.use(express.static(staticPath));

  // Explicit route for root to serve index.html
  app.get('/', (_req, res) => {
    const indexPath = join(staticPath, 'index.html');
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(503).send(`
        <html>
          <body style="font-family: system-ui; padding: 2rem; background: #1a1a2e; color: #fff;">
            <h1>LLM Council Server</h1>
            <p>Server is running but React UI not built yet.</p>
            <p>Run: <code style="background: #333; padding: 0.25rem 0.5rem; border-radius: 4px;">npm run build:server</code> in the extension root.</p>
            <hr style="border-color: #333; margin: 2rem 0;">
            <h3>API Endpoints:</h3>
            <ul>
              <li>POST /prompt - Submit council query</li>
              <li>GET /health - Health check</li>
              <li>GET /conversations - List conversations</li>
              <li>GET /auth-status - LLM auth status</li>
            </ul>
          </body>
        </html>
      `);
    }
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    const response: HealthResponse = {
      status: 'ok',
      extensionConnected: extensionSocket?.readyState === WebSocket.OPEN,
      uptime: Date.now() - startTime
    };
    res.json(response);
  });

  // List all conversations (proxied to extension)
  app.get('/conversations', async (_req, res) => {
    if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
      return res.status(503).json({
        success: false,
        error: 'Extension not connected'
      });
    }

    try {
      const requestId = uuidv4();
      const conversations = await requestFromExtension('get_history_list', {}, requestId);
      res.json({ success: true, conversations });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list conversations'
      });
    }
  });

  // Get single conversation (proxied to extension)
  app.get('/conversations/:id', async (req, res) => {
    if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
      return res.status(503).json({
        success: false,
        error: 'Extension not connected'
      });
    }

    try {
      const requestId = uuidv4();
      const conversation = await requestFromExtension('get_conversation', { id: req.params.id }, requestId);
      if (conversation) {
        res.json({ success: true, conversation });
      } else {
        res.status(404).json({ success: false, error: 'Conversation not found' });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get conversation'
      });
    }
  });

  // Delete conversation (proxied to extension)
  app.delete('/conversations/:id', async (req, res) => {
    if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
      return res.status(503).json({
        success: false,
        error: 'Extension not connected'
      });
    }

    try {
      const requestId = uuidv4();
      const result = await requestFromExtension('delete_conversation', { id: req.params.id }, requestId) as { success: boolean };
      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: 'Conversation not found' });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete conversation'
      });
    }
  });

  // Get all persisted requests (server-side history)
  app.get('/requests', (_req, res) => {
    const requests = getRecentRequests(50);
    res.json({ success: true, requests });
  });

  // Get a specific request by ID
  app.get('/requests/:id', (req, res) => {
    const request = getRequest(req.params.id);
    if (request) {
      res.json({ success: true, request });
    } else {
      res.status(404).json({ success: false, error: 'Request not found' });
    }
  });

  // Delete a request
  app.delete('/requests/:id', (req, res) => {
    const success = deleteRequest(req.params.id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Request not found' });
    }
  });

  // Get active (pending/processing) request if any
  app.get('/active-request', (_req, res) => {
    const active = getActiveRequest();
    res.json({ success: true, request: active });
  });

  // Get LLM auth status (proxied to extension)
  app.get('/auth-status', async (_req, res) => {
    if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
      return res.json({
        success: true,
        status: { chatgpt: false, claude: false, gemini: false },
        extensionConnected: false
      });
    }

    try {
      const requestId = uuidv4();
      const status = await requestFromExtension('get_auth_status', {}, requestId) as LLMAuthStatus;
      res.json({ success: true, status, extensionConnected: true });
    } catch (error) {
      res.json({
        success: true,
        status: { chatgpt: false, claude: false, gemini: false },
        extensionConnected: true,
        error: error instanceof Error ? error.message : 'Failed to get status'
      });
    }
  });

  // Main prompt endpoint
  app.post('/prompt', async (req, res) => {
    const body = req.body as PromptRequestBody;
    const { query, tier = 'normal', timeout = DEFAULT_TIMEOUT } = body;

    // Validation
    if (!query || typeof query !== 'string' || !query.trim()) {
      const response: PromptResponse = {
        success: false,
        error: 'Query is required',
        errorCode: 'INVALID_REQUEST'
      };
      return res.status(400).json(response);
    }

    // Check extension connection
    if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
      const response: PromptResponse = {
        success: false,
        error: 'Chrome extension not connected. Please open the extension tab in your browser.',
        errorCode: 'NO_EXTENSION'
      };
      return res.status(503).json(response);
    }

    // Create request
    const requestId = uuidv4();
    const councilRequest: CouncilRequest = {
      requestId,
      query: query.trim(),
      tier,
      timestamp: Date.now()
    };

    // Persist the request immediately
    const persistedRequest: PersistedRequest = {
      id: requestId,
      query: query.trim(),
      tier,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    saveRequest(persistedRequest);
    console.log(`[Server] Persisted request ${requestId}`);

    // Cleanup old requests periodically
    cleanupOldRequests(50);

    const effectiveTimeout = Math.min(timeout, MAX_TIMEOUT);

    try {
      // Update status to processing
      updateRequest(requestId, { status: 'processing' });

      // Send to extension and wait for response
      const response = await sendToExtension(councilRequest, effectiveTimeout);

      if (response.success) {
        // Persist the successful response
        updateRequest(requestId, {
          status: 'completed',
          stage1: response.stage1,
          stage2: response.stage2,
          stage3: response.stage3,
          metadata: response.metadata,
          duration: response.duration
        });

        const promptResponse: PromptResponse = {
          success: true,
          requestId,
          stage1: response.stage1,
          stage2: response.stage2,
          stage3: response.stage3,
          metadata: response.metadata,
          duration: response.duration
        };
        res.json(promptResponse);
      } else {
        // Persist the error
        updateRequest(requestId, {
          status: 'error',
          error: response.error,
          duration: response.duration
        });

        const promptResponse: PromptResponse = {
          success: false,
          requestId,
          error: response.error,
          errorCode: 'COUNCIL_ERROR',
          duration: response.duration
        };
        res.status(500).json(promptResponse);
      }
    } catch (error) {
      // Persist the timeout/error
      updateRequest(requestId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      const promptResponse: PromptResponse = {
        success: false,
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'TIMEOUT'
      };
      res.status(504).json(promptResponse);
    }
  });

  // Send request to extension and wait for response
  function sendToExtension(request: CouncilRequest, timeout: number): Promise<CouncilResponse> {
    return new Promise((resolve, reject) => {
      const { requestId } = request;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error(`Request timed out after ${timeout}ms`));
      }, timeout);

      // Store pending request
      pendingRequests.set(requestId, {
        requestId,
        resolve,
        reject,
        timeoutId
      });

      // Send to extension
      const message: WSMessage = {
        type: 'council_request',
        payload: request
      };

      extensionSocket?.send(JSON.stringify(message));
      console.log(`[Server] Sent request ${requestId} to extension`);
    });
  }

  // WebSocket handling
  wss.on('connection', (ws) => {
    console.log('[Server] Extension connected');

    // Only allow one extension connection at a time
    if (extensionSocket && extensionSocket.readyState === WebSocket.OPEN) {
      extensionSocket.close(1000, 'New connection');
    }

    extensionSocket = ws;

    ws.on('message', (data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        handleWSMessage(message);
      } catch (error) {
        console.error('[Server] Failed to parse message:', error);
      }
    });

    ws.on('close', () => {
      console.log('[Server] Extension disconnected');
      if (extensionSocket === ws) {
        extensionSocket = null;
      }

      // Reject all pending council requests
      for (const [requestId, pending] of pendingRequests) {
        clearTimeout(pending.timeoutId);
        pending.reject(new Error('Extension disconnected'));
        pendingRequests.delete(requestId);
      }

      // Reject all pending proxy requests
      for (const [requestId, pending] of pendingProxyRequests) {
        clearTimeout(pending.timeoutId);
        pending.reject(new Error('Extension disconnected'));
        pendingProxyRequests.delete(requestId);
      }
    });

    ws.on('error', (error) => {
      console.error('[Server] WebSocket error:', error);
    });
  });

  function handleWSMessage(message: WSMessage) {
    switch (message.type) {
      case 'extension_ready':
        console.log('[Server] Extension ready');
        break;

      case 'ping':
        extensionSocket?.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'council_response': {
        const response = message.payload as CouncilResponse;
        const pending = pendingRequests.get(response.requestId);

        if (pending) {
          clearTimeout(pending.timeoutId);
          pendingRequests.delete(response.requestId);
          pending.resolve(response);
          console.log(`[Server] Received response for ${response.requestId}`);
        }
        break;
      }

      case 'council_progress': {
        const progress = message.payload as ProgressUpdate;
        console.log(`[Server] Progress ${progress.requestId}: ${progress.stage} - ${progress.status}`);
        break;
      }

      // Handle proxied responses from extension
      case 'history_list':
      case 'conversation_data':
      case 'delete_result':
      case 'auth_status': {
        const requestId = message.requestId;
        if (requestId && pendingProxyRequests.has(requestId)) {
          const pending = pendingProxyRequests.get(requestId)!;
          clearTimeout(pending.timeoutId);
          pendingProxyRequests.delete(requestId);
          pending.resolve(message.payload);
        }
        break;
      }

      default:
        console.log('[Server] Unknown message type:', message.type);
    }
  }

  // Start server
  async function start() {
    server.listen(port, '0.0.0.0', () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                    Council Server                          ║
╠════════════════════════════════════════════════════════════╣
║  Web UI:  http://localhost:${port}                           ║
║  WS:      ws://localhost:${port}/ws                          ║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║    GET  /         - Web UI (works on iPhone Safari!)       ║
║    POST /prompt   - Submit council query                   ║
║    GET  /health   - Health check                           ║
╠════════════════════════════════════════════════════════════╣
║  iPhone Usage:                                             ║
║    Open http://<tailscale-ip>:${port} in Safari              ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  }

  return { start };
}
