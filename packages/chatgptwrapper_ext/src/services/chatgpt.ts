import { stripCitations } from '../utils/text';
import { computeRequirementsToken, computeSentinelProofToken } from './proof-of-work';
import type { StreamCallbacks, ChatGPTContext } from './types';

function getDeviceId(): string {
  let id = localStorage.getItem('oai_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('oai_device_id', id);
  }
  return id;
}

export async function getAccessToken(): Promise<string> {
  const res = await fetch('https://chatgpt.com/api/auth/session', {
    credentials: 'include'
  });

  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('Cloudflare check required. Visit chatgpt.com first.');
    }
    throw new Error(`Auth failed: ${res.status}`);
  }

  const data = await res.json();

  if (data.error === 'RefreshAccessTokenError') {
    throw new Error('Please login to ChatGPT first.');
  }

  if (!data.accessToken) {
    throw new Error('No access token. Login to chatgpt.com');
  }

  return data.accessToken;
}

interface ChatRequirements {
  token: string;
  proofofwork?: {
    required: boolean;
    seed: string;
    difficulty: string;
  };
}

async function getChatRequirements(token: string): Promise<ChatRequirements> {
  const p = await computeRequirementsToken();

  const res = await fetch('https://chatgpt.com/backend-api/sentinel/chat-requirements', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Oai-Device-Id': getDeviceId(),
      'Oai-Language': 'en-US'
    },
    body: JSON.stringify({ p })
  });

  if (!res.ok) {
    throw new Error(`Chat requirements failed: ${res.status}`);
  }

  return res.json();
}

async function processChatGPTSSEStream(
  response: Response,
  callbacks: StreamCallbacks,
  context: ChatGPTContext
): Promise<ChatGPTContext> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let newContext = { ...context };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);

          if (parsed.conversation_id) {
            newContext.conversationId = parsed.conversation_id;
          }

          const role = parsed.message?.author?.role;
          if (role !== 'assistant' && role !== 'tool') continue;

          if (parsed.message?.id) {
            newContext.parentMessageId = parsed.message.id;
          }

          if (parsed.message?.content?.parts?.length > 0) {
            const content = parsed.message.content.parts[0];
            if (typeof content === 'string') {
              const cleaned = stripCitations(content);
              if (cleaned !== fullContent) {
                fullContent = cleaned;
                callbacks.onToken(fullContent);
              }
            }
          }

          if (parsed.error) {
            throw new Error(parsed.error);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  callbacks.onComplete();
  return newContext;
}

export async function sendChatGPTMessage(
  text: string,
  model: string,
  context: ChatGPTContext,
  callbacks: StreamCallbacks
): Promise<ChatGPTContext> {
  callbacks.onStatus?.('Getting token...');
  const token = await getAccessToken();

  callbacks.onStatus?.('Getting requirements...');
  const requirements = await getChatRequirements(token);

  let proofToken = null;
  if (requirements.proofofwork?.required) {
    callbacks.onStatus?.('Computing proof...');
    proofToken = await computeSentinelProofToken(
      requirements.proofofwork.seed,
      requirements.proofofwork.difficulty
    );
  }

  callbacks.onStatus?.('Sending...');

  const messageId = crypto.randomUUID();
  const body = {
    action: 'next',
    messages: [{
      id: messageId,
      author: { role: 'user' },
      content: { content_type: 'text', parts: [text] }
    }],
    conversation_mode: { kind: 'primary_assistant' },
    model,
    parent_message_id: context.parentMessageId,
    conversation_id: context.conversationId || undefined,
    force_use_sse: true,
    history_and_training_disabled: false
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Oai-Device-Id': getDeviceId(),
    'Oai-Language': 'en-US',
    'Accept': 'text/event-stream',
    'Openai-Sentinel-Chat-Requirements-Token': requirements.token
  };

  if (proofToken) {
    headers['Openai-Sentinel-Proof-Token'] = proofToken;
  }

  const response = await fetch('https://chatgpt.com/backend-api/conversation', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return processChatGPTSSEStream(response, callbacks, context);
}
