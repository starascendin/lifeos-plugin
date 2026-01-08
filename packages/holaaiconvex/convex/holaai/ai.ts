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
    sessionId: v.optional(v.id("hola_conversationSessions")),
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
      userId: args.userId,
      moduleId: args.moduleId,
      lessonId: args.lessonId,
      sessionId: args.sessionId,
      situation: args.situation,
      title: args.title,
      dialogue: args.dialogue,
      grammarHints: args.grammarHints,
      keyPhrases: args.keyPhrases,
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

// ==================== CONVERSATION SESSIONS ====================

/**
 * List all conversation sessions for a user
 */
export const listSessions = query({
  args: {
    userId: v.id("users"),
    moduleId: v.optional(v.id("hola_learningModules")),
  },
  handler: async (ctx, args) => {
    if (args.moduleId) {
      return await ctx.db
        .query("hola_conversationSessions")
        .withIndex("by_user_module", (q) =>
          q.eq("userId", args.userId).eq("moduleId", args.moduleId!)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("hola_conversationSessions")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

/**
 * Get a session with its conversations
 */
export const getSessionWithConversations = query({
  args: { sessionId: v.id("hola_conversationSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    // Fetch module info
    const module = await ctx.db.get(session.moduleId);

    // Fetch all conversations in this session
    const conversations = await ctx.db
      .query("hola_journeyConversations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    return { ...session, module, conversations };
  },
});

/**
 * Create a new session (internal)
 */
export const createSession = internalMutation({
  args: {
    userId: v.id("users"),
    moduleId: v.id("hola_learningModules"),
    lessonId: v.optional(v.id("hola_moduleLessons")),
    scenarioDescription: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"hola_conversationSessions">> => {
    const now = Date.now();
    return await ctx.db.insert("hola_conversationSessions", {
      userId: args.userId,
      moduleId: args.moduleId,
      lessonId: args.lessonId,
      scenarioDescription: args.scenarioDescription,
      title: args.title,
      conversationCount: 0,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Increment session conversation count (internal)
 */
export const incrementSessionConversationCount = internalMutation({
  args: { sessionId: v.id("hola_conversationSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await ctx.db.patch(args.sessionId, {
      conversationCount: session.conversationCount + 1,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Toggle session favorite
 */
export const toggleSessionFavorite = mutation({
  args: { sessionId: v.id("hola_conversationSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await ctx.db.patch(args.sessionId, {
      isFavorite: !session.isFavorite,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete a session and all its conversations
 */
export const deleteSession = mutation({
  args: { sessionId: v.id("hola_conversationSessions") },
  handler: async (ctx, args) => {
    // Delete all conversations in the session
    const conversations = await ctx.db
      .query("hola_journeyConversations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const conversation of conversations) {
      await ctx.db.delete(conversation._id);
    }

    // Delete the session
    await ctx.db.delete(args.sessionId);
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

// Generate AI Lesson using centralized AI service
export const generateLesson = action({
  args: {
    userId: v.id("users"),
    prompt: v.string(),
    level: v.string(), // "A1", "A2", "B1"
  },
  handler: async (ctx, args): Promise<{ lessonId: Id<"hola_aiLessons">; lesson: unknown }> => {
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

    // Use centralized AI service (handles credit check, AI call, and deduction)
    const result = await ctx.runAction(internal.common.ai.executeAICall, {
      request: {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: fullPrompt }],
        temperature: 0.7,
        responseFormat: "json",
      },
      context: {
        feature: "holaai_lesson",
        description: "AI Lesson generation",
      },
    });

    if (!result.content) {
      throw new Error("No content generated");
    }

    const lessonContent = JSON.parse(result.content);

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

// Generate Bella Conversation using centralized AI service
export const generateBellaConversation = action({
  args: {
    userId: v.id("users"),
    situation: v.string(),
    level: v.string(), // "A1", "A2"
  },
  handler: async (ctx, args): Promise<{ conversationId: Id<"hola_bellaConversations">; conversation: unknown }> => {
    const levelDescription =
      args.level === "A1"
        ? "beginner (use very simple vocabulary, short sentences, present tense only)"
        : "elementary (use common vocabulary, varied sentence structure, can include past tense)";

    const fullPrompt = `${BELLA_CONVERSATION_PROMPT}

Level: ${args.level} (${levelDescription})
Situation: ${args.situation}

Generate a natural conversation scenario in JSON format.`;

    // Use centralized AI service (handles credit check, AI call, and deduction)
    const result = await ctx.runAction(internal.common.ai.executeAICall, {
      request: {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: fullPrompt }],
        temperature: 0.8,
        responseFormat: "json",
      },
      context: {
        feature: "holaai_conversation",
        description: "Bella Conversation generation",
      },
    });

    if (!result.content) {
      throw new Error("No content generated");
    }

    const conversationContent = JSON.parse(result.content);

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
6. When a learner profile is provided, naturally incorporate the learner's background (name, profession, interests, learning goals) into the conversation where relevant

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

// Internal query to get learner profile for AI context
export const getLearnerProfileInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hola_learnerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// Generate Journey Conversation using centralized AI service (contextualized to module)
export const generateJourneyConversation = action({
  args: {
    userId: v.id("users"),
    moduleId: v.id("hola_learningModules"),
    lessonId: v.optional(v.id("hola_moduleLessons")),
    sessionId: v.optional(v.id("hola_conversationSessions")),
    situation: v.string(),
  },
  handler: async (ctx, args): Promise<{ conversationId: Id<"hola_journeyConversations">; sessionId: Id<"hola_conversationSessions">; conversation: unknown }> => {
    // Fetch module context
    const module = await ctx.runQuery(internal.holaai.ai.getModuleContextInternal, {
      moduleId: args.moduleId,
    });

    if (!module) {
      throw new Error("Module not found");
    }

    // Fetch learner profile for personalization
    const learnerProfile = await ctx.runQuery(internal.holaai.ai.getLearnerProfileInternal, {
      userId: args.userId,
    });

    // Build learner profile context if available
    let profileContext = "";
    if (learnerProfile && learnerProfile.isComplete) {
      profileContext = `\nLearner Profile:
- Name: ${learnerProfile.name}
- From: ${learnerProfile.origin}
- Profession: ${learnerProfile.profession}
- Interests: ${learnerProfile.interests.join(", ")}
- Learning Goal: ${learnerProfile.learningGoal}${learnerProfile.additionalContext ? `\n- Additional Context: ${learnerProfile.additionalContext}` : ""}

Personalize the conversation naturally for this learner. For example, if they're a software engineer interested in cooking, you might have them discuss tech or food topics. Use their name where appropriate.\n`;
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
${profileContext}
Module Context:
${contextInfo}

User's situation/scenario: ${args.situation}

Generate a natural A1-level conversation that uses vocabulary and concepts from the module context above. Keep it simple and practical.`;

    // Use centralized AI service (handles credit check, AI call, and deduction)
    const result = await ctx.runAction(internal.common.ai.executeAICall, {
      request: {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: fullPrompt }],
        temperature: 0.8,
        responseFormat: "json",
      },
      context: {
        feature: "holaai_conversation",
        description: "Journey Conversation generation",
      },
    });

    if (!result.content) {
      throw new Error("No content generated");
    }

    const conversationContent = JSON.parse(result.content);
    const conversationTitle = conversationContent.title || "Untitled Conversation";

    // Handle session: use existing or create new
    let sessionId = args.sessionId;
    if (!sessionId) {
      // Create a new session
      sessionId = await ctx.runMutation(internal.holaai.ai.createSession, {
        userId: args.userId,
        moduleId: args.moduleId,
        lessonId: args.lessonId,
        scenarioDescription: args.situation,
        title: conversationTitle,
      });
    }

    // Save conversation to database with session link
    const conversationId: Id<"hola_journeyConversations"> = await ctx.runMutation(internal.holaai.ai.saveJourneyConversation, {
      userId: args.userId,
      moduleId: args.moduleId,
      lessonId: args.lessonId,
      sessionId: sessionId,
      situation: args.situation,
      title: conversationTitle,
      dialogue: conversationContent.dialogue || [],
      grammarHints: conversationContent.grammarHints || [],
      keyPhrases: conversationContent.keyPhrases || [],
    });

    // Increment session conversation count
    await ctx.runMutation(internal.holaai.ai.incrementSessionConversationCount, {
      sessionId: sessionId,
    });

    return { conversationId, sessionId, conversation: conversationContent };
  },
});

// Prompt for generating scenario suggestions
const SUGGESTIONS_PROMPT = `You are a Spanish language learning assistant. Generate personalized conversation scenario suggestions for a learner.

Based on the learner's profile and the current learning module, suggest 3-5 realistic conversation scenarios they could practice.

Each suggestion should:
1. Be appropriate for A1 level (beginner) using simple vocabulary
2. Relate to the learner's interests, profession, or learning goals when possible
3. Be practical and useful for real-life situations
4. Incorporate vocabulary and topics from the learning module

Respond in JSON format:
{
  "suggestions": [
    {
      "title": "Short descriptive title (3-5 words)",
      "description": "Brief description of what the scenario involves (1 sentence)",
      "scenario": "Full situation description for AI conversation generation (2-3 sentences)"
    }
  ]
}`;

// Generate personalized scenario suggestions using centralized AI service
export const generateSuggestions = action({
  args: {
    userId: v.id("users"),
    moduleId: v.id("hola_learningModules"),
    context: v.union(v.literal("before_generation"), v.literal("after_conversation")),
  },
  handler: async (ctx, args): Promise<{ suggestions: Array<{ title: string; description: string; scenario: string }> }> => {
    // Fetch module context
    const module = await ctx.runQuery(internal.holaai.ai.getModuleContextInternal, {
      moduleId: args.moduleId,
    });

    if (!module) {
      throw new Error("Module not found");
    }

    // Fetch learner profile
    const learnerProfile = await ctx.runQuery(internal.holaai.ai.getLearnerProfileInternal, {
      userId: args.userId,
    });

    // Build profile context
    let profileContext = "";
    if (learnerProfile && learnerProfile.isComplete) {
      profileContext = `Learner Profile:
- Name: ${learnerProfile.name}
- From: ${learnerProfile.origin}
- Profession: ${learnerProfile.profession}
- Interests: ${learnerProfile.interests.join(", ")}
- Learning Goal: ${learnerProfile.learningGoal}${learnerProfile.additionalContext ? `\n- Additional Context: ${learnerProfile.additionalContext}` : ""}

Generate suggestions that are personally relevant to this learner's background and interests.\n\n`;
    }

    // Build module context
    let moduleContext = `Learning Module: ${module.title}\nDescription: ${module.description}\n`;
    if (module.sampleVocabulary && module.sampleVocabulary.length > 0) {
      moduleContext += `\nKey vocabulary: ${module.sampleVocabulary.map((v: { spanish: string }) => v.spanish).join(", ")}\n`;
    }

    const contextNote = args.context === "before_generation"
      ? "These are initial suggestions before the learner starts practicing."
      : "These are follow-up suggestions after the learner has completed a conversation.";

    const fullPrompt = `${SUGGESTIONS_PROMPT}

${profileContext}${moduleContext}

Context: ${contextNote}

Generate suggestions that would be engaging and useful for this specific learner.`;

    // Use centralized AI service (handles credit check, AI call, and deduction)
    const result = await ctx.runAction(internal.common.ai.executeAICall, {
      request: {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: fullPrompt }],
        temperature: 0.9,
        responseFormat: "json",
      },
      context: {
        feature: "holaai_suggestions",
        description: "Suggestion generation",
      },
    });

    if (!result.content) {
      throw new Error("No content generated");
    }

    const parsed = JSON.parse(result.content);

    return { suggestions: parsed.suggestions || [] };
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
