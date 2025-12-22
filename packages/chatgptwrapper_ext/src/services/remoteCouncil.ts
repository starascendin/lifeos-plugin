/**
 * WebSocket client for remote council execution.
 * Connects to the desktop server and handles incoming council requests.
 */

import { runCouncilHeadless, type CouncilResult, type CouncilConfig } from './councilRunner';
import type { LLMType, Tier } from '../config/llm';

// Message types
interface WSMessage {
  type: 'council_request' | 'council_response' | 'council_progress' | 'ping' | 'pong' | 'extension_ready';
  payload?: unknown;
}

interface CouncilRequest {
  requestId: string;
  query: string;
  tier?: Tier;
  chairman?: LLMType;
  timestamp: number;
}

interface CouncilResponse {
  requestId: string;
  success: boolean;
  stage1?: CouncilResult['stage1'];
  stage2?: CouncilResult['stage2'];
  stage3?: CouncilResult['stage3'];
  metadata?: CouncilResult['metadata'];
  error?: string;
  duration?: number;
}

interface ProgressUpdate {
  requestId: string;
  stage: 'stage1' | 'stage2' | 'stage3';
  status: string;
}

type ConnectionStatusCallback = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

const DEFAULT_SERVER_URL = 'ws://localhost:3456/ws';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL_MS = 30000;

class RemoteCouncilClient {
  private ws: WebSocket | null = null;
  private serverUrl: string = DEFAULT_SERVER_URL;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  private statusCallback: ConnectionStatusCallback | null = null;

  /**
   * Connect to the council server.
   */
  connect(serverUrl: string = DEFAULT_SERVER_URL): void {
    this.serverUrl = serverUrl;
    this.attemptConnection();
  }

  /**
   * Disconnect from the server.
   */
  disconnect(): void {
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Check if connected to server.
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Set callback for connection status changes.
   */
  onStatusChange(callback: ConnectionStatusCallback): void {
    this.statusCallback = callback;
  }

  private attemptConnection(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.statusCallback?.('connecting');

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('[RemoteCouncil] Connected to server');
        this.reconnectAttempts = 0;
        this.statusCallback?.('connected');
        this.startHeartbeat();

        // Notify server that extension is ready
        this.send({ type: 'extension_ready' });
      };

      this.ws.onclose = (event) => {
        console.log('[RemoteCouncil] Connection closed:', event.code, event.reason);
        this.statusCallback?.('disconnected');
        this.cleanup();
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[RemoteCouncil] WebSocket error:', error);
        this.statusCallback?.('error');
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch (error) {
      console.error('[RemoteCouncil] Failed to create WebSocket:', error);
      this.statusCallback?.('error');
      this.scheduleReconnect();
    }
  }

  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[RemoteCouncil] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * Math.min(this.reconnectAttempts, 5);

    console.log(`[RemoteCouncil] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.attemptConnection();
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private async handleMessage(data: string): Promise<void> {
    try {
      const message: WSMessage = JSON.parse(data);

      switch (message.type) {
        case 'pong':
          // Heartbeat response
          break;

        case 'council_request':
          await this.handleCouncilRequest(message.payload as CouncilRequest);
          break;

        default:
          console.log('[RemoteCouncil] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[RemoteCouncil] Failed to parse message:', error);
    }
  }

  private async handleCouncilRequest(request: CouncilRequest): Promise<void> {
    const { requestId, query, tier = 'normal', chairman = 'claude' } = request;
    const startTime = Date.now();

    console.log('[RemoteCouncil] Received council request:', requestId, query.slice(0, 50));

    if (this.isProcessing) {
      this.sendResponse({
        requestId,
        success: false,
        error: 'Another request is in progress'
      });
      return;
    }

    this.isProcessing = true;

    try {
      const config: CouncilConfig = { tier, chairman };

      const result = await runCouncilHeadless(query, config, (stage, status) => {
        // Send progress updates
        this.sendProgress({ requestId, stage, status });
      });

      const duration = Date.now() - startTime;

      this.sendResponse({
        requestId,
        success: true,
        stage1: result.stage1,
        stage2: result.stage2,
        stage3: result.stage3,
        metadata: result.metadata,
        duration
      });

      console.log('[RemoteCouncil] Council completed in', duration, 'ms');
    } catch (error) {
      console.error('[RemoteCouncil] Council error:', error);

      this.sendResponse({
        requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private sendResponse(response: CouncilResponse): void {
    this.send({
      type: 'council_response',
      payload: response
    });
  }

  private sendProgress(progress: ProgressUpdate): void {
    this.send({
      type: 'council_progress',
      payload: progress
    });
  }
}

// Singleton instance
export const remoteCouncilClient = new RemoteCouncilClient();
