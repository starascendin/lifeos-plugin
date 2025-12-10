// Types for seed data structures

export interface VocabularyItemData {
  spanish: string;
  english: string;
  pronunciation?: string;
  exampleSentence?: string;
  exampleTranslation?: string;
}

export interface GrammarRuleData {
  title: string;
  explanation: string;
  formula?: string;
  examples: Array<{ spanish: string; english: string; highlight?: string }>;
  tips?: string[];
}

export interface PhraseData {
  spanish: string;
  english: string;
  context?: string;
  formalityLevel?: "formal" | "informal" | "neutral";
}

export interface ExerciseData {
  type: "multiple_choice" | "fill_blank" | "matching" | "translate";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  questionSpanish?: string;
  difficulty: number;
}

export interface MatchingPairData {
  spanish: string;
  english: string;
}

export interface LevelData {
  name: string;
  displayName: string;
  description: string;
  order: number;
}

export interface CategoryData {
  levelName: string; // Reference to level by name
  name: string;
  description: string;
  icon: string;
  order: number;
}

export interface ModuleData {
  moduleNumber: number;
  title: string;
  description: string;
  estimatedHours: number;
  prerequisiteModuleNumbers: number[]; // Reference by module number
  order: number;
}

export interface ModuleLessonData {
  moduleNumber: number; // Reference to module
  lessonNumber: string;
  title: string;
  description: string;
  objectives: string[];
  isQuiz: boolean;
  estimatedMinutes: number;
  order: number;
  // Content references - will be resolved at runtime
  vocabularyRefs?: string[]; // Reference by category name or "lesson:X.X" for lesson-specific
  grammarRefs?: string[]; // Reference by title or index
  phraseRefs?: string[]; // Reference by category name
  exerciseRefs?: string[]; // Reference by category name
}

// Lesson-specific content that gets created during seedA1LessonContent
export interface LessonContentData {
  lessonNumber: string;
  vocabulary?: VocabularyItemData[];
  grammar?: GrammarRuleData[];
  phrases?: PhraseData[];
  exercises?: ExerciseData[];
}

// Content organized by category for seedContent
export interface CategoryContentData {
  categoryName: string;
  levelName: string;
  vocabulary?: VocabularyItemData[];
  grammar?: GrammarRuleData[];
  phrases?: PhraseData[];
  exercises?: ExerciseData[];
  matchingExercise?: {
    question: string;
    pairs: MatchingPairData[];
  };
}

// Full seed data structure
export interface SeedContentData {
  levels: LevelData[];
  categories: CategoryData[];
  categoryContent: CategoryContentData[];
}

export interface SeedA1JourneyData {
  modules: ModuleData[];
  lessons: ModuleLessonData[];
}

export interface SeedA1LessonContentData {
  lessonContent: LessonContentData[];
}
