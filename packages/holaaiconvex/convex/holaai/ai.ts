import { action, mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// ==================== AI LESSONS ====================

export const listAiLessons = query({
  args: {
    userId: v.id("users"),
    favoritesOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.favoritesOnly) {
      return await ctx.db
        .query("hola_aiLessons")
        .withIndex("by_user_favorite", (q) =>
          q.eq("userId", args.userId).eq("isFavorite", true)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("hola_aiLessons")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getAiLesson = query({
  args: { lessonId: v.id("hola_aiLessons") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.lessonId);
  },
});

export const saveAiLesson = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    level: v.string(),
    prompt: v.string(),
    content: v.object({
      vocabulary: v.array(
        v.object({
          spanish: v.string(),
          english: v.string(),
          exampleSentence: v.optional(v.string()),
        })
      ),
      grammarRules: v.array(
        v.object({
          title: v.string(),
          explanation: v.string(),
          examples: v.array(
            v.object({
              spanish: v.string(),
              english: v.string(),
            })
          ),
        })
      ),
      phrases: v.array(
        v.object({
          spanish: v.string(),
          english: v.string(),
          context: v.optional(v.string()),
        })
      ),
      exercises: v.optional(
        v.array(
          v.object({
            type: v.string(),
            question: v.string(),
            options: v.optional(v.array(v.string())),
            correctAnswer: v.string(),
          })
        )
      ),
    }),
    estimatedMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"hola_aiLessons">> => {
    return await ctx.db.insert("hola_aiLessons", {
      ...args,
      isFavorite: false,
      createdAt: Date.now(),
    });
  },
});

export const toggleAiLessonFavorite = mutation({
  args: { lessonId: v.id("hola_aiLessons") },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) throw new Error("Lesson not found");

    await ctx.db.patch(args.lessonId, {
      isFavorite: !lesson.isFavorite,
    });
  },
});

export const deleteAiLesson = mutation({
  args: { lessonId: v.id("hola_aiLessons") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.lessonId);
  },
});

// ==================== BELLA CONVERSATIONS ====================

export const listBellaConversations = query({
  args: {
    userId: v.id("users"),
    favoritesOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.favoritesOnly) {
      return await ctx.db
        .query("hola_bellaConversations")
        .withIndex("by_user_favorite", (q) =>
          q.eq("userId", args.userId).eq("isFavorite", true)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("hola_bellaConversations")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getBellaConversation = query({
  args: { conversationId: v.id("hola_bellaConversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

export const saveBellaConversation = internalMutation({
  args: {
    userId: v.id("users"),
    level: v.string(),
    situation: v.string(),
    title: v.string(),
    dialogue: v.array(
      v.object({
        speaker: v.string(),
        speakerName: v.optional(v.string()),
        spanish: v.string(),
        english: v.string(),
      })
    ),
    grammarHints: v.array(
      v.object({
        topic: v.string(),
        explanation: v.string(),
        examples: v.array(
          v.object({
            spanish: v.string(),
            english: v.string(),
          })
        ),
      })
    ),
    keyPhrases: v.array(
      v.object({
        spanish: v.string(),
        english: v.string(),
        usage: v.optional(v.string()),
      })
    ),
    responseVariations: v.optional(
      v.array(
        v.object({
          prompt: v.string(),
          formal: v.string(),
          informal: v.string(),
          polite: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args): Promise<Id<"hola_bellaConversations">> => {
    return await ctx.db.insert("hola_bellaConversations", {
      ...args,
      isFavorite: false,
      createdAt: Date.now(),
    });
  },
});

export const toggleBellaFavorite = mutation({
  args: { conversationId: v.id("hola_bellaConversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await ctx.db.patch(args.conversationId, {
      isFavorite: !conversation.isFavorite,
    });
  },
});

export const deleteBellaConversation = mutation({
  args: { conversationId: v.id("hola_bellaConversations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.conversationId);
  },
});

// ==================== JOURNEY CONVERSATIONS ====================

export const listJourneyConversations = query({
  args: {
    userId: v.id("users"),
    moduleId: v.optional(v.id("hola_learningModules")),
  },
  handler: async (ctx, args) => {
    if (args.moduleId) {
      const moduleIdVal = args.moduleId;
      return await ctx.db
        .query("hola_journeyConversations")
        .withIndex("by_user_module", (q) =>
          q.eq("userId", args.userId).eq("moduleId", moduleIdVal)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("hola_journeyConversations")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getJourneyConversation = query({
  args: { conversationId: v.id("hola_journeyConversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;

    // Also fetch module info for context
    const module = await ctx.db.get(conversation.moduleId);
    return { ...conversation, module };
  },
});

export const saveJourneyConversation = internalMutation({
  args: {
    userId: v.id("users"),
    moduleId: v.id("hola_learningModules"),
    lessonId: v.optional(v.id("hola_moduleLessons")),
    situation: v.string(),
    title: v.string(),
    dialogue: v.array(
      v.object({
        speaker: v.string(),
        speakerName: v.optional(v.string()),
        spanish: v.string(),
        english: v.string(),
      })
    ),
    grammarHints: v.array(
      v.object({
        topic: v.string(),
        explanation: v.string(),
        examples: v.array(
          v.object({
            spanish: v.string(),
            english: v.string(),
          })
        ),
      })
    ),
    keyPhrases: v.array(
      v.object({
        spanish: v.string(),
        english: v.string(),
        usage: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args): Promise<Id<"hola_journeyConversations">> => {
    return await ctx.db.insert("hola_journeyConversations", {
      ...args,
      isFavorite: false,
      createdAt: Date.now(),
    });
  },
});

export const toggleJourneyConversationFavorite = mutation({
  args: { conversationId: v.id("hola_journeyConversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await ctx.db.patch(args.conversationId, {
      isFavorite: !conversation.isFavorite,
    });
  },
});

export const deleteJourneyConversation = mutation({
  args: { conversationId: v.id("hola_journeyConversations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.conversationId);
  },
});

// ==================== AI GENERATION ACTIONS ====================

// Gemini API prompts
const LESSON_GENERATION_PROMPT = `You are a Spanish language learning assistant. Generate a comprehensive lesson based on the user's request.

The lesson should include:
1. Vocabulary (5-10 relevant words/phrases with translations and example sentences)
2. Grammar rules (1-3 relevant grammar points with explanations and examples)
3. Common phrases (3-5 useful phrases for the context)
4. Exercises (3-5 practice questions)

Respond in JSON format:
{
  "title": "Lesson title",
  "vocabulary": [
    { "spanish": "word", "english": "translation", "exampleSentence": "Example using the word" }
  ],
  "grammarRules": [
    {
      "title": "Rule title",
      "explanation": "Clear explanation",
      "examples": [{ "spanish": "Spanish example", "english": "English translation" }]
    }
  ],
  "phrases": [
    { "spanish": "phrase", "english": "translation", "context": "When to use" }
  ],
  "exercises": [
    { "type": "multiple_choice", "question": "Question text", "options": ["a", "b", "c", "d"], "correctAnswer": "correct option" }
  ],
  "estimatedMinutes": 15
}`;

const BELLA_CONVERSATION_PROMPT = `You are a Spanish language learning assistant. Generate a realistic conversation scenario based on the user's situation.

The conversation should:
1. Be appropriate for the specified level (A1=basic, A2=elementary)
2. Include natural dialogue between two speakers
3. Highlight useful grammar structures
4. Include key phrases to memorize

Respond in JSON format:
{
  "title": "Conversation title",
  "dialogue": [
    { "speaker": "A", "speakerName": "Name/Role", "spanish": "Spanish text", "english": "English translation" }
  ],
  "grammarHints": [
    {
      "topic": "Grammar topic",
      "explanation": "How it's used in the conversation",
      "examples": [{ "spanish": "Example", "english": "Translation" }]
    }
  ],
  "keyPhrases": [
    { "spanish": "Key phrase", "english": "Translation", "usage": "When to use this" }
  ],
  "responseVariations": [
    { "prompt": "How to respond to...", "formal": "Formal response", "informal": "Casual response", "polite": "Polite alternative" }
  ]
}`;

// Generate AI Lesson using Gemini
export const generateLesson = action({
  args: {
    userId: v.id("users"),
    prompt: v.string(),
    level: v.string(), // "A1", "A2", "B1"
  },
  handler: async (ctx, args): Promise<{ lessonId: Id<"hola_aiLessons">; lesson: unknown }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const levelDescription =
      args.level === "A1"
        ? "beginner (very basic vocabulary and simple present tense)"
        : args.level === "A2"
          ? "elementary (common vocabulary and basic past/future tenses)"
          : "intermediate (varied vocabulary and complex grammar)";

    const fullPrompt = `${LESSON_GENERATION_PROMPT}

Level: ${args.level} (${levelDescription})
User request: ${args.prompt}

Generate the lesson in JSON format.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("No content generated");
    }

    const lessonContent = JSON.parse(content);

    // Save to database
    const lessonId: Id<"hola_aiLessons"> = await ctx.runMutation(internal.holaai.ai.saveAiLesson, {
      userId: args.userId,
      title: lessonContent.title || "Untitled Lesson",
      level: args.level,
      prompt: args.prompt,
      content: {
        vocabulary: lessonContent.vocabulary || [],
        grammarRules: lessonContent.grammarRules || [],
        phrases: lessonContent.phrases || [],
        exercises: lessonContent.exercises || [],
      },
      estimatedMinutes: lessonContent.estimatedMinutes || 15,
    });

    return { lessonId, lesson: lessonContent };
  },
});

// Generate Bella Conversation using Gemini
export const generateBellaConversation = action({
  args: {
    userId: v.id("users"),
    situation: v.string(),
    level: v.string(), // "A1", "A2"
  },
  handler: async (ctx, args): Promise<{ conversationId: Id<"hola_bellaConversations">; conversation: unknown }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const levelDescription =
      args.level === "A1"
        ? "beginner (use very simple vocabulary, short sentences, present tense only)"
        : "elementary (use common vocabulary, varied sentence structure, can include past tense)";

    const fullPrompt = `${BELLA_CONVERSATION_PROMPT}

Level: ${args.level} (${levelDescription})
Situation: ${args.situation}

Generate a natural conversation scenario in JSON format.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.8,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("No content generated");
    }

    const conversationContent = JSON.parse(content);

    // Save to database
    const conversationId: Id<"hola_bellaConversations"> = await ctx.runMutation(internal.holaai.ai.saveBellaConversation, {
      userId: args.userId,
      level: args.level,
      situation: args.situation,
      title: conversationContent.title || "Untitled Conversation",
      dialogue: conversationContent.dialogue || [],
      grammarHints: conversationContent.grammarHints || [],
      keyPhrases: conversationContent.keyPhrases || [],
      responseVariations: conversationContent.responseVariations || [],
    });

    return { conversationId, conversation: conversationContent };
  },
});

// Prompt for Journey Conversations (contextualized to module)
const JOURNEY_CONVERSATION_PROMPT = `You are a Spanish language learning assistant. Generate a realistic conversation scenario based on the user's situation.

The conversation should:
1. Be appropriate for A1 level (beginner) using simple vocabulary and short sentences
2. Incorporate the vocabulary and phrases from the learning module context provided
3. Include natural dialogue between two speakers
4. Highlight useful grammar structures relevant to the module
5. Include key phrases to memorize

Respond in JSON format:
{
  "title": "Conversation title",
  "dialogue": [
    { "speaker": "A", "speakerName": "Name/Role", "spanish": "Spanish text", "english": "English translation" }
  ],
  "grammarHints": [
    {
      "topic": "Grammar topic",
      "explanation": "How it's used in the conversation",
      "examples": [{ "spanish": "Example", "english": "Translation" }]
    }
  ],
  "keyPhrases": [
    { "spanish": "Key phrase", "english": "Translation", "usage": "When to use this" }
  ]
}`;

// Generate Journey Conversation using Gemini (contextualized to module)
export const generateJourneyConversation = action({
  args: {
    userId: v.id("users"),
    moduleId: v.id("hola_learningModules"),
    lessonId: v.optional(v.id("hola_moduleLessons")),
    situation: v.string(),
  },
  handler: async (ctx, args): Promise<{ conversationId: Id<"hola_journeyConversations">; conversation: unknown }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Fetch module context
    const module = await ctx.runQuery(internal.holaai.ai.getModuleContextInternal, {
      moduleId: args.moduleId,
    });

    if (!module) {
      throw new Error("Module not found");
    }

    // Build context string from module vocabulary and phrases
    let contextInfo = `Module: ${module.title}\nDescription: ${module.description}\n`;

    if (module.sampleVocabulary && module.sampleVocabulary.length > 0) {
      contextInfo += `\nKey Vocabulary from this module:\n`;
      module.sampleVocabulary.forEach((v: { spanish: string; english: string }) => {
        contextInfo += `- ${v.spanish} (${v.english})\n`;
      });
    }

    if (module.samplePhrases && module.samplePhrases.length > 0) {
      contextInfo += `\nKey Phrases from this module:\n`;
      module.samplePhrases.forEach((p: { spanish: string; english: string }) => {
        contextInfo += `- ${p.spanish} (${p.english})\n`;
      });
    }

    const fullPrompt = `${JOURNEY_CONVERSATION_PROMPT}

Module Context:
${contextInfo}

User's situation/scenario: ${args.situation}

Generate a natural A1-level conversation that uses vocabulary and concepts from the module context above. Keep it simple and practical.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.8,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("No content generated");
    }

    const conversationContent = JSON.parse(content);

    // Save to database
    const conversationId: Id<"hola_journeyConversations"> = await ctx.runMutation(internal.holaai.ai.saveJourneyConversation, {
      userId: args.userId,
      moduleId: args.moduleId,
      lessonId: args.lessonId,
      situation: args.situation,
      title: conversationContent.title || "Untitled Conversation",
      dialogue: conversationContent.dialogue || [],
      grammarHints: conversationContent.grammarHints || [],
      keyPhrases: conversationContent.keyPhrases || [],
    });

    return { conversationId, conversation: conversationContent };
  },
});

// Helper function to fetch module context
async function fetchModuleContext(ctx: any, moduleId: Id<"hola_learningModules">) {
  const module = await ctx.db.get(moduleId);
  if (!module) return null;

  // Get lessons for this module
  const lessons = await ctx.db
    .query("hola_moduleLessons")
    .withIndex("by_module", (q: any) => q.eq("moduleId", moduleId))
    .collect();

  // Collect vocabulary IDs from lessons
  const vocabIds: Id<"hola_vocabularyItems">[] = [];
  const phraseIds: Id<"hola_phrases">[] = [];

  for (const lesson of lessons) {
    vocabIds.push(...lesson.vocabularyIds);
    phraseIds.push(...lesson.phraseIds);
  }

  // Fetch sample vocabulary (limit to 10)
  const sampleVocabulary = await Promise.all(
    vocabIds.slice(0, 10).map((id) => ctx.db.get(id))
  );

  // Fetch sample phrases (limit to 5)
  const samplePhrases = await Promise.all(
    phraseIds.slice(0, 5).map((id) => ctx.db.get(id))
  );

  return {
    ...module,
    sampleVocabulary: sampleVocabulary.filter(Boolean).map((v: any) => ({
      spanish: v!.spanish,
      english: v!.english,
    })),
    samplePhrases: samplePhrases.filter(Boolean).map((p: any) => ({
      spanish: p!.spanish,
      english: p!.english,
    })),
  };
}

// Internal query to get module context for AI generation (used by actions)
export const getModuleContextInternal = internalQuery({
  args: { moduleId: v.id("hola_learningModules") },
  handler: async (ctx, args) => {
    return fetchModuleContext(ctx, args.moduleId);
  },
});

// Public query to get module context (used by frontend)
export const getModuleContext = query({
  args: { moduleId: v.id("hola_learningModules") },
  handler: async (ctx, args) => {
    return fetchModuleContext(ctx, args.moduleId);
  },
});

// Text-to-Speech using Gemini (returns audio URL or base64)
export const textToSpeech = action({
  args: {
    text: v.string(),
    language: v.optional(v.string()), // "es" for Spanish, "en" for English
  },
  handler: async (_ctx, args) => {
    // For now, we'll use a simpler approach
    // In production, you could use Google Cloud TTS or another service
    // The React Native app can use expo-speech for on-device TTS

    // Return the text to be spoken - the client will handle TTS
    return {
      text: args.text,
      language: args.language || "es",
      // If we had Cloud TTS, we'd return:
      // audioUrl: "...",
      // audioBase64: "...",
    };
  },
});
