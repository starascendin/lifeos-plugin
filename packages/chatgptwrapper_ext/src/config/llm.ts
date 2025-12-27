export type LLMType = 'chatgpt' | 'claude' | 'gemini' | 'xai';
export type Tier = 'mini' | 'normal' | 'pro';

export interface LLMConfigItem {
  icon: string;
  name: string;
  color: string;
}

export interface ModelOption {
  value: string;
  label: string;
}

export const LLM_CONFIG: Record<LLMType, LLMConfigItem> = {
  chatgpt: { icon: 'G', name: 'ChatGPT', color: '#10a37f' },
  claude: { icon: 'A', name: 'Claude', color: '#d97706' },
  gemini: { icon: '✦', name: 'Gemini', color: '#8b5cf6' },
  xai: { icon: 'X', name: 'Grok', color: '#1d9bf0' }
};

export const CHATGPT_MODELS: ModelOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'gpt-5-2', label: 'GPT-5.2' },
  { value: 'gpt-5-2-instant', label: 'Instant' },
  { value: 'gpt-5-2-thinking', label: 'Thinking' },
  { value: 'gpt-5-1-instant', label: 'GPT-5.1 Instant' },
  { value: 'gpt-5-1-thinking', label: 'GPT-5.1 Thinking' },
  { value: 'gpt-4o', label: 'GPT-4o' }
];

export const CLAUDE_MODELS: ModelOption[] = [
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5' },
  { value: 'claude-opus-4-5-20251101', label: 'Opus 4.5' }
];

export const GEMINI_MODELS: ModelOption[] = [
  { value: 'gemini-3-flash', label: 'Flash' },
  { value: 'gemini-3-fast', label: 'Fast' },
  { value: 'gemini-3-pro', label: 'Pro' }
];

export const XAI_MODELS: ModelOption[] = [
  { value: 'xai/grok-4.1-fast-non-reasoning', label: 'Fast' },
  { value: 'xai/grok-4-fast-reasoning', label: 'Reasoning' },
  { value: 'xai/grok-4.1-fast-reasoning', label: 'Fast Reasoning' }
];

export const MODEL_TIERS: Record<Tier, Record<LLMType, string>> = {
  mini: {
    chatgpt: 'gpt-4o',
    claude: 'claude-haiku-4-5-20251001',
    gemini: 'gemini-3-flash',
    xai: 'xai/grok-4.1-fast-non-reasoning'
  },
  normal: {
    chatgpt: 'gpt-5-2-instant',
    claude: 'claude-sonnet-4-5-20250929',
    gemini: 'gemini-3-fast',
    xai: 'xai/grok-4-fast-reasoning'
  },
  pro: {
    chatgpt: 'gpt-5-2-thinking',
    claude: 'claude-opus-4-5-20251101',
    gemini: 'gemini-3-pro',
    xai: 'xai/grok-4.1-fast-reasoning'
  }
};

export const LLM_PROVIDERS: LLMType[] = ['chatgpt', 'claude', 'gemini', 'xai'];

export function getModelsForProvider(llmType: LLMType): ModelOption[] {
  switch (llmType) {
    case 'chatgpt':
      return CHATGPT_MODELS;
    case 'claude':
      return CLAUDE_MODELS;
    case 'gemini':
      return GEMINI_MODELS;
    case 'xai':
      return XAI_MODELS;
  }
}
