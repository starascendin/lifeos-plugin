import type { StreamCallbacks, GeminiContext } from './types';

interface GeminiParams {
  bl: string;
  at: string | null;
}

let cachedParams: GeminiParams | null = null;

export async function getGeminiRequestParams(): Promise<GeminiParams> {
  if (cachedParams) return cachedParams;

  const res = await fetch('https://gemini.google.com/', {
    credentials: 'include'
  });

  if (!res.ok) {
    throw new Error(`Gemini fetch failed: ${res.status}`);
  }

  const html = await res.text();

  const blMatch = html.match(/"cfb2h":"([^"]+)"/);
  if (!blMatch) {
    throw new Error('Could not extract Gemini bl token. Please sign in to gemini.google.com');
  }

  const atMatch = html.match(/"SNlM0e":"([^"]+)"/);

  cachedParams = {
    bl: blMatch[1],
    at: atMatch ? atMatch[1] : null
  };

  return cachedParams;
}

function generateGeminiReqId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildGeminiFReq(prompt: string, contextIds: string[]): string {
  const inner = JSON.stringify([
    [prompt, 0, null, []],
    null,
    contextIds
  ]);
  return JSON.stringify([null, inner]);
}

interface GeminiResponse {
  text: string;
  contextIds: string[];
}

function parseGeminiResponse(text: string): GeminiResponse {
  const cleaned = text.replace(/^\)\]\}'\n\n/, '');
  const lines = cleaned.split('\n');
  const result: GeminiResponse = { text: '', contextIds: ['', '', ''] };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\d+$/.test(line)) continue;

    try {
      const parsed = JSON.parse(line);
      if (!Array.isArray(parsed) || !parsed[0]) continue;

      const wrapper = parsed[0];
      if (!Array.isArray(wrapper) || wrapper[0] !== 'wrb.fr') continue;

      const innerJson = wrapper[2];
      if (!innerJson) continue;

      const inner = JSON.parse(innerJson);
      if (!inner) continue;

      if (inner[1] && Array.isArray(inner[1])) {
        result.contextIds = inner[1];
      }

      if (inner[4] && inner[4][0] && inner[4][0][1] && inner[4][0][1][0]) {
        result.text = inner[4][0][1][0];
        break;
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  return result;
}

export async function sendGeminiMessage(
  text: string,
  context: GeminiContext,
  callbacks: StreamCallbacks
): Promise<GeminiContext> {
  callbacks.onStatus?.('Getting Gemini params...');
  const params = await getGeminiRequestParams();

  callbacks.onStatus?.('Sending...');

  const reqId = generateGeminiReqId();
  const fReq = buildGeminiFReq(text, context.geminiContextIds);

  const url = `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=${encodeURIComponent(params.bl)}&_reqid=${reqId}&rt=c`;

  const body = new URLSearchParams();
  body.append('f.req', fReq);
  if (params.at) {
    body.append('at', params.at);
  }

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body: body.toString()
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Please sign in to gemini.google.com');
    }
    throw new Error(`Gemini API error ${response.status}`);
  }

  const responseText = await response.text();
  const result = parseGeminiResponse(responseText);

  if (result.text) {
    callbacks.onToken(result.text);
  }

  callbacks.onComplete();

  return {
    geminiContextIds: result.contextIds.length > 0 ? result.contextIds : context.geminiContextIds
  };
}
