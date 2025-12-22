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
  HealthResponse
} from './types.js';

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

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Serve static files (web UI)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // Handle both dev (src/) and prod (dist/) paths
  let publicPath = join(__dirname, '..', 'public');

  // Check if public exists, if not try alternative path
  if (!existsSync(publicPath)) {
    publicPath = join(__dirname, '..', '..', 'public');
  }

  console.log('[Server] Serving static files from:', publicPath);
  app.use(express.static(publicPath));

  // Explicit route for root to serve index.html
  app.get('/', (_req, res) => {
    res.sendFile(join(publicPath, 'index.html'));
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

  // Main prompt endpoint
  app.post('/prompt', async (req, res) => {
    const body = req.body as PromptRequestBody;
    const { query, tier = 'normal', chairman = 'claude', timeout = DEFAULT_TIMEOUT } = body;

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
      chairman,
      timestamp: Date.now()
    };

    const effectiveTimeout = Math.min(timeout, MAX_TIMEOUT);

    try {
      // Send to extension and wait for response
      const response = await sendToExtension(councilRequest, effectiveTimeout);

      if (response.success) {
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

      // Reject all pending requests
      for (const [requestId, pending] of pendingRequests) {
        clearTimeout(pending.timeoutId);
        pending.reject(new Error('Extension disconnected'));
        pendingRequests.delete(requestId);
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

      default:
        console.log('[Server] Unknown message type:', message.type);
    }
  }

  // Start server
  function start() {
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
