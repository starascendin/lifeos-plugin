import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  voice,
} from '@livekit/agents';
import { z } from 'zod';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Convex API configuration
const CONVEX_URL = process.env.CONVEX_URL || 'https://beaming-giraffe-300.convex.site';
const TOOL_CALL_API_KEY = 'tool-call-secret-key-2024';

// Available tools on the backend
type ToolName =
  | 'get_todays_tasks'
  | 'get_projects'
  | 'get_tasks'
  | 'search_notes'
  | 'get_recent_notes'
  | 'create_quick_note'
  | 'add_tags_to_note';

/**
 * Call a tool on the Convex backend via the unified /tool-call endpoint
 */
async function callConvexTool(
  toolName: ToolName,
  userId: string,
  params?: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const url = `${CONVEX_URL}/tool-call`;
  console.log(`[VoiceAgent] Calling tool ${toolName} at:`, url);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TOOL_CALL_API_KEY,
      },
      body: JSON.stringify({
        tool: toolName,
        userId,
        params,
      }),
    });

    console.log('[VoiceAgent] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[VoiceAgent] Tool failed with response:', errorText);
      return { success: false, error: `API error: ${errorText}` };
    }

    const data = await response.json();
    console.log(`[VoiceAgent] Tool ${toolName} response:`, data.success ? 'success' : data.error);

    if (!data.success) {
      return { success: false, error: data.error };
    }

    return { success: true, result: data.result };
  } catch (error) {
    console.error('[VoiceAgent] Tool fetch error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Supported OpenAI models
const SUPPORTED_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-5-mini', 'gpt-4.1-mini', 'gpt-5.1-codex-mini'] as const;
type ModelId = (typeof SUPPORTED_MODELS)[number];

function isValidModel(model: string): model is ModelId {
  return SUPPORTED_MODELS.includes(model as ModelId);
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData.vad! as silero.VAD;

    // Connect first to receive participant info
    await ctx.connect();

    // Wait for the first participant (the user) to get their metadata
    const participant = await ctx.waitForParticipant();

    // Parse model and userId from participant metadata
    let selectedModel: ModelId = 'gpt-4o-mini'; // default
    let userId: string | undefined;
    try {
      console.log('[VoiceAgent] Raw participant metadata:', participant.metadata);
      if (participant.metadata) {
        const metadata = JSON.parse(participant.metadata);
        console.log('[VoiceAgent] Parsed metadata:', metadata);
        if (metadata.model && isValidModel(metadata.model)) {
          selectedModel = metadata.model;
        }
        if (metadata.userId) {
          userId = metadata.userId;
        }
      }
    } catch (e) {
      console.log('[VoiceAgent] Could not parse participant metadata, using default model. Error:', e);
    }

    console.log(`[VoiceAgent] Using model: ${selectedModel}, userId: ${userId || 'NOT PROVIDED - tools will fail!'}`);
    if (!userId) {
      console.warn('[VoiceAgent] WARNING: No userId in metadata. All tools requiring user context will return errors.');
    }

    // Create agent with tools
    const assistant = new voice.Agent({
      instructions: `You are a helpful voice AI assistant. You can help users manage their tasks, projects, and notes.

Available capabilities:
- Get today's tasks (tasks due today and top priority items)
- List projects with their status and completion stats
- Search and filter tasks by project, status, or priority
- Search voice notes by content
- Get recent voice notes
- Create quick notes to capture thoughts
- Add tags to notes for organization

Please be concise in your responses as this is voice interaction.`,
      tools: {
        // Tool 1: Get today's tasks
        get_my_todays_tasks: llm.tool({
          description: "Get the user's tasks for today. Returns tasks due today and top priority tasks with a summary.",
          parameters: z.object({}),
          execute: async () => {
            console.log('[VoiceAgent] Tool get_my_todays_tasks called');

            if (!userId) {
              console.error('[VoiceAgent] Tool failed: No userId available');
              return { error: 'User not authenticated. Cannot retrieve tasks.' };
            }

            const response = await callConvexTool('get_todays_tasks', userId);
            if (!response.success) {
              return { error: response.error };
            }
            return response.result;
          },
        }),

        // Tool 2: Get projects
        get_my_projects: llm.tool({
          description: "Get the user's projects with status and completion stats. Can optionally filter by project status.",
          parameters: z.object({
            status: z.enum(['planned', 'in_progress', 'paused', 'completed', 'cancelled']).optional()
              .describe('Optional: Filter projects by status'),
            includeArchived: z.boolean().optional()
              .describe('Optional: Include archived projects (default: false)'),
          }),
          execute: async (params) => {
            console.log('[VoiceAgent] Tool get_my_projects called with params:', params);

            if (!userId) {
              console.error('[VoiceAgent] Tool failed: No userId available');
              return { error: 'User not authenticated. Cannot retrieve projects.' };
            }

            const response = await callConvexTool('get_projects', userId, params);
            if (!response.success) {
              return { error: response.error };
            }
            return response.result;
          },
        }),

        // Tool 3: Get tasks with filters
        get_my_tasks: llm.tool({
          description: "Get the user's tasks with optional filters. Can filter by project, status, or priority.",
          parameters: z.object({
            projectId: z.string().optional()
              .describe('Optional: Filter by project ID'),
            status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']).optional()
              .describe('Optional: Filter by task status'),
            priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional()
              .describe('Optional: Filter by priority level'),
            limit: z.number().optional()
              .describe('Optional: Maximum number of tasks to return (default: 50, max: 100)'),
          }),
          execute: async (params) => {
            console.log('[VoiceAgent] Tool get_my_tasks called with params:', params);

            if (!userId) {
              console.error('[VoiceAgent] Tool failed: No userId available');
              return { error: 'User not authenticated. Cannot retrieve tasks.' };
            }

            const response = await callConvexTool('get_tasks', userId, params);
            if (!response.success) {
              return { error: response.error };
            }
            return response.result;
          },
        }),

        // Tool 4: Search notes
        search_my_notes: llm.tool({
          description: "Search the user's voice notes by content. Returns notes with matching transcripts.",
          parameters: z.object({
            query: z.string()
              .describe('Search terms to find in voice notes'),
            limit: z.number().optional()
              .describe('Optional: Maximum number of notes to return (default: 10, max: 50)'),
          }),
          execute: async (params) => {
            console.log('[VoiceAgent] Tool search_my_notes called with params:', params);

            if (!userId) {
              console.error('[VoiceAgent] Tool failed: No userId available');
              return { error: 'User not authenticated. Cannot search notes.' };
            }

            const response = await callConvexTool('search_notes', userId, params);
            if (!response.success) {
              return { error: response.error };
            }
            return response.result;
          },
        }),

        // Tool 5: Get recent notes
        get_my_recent_notes: llm.tool({
          description: "Get the user's most recent voice notes with their transcripts.",
          parameters: z.object({
            limit: z.number().optional()
              .describe('Optional: Number of notes to return (default: 5, max: 20)'),
          }),
          execute: async (params) => {
            console.log('[VoiceAgent] Tool get_my_recent_notes called with params:', params);

            if (!userId) {
              console.error('[VoiceAgent] Tool failed: No userId available');
              return { error: 'User not authenticated. Cannot retrieve notes.' };
            }

            const response = await callConvexTool('get_recent_notes', userId, params);
            if (!response.success) {
              return { error: response.error };
            }
            return response.result;
          },
        }),

        // Tool 6: Create quick note
        create_quick_note: llm.tool({
          description: "Create a quick text note to capture the user's thoughts. Use this when the user wants to save something they said as a note.",
          parameters: z.object({
            content: z.string()
              .describe('The content of the note to create'),
            tags: z.array(z.string()).optional()
              .describe('Optional: Tags for categorizing the note'),
          }),
          execute: async (params) => {
            console.log('[VoiceAgent] Tool create_quick_note called with params:', params);

            if (!userId) {
              console.error('[VoiceAgent] Tool failed: No userId available');
              return { error: 'User not authenticated. Cannot create note.' };
            }

            const response = await callConvexTool('create_quick_note', userId, params);
            if (!response.success) {
              return { error: response.error };
            }
            return response.result;
          },
        }),

        // Tool 7: Add tags to note
        add_tags_to_note: llm.tool({
          description: "Add tags to an existing note for better organization.",
          parameters: z.object({
            noteId: z.string()
              .describe('The ID of the note to add tags to'),
            tags: z.array(z.string())
              .describe('Tags to add to the note'),
          }),
          execute: async (params) => {
            console.log('[VoiceAgent] Tool add_tags_to_note called with params:', params);

            if (!userId) {
              console.error('[VoiceAgent] Tool failed: No userId available');
              return { error: 'User not authenticated. Cannot update note.' };
            }

            const response = await callConvexTool('add_tags_to_note', userId, params);
            if (!response.success) {
              return { error: response.error };
            }
            return response.result;
          },
        }),
      },
    });

    // Create session with dynamic model
    const session = new voice.AgentSession({
      vad,
      stt: new openai.STT(),
      llm: new openai.LLM({ model: selectedModel }),
      tts: new openai.TTS({ voice: 'alloy' }),
      turnDetection: new livekit.turnDetector.MultilingualModel(),
    });

    await session.start({
      agent: assistant,
      room: ctx.room,
      inputOptions: {
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });

    session.generateReply({
      instructions: `Greet the user briefly. Offer to help them with their tasks, projects, and notes - you can check today's tasks, list their projects, search for tasks, search or create notes, and more.`,
    });
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
