import {
  type JobContext,
  WorkerOptions,
  cli,
  defineAgent,
  voice,
} from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

class SpanishTutor extends voice.Agent {
  constructor() {
    super({
      instructions: `You are Bella, a friendly and patient Spanish language tutor.
You help users practice speaking Spanish through natural conversation.

Guidelines:
- Keep responses concise and conversational (2-3 sentences max)
- Speak clearly and at a moderate pace for language learners
- If the user speaks Spanish, respond in Spanish and gently correct any mistakes
- If the user speaks English, respond in Spanish with a brief English translation
- Be encouraging and supportive of their learning journey
- Introduce new vocabulary naturally in conversation
- Use simple grammar appropriate for beginners (A1-A2 level)
- If asked, explain grammar rules simply

Start by greeting the user warmly in Spanish and asking how you can help them practice today.`,
    });
  }
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const session = new voice.AgentSession({
      llm: new google.beta.realtime.RealtimeModel({
        model: 'gemini-live-2.5-flash-preview-native-audio-09-2025',
        voice: 'Puck',
        temperature: 0.8,
      }),
    });

    await session.start({
      agent: new SpanishTutor(),
      room: ctx.room,
    });

    await ctx.connect();
  },
});

cli.runApp(
  new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'holaai-spanish-tutor',
  })
);
