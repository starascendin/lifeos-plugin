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

  // ==================== LEARNER PROFILE ====================

  // Learner profile for personalized AI conversations
  hola_learnerProfiles: defineTable({
    userId: v.id("users"),
    name: v.string(), // Learner's name
    origin: v.string(), // Where they're from
    profession: v.string(), // Occupation/profession
    interests: v.array(v.string()), // Hobbies and interests
    learningGoal: v.string(), // Why learning Spanish / in Argentina
    additionalContext: v.optional(v.string()), // Any other relevant info
    isComplete: v.boolean(), // Whether onboarding is complete
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

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

  // Conversation sessions: groups of related AI conversations
  hola_conversationSessions: defineTable({
    userId: v.id("users"),
    moduleId: v.id("hola_learningModules"),
    lessonId: v.optional(v.id("hola_moduleLessons")),
    scenarioDescription: v.string(), // The original scenario/situation
    title: v.string(), // Generated or user-provided title
    conversationCount: v.number(), // Number of conversations in session
    isFavorite: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_module", ["userId", "moduleId"])
    .index("by_user_created", ["userId", "createdAt"]),

  // Journey-specific AI conversations (contextualized to modules/lessons)
  hola_journeyConversations: defineTable({
    userId: v.id("users"),
    moduleId: v.id("hola_learningModules"), // Which module context
    lessonId: v.optional(v.id("hola_moduleLessons")), // Which lesson context (optional)
    sessionId: v.optional(v.id("hola_conversationSessions")), // Parent session (optional for backwards compatibility)
    situation: v.string(), // User's scenario description
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
    isFavorite: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_module", ["userId", "moduleId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_session", ["sessionId"]),

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

  // ==================== LEARNING JOURNEY (A1 Test Prep) ====================

  // Learning modules: 7 structured modules for A1 curriculum
  hola_learningModules: defineTable({
    levelId: v.id("hola_contentLevels"),
    moduleNumber: v.number(), // 1-7
    title: v.string(), // e.g., "Foundations", "Present Tense & Description"
    description: v.string(),
    estimatedHours: v.optional(v.number()),
    prerequisites: v.array(v.id("hola_learningModules")), // Module IDs that must be completed first
    order: v.number(),
  })
    .index("by_level", ["levelId"])
    .index("by_level_order", ["levelId", "order"]),

  // Lessons within modules
  hola_moduleLessons: defineTable({
    moduleId: v.id("hola_learningModules"),
    lessonNumber: v.string(), // e.g., "1.1", "1.2", "2.1"
    title: v.string(),
    description: v.string(),
    objectives: v.array(v.string()), // Learning objectives
    vocabularyIds: v.array(v.id("hola_vocabularyItems")),
    grammarIds: v.array(v.id("hola_grammarRules")),
    phraseIds: v.array(v.id("hola_phrases")),
    exerciseIds: v.array(v.id("hola_exercises")),
    isQuiz: v.boolean(), // True for module checkpoint quizzes
    estimatedMinutes: v.optional(v.number()),
    order: v.number(),
  })
    .index("by_module", ["moduleId"])
    .index("by_module_order", ["moduleId", "order"]),

  // User progress through modules
  hola_userModuleProgress: defineTable({
    userId: v.id("users"),
    moduleId: v.id("hola_learningModules"),
    lessonsCompleted: v.array(v.id("hola_moduleLessons")),
    quizScore: v.optional(v.number()), // 0-100, null if quiz not taken
    quizAttempts: v.number(), // Number of quiz attempts
    isUnlocked: v.boolean(), // Whether user can access this module
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_module", ["userId", "moduleId"]),

  // Interactive lesson learning sessions
  hola_lessonSessions: defineTable({
    userId: v.id("users"),
    lessonId: v.id("hola_moduleLessons"),
    status: v.string(), // "in_progress" | "completed"
    currentStageIndex: v.number(), // Which stage user is on
    stages: v.array(
      v.object({
        id: v.string(),
        type: v.string(), // "intro" | "teach_vocab" | "drill_vocab" | etc.
        title: v.string(),
        contentIds: v.array(v.string()),
        isCompleted: v.boolean(),
        drillTypes: v.optional(v.array(v.string())),
      })
    ),
    itemMastery: v.any(), // Record<contentId, { correctCount, isMastered, attempts }>
    startedAt: v.number(),
    lastActivityAt: v.number(),
    completedAt: v.optional(v.number()),
    sessionStats: v.object({
      totalDrills: v.number(),
      correctDrills: v.number(),
      hintsUsed: v.number(),
      totalTimeSpent: v.number(), // seconds
    }),
  })
    .index("by_user", ["userId"])
    .index("by_user_lesson", ["userId", "lessonId"])
    .index("by_user_status", ["userId", "status"]),

  // ==================== PRACTICE TESTS ====================

  // Practice test definitions
  hola_practiceTests: defineTable({
    levelId: v.id("hola_contentLevels"),
    testNumber: v.string(), // "1", "2", "mock"
    title: v.string(), // e.g., "A1 Practice Test 1", "A1 Mock Exam"
    description: v.string(),
    duration: v.number(), // Duration in minutes
    sections: v.array(
      v.object({
        type: v.string(), // "listening", "reading", "grammar", "writing", "speaking"
        title: v.string(),
        points: v.number(),
        questionIds: v.array(v.string()), // IDs of questions (exercise IDs, passage IDs, etc.)
      })
    ),
    passingScore: v.number(), // Minimum score to pass (e.g., 70)
    order: v.number(),
  })
    .index("by_level", ["levelId"])
    .index("by_level_order", ["levelId", "order"]),

  // User test attempts
  hola_testAttempts: defineTable({
    userId: v.id("users"),
    testId: v.id("hola_practiceTests"),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    timeSpent: v.optional(v.number()), // Actual time spent in seconds
    sectionScores: v.array(
      v.object({
        section: v.string(),
        score: v.number(),
        maxScore: v.number(),
        answers: v.optional(
          v.array(
            v.object({
              questionId: v.string(),
              answer: v.string(),
              isCorrect: v.optional(v.boolean()),
            })
          )
        ),
      })
    ),
    totalScore: v.number(),
    passed: v.boolean(),
    feedback: v.optional(v.string()), // AI-generated feedback for writing
  })
    .index("by_user", ["userId"])
    .index("by_user_test", ["userId", "testId"])
    .index("by_user_completed", ["userId", "completedAt"]),

  // ==================== ENHANCED EXERCISE TYPES ====================

  // Reading comprehension passages
  hola_readingPassages: defineTable({
    categoryId: v.optional(v.id("hola_contentCategories")),
    levelId: v.id("hola_contentLevels"),
    title: v.string(),
    content: v.string(), // Spanish text passage
    contentEnglish: v.optional(v.string()), // English translation (for reference)
    difficulty: v.number(), // 1-5
    wordCount: v.optional(v.number()),
    questions: v.array(
      v.object({
        question: v.string(), // Question in Spanish or English
        questionSpanish: v.optional(v.string()),
        options: v.array(v.string()),
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
        points: v.number(),
      })
    ),
    order: v.number(),
  })
    .index("by_level", ["levelId"])
    .index("by_category", ["categoryId"]),

  // Listening comprehension dialogues
  hola_listeningDialogues: defineTable({
    categoryId: v.optional(v.id("hola_contentCategories")),
    levelId: v.id("hola_contentLevels"),
    title: v.string(),
    audioUrl: v.optional(v.string()), // Pre-recorded audio URL
    usesTTS: v.boolean(), // Whether to generate audio via TTS
    transcript: v.array(
      v.object({
        speaker: v.string(), // "Speaker 1", "Speaker 2", or name
        spanish: v.string(),
        english: v.string(),
      })
    ),
    context: v.optional(v.string()), // Scene description
    questions: v.array(
      v.object({
        question: v.string(),
        options: v.array(v.string()),
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
        points: v.number(),
      })
    ),
    difficulty: v.number(),
    order: v.number(),
  })
    .index("by_level", ["levelId"])
    .index("by_category", ["categoryId"]),

  // Writing prompts
  hola_writingPrompts: defineTable({
    categoryId: v.optional(v.id("hola_contentCategories")),
    levelId: v.id("hola_contentLevels"),
    promptType: v.string(), // "form", "email", "paragraph"
    title: v.string(),
    instructions: v.string(), // What to write
    instructionsSpanish: v.optional(v.string()),
    requirements: v.array(v.string()), // e.g., "Include your name", "Mention 2 family members"
    sampleAnswer: v.string(), // Example good response
    rubric: v.array(
      v.object({
        criteria: v.string(), // e.g., "Grammar accuracy"
        points: v.number(),
        description: v.optional(v.string()),
      })
    ),
    maxPoints: v.number(),
    difficulty: v.number(),
    order: v.number(),
  })
    .index("by_level", ["levelId"])
    .index("by_category", ["categoryId"])
    .index("by_type", ["promptType"]),

  // ==================== CERTIFICATES ====================

  // User certificates
  hola_certificates: defineTable({
    userId: v.id("users"),
    levelId: v.id("hola_contentLevels"),
    testId: v.id("hola_practiceTests"),
    attemptId: v.id("hola_testAttempts"),
    score: v.number(),
    grade: v.string(), // "Advanced A1", "Standard A1", "Minimal A1"
    earnedAt: v.number(),
    certificateUrl: v.optional(v.string()), // URL to generated certificate image/PDF
  })
    .index("by_user", ["userId"])
    .index("by_user_level", ["userId", "levelId"]),
};
