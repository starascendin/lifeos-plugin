import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

/**
 * Learning Journey Functions
 * Manages the structured A1 learning path with modules and lessons
 */

// ==================== QUERIES ====================

/**
 * List all modules for a level with user progress
 */
export const listModules = query({
  args: {
    levelId: v.id("hola_contentLevels"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const modules = await ctx.db
      .query("hola_learningModules")
      .withIndex("by_level_order", (q) => q.eq("levelId", args.levelId))
      .collect();

    if (!args.userId) {
      return modules.map((m) => ({
        ...m,
        progress: null,
        lessonsCount: 0,
        completedLessonsCount: 0,
      }));
    }

    // Get user progress for each module
    const modulesWithProgress = await Promise.all(
      modules.map(async (module) => {
        const progress = await ctx.db
          .query("hola_userModuleProgress")
          .withIndex("by_user_module", (q) =>
            q.eq("userId", args.userId!).eq("moduleId", module._id)
          )
          .first();

        // Count lessons in module
        const lessons = await ctx.db
          .query("hola_moduleLessons")
          .withIndex("by_module", (q) => q.eq("moduleId", module._id))
          .collect();

        return {
          ...module,
          progress,
          lessonsCount: lessons.length,
          completedLessonsCount: progress?.lessonsCompleted.length ?? 0,
        };
      })
    );

    return modulesWithProgress;
  },
});

/**
 * Get a single module with its lessons
 */
export const getModuleWithLessons = query({
  args: {
    moduleId: v.id("hola_learningModules"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const module = await ctx.db.get(args.moduleId);
    if (!module) return null;

    const lessons = await ctx.db
      .query("hola_moduleLessons")
      .withIndex("by_module_order", (q) => q.eq("moduleId", args.moduleId))
      .collect();

    let progress = null;
    if (args.userId) {
      progress = await ctx.db
        .query("hola_userModuleProgress")
        .withIndex("by_user_module", (q) =>
          q.eq("userId", args.userId!).eq("moduleId", args.moduleId)
        )
        .first();
    }

    // Get level info
    const level = await ctx.db.get(module.levelId);

    return {
      ...module,
      level,
      lessons: lessons.map((lesson) => ({
        ...lesson,
        isCompleted: progress?.lessonsCompleted.includes(lesson._id) ?? false,
      })),
      progress,
    };
  },
});

/**
 * Get full lesson content (vocabulary, grammar, phrases, exercises)
 */
export const getLessonContent = query({
  args: {
    lessonId: v.id("hola_moduleLessons"),
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) return null;

    // Fetch all related content
    const [vocabulary, grammar, phrases, exercises] = await Promise.all([
      Promise.all(lesson.vocabularyIds.map((id) => ctx.db.get(id))),
      Promise.all(lesson.grammarIds.map((id) => ctx.db.get(id))),
      Promise.all(lesson.phraseIds.map((id) => ctx.db.get(id))),
      Promise.all(lesson.exerciseIds.map((id) => ctx.db.get(id))),
    ]);

    // Get module info
    const module = await ctx.db.get(lesson.moduleId);

    return {
      ...lesson,
      module,
      vocabulary: vocabulary.filter(Boolean),
      grammar: grammar.filter(Boolean),
      phrases: phrases.filter(Boolean),
      exercises: exercises.filter(Boolean),
    };
  },
});

/**
 * Get user's journey progress for a level
 */
export const getUserJourneyProgress = query({
  args: {
    userId: v.id("users"),
    levelId: v.id("hola_contentLevels"),
  },
  handler: async (ctx, args) => {
    // Get all modules for level
    const modules = await ctx.db
      .query("hola_learningModules")
      .withIndex("by_level_order", (q) => q.eq("levelId", args.levelId))
      .collect();

    // Get progress for each module
    const moduleProgress = await Promise.all(
      modules.map(async (module) => {
        const progress = await ctx.db
          .query("hola_userModuleProgress")
          .withIndex("by_user_module", (q) =>
            q.eq("userId", args.userId).eq("moduleId", module._id)
          )
          .first();

        const lessons = await ctx.db
          .query("hola_moduleLessons")
          .withIndex("by_module", (q) => q.eq("moduleId", module._id))
          .collect();

        return {
          moduleId: module._id,
          moduleNumber: module.moduleNumber,
          title: module.title,
          totalLessons: lessons.length,
          completedLessons: progress?.lessonsCompleted.length ?? 0,
          quizScore: progress?.quizScore,
          isUnlocked: progress?.isUnlocked ?? module.moduleNumber === 1, // First module always unlocked
          isCompleted: progress?.completedAt != null,
        };
      })
    );

    // Calculate overall progress
    const totalLessons = moduleProgress.reduce((sum, m) => sum + m.totalLessons, 0);
    const completedLessons = moduleProgress.reduce((sum, m) => sum + m.completedLessons, 0);
    const completedModules = moduleProgress.filter((m) => m.isCompleted).length;

    return {
      levelId: args.levelId,
      modules: moduleProgress,
      totalModules: modules.length,
      completedModules,
      totalLessons,
      completedLessons,
      overallProgress: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    };
  },
});

/**
 * Get next lesson to study
 */
export const getNextLesson = query({
  args: {
    userId: v.id("users"),
    levelId: v.id("hola_contentLevels"),
  },
  handler: async (ctx, args) => {
    // Get all modules in order
    const modules = await ctx.db
      .query("hola_learningModules")
      .withIndex("by_level_order", (q) => q.eq("levelId", args.levelId))
      .collect();

    for (const module of modules) {
      // Check if module is unlocked
      const progress = await ctx.db
        .query("hola_userModuleProgress")
        .withIndex("by_user_module", (q) =>
          q.eq("userId", args.userId).eq("moduleId", module._id)
        )
        .first();

      const isUnlocked = progress?.isUnlocked ?? module.moduleNumber === 1;
      if (!isUnlocked) continue;

      // Get lessons in this module
      const lessons = await ctx.db
        .query("hola_moduleLessons")
        .withIndex("by_module_order", (q) => q.eq("moduleId", module._id))
        .collect();

      // Find first incomplete lesson
      for (const lesson of lessons) {
        const isCompleted = progress?.lessonsCompleted.includes(lesson._id) ?? false;
        if (!isCompleted) {
          return {
            lesson,
            module,
          };
        }
      }
    }

    return null; // All lessons completed
  },
});

// ==================== MUTATIONS ====================

/**
 * Initialize user progress for a level (call when user starts learning)
 */
export const initializeJourney = mutation({
  args: {
    userId: v.id("users"),
    levelId: v.id("hola_contentLevels"),
  },
  handler: async (ctx, args) => {
    // Get all modules for this level
    const modules = await ctx.db
      .query("hola_learningModules")
      .withIndex("by_level_order", (q) => q.eq("levelId", args.levelId))
      .collect();

    // Create progress records for each module
    for (const module of modules) {
      // Check if progress already exists
      const existing = await ctx.db
        .query("hola_userModuleProgress")
        .withIndex("by_user_module", (q) =>
          q.eq("userId", args.userId).eq("moduleId", module._id)
        )
        .first();

      if (!existing) {
        await ctx.db.insert("hola_userModuleProgress", {
          userId: args.userId,
          moduleId: module._id,
          lessonsCompleted: [],
          quizAttempts: 0,
          isUnlocked: module.moduleNumber === 1, // Only first module unlocked initially
        });
      }
    }

    return { success: true, modulesInitialized: modules.length };
  },
});

/**
 * Mark a lesson as completed
 */
export const completeLesson = mutation({
  args: {
    userId: v.id("users"),
    lessonId: v.id("hola_moduleLessons"),
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) throw new Error("Lesson not found");

    // Get or create progress for this module
    let progress = await ctx.db
      .query("hola_userModuleProgress")
      .withIndex("by_user_module", (q) =>
        q.eq("userId", args.userId).eq("moduleId", lesson.moduleId)
      )
      .first();

    if (!progress) {
      // Create progress if doesn't exist
      const progressId = await ctx.db.insert("hola_userModuleProgress", {
        userId: args.userId,
        moduleId: lesson.moduleId,
        lessonsCompleted: [args.lessonId],
        quizAttempts: 0,
        isUnlocked: true,
        startedAt: Date.now(),
      });
      progress = await ctx.db.get(progressId);
    } else if (!progress.lessonsCompleted.includes(args.lessonId)) {
      // Add lesson to completed list
      const updatedLessons = [...progress.lessonsCompleted, args.lessonId];
      await ctx.db.patch(progress._id, {
        lessonsCompleted: updatedLessons,
        startedAt: progress.startedAt ?? Date.now(),
      });
    }

    // Check if all lessons in module are completed
    const allLessons = await ctx.db
      .query("hola_moduleLessons")
      .withIndex("by_module", (q) => q.eq("moduleId", lesson.moduleId))
      .collect();

    const updatedProgress = await ctx.db.get(progress!._id);
    const allCompleted = allLessons.every((l) =>
      updatedProgress!.lessonsCompleted.includes(l._id)
    );

    if (allCompleted && !updatedProgress!.completedAt) {
      await ctx.db.patch(progress!._id, {
        completedAt: Date.now(),
      });
    }

    return {
      success: true,
      moduleCompleted: allCompleted,
    };
  },
});

/**
 * Submit quiz score and potentially unlock next module
 */
export const submitModuleQuiz = mutation({
  args: {
    userId: v.id("users"),
    moduleId: v.id("hola_learningModules"),
    score: v.number(), // 0-100
  },
  handler: async (ctx, args) => {
    const module = await ctx.db.get(args.moduleId);
    if (!module) throw new Error("Module not found");

    // Get user progress
    const progress = await ctx.db
      .query("hola_userModuleProgress")
      .withIndex("by_user_module", (q) =>
        q.eq("userId", args.userId).eq("moduleId", args.moduleId)
      )
      .first();

    if (!progress) throw new Error("User progress not found");

    // Update quiz score
    const newBestScore =
      progress.quizScore == null
        ? args.score
        : Math.max(progress.quizScore, args.score);

    await ctx.db.patch(progress._id, {
      quizScore: newBestScore,
      quizAttempts: progress.quizAttempts + 1,
    });

    // If passed (>=70%), unlock next module
    const passed = args.score >= 70;
    let nextModuleUnlocked = false;

    if (passed) {
      // Find next module
      const nextModule = await ctx.db
        .query("hola_learningModules")
        .withIndex("by_level_order", (q) => q.eq("levelId", module.levelId))
        .filter((q) => q.eq(q.field("moduleNumber"), module.moduleNumber + 1))
        .first();

      if (nextModule) {
        // Get or create progress for next module
        let nextProgress = await ctx.db
          .query("hola_userModuleProgress")
          .withIndex("by_user_module", (q) =>
            q.eq("userId", args.userId).eq("moduleId", nextModule._id)
          )
          .first();

        if (nextProgress) {
          if (!nextProgress.isUnlocked) {
            await ctx.db.patch(nextProgress._id, { isUnlocked: true });
            nextModuleUnlocked = true;
          }
        } else {
          await ctx.db.insert("hola_userModuleProgress", {
            userId: args.userId,
            moduleId: nextModule._id,
            lessonsCompleted: [],
            quizAttempts: 0,
            isUnlocked: true,
          });
          nextModuleUnlocked = true;
        }
      }
    }

    return {
      success: true,
      score: args.score,
      bestScore: newBestScore,
      passed,
      nextModuleUnlocked,
    };
  },
});

/**
 * Reset module progress (for retaking)
 */
export const resetModuleProgress = mutation({
  args: {
    userId: v.id("users"),
    moduleId: v.id("hola_learningModules"),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("hola_userModuleProgress")
      .withIndex("by_user_module", (q) =>
        q.eq("userId", args.userId).eq("moduleId", args.moduleId)
      )
      .first();

    if (progress) {
      await ctx.db.patch(progress._id, {
        lessonsCompleted: [],
        quizScore: undefined,
        quizAttempts: 0,
        startedAt: undefined,
        completedAt: undefined,
      });
    }

    return { success: true };
  },
});

// ==================== ADMIN MUTATIONS ====================

/**
 * Create a learning module (admin)
 */
export const createModule = mutation({
  args: {
    levelId: v.id("hola_contentLevels"),
    moduleNumber: v.number(),
    title: v.string(),
    description: v.string(),
    estimatedHours: v.optional(v.number()),
    prerequisites: v.array(v.id("hola_learningModules")),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("hola_learningModules", args);
  },
});

/**
 * Create a lesson within a module (admin)
 */
export const createLesson = mutation({
  args: {
    moduleId: v.id("hola_learningModules"),
    lessonNumber: v.string(),
    title: v.string(),
    description: v.string(),
    objectives: v.array(v.string()),
    vocabularyIds: v.array(v.id("hola_vocabularyItems")),
    grammarIds: v.array(v.id("hola_grammarRules")),
    phraseIds: v.array(v.id("hola_phrases")),
    exerciseIds: v.array(v.id("hola_exercises")),
    isQuiz: v.boolean(),
    estimatedMinutes: v.optional(v.number()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("hola_moduleLessons", args);
  },
});

/**
 * Batch create lessons (admin)
 */
export const createLessonsBatch = mutation({
  args: {
    lessons: v.array(
      v.object({
        moduleId: v.id("hola_learningModules"),
        lessonNumber: v.string(),
        title: v.string(),
        description: v.string(),
        objectives: v.array(v.string()),
        vocabularyIds: v.array(v.id("hola_vocabularyItems")),
        grammarIds: v.array(v.id("hola_grammarRules")),
        phraseIds: v.array(v.id("hola_phrases")),
        exerciseIds: v.array(v.id("hola_exercises")),
        isQuiz: v.boolean(),
        estimatedMinutes: v.optional(v.number()),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = await Promise.all(
      args.lessons.map((lesson) => ctx.db.insert("hola_moduleLessons", lesson))
    );
    return ids;
  },
});
