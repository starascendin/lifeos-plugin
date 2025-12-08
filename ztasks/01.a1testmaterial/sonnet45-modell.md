I'll help you design this systematically. Let me break this down into a clear product structure with data models and content generation prompts.

---

## Phase 1: Core Product Architecture

### High-Level Flow

```
User Journey:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   LESSONS   │ ──► │   DRILLS    │ ──► │    QUIZ     │
│  (Learn)    │     │  (Practice) │     │   (Test)    │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      └───────────────────┴───────────────────┘
                          │
                    ┌─────▼─────┐
                    │  PROGRESS │
                    │  UNLOCK   │
                    └───────────┘
```

---

## Phase 2: Data Models

### Learning Structure Hierarchy

```
Level (A1, A2, B1...)
  └── Module (7 modules in A1)
        └── Lesson (5-8 lessons per module)
              ├── Content Sections
              ├── Vocabulary Items
              └── Grammar Points
                    │
                    ▼
              Drill Pool (linked to lesson)
                    │
                    ▼
              Quiz (end of lesson/module)
```

### Core Models

```typescript
// ========== LEARNING CONTENT MODELS ==========

interface Level {
  id: string;                    // "a1", "a2"
  name: string;                  // "A1 - Beginner"
  description: string;
  order: number;
  modules: Module[];
  isLocked: boolean;
}

interface Module {
  id: string;                    // "a1-m1"
  levelId: string;
  name: string;                  // "Foundations"
  description: string;
  order: number;
  lessons: Lesson[];
  isLocked: boolean;
  unlockRequirement: {
    type: "lesson_complete" | "quiz_score";
    targetId: string;
    minScore?: number;           // for quiz_score type
  };
}

interface Lesson {
  id: string;                    // "a1-m1-l1"
  moduleId: string;
  title: string;                 // "Greetings & Introductions"
  description: string;
  order: number;
  estimatedMinutes: number;
  
  // Content
  objectives: string[];          // Learning objectives
  sections: LessonSection[];
  vocabulary: VocabularyItem[];
  grammarPoints: GrammarPoint[];
  
  // Linked drills & quiz
  drillPoolId: string;
  quizId: string;
  
  // Progression
  isLocked: boolean;
  unlockRequirement: {
    type: "lesson_complete";
    lessonId: string;
  } | null;                      // null for first lesson
}

interface LessonSection {
  id: string;
  type: "explanation" | "example" | "pronunciation" | "cultural_note";
  title: string;
  content: string;               // Markdown supported
  audioUrl?: string;             // For pronunciation
  examples?: {
    spanish: string;
    english: string;
    pronunciation?: string;      // Phonetic guide
  }[];
}

interface VocabularyItem {
  id: string;
  lessonId: string;
  spanish: string;
  english: string;
  pronunciation: string;         // Phonetic: "OH-lah"
  partOfSpeech: "noun" | "verb" | "adjective" | "adverb" | "phrase" | "other";
  gender?: "masculine" | "feminine";
  context?: string;              // Usage note
  exampleSentence: {
    spanish: string;
    english: string;
  };
  audioUrl?: string;
  difficulty: 1 | 2 | 3;         // For spaced repetition
}

interface GrammarPoint {
  id: string;
  lessonId: string;
  title: string;                 // "SER Conjugation"
  explanation: string;           // Markdown
  formula?: string;              // "Es la(s) + [hora] + (y/menos) + [minutos]"
  table?: {
    headers: string[];
    rows: string[][];
  };
  examples: {
    spanish: string;
    english: string;
    highlight?: string;          // Part to emphasize
  }[];
  commonMistakes?: {
    wrong: string;
    correct: string;
    explanation: string;
  }[];
}

// ========== DRILL MODELS ==========

interface DrillPool {
  id: string;
  lessonId: string;
  drills: Drill[];
}

interface Drill {
  id: string;
  poolId: string;
  type: DrillType;
  difficulty: 1 | 2 | 3;
  points: number;
  
  // Content varies by type
  content: DrillContent;
  
  // Metadata for adaptive learning
  skillsTested: string[];        // ["vocabulary", "ser_conjugation"]
  averageTimeSeconds: number;
}

type DrillType = 
  | "multiple_choice"
  | "fill_blank"
  | "matching"
  | "word_order"
  | "translation_select"
  | "listening_select"
  | "dialogue_response";

type DrillContent = 
  | MultipleChoiceContent
  | FillBlankContent
  | MatchingContent
  | WordOrderContent
  | TranslationSelectContent
  | ListeningSelectContent
  | DialogueResponseContent;

interface MultipleChoiceContent {
  question: string;
  questionAudio?: string;
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
  explanation: string;           // Shown after answer
}

interface FillBlankContent {
  sentence: string;              // "Yo ___ ingeniero" (use ___ for blank)
  blankIndex: number;            // Position in sentence
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
  correctAnswer: string;
  explanation: string;
}

interface MatchingContent {
  instruction: string;
  pairs: {
    id: string;
    left: string;                // Spanish
    right: string;               // English
  }[];
  // App shuffles right side for user
}

interface WordOrderContent {
  instruction: string;
  targetSentence: string;        // Correct order
  words: string[];               // Shuffled words
  translation: string;           // English meaning
}

interface TranslationSelectContent {
  sourceText: string;            // English to translate
  options: {
    id: string;
    text: string;                // Spanish options
    isCorrect: boolean;
  }[];
  explanation: string;
}

interface ListeningSelectContent {
  audioUrl: string;
  question: string;              // "What did you hear?"
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
  transcript: string;            // Shown after
}

interface DialogueResponseContent {
  context: string;               // "You meet someone at a café"
  prompt: {                      // What the other person says
    text: string;
    audioUrl?: string;
  };
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
    isAcceptable: boolean;       // Some responses are ok but not best
  }[];
  explanation: string;
}

// ========== QUIZ MODEL ==========

interface Quiz {
  id: string;
  lessonId?: string;             // null for module/level quizzes
  moduleId?: string;
  type: "lesson" | "module" | "certification";
  title: string;
  passingScore: number;          // Percentage (70, 80, etc.)
  timeLimit?: number;            // Minutes, null for untimed
  questions: QuizQuestion[];
}

interface QuizQuestion {
  id: string;
  quizId: string;
  type: DrillType;               // Same types as drills
  content: DrillContent;
  points: number;
  order: number;
}

// ========== USER PROGRESS MODELS ==========

interface UserProgress {
  userId: string;
  currentLevel: string;
  currentModule: string;
  currentLesson: string;
  
  // Completed items
  completedLessons: string[];
  completedModules: string[];
  
  // Scores
  quizScores: {
    quizId: string;
    score: number;
    completedAt: Date;
    attempts: number;
  }[];
  
  // Drill performance (for adaptive learning)
  drillHistory: {
    drillId: string;
    correct: boolean;
    timeSpent: number;
    attemptedAt: Date;
  }[];
  
  // Vocabulary mastery (spaced repetition)
  vocabularyMastery: {
    vocabId: string;
    level: 0 | 1 | 2 | 3 | 4 | 5; // 0=new, 5=mastered
    nextReviewDate: Date;
    correctStreak: number;
  }[];
  
  // Stats
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  totalTimeMinutes: number;
}
```

---

## Phase 3: Progression System

### Unlock Logic

```typescript
// Progression Rules

const PROGRESSION_RULES = {
  // To unlock next lesson
  lessonUnlock: {
    requirePreviousLesson: true,
    requireQuizScore: 70,        // % on lesson quiz
  },
  
  // To unlock next module
  moduleUnlock: {
    requireAllLessons: true,
    requireModuleQuizScore: 75,
  },
  
  // To unlock certification test
  certificationUnlock: {
    requireAllModules: true,
    requirePracticeTests: 2,     // Must complete 2 practice tests
    minPracticeScore: 70,
  },
  
  // XP rewards
  xp: {
    lessonComplete: 50,
    drillCorrect: 10,
    quizPass: 100,
    perfectQuiz: 50,             // Bonus for 100%
    streakBonus: 25,             // Daily streak
  }
};
```

### Session Flow

```
User opens app
      │
      ▼
┌─────────────────┐
│ Show Progress   │
│ Dashboard       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Continue Lesson │◄─── Current lesson in progress
│       OR        │
│ Start New       │◄─── If previous complete
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ LESSON VIEW     │
│ - Read sections │
│ - Study vocab   │
│ - Learn grammar │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ DRILL SESSION   │
│ 10-15 drills    │
│ Adaptive order  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ LESSON QUIZ     │
│ 10 questions    │
│ Need 70% pass   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
   PASS      FAIL
    │         │
    ▼         ▼
 Unlock    Review &
  Next     Retry
```

---

## Phase 4: A1 Content Structure

Based on your spec, here's the organized A1 content:

```
A1 LEVEL
│
├── Module 1: Foundations (Fundamentos)
│   ├── L1.1: Spanish Alphabet & Pronunciation
│   ├── L1.2: Greetings & Introductions
│   ├── L1.3: Numbers 0-20
│   ├── L1.4: Basic Sentence Structure
│   └── Module 1 Quiz
│
├── Module 2: Present Tense & Description
│   ├── L2.1: Verb SER (permanent)
│   ├── L2.2: Verb ESTAR (temporary/location)
│   ├── L2.3: Regular -AR Verbs
│   ├── L2.4: Regular -ER/-IR Verbs
│   ├── L2.5: Articles & Gender Agreement
│   ├── L2.6: Describing People & Things
│   └── Module 2 Quiz
│
├── Module 3: Daily Life & Time
│   ├── L3.1: Days, Months, Seasons
│   ├── L3.2: Telling Time
│   ├── L3.3: Daily Routines
│   ├── L3.4: Irregular Verb TENER
│   ├── L3.5: Expressing Age & Possession
│   └── Module 3 Quiz
│
├── Module 4: Family & Relationships
│   ├── L4.1: Family Vocabulary
│   ├── L4.2: Possessive Adjectives
│   ├── L4.3: Describing Family Members
│   ├── L4.4: Irregular Verb IR
│   └── Module 4 Quiz
│
├── Module 5: Food & Preferences
│   ├── L5.1: Food & Drink Vocabulary
│   ├── L5.2: GUSTAR (likes/dislikes)
│   ├── L5.3: Restaurant Conversations
│   ├── L5.4: Ordering Food
│   └── Module 5 Quiz
│
├── Module 6: Places & Directions
│   ├── L6.1: City Locations
│   ├── L6.2: Prepositions of Place
│   ├── L6.3: Nationality & Origin
│   ├── L6.4: Asking for Directions
│   └── Module 6 Quiz
│
├── Module 7: Review & Integration
│   ├── L7.1: Grammar Review
│   ├── L7.2: Real-world Conversations
│   ├── L7.3: Common Mistakes
│   └── Module 7 Quiz
│
└── A1 Certification
    ├── Practice Test 1
    ├── Practice Test 2
    └── Final Certification Test
```

---

## Phase 5: AI Content Generation Prompts

### Master System Prompt

```markdown
# Spanish A1 Content Generator

You are an expert Spanish language curriculum designer creating content for a mobile-first language learning app. Your content must be:

1. **CEFR A1 Aligned**: Vocabulary within 500-1000 most common words, simple grammar structures only
2. **Mobile-Optimized**: Multiple choice preferred, short text, clear formatting
3. **Progressive**: Each lesson builds on previous content
4. **Practical**: Real-world scenarios learners will actually encounter
5. **Consistent**: Follow exact JSON schemas provided

## A1 Scope Constraints:
- Verbs: Present tense only (regular + key irregulars: ser, estar, tener, ir, hacer, querer, poder, gustar)
- Vocabulary: Common everyday words, no specialized terminology
- Sentences: Simple and compound only, no complex clauses
- Topics: Personal info, daily life, family, food, directions, basic transactions

## Voice & Tone:
- Clear, encouraging explanations
- Pronunciation guides in simple phonetics (OH-lah, not IPA)
- Cultural notes where relevant
- Common mistakes highlighted

## Output Format:
Always return valid JSON matching the schema exactly.
```

---

### Prompt 1: Generate Lesson Content

```markdown
# Generate Lesson Content

Create a complete lesson for the Spanish A1 curriculum.

## Input Parameters:
- Lesson ID: {lesson_id}
- Title: {title}
- Module Context: {module_name}
- Previous Lesson: {previous_lesson_summary}
- Learning Objectives: {objectives_list}

## Required Output Schema:

```json
{
  "id": "string",
  "title": "string",
  "description": "string (2-3 sentences)",
  "estimatedMinutes": "number (10-20)",
  "objectives": ["string array, 3-5 items"],
  
  "sections": [
    {
      "id": "string",
      "type": "explanation | example | pronunciation | cultural_note",
      "title": "string",
      "content": "string (markdown, 2-4 paragraphs max)",
      "examples": [
        {
          "spanish": "string",
          "english": "string", 
          "pronunciation": "string (phonetic)"
        }
      ]
    }
  ],
  
  "vocabulary": [
    {
      "id": "string",
      "spanish": "string",
      "english": "string",
      "pronunciation": "string",
      "partOfSpeech": "noun | verb | adjective | adverb | phrase | other",
      "gender": "masculine | feminine | null",
      "context": "string (when/how to use)",
      "exampleSentence": {
        "spanish": "string",
        "english": "string"
      },
      "difficulty": "1 | 2 | 3"
    }
  ],
  
  "grammarPoints": [
    {
      "id": "string",
      "title": "string",
      "explanation": "string (markdown, clear and concise)",
      "formula": "string or null",
      "table": {
        "headers": ["string array"],
        "rows": [["string arrays"]]
      } or null,
      "examples": [
        {
          "spanish": "string",
          "english": "string",
          "highlight": "string (word to emphasize)"
        }
      ],
      "commonMistakes": [
        {
          "wrong": "string",
          "correct": "string", 
          "explanation": "string"
        }
      ]
    }
  ]
}
```

## Guidelines:
1. Include 10-15 vocabulary items appropriate for the lesson topic
2. Include 1-3 grammar points depending on lesson complexity
3. Sections should flow logically: introduction → explanation → examples → practice tips
4. Vocabulary difficulty: mostly 1s and 2s, few 3s
5. All Spanish text must have pronunciation guides
6. Include at least one cultural note if relevant

## Example Request:
Generate lesson for:
- Lesson ID: "a1-m1-l2"
- Title: "Greetings & Introductions"
- Module: "Foundations"
- Previous: "Spanish Alphabet & Pronunciation"
- Objectives: ["Greet formally and informally", "Introduce yourself", "Use basic courtesy phrases"]
```

---

### Prompt 2: Generate Drill Pool

```markdown
# Generate Drill Pool

Create a drill pool for a specific lesson.

## Input Parameters:
- Lesson ID: {lesson_id}
- Vocabulary List: {vocabulary_json}
- Grammar Points: {grammar_points_json}
- Target Drill Count: {count, default 20}

## Required Output Schema:

```json
{
  "id": "string (drillpool-{lesson_id})",
  "lessonId": "string",
  "drills": [
    {
      "id": "string",
      "type": "multiple_choice | fill_blank | matching | word_order | translation_select | dialogue_response",
      "difficulty": "1 | 2 | 3",
      "points": "number (10-30)",
      "skillsTested": ["string array"],
      "content": { ... } // Type-specific content
    }
  ]
}
```

## Drill Type Schemas:

### multiple_choice:
```json
{
  "question": "string",
  "options": [
    {"id": "a", "text": "string", "isCorrect": false},
    {"id": "b", "text": "string", "isCorrect": true},
    {"id": "c", "text": "string", "isCorrect": false},
    {"id": "d", "text": "string", "isCorrect": false}
  ],
  "explanation": "string"
}
```

### fill_blank:
```json
{
  "sentence": "string with ___ for blank",
  "blankIndex": "number",
  "options": [
    {"id": "a", "text": "string", "isCorrect": false},
    {"id": "b", "text": "string", "isCorrect": true},
    {"id": "c", "text": "string", "isCorrect": false}
  ],
  "correctAnswer": "string",
  "explanation": "string"
}
```

### matching:
```json
{
  "instruction": "Match Spanish to English",
  "pairs": [
    {"id": "1", "left": "Hola", "right": "Hello"},
    {"id": "2", "left": "Adiós", "right": "Goodbye"}
  ]
}
```
Note: Include 4-6 pairs per matching drill.

### word_order:
```json
{
  "instruction": "Arrange words to form a correct sentence",
  "targetSentence": "Me llamo María",
  "words": ["María", "llamo", "Me"],
  "translation": "My name is María"
}
```

### translation_select:
```json
{
  "sourceText": "How are you? (informal)",
  "options": [
    {"id": "a", "text": "¿Cómo está?", "isCorrect": false},
    {"id": "b", "text": "¿Cómo estás?", "isCorrect": true},
    {"id": "c", "text": "¿Qué tal está?", "isCorrect": false}
  ],
  "explanation": "Use 'estás' for informal 'tú' form"
}
```

### dialogue_response:
```json
{
  "context": "You meet a new colleague at work",
  "prompt": {
    "text": "Hola, ¿cómo te llamas?"
  },
  "options": [
    {"id": "a", "text": "Estoy bien, gracias", "isCorrect": false, "isAcceptable": false},
    {"id": "b", "text": "Me llamo [Name]. Mucho gusto.", "isCorrect": true, "isAcceptable": true},
    {"id": "c", "text": "Hola, me llamo [Name].", "isCorrect": false, "isAcceptable": true}
  ],
  "explanation": "When asked your name, respond with 'Me llamo...' Adding 'Mucho gusto' is polite."
}
```

## Distribution Guidelines:
- 30% multiple_choice (6 drills)
- 25% fill_blank (5 drills)
- 15% matching (3 drills)
- 10% word_order (2 drills)
- 10% translation_select (2 drills)
- 10% dialogue_response (2 drills)

## Difficulty Distribution:
- 50% difficulty 1 (basic recall)
- 35% difficulty 2 (application)
- 15% difficulty 3 (synthesis)

## Quality Rules:
1. Wrong options must be plausible (common mistakes learners make)
2. Explanations should teach, not just state correct answer
3. Test vocabulary AND grammar from the lesson
4. Include distractors based on real confusion patterns (ser/estar, gender agreement, etc.)
5. Dialogue scenarios should be realistic A1 situations
```

---

### Prompt 3: Generate Quiz

```markdown
# Generate Quiz

Create a quiz for lesson or module assessment.

## Input Parameters:
- Quiz Type: {lesson | module | certification}
- Associated ID: {lesson_id or module_id}
- Lessons Covered: {lesson_ids_array}
- Question Count: {count}
- Time Limit: {minutes or null}

## Required Output Schema:

```json
{
  "id": "string",
  "lessonId": "string or null",
  "moduleId": "string or null", 
  "type": "lesson | module | certification",
  "title": "string",
  "passingScore": "number (70-80)",
  "timeLimit": "number or null",
  "questions": [
    {
      "id": "string",
      "type": "drill type",
      "content": { ... },
      "points": "number",
      "order": "number"
    }
  ]
}
```

## Quiz Type Specifications:

### Lesson Quiz:
- 10 questions
- 70% passing
- No time limit
- Focus on just-learned content
- 60% vocabulary, 40% grammar

### Module Quiz:
- 20-25 questions
- 75% passing
- 15 minute time limit
- Cumulative across all module lessons
- Include integration questions

### Certification (Practice/Final):
- 50 questions
- 5 sections matching CEFR A1 test format:
  1. Listening (10 questions)
  2. Reading (10 questions)
  3. Grammar (15 questions)
  4. Writing (5 questions - sentence completion)
  5. Speaking/Interaction (10 questions - dialogue response)
- 80% passing for certification
- 45 minute time limit

## Question Selection Rules:
1. No exact repeat of drill questions (rephrase)
2. Cover all lesson objectives
3. Balanced difficulty (easier at start, harder toward end)
4. Each wrong answer should target a specific misconception
```

---

### Prompt 4: Generate Vocabulary Set with Spaced Repetition Metadata

```markdown
# Generate Vocabulary Set

Create vocabulary items with metadata for spaced repetition system.

## Input Parameters:
- Topic: {topic}
- Lesson Context: {lesson_title}
- Count: {number of items}
- Related Grammar: {grammar_point if applicable}

## Required Output Schema:

```json
{
  "vocabulary": [
    {
      "id": "vocab-{topic}-{index}",
      "spanish": "string",
      "english": "string",
      "pronunciation": "string (phonetic)",
      "partOfSpeech": "noun | verb | adjective | adverb | phrase | other",
      "gender": "masculine | feminine | null",
      "plural": "string or null",
      "conjugation": {
        "infinitive": "string",
        "yo": "string",
        "tú": "string",
        "él": "string",
        "nosotros": "string",
        "ellos": "string"
      } or null,
      "context": "string",
      "exampleSentence": {
        "spanish": "string",
        "english": "string"
      },
      "relatedWords": ["string array"],
      "confusedWith": [
        {
          "word": "string",
          "difference": "string"
        }
      ],
      "difficulty": "1 | 2 | 3",
      "frequency": "high | medium | low",
      "tags": ["string array: topic tags"]
    }
  ]
}
```

## Guidelines:
1. Frequency based on corpus data (most common Spanish words)
2. Include words commonly confused together
3. For verbs, include full present tense conjugation
4. For nouns, include plural form and gender
5. Example sentences should use other known A1 vocabulary
6. Tags should include topic and grammatical features
```

---

### Prompt 5: Batch Content Generation

```markdown
# Batch Generate Module Content

Generate all content for an entire module in one request.

## Input:
- Module ID: {module_id}
- Module Title: {title}
- Lesson Outlines: [
    {
      "id": "string",
      "title": "string",
      "objectives": ["string array"]
    }
  ]

## Output:
Complete JSON with:
1. Module metadata
2. All lessons with full content
3. All drill pools
4. All quizzes (lesson + module)

## Structure:
```json
{
  "module": {
    "id": "string",
    "name": "string",
    "description": "string",
    "lessons": [ /* full lesson objects */ ],
    "drillPools": [ /* drill pool for each lesson */ ],
    "quizzes": [ /* lesson quizzes + module quiz */ ],
    "moduleQuiz": { /* comprehensive module quiz */ }
  }
}
```

Use this for efficient batch processing when generating complete curriculum.
```

---

## Phase 6: Implementation Roadmap

### MVP (4-6 weeks)
1. **Week 1-2**: Core data models + database setup
2. **Week 2-3**: Generate Module 1-2 content using AI prompts
3. **Week 3-4**: Build lesson viewer + drill engine
4. **Week 4-5**: Progress tracking + unlock logic
5. **Week 5-6**: Quiz system + basic analytics

### Phase 2 (4 weeks)
1. Audio integration (pronunciation)
2. Spaced repetition for vocabulary review
3. Remaining modules (3-7)
4. Certification tests

### Phase 3 (ongoing)
1. Web app port
2. A2 content generation
3. Social features
4. Advanced analytics

---

Would you like me to:
1. Generate actual JSON content for Module 1 using these prompts?
2. Create the database schema for your preferred backend?
3. Design the mobile UI flow for lessons/drills?
4. Build out the spaced repetition algorithm?