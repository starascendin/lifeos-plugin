# HolaAI Content Generation & Learning Journey Analysis

## Overview

This document explains how the HolaAI Spanish learning app handles:
1. Seed scripts and what they create
2. AI content generation (where/how)
3. Data storage structure

---

## 1. Seed Scripts

**Location**: `packages/holaaiconvex/convex/holaai/seed.ts` (~2,100 lines)

### 4 Seed Mutations Available:

#### a) `seedContent`
Creates foundational content structure:
- **Levels**: A1 (Beginner), A2 (Elementary), B1 (Intermediate)
- **Categories per level**: Greetings, Numbers, Food & Drinks, Family, Travel
- **Vocabulary items**: Spanish words with English translations, pronunciations, example sentences
- **Grammar rules**: Explanations with formulas and examples
- **Phrases**: Common Spanish phrases with context and formality levels
- **Exercises**: Multiple choice, fill-in-blank, matching, translation

#### b) `seedA1Journey`
Creates the structured A1 learning journey with **7 modules containing 26+ lessons**:

| Module | Title | Lessons |
|--------|-------|---------|
| 1 | Foundations | Alphabet, Greetings, Numbers 0-20, Basic Sentences |
| 2 | Present Tense | SER, ESTAR, -AR Verbs, -ER/-IR Verbs, Articles, Describing People |
| 3 | Daily Life & Time | Days/Months, Telling Time, Weather, TENER |
| 4 | Family | Family Vocab, Possessives, "Having"/"Being", IR |
| 5 | Food | Food Vocab, GUSTAR, Restaurant Ordering, Review |
| 6 | Places | City Locations, Prepositions, Origin, Directions |
| 7 | Review | Common Mistakes, Consolidation |

Each lesson contains references to:
- `vocabularyIds` - array of vocabulary items
- `grammarIds` - array of grammar rules
- `phraseIds` - array of phrases
- `exerciseIds` - array of exercises
- `objectives` - learning goals
- `estimatedMinutes` - time estimate

#### c) `seedA1LessonContent`
Populates detailed content for specific lessons (16 lessons covered):
- Vocabulary for each lesson topic
- Grammar rules with detailed explanations
- Contextual phrases
- Practice exercises

#### d) `clearContent`
Utility to clear all seeded content in reverse dependency order.

### Seed Data Hierarchy:
```
Levels (A1, A2, B1)
├── Categories (Greetings, Numbers, Food, etc.)
│   ├── Vocabulary Items
│   ├── Grammar Rules
│   ├── Phrases
│   └── Exercises
└── Learning Modules (7 for A1)
    └── Module Lessons (1.1, 1.2, etc.)
        ├── vocabularyIds[]
        ├── grammarIds[]
        ├── phraseIds[]
        └── exerciseIds[]
```

---

## 2. AI Content Generation

**Location**: `packages/holaaiconvex/convex/holaai/ai.ts`

### AI Service Used: **Google Gemini API**
- **Model**: `gemini-2.0-flash` for content generation
- **TTS Model**: `gemini-2.5-flash-preview-tts` for audio
- Environment variable: `GEMINI_API_KEY`

### Generation Types:

#### A. `generateLesson` (lines 524-595)
Generates custom lessons based on user prompts.

**Prompt template** (`LESSON_GENERATION_PROMPT`):
- Creates vocabulary (5-10 words)
- Grammar rules (1-3)
- Common phrases (3-5)
- Exercises (3-5)
- Estimated learning time

**Temperature**: 0.7 (structured)

#### B. `generateBellaConversation` (lines 598-664)
Generates conversation practice scenarios.

**Output**:
- Dialogue between two speakers (Spanish/English)
- Grammar hints with explanations
- Key phrases to memorize
- Response variations (formal/informal/polite)

**Temperature**: 0.8 (balanced)

#### C. `generateJourneyConversation` (lines 707-836)
Generates personalized conversations tied to learning journey.

**Personalization**:
- Fetches learner profile (name, profession, interests, goals)
- Incorporates module vocabulary and phrases
- Creates scenario-specific conversations

**Temperature**: 0.8 (balanced)

#### D. `generateSuggestions` (lines 861-947)
Generates 3-5 personalized conversation practice scenarios.

**Temperature**: 0.9 (creative)

#### E. Text-to-Speech (`packages/holaaiconvex/convex/common/tts.ts`)
- Model: Gemini 2.5 Flash Preview TTS
- Voice: "Kore" (Spanish-friendly)
- Output: Base64-encoded PCM (24kHz, mono, 16-bit)

### Generation Flow:
```
1. User calls Convex action (e.g., generateLesson)
2. Action validates GEMINI_API_KEY
3. Constructs level-appropriate prompt
4. Calls Gemini API with responseMimeType: "application/json"
5. Parses JSON response
6. (Optional) Fetches learner profile for personalization
7. Calls internal mutation to save content
8. Returns content ID to client
```

---

## 3. Data Storage (Schema)

**Location**: `packages/holaaiconvex/convex/holaai/schema.ts`

### AI-Generated Content Tables:

#### `hola_aiLessons`
```typescript
{
  userId: v.id("users"),
  title: v.string(),
  level: v.string(),  // A1, A2, B1
  prompt: v.string(),
  content: v.object({
    vocabulary: v.array({spanish, english, exampleSentence}),
    grammarRules: v.array({title, explanation, examples}),
    phrases: v.array({spanish, english, context}),
    exercises: v.array({type, question, options, correctAnswer})
  }),
  estimatedMinutes: v.number(),
  isFavorite: v.boolean(),
  createdAt: v.number()
}
// Indexes: by_user, by_user_favorite, by_user_created
```

#### `hola_bellaConversations`
```typescript
{
  userId: v.id("users"),
  level: v.string(),
  situation: v.string(),
  title: v.string(),
  dialogue: v.array({speaker, speakerName, spanish, english}),
  grammarHints: v.array({...}),
  keyPhrases: v.array({spanish, english, usage}),
  responseVariations: v.array({prompt, formal, informal, polite}),
  isFavorite: v.boolean(),
  createdAt: v.number()
}
// Indexes: by_user, by_user_favorite, by_user_created
```

#### `hola_journeyConversations`
```typescript
{
  userId: v.id("users"),
  moduleId: v.id("hola_learningModules"),
  lessonId: v.optional(v.id("hola_moduleLessons")),
  sessionId: v.id("hola_conversationSessions"),
  situation: v.string(),
  title: v.string(),
  dialogue: v.array({...}),
  grammarHints: v.array({...}),
  keyPhrases: v.array({...}),
  isFavorite: v.boolean(),
  createdAt: v.number()
}
// Indexes: by_user, by_user_module, by_user_created, by_session
```

#### `hola_conversationSessions`
```typescript
{
  userId: v.id("users"),
  moduleId: v.id("hola_learningModules"),
  lessonId: v.optional(v.id("hola_moduleLessons")),
  scenarioDescription: v.string(),
  title: v.string(),
  conversationCount: v.number(),
  isFavorite: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number()
}
```

#### `hola_voiceConversations`
```typescript
{
  userId: v.id("users"),
  provider: v.string(),  // "gemini-live" | "livekit"
  title: v.optional(v.string()),
  transcript: v.array({role, content, timestamp}),
  duration: v.number(),
  createdAt: v.number()
}
```

### Seeded Content Tables:

#### `hola_contentLevels`
Proficiency levels (A1, A2, B1)

#### `hola_contentCategories`
Categories within levels (Grammar, Vocabulary, Scenarios)

#### `hola_vocabularyItems`
```typescript
{
  categoryId: v.id("hola_contentCategories"),
  spanish: v.string(),
  english: v.string(),
  pronunciation: v.optional(v.string()),
  exampleSentence: v.optional(v.string()),
  audioUrl: v.optional(v.string()),
  difficulty: v.number(),
  tags: v.optional(v.array(v.string()))
}
```

#### `hola_grammarRules`
```typescript
{
  categoryId: v.id("hola_contentCategories"),
  title: v.string(),
  explanation: v.string(),
  formula: v.optional(v.string()),
  examples: v.array({spanish, english, highlight}),
  difficulty: v.number()
}
```

#### `hola_phrases`
```typescript
{
  categoryId: v.id("hola_contentCategories"),
  spanish: v.string(),
  english: v.string(),
  context: v.string(),
  formality: v.string(),  // "formal" | "informal" | "neutral"
  difficulty: v.number()
}
```

#### `hola_exercises`
```typescript
{
  categoryId: v.optional(v.id("hola_contentCategories")),
  grammarRuleId: v.optional(v.id("hola_grammarRules")),
  type: v.string(),  // "multiple_choice" | "fill_blank" | "matching" | "translate"
  question: v.string(),
  options: v.optional(v.array(v.string())),
  correctAnswer: v.string(),
  explanation: v.optional(v.string()),
  difficulty: v.number()
}
```

#### `hola_learningModules`
```typescript
{
  levelId: v.id("hola_contentLevels"),
  moduleNumber: v.number(),
  title: v.string(),
  description: v.string(),
  prerequisites: v.array(v.id("hola_learningModules")),
  estimatedHours: v.number(),
  order: v.number()
}
```

#### `hola_moduleLessons`
```typescript
{
  moduleId: v.id("hola_learningModules"),
  lessonNumber: v.string(),  // "1.1", "1.2", etc.
  title: v.string(),
  description: v.string(),
  objectives: v.array(v.string()),
  vocabularyIds: v.array(v.id("hola_vocabularyItems")),
  grammarIds: v.array(v.id("hola_grammarRules")),
  phraseIds: v.array(v.id("hola_phrases")),
  exerciseIds: v.array(v.id("hola_exercises")),
  isQuiz: v.boolean(),
  estimatedMinutes: v.number(),
  order: v.number()
}
```

### User Progress Tables:

#### `hola_userProgress`
SM-2 spaced repetition tracking per vocabulary/grammar/phrase item:
- `masteryLevel` (0-100)
- `easeFactor`, `interval`, `nextReviewAt` (spaced repetition)
- `timesPracticed`, `correctCount`, `incorrectCount`

#### `hola_userModuleProgress`
A1 journey progress:
- `lessonsCompleted` (array of lesson IDs)
- `quizScore`, `quizAttempts`
- `isUnlocked` (70% quiz score unlocks next module)

#### `hola_learnerProfiles`
Personalization data:
- `name`, `origin`, `profession`
- `interests` (array)
- `learningGoal`, `additionalContext`

---

## Key File Locations

| Component | File Path |
|-----------|-----------|
| Seed Scripts | `packages/holaaiconvex/convex/holaai/seed.ts` |
| AI Actions | `packages/holaaiconvex/convex/holaai/ai.ts` |
| TTS Generation | `packages/holaaiconvex/convex/common/tts.ts` |
| Voice/LiveKit | `packages/holaaiconvex/convex/holaai/voice.ts` |
| Learner Profiles | `packages/holaaiconvex/convex/holaai/profile.ts` |
| Learning Journey | `packages/holaaiconvex/convex/holaai/journey.ts` |
| Schema (HolaAI) | `packages/holaaiconvex/convex/holaai/schema.ts` |
| Master Schema | `packages/holaaiconvex/convex/schema.ts` |

---

## Summary

### Seed Scripts:
- **Create** 7 structured A1 modules with 26+ lessons
- **Populate** vocabulary, grammar, phrases, exercises
- **Do NOT** use AI - all content is hardcoded in the seed file

### AI Generation:
- **Google Gemini 2.0 Flash** for content
- **Generates on-demand**: lessons, conversations, suggestions
- **Personalized** using learner profiles
- **Stored** in separate AI content tables

### Storage:
- **Seeded content**: `hola_learningModules`, `hola_moduleLessons`, `hola_vocabularyItems`, etc.
- **AI-generated content**: `hola_aiLessons`, `hola_bellaConversations`, `hola_journeyConversations`
- **Progress tracking**: `hola_userProgress` (spaced repetition), `hola_userModuleProgress` (journey)
