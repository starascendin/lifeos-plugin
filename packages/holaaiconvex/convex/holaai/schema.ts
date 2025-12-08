import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * HolaAI Spanish Learning App Tables
 * All tables prefixed with hola_ for clear ownership
 */
export const holaaiTables = {
  // ==================== LEARNING CONTENT ====================

  // Content levels: A1 (Beginner), A2 (Elementary), B1 (Intermediate), etc.
  hola_contentLevels: defineTable({
    name: v.string(), // e.g., "A1", "A2", "B1"
    displayName: v.string(), // e.g., "Beginner", "Elementary"
    description: v.string(),
    order: v.number(), // For sorting: 1, 2, 3...
  }).index("by_order", ["order"]),

  // Categories within each level: Grammar, Vocabulary, Scenarios, etc.
  hola_contentCategories: defineTable({
    levelId: v.id("hola_contentLevels"),
    name: v.string(), // e.g., "Grammar", "Vocabulary", "Restaurant"
    description: v.string(),
    icon: v.optional(v.string()), // Icon name for UI
    order: v.number(),
  })
    .index("by_level", ["levelId"])
    .index("by_level_order", ["levelId", "order"]),

  // Vocabulary items: Spanish words with translations
  hola_vocabularyItems: defineTable({
    categoryId: v.id("hola_contentCategories"),
    spanish: v.string(), // Spanish word/phrase
    english: v.string(), // English translation
    pronunciation: v.optional(v.string()), // Phonetic pronunciation
    exampleSentence: v.optional(v.string()), // Example usage in Spanish
    exampleTranslation: v.optional(v.string()), // Example translation
    audioUrl: v.optional(v.string()), // URL to audio file
    imageUrl: v.optional(v.string()), // URL to image
    difficulty: v.optional(v.number()), // 1-5 difficulty rating
    order: v.number(),
  })
    .index("by_category", ["categoryId"])
    .index("by_category_order", ["categoryId", "order"]),

  // Grammar rules with explanations
  hola_grammarRules: defineTable({
    categoryId: v.id("hola_contentCategories"),
    title: v.string(), // e.g., "Present Tense - Regular Verbs"
    explanation: v.string(), // Detailed explanation
    formula: v.optional(v.string()), // e.g., "verb stem + o/as/a/amos/áis/an"
    examples: v.array(
      v.object({
        spanish: v.string(),
        english: v.string(),
      })
    ),
    tips: v.array(v.string()), // Helpful tips
    order: v.number(),
  })
    .index("by_category", ["categoryId"])
    .index("by_category_order", ["categoryId", "order"]),

  // Common phrases
  hola_phrases: defineTable({
    categoryId: v.id("hola_contentCategories"),
    spanish: v.string(),
    english: v.string(),
    context: v.optional(v.string()), // When to use this phrase
    formalityLevel: v.optional(v.string()), // "formal", "informal", "neutral"
    audioUrl: v.optional(v.string()),
    order: v.number(),
  })
    .index("by_category", ["categoryId"])
    .index("by_category_order", ["categoryId", "order"]),

  // Lessons: Collections of content
  hola_lessons: defineTable({
    categoryId: v.id("hola_contentCategories"),
    title: v.string(),
    description: v.string(),
    vocabularyIds: v.array(v.id("hola_vocabularyItems")),
    grammarIds: v.array(v.id("hola_grammarRules")),
    phraseIds: v.array(v.id("hola_phrases")),
    estimatedMinutes: v.optional(v.number()),
    order: v.number(),
  })
    .index("by_category", ["categoryId"])
    .index("by_category_order", ["categoryId", "order"]),

  // ==================== USER PROGRESS ====================

  // Per-item progress tracking (spaced repetition)
  hola_userProgress: defineTable({
    userId: v.id("users"),
    contentType: v.string(), // "vocabulary", "grammar", "phrase"
    contentId: v.string(), // ID of the content item
    masteryLevel: v.number(), // 0-100 percentage
    timesPracticed: v.number(),
    correctCount: v.number(),
    incorrectCount: v.number(),
    lastPracticedAt: v.number(), // Timestamp
    nextReviewAt: v.number(), // Next review due timestamp
    easeFactor: v.number(), // SM-2 algorithm ease factor (default 2.5)
    interval: v.number(), // Current interval in days
  })
    .index("by_user", ["userId"])
    .index("by_user_content", ["userId", "contentType", "contentId"])
    .index("by_user_next_review", ["userId", "nextReviewAt"]),

  // Level progress summary
  hola_userLevelProgress: defineTable({
    userId: v.id("users"),
    levelId: v.id("hola_contentLevels"),
    vocabMastery: v.number(), // 0-100
    grammarMastery: v.number(), // 0-100
    phraseMastery: v.number(), // 0-100
    totalItemsStudied: v.number(),
    totalItemsAvailable: v.number(),
    lastStudiedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_level", ["userId", "levelId"]),

  // ==================== EXERCISES & QUIZZES ====================

  // Exercise definitions
  hola_exercises: defineTable({
    grammarRuleId: v.optional(v.id("hola_grammarRules")),
    categoryId: v.optional(v.id("hola_contentCategories")),
    type: v.string(), // "multiple_choice", "fill_blank", "matching", "translate"
    question: v.string(),
    questionSpanish: v.optional(v.string()), // Spanish version of question
    options: v.optional(v.array(v.string())), // For multiple choice
    correctAnswer: v.string(),
    explanation: v.optional(v.string()), // Explanation when answered
    difficulty: v.number(), // 1-5
    order: v.number(),
  })
    .index("by_grammar_rule", ["grammarRuleId"])
    .index("by_category", ["categoryId"])
    .index("by_type", ["type"]),

  // Matching pairs for matching exercises
  hola_matchingPairs: defineTable({
    exerciseId: v.id("hola_exercises"),
    spanish: v.string(),
    english: v.string(),
    order: v.number(),
  }).index("by_exercise", ["exerciseId"]),

  // User exercise attempts
  hola_userExerciseProgress: defineTable({
    userId: v.id("users"),
    exerciseId: v.id("hola_exercises"),
    attempts: v.number(),
    correctAttempts: v.number(),
    lastScore: v.number(), // 0-100
    bestScore: v.number(),
    lastAttemptedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_exercise", ["userId", "exerciseId"]),

  // ==================== AI GENERATED CONTENT ====================

  // AI-generated custom lessons
  hola_aiLessons: defineTable({
    userId: v.id("users"),
    title: v.string(),
    level: v.string(), // "A1", "A2", "B1"
    prompt: v.string(), // User's original prompt
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
    isFavorite: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_favorite", ["userId", "isFavorite"])
    .index("by_user_created", ["userId", "createdAt"]),

  // Bella AI conversation scenarios
  hola_bellaConversations: defineTable({
    userId: v.id("users"),
    level: v.string(), // "A1", "A2"
    situation: v.string(), // User's situation description
    title: v.string(), // Generated title
    dialogue: v.array(
      v.object({
        speaker: v.string(), // "A" or "B"
        speakerName: v.optional(v.string()), // e.g., "Waiter", "Customer"
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
    isFavorite: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_favorite", ["userId", "isFavorite"])
    .index("by_user_created", ["userId", "createdAt"]),

  // ==================== VOICE CONVERSATIONS ====================

  // Voice conversation sessions
  hola_voiceConversations: defineTable({
    userId: v.id("users"),
    provider: v.string(), // "gemini-live", "livekit"
    title: v.optional(v.string()),
    transcript: v.array(
      v.object({
        role: v.string(), // "user" or "assistant"
        content: v.string(),
        timestamp: v.number(),
      })
    ),
    duration: v.optional(v.number()), // Duration in seconds
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),
};
