// Export all seed data
import levelsData from "./levels.json";
import categoriesData from "./categories.json";
import modulesData from "./modules.json";
import lessonsData from "./lessons.json";
import lessonContentData from "./lesson-content.json";

// Category content files
import contentA1Greetings from "./content-a1-greetings.json";
import contentA1Numbers from "./content-a1-numbers.json";
import contentA1Food from "./content-a1-food.json";
import contentA2Travel from "./content-a2-travel.json";

import type {
  LevelData,
  CategoryData,
  ModuleData,
  CategoryContentData,
  LessonContentData,
} from "./types";

// Typed exports
export const levels: LevelData[] = levelsData.levels;
export const categories: CategoryData[] = categoriesData.categories;
export const modules: ModuleData[] = modulesData.modules;
export const lessons = lessonsData.lessons;
export const lessonContent = lessonContentData.lessonContent as LessonContentData[];

// Category content combined
export const categoryContent: CategoryContentData[] = [
  contentA1Greetings as CategoryContentData,
  contentA1Numbers as CategoryContentData,
  contentA1Food as CategoryContentData,
  contentA2Travel as CategoryContentData,
];

// Helper to get category content by name
export function getCategoryContent(categoryName: string, levelName: string): CategoryContentData | undefined {
  return categoryContent.find(
    (c) => c.categoryName === categoryName && c.levelName === levelName
  );
}

// Helper to get lesson content by lesson number
export function getLessonContent(lessonNumber: string): LessonContentData | undefined {
  return lessonContent.find((l) => l.lessonNumber === lessonNumber);
}

// Re-export types
export * from "./types";
