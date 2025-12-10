import { mutation } from "../_generated/server";
import { v } from "convex/values";
import {
  levels,
  categories,
  modules,
  lessons,
  categoryContent,
  lessonContent,
  getCategoryContent,
  getLessonContent,
} from "./seed-data";
import type { Id } from "../_generated/dataModel";

// Seed initial learning content for the app
export const seedContent = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existingLevels = await ctx.db.query("hola_contentLevels").collect();
    if (existingLevels.length > 0) {
      return { message: "Content already seeded", skipped: true };
    }

    // ==================== LEVELS ====================
    const levelIdMap: Record<string, Id<"hola_contentLevels">> = {};
    for (const level of levels) {
      const id = await ctx.db.insert("hola_contentLevels", {
        name: level.name,
        displayName: level.displayName,
        description: level.description,
        order: level.order,
      });
      levelIdMap[level.name] = id;
    }

    // ==================== CATEGORIES ====================
    const categoryIdMap: Record<string, Id<"hola_contentCategories">> = {};
    for (const category of categories) {
      const levelId = levelIdMap[category.levelName];
      if (!levelId) continue;

      const id = await ctx.db.insert("hola_contentCategories", {
        levelId,
        name: category.name,
        description: category.description,
        icon: category.icon,
        order: category.order,
      });
      // Key by "levelName:categoryName" for unique lookup
      categoryIdMap[`${category.levelName}:${category.name}`] = id;
    }

    // ==================== CATEGORY CONTENT ====================
    for (const content of categoryContent) {
      const categoryId = categoryIdMap[`${content.levelName}:${content.categoryName}`];
      if (!categoryId) continue;

      // Insert vocabulary
      if (content.vocabulary) {
        for (let i = 0; i < content.vocabulary.length; i++) {
          const vocab = content.vocabulary[i];
          await ctx.db.insert("hola_vocabularyItems", {
            categoryId,
            spanish: vocab.spanish,
            english: vocab.english,
            pronunciation: vocab.pronunciation,
            exampleSentence: vocab.exampleSentence,
            exampleTranslation: vocab.exampleTranslation,
            order: i + 1,
          });
        }
      }

      // Insert grammar rules
      if (content.grammar) {
        for (let i = 0; i < content.grammar.length; i++) {
          const grammar = content.grammar[i];
          await ctx.db.insert("hola_grammarRules", {
            categoryId,
            title: grammar.title,
            explanation: grammar.explanation,
            formula: grammar.formula,
            examples: grammar.examples,
            tips: grammar.tips || [],
            order: i + 1,
          });
        }
      }

      // Insert phrases
      if (content.phrases) {
        for (let i = 0; i < content.phrases.length; i++) {
          const phrase = content.phrases[i];
          await ctx.db.insert("hola_phrases", {
            categoryId,
            spanish: phrase.spanish,
            english: phrase.english,
            context: phrase.context,
            formalityLevel: phrase.formalityLevel || "neutral",
            order: i + 1,
          });
        }
      }

      // Insert exercises
      if (content.exercises) {
        for (let i = 0; i < content.exercises.length; i++) {
          const exercise = content.exercises[i];
          await ctx.db.insert("hola_exercises", {
            categoryId,
            type: exercise.type,
            question: exercise.question,
            options: exercise.options,
            correctAnswer: exercise.correctAnswer,
            explanation: exercise.explanation,
            questionSpanish: exercise.questionSpanish,
            difficulty: exercise.difficulty,
            order: i + 1,
          });
        }
      }

      // Insert matching exercise with pairs
      if (content.matchingExercise) {
        const matchingExerciseId = await ctx.db.insert("hola_exercises", {
          categoryId,
          type: "matching",
          question: content.matchingExercise.question,
          correctAnswer: "all_matched",
          difficulty: 1,
          order: (content.exercises?.length || 0) + 1,
        });

        for (let i = 0; i < content.matchingExercise.pairs.length; i++) {
          const pair = content.matchingExercise.pairs[i];
          await ctx.db.insert("hola_matchingPairs", {
            exerciseId: matchingExerciseId,
            spanish: pair.spanish,
            english: pair.english,
            order: i + 1,
          });
        }
      }
    }

    return {
      message: "Content seeded successfully",
      levels: levels.length,
      categories: categories.length,
      skipped: false,
    };
  },
});

// Seed A1 Learning Journey modules and lessons
export const seedA1Journey = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existingModules = await ctx.db.query("hola_learningModules").collect();
    if (existingModules.length > 0) {
      return { message: "A1 Journey already seeded", skipped: true };
    }

    // Get A1 level
    const a1Level = await ctx.db
      .query("hola_contentLevels")
      .filter((q) => q.eq(q.field("name"), "A1"))
      .first();

    if (!a1Level) {
      return { message: "A1 level not found. Please run seedContent first.", skipped: true };
    }

    // Get existing categories for A1
    const existingCategories = await ctx.db
      .query("hola_contentCategories")
      .withIndex("by_level", (q) => q.eq("levelId", a1Level._id))
      .collect();

    const categoryMap: Record<string, Id<"hola_contentCategories">> = {};
    for (const cat of existingCategories) {
      categoryMap[cat.name] = cat._id;
    }

    // Get all existing content by category
    const allVocab = await ctx.db.query("hola_vocabularyItems").collect();
    const allGrammar = await ctx.db.query("hola_grammarRules").collect();
    const allPhrases = await ctx.db.query("hola_phrases").collect();
    const allExercises = await ctx.db.query("hola_exercises").collect();

    // Group by category
    const vocabByCategory: Record<string, Id<"hola_vocabularyItems">[]> = {};
    const grammarByCategory: Record<string, Id<"hola_grammarRules">[]> = {};
    const phrasesByCategory: Record<string, Id<"hola_phrases">[]> = {};
    const exercisesByCategory: Record<string, Id<"hola_exercises">[]> = {};

    for (const cat of existingCategories) {
      vocabByCategory[cat.name] = allVocab
        .filter((v) => v.categoryId === cat._id)
        .map((v) => v._id);
      grammarByCategory[cat.name] = allGrammar
        .filter((g) => g.categoryId === cat._id)
        .map((g) => g._id);
      phrasesByCategory[cat.name] = allPhrases
        .filter((p) => p.categoryId === cat._id)
        .map((p) => p._id);
      exercisesByCategory[cat.name] = allExercises
        .filter((e) => e.categoryId === cat._id)
        .map((e) => e._id);
    }

    // ==================== MODULES ====================
    const moduleIdMap: Record<number, Id<"hola_learningModules">> = {};

    for (const module of modules) {
      // Resolve prerequisite IDs
      const prerequisites: Id<"hola_learningModules">[] = [];
      for (const prereqNum of module.prerequisiteModuleNumbers) {
        const prereqId = moduleIdMap[prereqNum];
        if (prereqId) {
          prerequisites.push(prereqId);
        }
      }

      const moduleId = await ctx.db.insert("hola_learningModules", {
        levelId: a1Level._id,
        moduleNumber: module.moduleNumber,
        title: module.title,
        description: module.description,
        estimatedHours: module.estimatedHours,
        prerequisites,
        order: module.order,
      });

      moduleIdMap[module.moduleNumber] = moduleId;
    }

    // ==================== LESSONS ====================
    for (const lesson of lessons) {
      const moduleId = moduleIdMap[lesson.moduleNumber];
      if (!moduleId) continue;

      // Resolve content references
      let vocabularyIds: Id<"hola_vocabularyItems">[] = [];
      let grammarIds: Id<"hola_grammarRules">[] = [];
      let phraseIds: Id<"hola_phrases">[] = [];
      let exerciseIds: Id<"hola_exercises">[] = [];

      const refs = (lesson as any).contentRefs;
      if (refs) {
        // Vocabulary
        if (refs.vocabularyCategory) {
          const vocabs = vocabByCategory[refs.vocabularyCategory] || [];
          if (refs.vocabularySlice) {
            vocabularyIds = vocabs.slice(refs.vocabularySlice[0], refs.vocabularySlice[1]);
          } else {
            vocabularyIds = vocabs;
          }
        }

        // Grammar
        if (refs.grammarCategory) {
          const grammars = grammarByCategory[refs.grammarCategory] || [];
          if (refs.grammarSlice) {
            grammarIds = grammars.slice(refs.grammarSlice[0], refs.grammarSlice[1]);
          } else {
            grammarIds = grammars;
          }
        }

        // Phrases
        if (refs.phraseCategory) {
          const phrases = phrasesByCategory[refs.phraseCategory] || [];
          if (refs.phraseSlice) {
            phraseIds = phrases.slice(refs.phraseSlice[0], refs.phraseSlice[1]);
          } else {
            phraseIds = phrases;
          }
        }

        // Exercises
        if (refs.exerciseCategory) {
          if (Array.isArray(refs.exerciseCategory)) {
            // Multiple categories
            for (const catName of refs.exerciseCategory) {
              exerciseIds = exerciseIds.concat(exercisesByCategory[catName] || []);
            }
          } else {
            const exercises = exercisesByCategory[refs.exerciseCategory] || [];
            if (refs.exerciseSlice) {
              exerciseIds = exercises.slice(refs.exerciseSlice[0], refs.exerciseSlice[1]);
            } else {
              exerciseIds = exercises;
            }
          }
        }
      }

      await ctx.db.insert("hola_moduleLessons", {
        moduleId,
        lessonNumber: lesson.lessonNumber,
        title: lesson.title,
        description: lesson.description,
        objectives: lesson.objectives,
        vocabularyIds,
        grammarIds,
        phraseIds,
        exerciseIds,
        isQuiz: lesson.isQuiz,
        estimatedMinutes: lesson.estimatedMinutes,
        order: lesson.order,
      });
    }

    return {
      message: "A1 Journey seeded successfully",
      modules: modules.length,
      skipped: false,
    };
  },
});

// Seed A1 Lesson Content - Populates empty lessons with vocabulary, grammar, phrases, exercises
export const seedA1LessonContent = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all modules
    const existingModules = await ctx.db.query("hola_learningModules").collect();
    if (existingModules.length === 0) {
      return { message: "No modules found. Run seedA1Journey first.", skipped: true };
    }

    // Get all lessons
    const existingLessons = await ctx.db.query("hola_moduleLessons").collect();

    // Get A1 level for category creation
    const a1Level = await ctx.db
      .query("hola_contentLevels")
      .filter((q) => q.eq(q.field("name"), "A1"))
      .first();

    if (!a1Level) {
      return { message: "A1 level not found", skipped: true };
    }

    // Create a general A1 category for lesson content
    let lessonContentCategory = await ctx.db
      .query("hola_contentCategories")
      .filter((q) => q.eq(q.field("name"), "Lesson Content"))
      .first();

    if (!lessonContentCategory) {
      const catId = await ctx.db.insert("hola_contentCategories", {
        levelId: a1Level._id,
        name: "Lesson Content",
        description: "Content for A1 learning journey lessons",
        icon: "book",
        order: 100,
      });
      lessonContentCategory = await ctx.db.get(catId);
    }

    const categoryId = lessonContentCategory!._id;
    const totalCreated = { vocabulary: 0, grammar: 0, phrases: 0, exercises: 0 };

    // Helper to find lesson by number
    const findLesson = (lessonNum: string) =>
      existingLessons.find((l) => l.lessonNumber === lessonNum);

    // Process each lesson content from JSON
    for (const content of lessonContent) {
      const lesson = findLesson(content.lessonNumber);
      if (!lesson) continue;

      // Check if lesson already has content
      const hasVocab = lesson.vocabularyIds.length > 0;
      const hasGrammar = lesson.grammarIds.length > 0;
      const hasPhrases = lesson.phraseIds.length > 0;
      const hasExercises = lesson.exerciseIds.length > 0;

      const vocabIds: Id<"hola_vocabularyItems">[] = [];
      const grammarIds: Id<"hola_grammarRules">[] = [];
      const phraseIds: Id<"hola_phrases">[] = [];
      const exerciseIds: Id<"hola_exercises">[] = [];

      // Insert vocabulary if lesson doesn't have any
      if (!hasVocab && content.vocabulary) {
        for (let i = 0; i < content.vocabulary.length; i++) {
          const vocab = content.vocabulary[i];
          const id = await ctx.db.insert("hola_vocabularyItems", {
            categoryId,
            spanish: vocab.spanish,
            english: vocab.english,
            pronunciation: vocab.pronunciation,
            exampleSentence: vocab.exampleSentence,
            exampleTranslation: vocab.exampleTranslation,
            order: i + 1,
          });
          vocabIds.push(id);
          totalCreated.vocabulary++;
        }
      }

      // Insert grammar if lesson doesn't have any
      if (!hasGrammar && content.grammar) {
        for (let i = 0; i < content.grammar.length; i++) {
          const grammar = content.grammar[i];
          const id = await ctx.db.insert("hola_grammarRules", {
            categoryId,
            title: grammar.title,
            explanation: grammar.explanation,
            formula: grammar.formula,
            examples: grammar.examples,
            tips: grammar.tips || [],
            order: i + 1,
          });
          grammarIds.push(id);
          totalCreated.grammar++;
        }
      }

      // Insert phrases if lesson doesn't have any
      if (!hasPhrases && content.phrases) {
        for (let i = 0; i < content.phrases.length; i++) {
          const phrase = content.phrases[i];
          const id = await ctx.db.insert("hola_phrases", {
            categoryId,
            spanish: phrase.spanish,
            english: phrase.english,
            context: phrase.context,
            formalityLevel: (phrase.formalityLevel as "formal" | "informal" | "neutral") || "neutral",
            order: i + 1,
          });
          phraseIds.push(id);
          totalCreated.phrases++;
        }
      }

      // Insert exercises if lesson doesn't have any
      if (!hasExercises && content.exercises) {
        for (let i = 0; i < content.exercises.length; i++) {
          const exercise = content.exercises[i];
          const id = await ctx.db.insert("hola_exercises", {
            categoryId,
            type: exercise.type,
            question: exercise.question,
            options: exercise.options,
            correctAnswer: exercise.correctAnswer,
            explanation: exercise.explanation,
            difficulty: exercise.difficulty,
            order: i + 1,
          });
          exerciseIds.push(id);
          totalCreated.exercises++;
        }
      }

      // Update lesson with new content IDs
      const updates: Partial<{
        vocabularyIds: Id<"hola_vocabularyItems">[];
        grammarIds: Id<"hola_grammarRules">[];
        phraseIds: Id<"hola_phrases">[];
        exerciseIds: Id<"hola_exercises">[];
      }> = {};

      if (vocabIds.length > 0) updates.vocabularyIds = vocabIds;
      if (grammarIds.length > 0) updates.grammarIds = grammarIds;
      if (phraseIds.length > 0) updates.phraseIds = phraseIds;
      if (exerciseIds.length > 0) updates.exerciseIds = exerciseIds;

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(lesson._id, updates);
      }
    }

    return {
      message: "A1 lesson content seeded successfully",
      created: totalCreated,
      skipped: false,
    };
  },
});

// Clear all seeded content (for development)
export const clearContent = mutation({
  args: { confirm: v.boolean() },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      return { message: "Pass confirm: true to clear all content" };
    }

    // Delete in reverse order of dependencies
    const tables = [
      // Journey tables
      "hola_certificates",
      "hola_testAttempts",
      "hola_practiceTests",
      "hola_writingPrompts",
      "hola_listeningDialogues",
      "hola_readingPassages",
      "hola_userModuleProgress",
      "hola_moduleLessons",
      "hola_learningModules",
      // Original tables
      "hola_matchingPairs",
      "hola_userExerciseProgress",
      "hola_exercises",
      "hola_userProgress",
      "hola_userLevelProgress",
      "hola_lessons",
      "hola_phrases",
      "hola_grammarRules",
      "hola_vocabularyItems",
      "hola_contentCategories",
      "hola_contentLevels",
      "hola_voiceConversations",
      "hola_bellaConversations",
      "hola_aiLessons",
    ] as const;

    const counts: Record<string, number> = {};

    for (const table of tables) {
      const items = await ctx.db.query(table).collect();
      counts[table] = items.length;
      for (const item of items) {
        await ctx.db.delete(item._id);
      }
    }

    return {
      message: "Content cleared successfully",
      deleted: counts,
    };
  },
});
