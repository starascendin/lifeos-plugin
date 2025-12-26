import { stripArtifactTags } from '../utils/text';
import type { StreamCallbacks, ClaudeContext } from './types';
import { generateUUID } from '../utils/uuid';

let cachedOrgUuid: string | null = null;

export async function getClaudeOrgUuid(): Promise<string> {
  if (cachedOrgUuid) return cachedOrgUuid;

  const res = await fetch('https://claude.ai/api/organizations', {
    credentials: 'include'
  });

  if (!res.ok) {
    if (res.status === 403) throw new Error('Please sign in to Claude first.');
    throw new Error(`Claude org fetch failed: ${res.status}`);
  }

  const orgs = await res.json();
  const org = orgs.find((o: { capabilities?: string[] }) => o.capabilities?.includes('chat')) || orgs[0];
  if (!org) throw new Error('No Claude organization found');

  cachedOrgUuid = org.uuid;
  return cachedOrgUuid!;
}

async function createClaudeConversation(orgUuid: string, model: string): Promise<string> {
  const uuid = generateUUID();
  const res = await fetch(`https://claude.ai/api/organizations/${orgUuid}/chat_conversations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '',
      uuid,
      model,
      is_temporary: false
    })
  });

  if (!res.ok) {
    if (res.status === 403) throw new Error('No logged-in Claude account.');
    throw new Error(`Create conversation failed: ${res.status}`);
  }

  return uuid;
}

async function processClaudeSSEStream(
  response: Response,
  callbacks: StreamCallbacks
): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);

        try {
          const parsed = JSON.parse(data);

          if (parsed.completion) {
            fullContent += parsed.completion;
            const cleaned = stripArtifactTags(fullContent);
            callbacks.onToken(cleaned);
          }

          if (parsed.error) {
            throw new Error(parsed.error.message || parsed.error);
          }
        } catch {
          // Ignore parse errors for non-JSON lines
        }
      }
    }
  }

  callbacks.onComplete();
}

export async function sendClaudeMessage(
  text: string,
  model: string,
  context: ClaudeContext,
  callbacks: StreamCallbacks
): Promise<ClaudeContext> {
  callbacks.onStatus?.('Getting organization...');
  const orgUuid = context.claudeOrgUuid || await getClaudeOrgUuid();

  let conversationId = context.conversationId;
  if (!conversationId) {
    callbacks.onStatus?.('Creating conversation...');
    conversationId = await createClaudeConversation(orgUuid, model);
  }

  callbacks.onStatus?.('Sending...');

  const response = await fetch(
    `https://claude.ai/api/organizations/${orgUuid}/chat_conversations/${conversationId}/completion`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        prompt: text,
        files: [],
        rendering_mode: 'raw',
        attachments: []
      })
    }
  );

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Please sign in to Claude first.');
    }
    throw new Error(`Claude API error ${response.status}`);
  }

  await processClaudeSSEStream(response, callbacks);

  return {
    conversationId,
    claudeOrgUuid: orgUuid
  };
}
