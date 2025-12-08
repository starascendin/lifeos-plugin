import { mutation } from "../_generated/server";
import { v } from "convex/values";

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
    const a1Id = await ctx.db.insert("hola_contentLevels", {
      name: "A1",
      displayName: "Beginner",
      description: "Basic phrases, greetings, and simple present tense",
      order: 1,
    });

    const a2Id = await ctx.db.insert("hola_contentLevels", {
      name: "A2",
      displayName: "Elementary",
      description: "Common vocabulary, past tense, and everyday situations",
      order: 2,
    });

    await ctx.db.insert("hola_contentLevels", {
      name: "B1",
      displayName: "Intermediate",
      description: "Complex grammar, varied vocabulary, and nuanced expression",
      order: 3,
    });

    // ==================== A1 CATEGORIES ====================
    const a1GreetingsId = await ctx.db.insert("hola_contentCategories", {
      levelId: a1Id,
      name: "Greetings",
      description: "Basic greetings and introductions",
      icon: "hand-wave",
      order: 1,
    });

    const a1NumbersId = await ctx.db.insert("hola_contentCategories", {
      levelId: a1Id,
      name: "Numbers",
      description: "Numbers 1-100 and basic counting",
      icon: "hash",
      order: 2,
    });

    const a1FoodId = await ctx.db.insert("hola_contentCategories", {
      levelId: a1Id,
      name: "Food & Drinks",
      description: "Basic food vocabulary and ordering",
      icon: "utensils",
      order: 3,
    });

    await ctx.db.insert("hola_contentCategories", {
      levelId: a1Id,
      name: "Family",
      description: "Family members and relationships",
      icon: "users",
      order: 4,
    });

    // ==================== A1 GREETINGS VOCABULARY ====================
    const greetingsVocab = [
      { spanish: "Hola", english: "Hello", pronunciation: "OH-lah", exampleSentence: "¡Hola! ¿Cómo estás?", exampleTranslation: "Hello! How are you?" },
      { spanish: "Buenos días", english: "Good morning", pronunciation: "BWEH-nohs DEE-ahs", exampleSentence: "Buenos días, señor García.", exampleTranslation: "Good morning, Mr. García." },
      { spanish: "Buenas tardes", english: "Good afternoon", pronunciation: "BWEH-nahs TAR-dehs", exampleSentence: "Buenas tardes, ¿puedo ayudarle?", exampleTranslation: "Good afternoon, can I help you?" },
      { spanish: "Buenas noches", english: "Good evening/night", pronunciation: "BWEH-nahs NOH-chehs", exampleSentence: "Buenas noches, hasta mañana.", exampleTranslation: "Good night, see you tomorrow." },
      { spanish: "Adiós", english: "Goodbye", pronunciation: "ah-dee-OHS", exampleSentence: "Adiós, fue un placer conocerte.", exampleTranslation: "Goodbye, it was a pleasure meeting you." },
      { spanish: "Hasta luego", english: "See you later", pronunciation: "AHS-tah LWEH-goh", exampleSentence: "Hasta luego, nos vemos mañana.", exampleTranslation: "See you later, we'll meet tomorrow." },
      { spanish: "¿Cómo estás?", english: "How are you? (informal)", pronunciation: "KOH-moh ehs-TAHS", exampleSentence: "Hola María, ¿cómo estás?", exampleTranslation: "Hi María, how are you?" },
      { spanish: "¿Cómo está usted?", english: "How are you? (formal)", pronunciation: "KOH-moh ehs-TAH oos-TEHD", exampleSentence: "Buenos días, ¿cómo está usted?", exampleTranslation: "Good morning, how are you?" },
      { spanish: "Muy bien", english: "Very well", pronunciation: "mwee bee-EHN", exampleSentence: "Estoy muy bien, gracias.", exampleTranslation: "I'm very well, thank you." },
      { spanish: "Gracias", english: "Thank you", pronunciation: "GRAH-see-ahs", exampleSentence: "Muchas gracias por tu ayuda.", exampleTranslation: "Thank you very much for your help." },
    ];

    for (let i = 0; i < greetingsVocab.length; i++) {
      await ctx.db.insert("hola_vocabularyItems", {
        categoryId: a1GreetingsId,
        ...greetingsVocab[i],
        order: i + 1,
      });
    }

    // ==================== A1 GREETINGS GRAMMAR ====================
    await ctx.db.insert("hola_grammarRules", {
      categoryId: a1GreetingsId,
      title: "Formal vs Informal 'You'",
      explanation: "Spanish has two ways to say 'you': 'tú' (informal, for friends and family) and 'usted' (formal, for strangers and elders). This affects verb conjugation.",
      formula: "tú + verb (informal) | usted + verb (formal)",
      examples: [
        { spanish: "¿Cómo estás tú?", english: "How are you? (informal)" },
        { spanish: "¿Cómo está usted?", english: "How are you? (formal)" },
      ],
      tips: [
        "Use 'tú' with friends, family, and people your age",
        "Use 'usted' with strangers, elders, and in professional settings",
        "When in doubt, start with 'usted' - it's always respectful",
      ],
      order: 1,
    });

    await ctx.db.insert("hola_grammarRules", {
      categoryId: a1GreetingsId,
      title: "Verb 'Estar' - To Be (temporary states)",
      explanation: "Use 'estar' for temporary states, locations, and feelings. It's one of two verbs meaning 'to be' in Spanish.",
      formula: "yo estoy, tú estás, él/ella/usted está, nosotros estamos, ellos/ustedes están",
      examples: [
        { spanish: "Estoy bien.", english: "I am well." },
        { spanish: "¿Dónde estás?", english: "Where are you?" },
        { spanish: "Ella está cansada.", english: "She is tired." },
      ],
      tips: [
        "Remember: 'estar' for Location, Emotion, Condition, Action (LECA)",
        "Compare: 'Soy alto' (I am tall - permanent) vs 'Estoy cansado' (I am tired - temporary)",
      ],
      order: 2,
    });

    // ==================== A1 GREETINGS PHRASES ====================
    const greetingsPhrases = [
      { spanish: "Mucho gusto", english: "Nice to meet you", context: "When meeting someone for the first time", formalityLevel: "neutral" },
      { spanish: "El gusto es mío", english: "The pleasure is mine", context: "Response to 'mucho gusto'", formalityLevel: "neutral" },
      { spanish: "¿Qué tal?", english: "What's up? / How's it going?", context: "Casual greeting with friends", formalityLevel: "informal" },
      { spanish: "Más o menos", english: "So-so", context: "When you're feeling okay, not great", formalityLevel: "neutral" },
      { spanish: "¿Y tú?", english: "And you?", context: "Returning the question informally", formalityLevel: "informal" },
      { spanish: "Encantado/a", english: "Delighted (to meet you)", context: "Formal introduction (use -o for male, -a for female)", formalityLevel: "formal" },
    ];

    for (let i = 0; i < greetingsPhrases.length; i++) {
      await ctx.db.insert("hola_phrases", {
        categoryId: a1GreetingsId,
        ...greetingsPhrases[i],
        order: i + 1,
      });
    }

    // ==================== A1 NUMBERS VOCABULARY ====================
    const numbersVocab = [
      { spanish: "uno", english: "one", pronunciation: "OO-noh" },
      { spanish: "dos", english: "two", pronunciation: "dohs" },
      { spanish: "tres", english: "three", pronunciation: "trehs" },
      { spanish: "cuatro", english: "four", pronunciation: "KWAH-troh" },
      { spanish: "cinco", english: "five", pronunciation: "SEEN-koh" },
      { spanish: "seis", english: "six", pronunciation: "says" },
      { spanish: "siete", english: "seven", pronunciation: "SYEH-teh" },
      { spanish: "ocho", english: "eight", pronunciation: "OH-choh" },
      { spanish: "nueve", english: "nine", pronunciation: "NWEH-beh" },
      { spanish: "diez", english: "ten", pronunciation: "dyehs" },
      { spanish: "veinte", english: "twenty", pronunciation: "BAYN-teh" },
      { spanish: "cien", english: "one hundred", pronunciation: "syehn" },
    ];

    for (let i = 0; i < numbersVocab.length; i++) {
      await ctx.db.insert("hola_vocabularyItems", {
        categoryId: a1NumbersId,
        ...numbersVocab[i],
        order: i + 1,
      });
    }

    // ==================== A1 FOOD VOCABULARY ====================
    const foodVocab = [
      { spanish: "el agua", english: "water", exampleSentence: "Un vaso de agua, por favor.", exampleTranslation: "A glass of water, please." },
      { spanish: "el café", english: "coffee", exampleSentence: "Me gusta el café con leche.", exampleTranslation: "I like coffee with milk." },
      { spanish: "el pan", english: "bread", exampleSentence: "El pan está fresco.", exampleTranslation: "The bread is fresh." },
      { spanish: "la fruta", english: "fruit", exampleSentence: "Como fruta todos los días.", exampleTranslation: "I eat fruit every day." },
      { spanish: "la carne", english: "meat", exampleSentence: "No como carne.", exampleTranslation: "I don't eat meat." },
      { spanish: "el pescado", english: "fish", exampleSentence: "El pescado está delicioso.", exampleTranslation: "The fish is delicious." },
      { spanish: "la ensalada", english: "salad", exampleSentence: "Quiero una ensalada.", exampleTranslation: "I want a salad." },
      { spanish: "el arroz", english: "rice", exampleSentence: "Arroz con pollo es mi favorito.", exampleTranslation: "Rice with chicken is my favorite." },
    ];

    for (let i = 0; i < foodVocab.length; i++) {
      await ctx.db.insert("hola_vocabularyItems", {
        categoryId: a1FoodId,
        ...foodVocab[i],
        order: i + 1,
      });
    }

    // ==================== A1 FOOD PHRASES ====================
    const foodPhrases = [
      { spanish: "La cuenta, por favor", english: "The check, please", context: "Asking for the bill at a restaurant" },
      { spanish: "¿Qué recomienda?", english: "What do you recommend?", context: "Asking waiter for recommendations" },
      { spanish: "Tengo hambre", english: "I'm hungry", context: "Expressing hunger" },
      { spanish: "Tengo sed", english: "I'm thirsty", context: "Expressing thirst" },
      { spanish: "¡Está delicioso!", english: "It's delicious!", context: "Complimenting the food" },
    ];

    for (let i = 0; i < foodPhrases.length; i++) {
      await ctx.db.insert("hola_phrases", {
        categoryId: a1FoodId,
        ...foodPhrases[i],
        formalityLevel: "neutral",
        order: i + 1,
      });
    }

    // ==================== A2 CATEGORIES ====================
    const a2TravelId = await ctx.db.insert("hola_contentCategories", {
      levelId: a2Id,
      name: "Travel",
      description: "Vocabulary for traveling and transportation",
      icon: "plane",
      order: 1,
    });

    await ctx.db.insert("hola_contentCategories", {
      levelId: a2Id,
      name: "Shopping",
      description: "Shopping vocabulary and conversations",
      icon: "shopping-bag",
      order: 2,
    });

    // ==================== A2 TRAVEL VOCABULARY ====================
    const travelVocab = [
      { spanish: "el aeropuerto", english: "airport", exampleSentence: "El aeropuerto está lejos.", exampleTranslation: "The airport is far." },
      { spanish: "el avión", english: "airplane", exampleSentence: "El avión sale a las tres.", exampleTranslation: "The plane leaves at three." },
      { spanish: "el hotel", english: "hotel", exampleSentence: "Reservé un hotel céntrico.", exampleTranslation: "I booked a central hotel." },
      { spanish: "el pasaporte", english: "passport", exampleSentence: "¿Dónde está mi pasaporte?", exampleTranslation: "Where is my passport?" },
      { spanish: "la maleta", english: "suitcase", exampleSentence: "Mi maleta es negra.", exampleTranslation: "My suitcase is black." },
      { spanish: "el billete", english: "ticket", exampleSentence: "Compré el billete online.", exampleTranslation: "I bought the ticket online." },
    ];

    for (let i = 0; i < travelVocab.length; i++) {
      await ctx.db.insert("hola_vocabularyItems", {
        categoryId: a2TravelId,
        ...travelVocab[i],
        order: i + 1,
      });
    }

    // ==================== EXERCISES ====================
    // A1 Greetings Multiple Choice
    await ctx.db.insert("hola_exercises", {
      categoryId: a1GreetingsId,
      type: "multiple_choice",
      question: "How do you say 'Good morning' in Spanish?",
      options: ["Buenas noches", "Buenos días", "Buenas tardes", "Hola"],
      correctAnswer: "Buenos días",
      explanation: "'Buenos días' means 'Good morning' and is used until around noon.",
      difficulty: 1,
      order: 1,
    });

    await ctx.db.insert("hola_exercises", {
      categoryId: a1GreetingsId,
      type: "multiple_choice",
      question: "Which greeting would you use with your boss?",
      options: ["¿Qué tal?", "¿Cómo está usted?", "¿Cómo estás?", "Hola, ¿qué onda?"],
      correctAnswer: "¿Cómo está usted?",
      explanation: "Use the formal 'usted' form with your boss or in professional settings.",
      difficulty: 2,
      order: 2,
    });

    await ctx.db.insert("hola_exercises", {
      categoryId: a1GreetingsId,
      type: "fill_blank",
      question: "Complete: ¿Cómo _____ tú? (How are you - informal)",
      correctAnswer: "estás",
      explanation: "With 'tú' (informal you), we use 'estás' from the verb 'estar'.",
      difficulty: 2,
      order: 3,
    });

    // A1 Numbers exercises
    await ctx.db.insert("hola_exercises", {
      categoryId: a1NumbersId,
      type: "multiple_choice",
      question: "What is 'siete' in English?",
      options: ["six", "seven", "eight", "nine"],
      correctAnswer: "seven",
      difficulty: 1,
      order: 1,
    });

    // A1 Food exercises
    await ctx.db.insert("hola_exercises", {
      categoryId: a1FoodId,
      type: "translate",
      question: "Translate to Spanish: 'I want water, please'",
      questionSpanish: "Quiero agua, por favor",
      correctAnswer: "Quiero agua, por favor",
      explanation: "'Quiero' means 'I want'. 'Agua' is water. 'Por favor' means 'please'.",
      difficulty: 2,
      order: 1,
    });

    // Matching exercise
    const matchingExerciseId = await ctx.db.insert("hola_exercises", {
      categoryId: a1GreetingsId,
      type: "matching",
      question: "Match the Spanish greetings with their English translations",
      correctAnswer: "all_matched",
      difficulty: 1,
      order: 4,
    });

    // Add matching pairs
    const matchingPairs = [
      { spanish: "Hola", english: "Hello" },
      { spanish: "Adiós", english: "Goodbye" },
      { spanish: "Gracias", english: "Thank you" },
      { spanish: "Por favor", english: "Please" },
    ];

    for (let i = 0; i < matchingPairs.length; i++) {
      await ctx.db.insert("hola_matchingPairs", {
        exerciseId: matchingExerciseId,
        ...matchingPairs[i],
        order: i + 1,
      });
    }

    return {
      message: "Content seeded successfully",
      levels: 3,
      categories: 6,
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
    const categories = await ctx.db
      .query("hola_contentCategories")
      .withIndex("by_level", (q) => q.eq("levelId", a1Level._id))
      .collect();

    const greetingsCategory = categories.find(c => c.name === "Greetings");
    const numbersCategory = categories.find(c => c.name === "Numbers");
    const foodCategory = categories.find(c => c.name === "Food & Drinks");
    const familyCategory = categories.find(c => c.name === "Family");

    // Get existing vocabulary
    const allVocab = await ctx.db.query("hola_vocabularyItems").collect();
    const allGrammar = await ctx.db.query("hola_grammarRules").collect();
    const allPhrases = await ctx.db.query("hola_phrases").collect();
    const allExercises = await ctx.db.query("hola_exercises").collect();

    // Filter by category
    const greetingsVocab = allVocab.filter(v => greetingsCategory && v.categoryId === greetingsCategory._id);
    const greetingsGrammar = allGrammar.filter(g => greetingsCategory && g.categoryId === greetingsCategory._id);
    const greetingsPhrases = allPhrases.filter(p => greetingsCategory && p.categoryId === greetingsCategory._id);
    const greetingsExercises = allExercises.filter(e => greetingsCategory && e.categoryId === greetingsCategory._id);

    const numbersVocab = allVocab.filter(v => numbersCategory && v.categoryId === numbersCategory._id);
    const numbersExercises = allExercises.filter(e => numbersCategory && e.categoryId === numbersCategory._id);

    const foodVocab = allVocab.filter(v => foodCategory && v.categoryId === foodCategory._id);
    const foodPhrases = allPhrases.filter(p => foodCategory && p.categoryId === foodCategory._id);
    const foodExercises = allExercises.filter(e => foodCategory && e.categoryId === foodCategory._id);

    // ==================== MODULE 1: FOUNDATIONS ====================
    const module1Id = await ctx.db.insert("hola_learningModules", {
      levelId: a1Level._id,
      moduleNumber: 1,
      title: "Foundations",
      description: "Spanish alphabet, pronunciation, greetings, and basic numbers. Build the foundation for your Spanish journey.",
      estimatedHours: 3,
      prerequisites: [],
      order: 1,
    });

    // Lesson 1.1: Spanish Alphabet & Pronunciation
    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module1Id,
      lessonNumber: "1.1",
      title: "Spanish Alphabet & Pronunciation",
      description: "Learn the Spanish alphabet and key pronunciation rules that differ from English.",
      objectives: [
        "Recognize all 27 letters of the Spanish alphabet",
        "Pronounce vowels correctly (a, e, i, o, u)",
        "Understand key consonant differences (j, ll, ñ, rr)",
        "Practice basic Spanish sounds"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 20,
      order: 1,
    });

    // Lesson 1.2: Greetings & Introductions
    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module1Id,
      lessonNumber: "1.2",
      title: "Greetings & Introductions",
      description: "Learn to greet people and introduce yourself in Spanish.",
      objectives: [
        "Greet people formally and informally",
        "Introduce yourself with Me llamo...",
        "Ask and respond to '¿Cómo estás?'",
        "Use basic courtesy phrases"
      ],
      vocabularyIds: greetingsVocab.slice(0, 6).map(v => v._id),
      grammarIds: greetingsGrammar.slice(0, 1).map(g => g._id),
      phraseIds: greetingsPhrases.slice(0, 3).map(p => p._id),
      exerciseIds: greetingsExercises.slice(0, 2).map(e => e._id),
      isQuiz: false,
      estimatedMinutes: 25,
      order: 2,
    });

    // Lesson 1.3: Numbers 0-20
    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module1Id,
      lessonNumber: "1.3",
      title: "Numbers 0-20",
      description: "Master counting from zero to twenty in Spanish.",
      objectives: [
        "Count from 0-20 in Spanish",
        "Recognize written numbers",
        "Use numbers in basic sentences",
        "Understand number pronunciation patterns"
      ],
      vocabularyIds: numbersVocab.slice(0, 10).map(v => v._id),
      grammarIds: [],
      phraseIds: [],
      exerciseIds: numbersExercises.map(e => e._id),
      isQuiz: false,
      estimatedMinutes: 20,
      order: 3,
    });

    // Lesson 1.4: Basic Sentence Structure
    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module1Id,
      lessonNumber: "1.4",
      title: "Basic Sentence Structure",
      description: "Understand how Spanish sentences are formed.",
      objectives: [
        "Understand Subject-Verb-Object order",
        "Form simple declarative sentences",
        "Ask yes/no questions with intonation",
        "Use question marks and exclamation points correctly"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 20,
      order: 4,
    });

    // Module 1 Quiz
    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module1Id,
      lessonNumber: "Quiz 1",
      title: "Foundation Check",
      description: "Test your knowledge of greetings, numbers, and basic Spanish.",
      objectives: [
        "Demonstrate mastery of greetings vocabulary",
        "Show understanding of numbers 0-20",
        "Apply formal vs informal 'you'"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: greetingsExercises.concat(numbersExercises).map(e => e._id),
      isQuiz: true,
      estimatedMinutes: 15,
      order: 5,
    });

    // ==================== MODULE 2: PRESENT TENSE ====================
    const module2Id = await ctx.db.insert("hola_learningModules", {
      levelId: a1Level._id,
      moduleNumber: 2,
      title: "Present Tense & Description",
      description: "Learn the essential verbs SER and ESTAR, regular verb conjugation, and how to describe people and things.",
      estimatedHours: 4,
      prerequisites: [module1Id],
      order: 2,
    });

    // Lesson 2.1: Verb SER
    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module2Id,
      lessonNumber: "2.1",
      title: "Verb SER (To Be - Permanent)",
      description: "Master the verb SER for describing permanent characteristics, origin, and profession.",
      objectives: [
        "Conjugate SER in all present tense forms",
        "Use SER for nationality and origin",
        "Describe professions with SER",
        "Express identity and characteristics"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 30,
      order: 1,
    });

    // Lesson 2.2: Verb ESTAR
    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module2Id,
      lessonNumber: "2.2",
      title: "Verb ESTAR (To Be - Temporary/Location)",
      description: "Learn ESTAR for expressing location, emotions, and temporary states.",
      objectives: [
        "Conjugate ESTAR in present tense",
        "Use ESTAR for location",
        "Express feelings and emotions",
        "Distinguish when to use SER vs ESTAR"
      ],
      vocabularyIds: [],
      grammarIds: greetingsGrammar.slice(1, 2).map(g => g._id),
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 30,
      order: 2,
    });

    // Lesson 2.3: Regular -AR Verbs
    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module2Id,
      lessonNumber: "2.3",
      title: "Regular -AR Verbs",
      description: "Learn to conjugate regular -AR verbs like hablar, estudiar, trabajar.",
      objectives: [
        "Identify -AR verb infinitives",
        "Apply -AR conjugation pattern",
        "Use common -AR verbs in sentences",
        "Practice with hablar, estudiar, trabajar, caminar"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 3,
    });

    // Lesson 2.4: Regular -ER/-IR Verbs
    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module2Id,
      lessonNumber: "2.4",
      title: "Regular -ER/-IR Verbs",
      description: "Master the conjugation patterns for -ER and -IR verbs.",
      objectives: [
        "Conjugate regular -ER verbs (comer, beber, leer)",
        "Conjugate regular -IR verbs (vivir, escribir)",
        "Recognize similarities between -ER and -IR patterns",
        "Form complete sentences with mixed verb types"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 4,
    });

    // Lesson 2.5: Articles & Agreement
    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module2Id,
      lessonNumber: "2.5",
      title: "Articles & Noun-Adjective Agreement",
      description: "Learn definite/indefinite articles and adjective agreement rules.",
      objectives: [
        "Use el, la, los, las correctly",
        "Use un, una, unos, unas correctly",
        "Match adjectives to noun gender",
        "Match adjectives to noun number"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 5,
    });

    // Lesson 2.6: Describing People
    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module2Id,
      lessonNumber: "2.6",
      title: "Describing People & Things",
      description: "Put it all together to describe people, objects, and places.",
      objectives: [
        "Describe physical appearance",
        "Describe personality traits",
        "Describe objects (color, size, shape)",
        "Write a short self-description"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 30,
      order: 6,
    });

    // Module 2 Quiz
    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module2Id,
      lessonNumber: "Quiz 2",
      title: "Present Tense Mastery",
      description: "Test your verb conjugation and description skills.",
      objectives: [
        "Demonstrate SER vs ESTAR mastery",
        "Conjugate regular verbs correctly",
        "Apply adjective agreement rules"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: true,
      estimatedMinutes: 20,
      order: 7,
    });

    // ==================== MODULE 3: DAILY LIFE & TIME ====================
    const module3Id = await ctx.db.insert("hola_learningModules", {
      levelId: a1Level._id,
      moduleNumber: 3,
      title: "Daily Life & Time",
      description: "Learn to tell time, describe daily routines, and use the irregular verb TENER.",
      estimatedHours: 3,
      prerequisites: [module2Id],
      order: 3,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module3Id,
      lessonNumber: "3.1",
      title: "Days, Months, Seasons",
      description: "Learn the days of the week, months, and seasons in Spanish.",
      objectives: [
        "Name all days of the week",
        "Name all months of the year",
        "Name the four seasons",
        "Use dates in conversation"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 20,
      order: 1,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module3Id,
      lessonNumber: "3.2",
      title: "Telling Time",
      description: "Master telling time in Spanish including hours and minutes.",
      objectives: [
        "Ask '¿Qué hora es?'",
        "Tell time on the hour",
        "Tell time with minutes (y, menos)",
        "Use 'cuarto' and 'media' correctly"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 2,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module3Id,
      lessonNumber: "3.3",
      title: "Daily Routines",
      description: "Describe your daily activities and schedule.",
      objectives: [
        "Describe morning routine",
        "Describe afternoon activities",
        "Use reflexive verbs for daily actions",
        "Sequence events with time expressions"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 3,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module3Id,
      lessonNumber: "3.4",
      title: "Irregular Verb: TENER",
      description: "Learn the essential irregular verb TENER (to have).",
      objectives: [
        "Conjugate TENER in present tense",
        "Use TENER for possession",
        "Use TENER expressions (hambre, sed, años)",
        "Express age with TENER"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 4,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module3Id,
      lessonNumber: "3.5",
      title: "Expressing Age & Possession",
      description: "Use TENER to express age and ownership.",
      objectives: [
        "Ask and tell age",
        "Describe what you have/own",
        "Use possessive expressions",
        "Combine with adjectives (tengo dos hermanos pequeños)"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 20,
      order: 5,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module3Id,
      lessonNumber: "Quiz 3",
      title: "Time & Routines",
      description: "Test your time-telling and daily routine vocabulary.",
      objectives: [
        "Tell time accurately",
        "Conjugate TENER correctly",
        "Describe a daily schedule"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: true,
      estimatedMinutes: 15,
      order: 6,
    });

    // ==================== MODULE 4: FAMILY ====================
    const module4Id = await ctx.db.insert("hola_learningModules", {
      levelId: a1Level._id,
      moduleNumber: 4,
      title: "Family & Relationships",
      description: "Learn family vocabulary, possessive adjectives, and the verb IR.",
      estimatedHours: 3,
      prerequisites: [module3Id],
      order: 4,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module4Id,
      lessonNumber: "4.1",
      title: "Family Vocabulary",
      description: "Learn words for family members and relationships.",
      objectives: [
        "Name immediate family members",
        "Name extended family members",
        "Describe family relationships",
        "Use gender-specific family terms"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 20,
      order: 1,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module4Id,
      lessonNumber: "4.2",
      title: "Possessive Adjectives",
      description: "Master mi, tu, su, nuestro, vuestro, su.",
      objectives: [
        "Use mi/mis, tu/tus correctly",
        "Use su/sus for third person",
        "Use nuestro/a/os/as",
        "Combine possessives with family terms"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 2,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module4Id,
      lessonNumber: "4.3",
      title: "Describing Family Members",
      description: "Practice describing your family using SER, TENER, and adjectives.",
      objectives: [
        "Describe family members' appearance",
        "Describe family members' personalities",
        "State ages of family members",
        "Write a family description paragraph"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 3,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module4Id,
      lessonNumber: "4.4",
      title: "Irregular Verb: IR (to go)",
      description: "Learn the irregular verb IR and common expressions.",
      objectives: [
        "Conjugate IR in present tense",
        "Use IR + a + infinitive for future",
        "Express where you're going",
        "Use IR with places and activities"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 4,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module4Id,
      lessonNumber: "Quiz 4",
      title: "Family & Possessives",
      description: "Test your family vocabulary and possessive adjective skills.",
      objectives: [
        "Identify family members correctly",
        "Use possessive adjectives accurately",
        "Conjugate IR correctly"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: true,
      estimatedMinutes: 15,
      order: 5,
    });

    // ==================== MODULE 5: FOOD ====================
    const module5Id = await ctx.db.insert("hola_learningModules", {
      levelId: a1Level._id,
      moduleNumber: 5,
      title: "Food & Preferences",
      description: "Learn food vocabulary, how to order at restaurants, and express likes/dislikes with GUSTAR.",
      estimatedHours: 3,
      prerequisites: [module4Id],
      order: 5,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module5Id,
      lessonNumber: "5.1",
      title: "Food & Drink Vocabulary",
      description: "Learn essential food and beverage vocabulary.",
      objectives: [
        "Name common foods",
        "Name beverages",
        "Categorize by food groups",
        "Use articles with food nouns"
      ],
      vocabularyIds: foodVocab.map(v => v._id),
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 1,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module5Id,
      lessonNumber: "5.2",
      title: "Expressing Likes/Dislikes (GUSTAR)",
      description: "Master the special verb GUSTAR for expressing preferences.",
      objectives: [
        "Understand GUSTAR structure (reverse of English)",
        "Use me gusta / me gustan correctly",
        "Express what you don't like with no me gusta",
        "Use other similar verbs (encantar, interesar)"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 30,
      order: 2,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module5Id,
      lessonNumber: "5.3",
      title: "Restaurant Conversations",
      description: "Learn to navigate dining out in Spanish.",
      objectives: [
        "Ask for a table",
        "Read a menu",
        "Ask about ingredients",
        "Handle common restaurant situations"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: foodPhrases.slice(0, 2).map(p => p._id),
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 3,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module5Id,
      lessonNumber: "5.4",
      title: "Ordering Food",
      description: "Practice ordering food and drinks like a native.",
      objectives: [
        "Order food politely (Quisiera, Me gustaría)",
        "Ask for the check",
        "Handle dietary restrictions",
        "Tip and pay appropriately"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: foodPhrases.slice(2).map(p => p._id),
      exerciseIds: foodExercises.map(e => e._id),
      isQuiz: false,
      estimatedMinutes: 25,
      order: 4,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module5Id,
      lessonNumber: "Quiz 5",
      title: "Food & Preferences",
      description: "Test your food vocabulary and GUSTAR usage.",
      objectives: [
        "Name foods accurately",
        "Use GUSTAR correctly",
        "Order food in a restaurant scenario"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: foodExercises.map(e => e._id),
      isQuiz: true,
      estimatedMinutes: 15,
      order: 5,
    });

    // ==================== MODULE 6: PLACES ====================
    const module6Id = await ctx.db.insert("hola_learningModules", {
      levelId: a1Level._id,
      moduleNumber: 6,
      title: "Places & Directions",
      description: "Learn city vocabulary, prepositions of place, and how to ask for directions.",
      estimatedHours: 2,
      prerequisites: [module5Id],
      order: 6,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module6Id,
      lessonNumber: "6.1",
      title: "City Locations",
      description: "Learn vocabulary for places in a city.",
      objectives: [
        "Name common city locations",
        "Describe where places are",
        "Ask about locations",
        "Use HAY for expressing existence"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 20,
      order: 1,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module6Id,
      lessonNumber: "6.2",
      title: "Prepositions of Place",
      description: "Master spatial prepositions: en, sobre, debajo, cerca, lejos.",
      objectives: [
        "Use basic prepositions correctly",
        "Describe object locations",
        "Give simple directions",
        "Combine with ESTAR for locations"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 2,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module6Id,
      lessonNumber: "6.3",
      title: "Where are you from?",
      description: "Discuss nationality and origin.",
      objectives: [
        "Ask '¿De dónde eres?'",
        "State your nationality",
        "Name countries and nationalities",
        "Use SER for origin"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 20,
      order: 3,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module6Id,
      lessonNumber: "6.4",
      title: "Asking for Directions",
      description: "Learn to ask for and understand directions.",
      objectives: [
        "Ask where something is",
        "Understand basic directions",
        "Use direction vocabulary (izquierda, derecha, recto)",
        "Navigate a simple map conversation"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 4,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module6Id,
      lessonNumber: "Quiz 6",
      title: "Locations & Movement",
      description: "Test your knowledge of places and directions.",
      objectives: [
        "Name city locations",
        "Use prepositions correctly",
        "Give and understand directions"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: true,
      estimatedMinutes: 15,
      order: 5,
    });

    // ==================== MODULE 7: REVIEW ====================
    const module7Id = await ctx.db.insert("hola_learningModules", {
      levelId: a1Level._id,
      moduleNumber: 7,
      title: "Review & Integration",
      description: "Comprehensive review of all A1 content, real-world practice, and exam preparation.",
      estimatedHours: 2,
      prerequisites: [module6Id],
      order: 7,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module7Id,
      lessonNumber: "7.1",
      title: "Comprehensive Grammar Review",
      description: "Review all grammar concepts covered in A1.",
      objectives: [
        "Review SER vs ESTAR usage",
        "Review verb conjugations",
        "Review adjective agreement",
        "Practice integrated grammar exercises"
      ],
      vocabularyIds: [],
      grammarIds: allGrammar.slice(0, 2).map(g => g._id),
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 30,
      order: 1,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module7Id,
      lessonNumber: "7.2",
      title: "Real-world Conversations",
      description: "Practice complete conversations for common scenarios.",
      objectives: [
        "Handle introductions scenario",
        "Order at a restaurant",
        "Ask for directions",
        "Describe yourself and family"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: allPhrases.slice(0, 5).map(p => p._id),
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 30,
      order: 2,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module7Id,
      lessonNumber: "7.3",
      title: "Common Mistakes & Corrections",
      description: "Learn to avoid the most common errors Spanish learners make.",
      objectives: [
        "Avoid SER/ESTAR confusion",
        "Avoid article errors",
        "Avoid false cognates",
        "Self-correct common errors"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: [],
      isQuiz: false,
      estimatedMinutes: 25,
      order: 3,
    });

    await ctx.db.insert("hola_moduleLessons", {
      moduleId: module7Id,
      lessonNumber: "Practice",
      title: "Mixed Scenarios Practice",
      description: "Practice with mixed exercises from all modules.",
      objectives: [
        "Complete mixed-topic exercises",
        "Demonstrate integrated skills",
        "Prepare for final assessment"
      ],
      vocabularyIds: [],
      grammarIds: [],
      phraseIds: [],
      exerciseIds: allExercises.map(e => e._id),
      isQuiz: false,
      estimatedMinutes: 30,
      order: 4,
    });

    return {
      message: "A1 Journey seeded successfully",
      modules: 7,
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

    return { message: "Content cleared", counts };
  },
});
