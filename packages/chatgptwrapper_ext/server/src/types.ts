/**
 * Shared types for council server and extension communication.
 */

export type Tier = 'mini' | 'normal' | 'pro';
export type LLMType = 'chatgpt' | 'claude' | 'gemini' | 'xai';

export interface CouncilRequest {
  requestId: string;
  query: string;
  tier?: Tier;
  timestamp: number;
}

export interface Stage1Result {
  model: string;
  llmType: LLMType;
  response: string;
}

export interface Stage2Result {
  model: string;
  llmType: LLMType;
  ranking: string;
  parsedRanking: string[];
  evaluations: unknown[];
}

export interface Stage3Result {
  model: string;
  llmType: LLMType;
  response: string;
}

export interface AggregateRanking {
  model: string;
  llmType: LLMType;
  averageRank: number;
  rankingsCount: number;
}

export interface CouncilMetadata {
  labelToModel: Record<string, { model: string; llmType: LLMType }>;
  aggregateRankings: AggregateRanking[];
}

export interface CouncilResponse {
  requestId: string;
  success: boolean;
  stage1?: Stage1Result[];
  stage2?: Stage2Result[];
  stage3?: Stage3Result[];
  metadata?: CouncilMetadata;
  error?: string;
  duration?: number;
}

export interface ProgressUpdate {
  requestId: string;
  stage: 'stage1' | 'stage2' | 'stage3';
  status: string;
}

export interface WSMessage {
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
  requestId?: string;  // For request/response correlation
}

// LLM auth status
export interface LLMAuthStatus {
  chatgpt: boolean;
  claude: boolean;
  gemini: boolean;
  xai: boolean;
  timestamp: number;
}

// HTTP request/response types
export interface PromptRequestBody {
  query: string;
  tier?: Tier;
  timeout?: number;
}

export interface PromptResponse {
  success: boolean;
  requestId?: string;
  stage1?: Stage1Result[];
  stage2?: Stage2Result[];
  stage3?: Stage3Result[];
  metadata?: CouncilMetadata;
  error?: string;
  errorCode?: string;
  duration?: number;
}

export interface HealthResponse {
  status: 'ok';
  extensionConnected: boolean;
  uptime: number;
}

// Storage types
export interface StoredConversation {
  id: string;
  query: string;
  tier: Tier;
  createdAt: number;
  duration: number;
  stage1: Stage1Result[];
  stage2: Stage2Result[];
  stage3: Stage3Result[];
  metadata?: CouncilMetadata;
}

export interface ConversationSummary {
  id: string;
  query: string;
  tier: Tier;
  createdAt: number;
  duration: number;
}
