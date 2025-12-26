/**
 * WebSocket client for remote council execution.
 * Connects to the desktop server and handles incoming council requests.
 */

import { runCouncilHeadless, type CouncilResult, type CouncilConfig } from './councilRunner';
import type { Tier } from '../config/llm';
import { getAccessToken } from './chatgpt';
import { getClaudeOrgUuid } from './claude';
import { getGeminiRequestParams } from './gemini';

// Message types
interface WSMessage {
  type:
    | 'council_request'
    | 'council_response'
    | 'council_progress'
    | 'ping'
    | 'pong'
    | 'extension_ready'
    // Auth status messages
    | 'get_auth_status'
    | 'auth_status'
    // History messages
    | 'get_history_list'
    | 'history_list'
    | 'get_conversation'
    | 'conversation_data'
    | 'delete_conversation'
    | 'delete_result';
  payload?: unknown;
  requestId?: string;
}

// Storage types for remote conversations - matches SavedCouncilConversation format
interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  tier: Tier;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content?: string;
    stage1?: CouncilResult['stage1'];
    stage2?: CouncilResult['stage2'];
    stage3?: CouncilResult['stage3'];
    metadata?: CouncilResult['metadata'];
    loading?: { stage1: boolean; stage2: boolean; stage3: boolean };
    timestamp: number;
  }>;
  messageCount: number;
}

// Matches ConversationIndex format
interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

// Use the same storage keys as regular council mode so both modes share the same history
const REMOTE_STORAGE_KEYS = {
  CONVERSATION_INDEX: 'council_conversation_index',
  CONVERSATION_PREFIX: 'council_conversation_'
} as const;

interface CouncilRequest {
  requestId: string;
  query: string;
  tier?: Tier;
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

        case 'get_auth_status': {
          const status = await this.checkAuthStatus();
          this.send({
            type: 'auth_status',
            payload: { ...status, timestamp: Date.now() },
            requestId: message.requestId
          });
          break;
        }

        case 'get_history_list': {
          const conversations = await this.getHistoryList();
          this.send({
            type: 'history_list',
            payload: conversations,
            requestId: message.requestId
          });
          break;
        }

        case 'get_conversation': {
          const { id } = message.payload as { id: string };
          const conversation = await this.getConversation(id);
          this.send({
            type: 'conversation_data',
            payload: conversation,
            requestId: message.requestId
          });
          break;
        }

        case 'delete_conversation': {
          const { id } = message.payload as { id: string };
          const success = await this.deleteConversation(id);
          this.send({
            type: 'delete_result',
            payload: { success, id },
            requestId: message.requestId
          });
          break;
        }

        default:
          console.log('[RemoteCouncil] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[RemoteCouncil] Failed to parse message:', error);
    }
  }

  private async handleCouncilRequest(request: CouncilRequest): Promise<void> {
    const { requestId, query, tier = 'normal' } = request;
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
      const config: CouncilConfig = { tier };

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

      // Save conversation to extension storage in SavedCouncilConversation format
      const title = query.trim().length <= 50 ? query.trim() : query.trim().substring(0, 47) + '...';
      const now = Date.now();
      await this.saveConversation({
        id: requestId,
        title,
        createdAt: startTime,
        updatedAt: now,
        tier,
        messages: [
          {
            id: `${requestId}-user`,
            role: 'user',
            content: query,
            timestamp: startTime
          },
          {
            id: `${requestId}-assistant`,
            role: 'assistant',
            stage1: result.stage1,
            stage2: result.stage2,
            stage3: result.stage3,
            metadata: result.metadata,
            loading: { stage1: false, stage2: false, stage3: false },
            timestamp: now
          }
        ],
        messageCount: 2
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

  // ============ Auth Status Methods ============

  private async checkAuthStatus(): Promise<{ chatgpt: boolean; claude: boolean; gemini: boolean }> {
    const status = { chatgpt: false, claude: false, gemini: false };

    try {
      await getAccessToken();
      status.chatgpt = true;
    } catch {
      // Not authenticated
    }

    try {
      await getClaudeOrgUuid();
      status.claude = true;
    } catch {
      // Not authenticated
    }

    try {
      await getGeminiRequestParams();
      status.gemini = true;
    } catch {
      // Not authenticated
    }

    console.log('[RemoteCouncil] Auth status:', status);
    return status;
  }

  // ============ History Storage Methods ============

  private isStorageAvailable(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
  }

  private async getHistoryList(): Promise<ConversationSummary[]> {
    if (!this.isStorageAvailable()) {
      console.warn('[RemoteCouncil] chrome.storage.local not available');
      return [];
    }

    try {
      const result = await chrome.storage.local.get(REMOTE_STORAGE_KEYS.CONVERSATION_INDEX);
      return (result[REMOTE_STORAGE_KEYS.CONVERSATION_INDEX] as ConversationSummary[] | undefined) || [];
    } catch (error) {
      console.error('[RemoteCouncil] Failed to load history:', error);
      return [];
    }
  }

  private async getConversation(id: string): Promise<StoredConversation | null> {
    if (!this.isStorageAvailable()) return null;

    try {
      const key = `${REMOTE_STORAGE_KEYS.CONVERSATION_PREFIX}${id}`;
      const result = await chrome.storage.local.get(key);
      return (result[key] as StoredConversation | undefined) || null;
    } catch (error) {
      console.error('[RemoteCouncil] Failed to load conversation:', error);
      return null;
    }
  }

  private async saveConversation(conversation: StoredConversation): Promise<void> {
    if (!this.isStorageAvailable()) return;

    try {
      // Save the full conversation
      const key = `${REMOTE_STORAGE_KEYS.CONVERSATION_PREFIX}${conversation.id}`;
      await chrome.storage.local.set({ [key]: conversation });

      // Update the index with ConversationIndex format
      const index = await this.getHistoryList();
      const existingIdx = index.findIndex((c) => c.id === conversation.id);

      const summary: ConversationSummary = {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messageCount: conversation.messageCount
      };

      if (existingIdx >= 0) {
        index[existingIdx] = summary;
      } else {
        index.unshift(summary);
      }

      // Sort by updatedAt descending
      index.sort((a, b) => b.updatedAt - a.updatedAt);

      await chrome.storage.local.set({ [REMOTE_STORAGE_KEYS.CONVERSATION_INDEX]: index });
      console.log('[RemoteCouncil] Saved conversation:', conversation.id);
    } catch (error) {
      console.error('[RemoteCouncil] Failed to save conversation:', error);
    }
  }

  private async deleteConversation(id: string): Promise<boolean> {
    if (!this.isStorageAvailable()) return false;

    try {
      // Remove the conversation
      const key = `${REMOTE_STORAGE_KEYS.CONVERSATION_PREFIX}${id}`;
      await chrome.storage.local.remove(key);

      // Update the index
      const index = await this.getHistoryList();
      const filtered = index.filter((c) => c.id !== id);
      await chrome.storage.local.set({ [REMOTE_STORAGE_KEYS.CONVERSATION_INDEX]: filtered });

      console.log('[RemoteCouncil] Deleted conversation:', id);
      return true;
    } catch (error) {
      console.error('[RemoteCouncil] Failed to delete conversation:', error);
      return false;
    }
  }
}

// Singleton instance
export const remoteCouncilClient = new RemoteCouncilClient();
