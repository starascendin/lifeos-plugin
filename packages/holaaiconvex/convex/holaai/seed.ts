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

// Seed A1 Lesson Content - Populates empty lessons with vocabulary, grammar, phrases, exercises
export const seedA1LessonContent = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all modules
    const modules = await ctx.db.query("hola_learningModules").collect();
    if (modules.length === 0) {
      return { message: "No modules found. Run seedA1Journey first.", skipped: true };
    }

    // Get all lessons
    const lessons = await ctx.db.query("hola_moduleLessons").collect();

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
    let totalCreated = { vocabulary: 0, grammar: 0, phrases: 0, exercises: 0 };

    // Helper function to find lesson by number
    const findLesson = (lessonNum: string) => lessons.find(l => l.lessonNumber === lessonNum);

    // ==================== LESSON 1.1: Alphabet & Pronunciation ====================
    const lesson1_1 = findLesson("1.1");
    if (lesson1_1 && lesson1_1.vocabularyIds.length === 0) {
      const alphabetVocab = [
        { spanish: "A", english: "ah", pronunciation: "ah (like 'father')", exampleSentence: "A de amor", exampleTranslation: "A as in amor (love)" },
        { spanish: "E", english: "eh", pronunciation: "eh (like 'bed')", exampleSentence: "E de elefante", exampleTranslation: "E as in elephant" },
        { spanish: "I", english: "ee", pronunciation: "ee (like 'see')", exampleSentence: "I de iglesia", exampleTranslation: "I as in church" },
        { spanish: "O", english: "oh", pronunciation: "oh (like 'hope')", exampleSentence: "O de oso", exampleTranslation: "O as in bear" },
        { spanish: "U", english: "oo", pronunciation: "oo (like 'moon')", exampleSentence: "U de uva", exampleTranslation: "U as in grape" },
        { spanish: "Ñ", english: "eñe", pronunciation: "ny (like 'canyon')", exampleSentence: "Ñ de niño", exampleTranslation: "Ñ as in child" },
        { spanish: "LL", english: "elle", pronunciation: "y (like 'yes')", exampleSentence: "LL de llave", exampleTranslation: "LL as in key" },
        { spanish: "RR", english: "erre", pronunciation: "rolled r", exampleSentence: "RR de perro", exampleTranslation: "RR as in dog" },
      ];

      const vocabIds = [];
      for (let i = 0; i < alphabetVocab.length; i++) {
        const id = await ctx.db.insert("hola_vocabularyItems", {
          categoryId,
          ...alphabetVocab[i],
          order: i + 1,
        });
        vocabIds.push(id);
        totalCreated.vocabulary++;
      }

      const grammarId = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Spanish Vowel Sounds",
        explanation: "Spanish has 5 pure vowel sounds that never change. Unlike English, Spanish vowels are always pronounced the same way.",
        formula: "A=ah, E=eh, I=ee, O=oh, U=oo",
        examples: [
          { spanish: "casa", english: "house (cah-sah)" },
          { spanish: "mesa", english: "table (meh-sah)" },
          { spanish: "silla", english: "chair (see-yah)" },
        ],
        tips: [
          "Spanish vowels are short and crisp - don't drag them out",
          "The letter 'H' is always silent in Spanish",
          "The letter 'J' sounds like English 'H' (jamón = hah-MOHN)",
        ],
        order: 1,
      });
      totalCreated.grammar++;

      const exerciseId = await ctx.db.insert("hola_exercises", {
        categoryId,
        type: "multiple_choice",
        question: "How is the Spanish letter 'Ñ' pronounced?",
        options: ["Like English 'N'", "Like 'NY' in canyon", "Like 'GN'", "Silent"],
        correctAnswer: "Like 'NY' in canyon",
        explanation: "Ñ (eñe) makes a 'ny' sound, like in 'canyon' or 'onion'.",
        difficulty: 1,
        order: 1,
      });
      totalCreated.exercises++;

      await ctx.db.patch(lesson1_1._id, {
        vocabularyIds: vocabIds,
        grammarIds: [grammarId],
        exerciseIds: [exerciseId],
      });
    }

    // ==================== LESSON 1.4: Basic Sentence Structure ====================
    const lesson1_4 = findLesson("1.4");
    if (lesson1_4 && lesson1_4.grammarIds.length === 0) {
      const grammarId = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Spanish Sentence Structure (SVO)",
        explanation: "Spanish generally follows Subject-Verb-Object order like English. However, subjects can often be omitted because verb conjugations indicate who is acting.",
        formula: "Subject + Verb + Object (Subject often optional)",
        examples: [
          { spanish: "Yo como pizza.", english: "I eat pizza." },
          { spanish: "Como pizza.", english: "I eat pizza. (subject dropped)" },
          { spanish: "María habla español.", english: "María speaks Spanish." },
        ],
        tips: [
          "Questions use rising intonation or invert subject-verb: ¿Hablas español?",
          "Use ¿ at the start and ? at the end of questions",
          "Use ¡ at the start and ! at the end of exclamations",
        ],
        order: 1,
      });
      totalCreated.grammar++;

      const phraseIds = [];
      const phrases = [
        { spanish: "¿Hablas español?", english: "Do you speak Spanish?", context: "Yes/no question with rising intonation", formalityLevel: "informal" as const },
        { spanish: "¡Qué bueno!", english: "How great!", context: "Exclamation showing enthusiasm", formalityLevel: "neutral" as const },
        { spanish: "No entiendo.", english: "I don't understand.", context: "Negation with 'no' before verb", formalityLevel: "neutral" as const },
      ];
      for (let i = 0; i < phrases.length; i++) {
        const id = await ctx.db.insert("hola_phrases", { categoryId, ...phrases[i], order: i + 1 });
        phraseIds.push(id);
        totalCreated.phrases++;
      }

      await ctx.db.patch(lesson1_4._id, { grammarIds: [grammarId], phraseIds });
    }

    // ==================== LESSON 2.1: Verb SER ====================
    const lesson2_1 = findLesson("2.1");
    if (lesson2_1 && lesson2_1.grammarIds.length === 0) {
      const vocabIds = [];
      const professions = [
        { spanish: "médico/a", english: "doctor", pronunciation: "MEH-dee-koh", exampleSentence: "Soy médico.", exampleTranslation: "I am a doctor." },
        { spanish: "profesor/a", english: "teacher", pronunciation: "proh-feh-SOHR", exampleSentence: "Ella es profesora.", exampleTranslation: "She is a teacher." },
        { spanish: "estudiante", english: "student", pronunciation: "ehs-too-DYAHN-teh", exampleSentence: "Somos estudiantes.", exampleTranslation: "We are students." },
        { spanish: "ingeniero/a", english: "engineer", pronunciation: "een-heh-NYEH-roh", exampleSentence: "Mi padre es ingeniero.", exampleTranslation: "My father is an engineer." },
        { spanish: "abogado/a", english: "lawyer", pronunciation: "ah-boh-GAH-doh", exampleSentence: "¿Eres abogado?", exampleTranslation: "Are you a lawyer?" },
      ];
      for (let i = 0; i < professions.length; i++) {
        const id = await ctx.db.insert("hola_vocabularyItems", { categoryId, ...professions[i], order: i + 1 });
        vocabIds.push(id);
        totalCreated.vocabulary++;
      }

      const grammarId = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Verb SER - To Be (Permanent)",
        explanation: "SER is used for permanent characteristics: identity, profession, nationality, origin, physical traits, personality, time, and possession.",
        formula: "yo soy, tú eres, él/ella/usted es, nosotros somos, ellos/ustedes son",
        examples: [
          { spanish: "Soy de México.", english: "I am from Mexico." },
          { spanish: "Ella es alta.", english: "She is tall." },
          { spanish: "Son las tres.", english: "It's three o'clock." },
        ],
        tips: [
          "Remember D.O.C.T.O.R.: Description, Occupation, Characteristic, Time, Origin, Relationship",
          "SER for 'what' something IS, ESTAR for 'how' or 'where' it IS",
        ],
        order: 1,
      });
      totalCreated.grammar++;

      const exerciseIds = [];
      const ex1 = await ctx.db.insert("hola_exercises", {
        categoryId,
        type: "fill_blank",
        question: "Complete: Yo _____ estudiante. (I am a student)",
        correctAnswer: "soy",
        explanation: "With 'yo' (I), we use 'soy' from the verb SER for identity/profession.",
        difficulty: 1,
        order: 1,
      });
      exerciseIds.push(ex1);
      totalCreated.exercises++;

      const ex2 = await ctx.db.insert("hola_exercises", {
        categoryId,
        type: "multiple_choice",
        question: "Which form of SER is used with 'nosotros'?",
        options: ["soy", "eres", "somos", "son"],
        correctAnswer: "somos",
        explanation: "Nosotros (we) uses 'somos'. Example: Nosotros somos amigos.",
        difficulty: 1,
        order: 2,
      });
      exerciseIds.push(ex2);
      totalCreated.exercises++;

      await ctx.db.patch(lesson2_1._id, { vocabularyIds: vocabIds, grammarIds: [grammarId], exerciseIds });
    }

    // ==================== LESSON 2.3: Regular -AR Verbs ====================
    const lesson2_3 = findLesson("2.3");
    if (lesson2_3 && lesson2_3.grammarIds.length === 0) {
      const vocabIds = [];
      const arVerbs = [
        { spanish: "hablar", english: "to speak", pronunciation: "ah-BLAHR", exampleSentence: "Hablo español.", exampleTranslation: "I speak Spanish." },
        { spanish: "estudiar", english: "to study", pronunciation: "ehs-too-DYAHR", exampleSentence: "Estudiamos mucho.", exampleTranslation: "We study a lot." },
        { spanish: "trabajar", english: "to work", pronunciation: "trah-bah-HAHR", exampleSentence: "Trabajo en una oficina.", exampleTranslation: "I work in an office." },
        { spanish: "caminar", english: "to walk", pronunciation: "kah-mee-NAHR", exampleSentence: "Caminan al parque.", exampleTranslation: "They walk to the park." },
        { spanish: "comprar", english: "to buy", pronunciation: "kohm-PRAHR", exampleSentence: "¿Compras pan?", exampleTranslation: "Do you buy bread?" },
        { spanish: "escuchar", english: "to listen", pronunciation: "ehs-koo-CHAHR", exampleSentence: "Escucho música.", exampleTranslation: "I listen to music." },
      ];
      for (let i = 0; i < arVerbs.length; i++) {
        const id = await ctx.db.insert("hola_vocabularyItems", { categoryId, ...arVerbs[i], order: i + 1 });
        vocabIds.push(id);
        totalCreated.vocabulary++;
      }

      const grammarId = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Regular -AR Verb Conjugation",
        explanation: "To conjugate regular -AR verbs, remove -AR and add the appropriate ending based on the subject.",
        formula: "yo -o, tú -as, él/ella/usted -a, nosotros -amos, ellos/ustedes -an",
        examples: [
          { spanish: "hablar → hablo, hablas, habla, hablamos, hablan", english: "to speak → I speak, you speak, he/she speaks, we speak, they speak" },
          { spanish: "Ella trabaja mucho.", english: "She works a lot." },
          { spanish: "¿Estudias español?", english: "Do you study Spanish?" },
        ],
        tips: [
          "The 'nosotros' form keeps the stress on the same syllable as the infinitive",
          "Most -AR verbs are regular, making them easy to learn",
        ],
        order: 1,
      });
      totalCreated.grammar++;

      const ex1 = await ctx.db.insert("hola_exercises", {
        categoryId,
        type: "fill_blank",
        question: "Complete: Ella _____ español. (hablar - she speaks)",
        correctAnswer: "habla",
        explanation: "For él/ella/usted with -AR verbs, we use the -a ending: habla.",
        difficulty: 1,
        order: 1,
      });
      totalCreated.exercises++;

      await ctx.db.patch(lesson2_3._id, { vocabularyIds: vocabIds, grammarIds: [grammarId], exerciseIds: [ex1] });
    }

    // ==================== LESSON 2.4: Regular -ER/-IR Verbs ====================
    const lesson2_4 = findLesson("2.4");
    if (lesson2_4 && lesson2_4.grammarIds.length === 0) {
      const vocabIds = [];
      const erIrVerbs = [
        { spanish: "comer", english: "to eat", pronunciation: "koh-MEHR", exampleSentence: "Como frutas.", exampleTranslation: "I eat fruits." },
        { spanish: "beber", english: "to drink", pronunciation: "beh-BEHR", exampleSentence: "Beben agua.", exampleTranslation: "They drink water." },
        { spanish: "leer", english: "to read", pronunciation: "leh-EHR", exampleSentence: "Leo libros.", exampleTranslation: "I read books." },
        { spanish: "vivir", english: "to live", pronunciation: "bee-BEER", exampleSentence: "Vivo en Madrid.", exampleTranslation: "I live in Madrid." },
        { spanish: "escribir", english: "to write", pronunciation: "ehs-kree-BEER", exampleSentence: "Escribes bien.", exampleTranslation: "You write well." },
        { spanish: "abrir", english: "to open", pronunciation: "ah-BREER", exampleSentence: "Abrimos la puerta.", exampleTranslation: "We open the door." },
      ];
      for (let i = 0; i < erIrVerbs.length; i++) {
        const id = await ctx.db.insert("hola_vocabularyItems", { categoryId, ...erIrVerbs[i], order: i + 1 });
        vocabIds.push(id);
        totalCreated.vocabulary++;
      }

      const grammarId = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Regular -ER/-IR Verb Conjugation",
        explanation: "-ER and -IR verbs share similar endings. The only difference is in the 'nosotros' form.",
        formula: "-ER: -o, -es, -e, -emos, -en | -IR: -o, -es, -e, -imos, -en",
        examples: [
          { spanish: "comer → como, comes, come, comemos, comen", english: "to eat → I eat, you eat, he eats, we eat, they eat" },
          { spanish: "vivir → vivo, vives, vive, vivimos, viven", english: "to live → I live, you live, he lives, we live, they live" },
        ],
        tips: [
          "-ER and -IR are identical except nosotros: -emos vs -imos",
          "The yo form is always -o for all regular verbs",
        ],
        order: 1,
      });
      totalCreated.grammar++;

      await ctx.db.patch(lesson2_4._id, { vocabularyIds: vocabIds, grammarIds: [grammarId] });
    }

    // ==================== LESSON 2.5: Articles & Agreement ====================
    const lesson2_5 = findLesson("2.5");
    if (lesson2_5 && lesson2_5.grammarIds.length === 0) {
      const grammarIds = [];

      const g1 = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Definite Articles (el, la, los, las)",
        explanation: "Spanish has four definite articles that match the gender and number of the noun. Use them like 'the' in English.",
        formula: "Masculine: el (singular), los (plural) | Feminine: la (singular), las (plural)",
        examples: [
          { spanish: "el libro / los libros", english: "the book / the books" },
          { spanish: "la mesa / las mesas", english: "the table / the tables" },
          { spanish: "el agua (f.)", english: "the water (feminine but uses 'el' for sound)" },
        ],
        tips: [
          "Words ending in -o are usually masculine, -a usually feminine",
          "Use 'el' before feminine words starting with stressed 'a': el agua, el águila",
        ],
        order: 1,
      });
      grammarIds.push(g1);
      totalCreated.grammar++;

      const g2 = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Indefinite Articles (un, una, unos, unas)",
        explanation: "Indefinite articles are like 'a/an' or 'some' in English. They also match gender and number.",
        formula: "Masculine: un (singular), unos (plural) | Feminine: una (singular), unas (plural)",
        examples: [
          { spanish: "un perro / unos perros", english: "a dog / some dogs" },
          { spanish: "una casa / unas casas", english: "a house / some houses" },
        ],
        tips: [
          "'Unos/unas' means 'some' or 'a few'",
          "Don't use articles with professions after SER: Soy médico (not 'Soy un médico')",
        ],
        order: 2,
      });
      grammarIds.push(g2);
      totalCreated.grammar++;

      const ex1 = await ctx.db.insert("hola_exercises", {
        categoryId,
        type: "multiple_choice",
        question: "Which article goes with 'mesas' (tables)?",
        options: ["el", "la", "los", "las"],
        correctAnswer: "las",
        explanation: "'Mesa' is feminine (-a ending) and 'mesas' is plural, so we use 'las'.",
        difficulty: 1,
        order: 1,
      });
      totalCreated.exercises++;

      await ctx.db.patch(lesson2_5._id, { grammarIds, exerciseIds: [ex1] });
    }

    // ==================== LESSON 2.6: Describing People ====================
    const lesson2_6 = findLesson("2.6");
    if (lesson2_6 && lesson2_6.vocabularyIds.length === 0) {
      const vocabIds = [];
      const adjectives = [
        { spanish: "alto/a", english: "tall", pronunciation: "AHL-toh", exampleSentence: "Mi hermano es alto.", exampleTranslation: "My brother is tall." },
        { spanish: "bajo/a", english: "short", pronunciation: "BAH-hoh", exampleSentence: "Ella es baja.", exampleTranslation: "She is short." },
        { spanish: "guapo/a", english: "handsome/pretty", pronunciation: "GWAH-poh", exampleSentence: "Es muy guapa.", exampleTranslation: "She is very pretty." },
        { spanish: "simpático/a", english: "nice/friendly", pronunciation: "seem-PAH-tee-koh", exampleSentence: "Son muy simpáticos.", exampleTranslation: "They are very nice." },
        { spanish: "inteligente", english: "intelligent", pronunciation: "een-teh-lee-HEHN-teh", exampleSentence: "Es inteligente.", exampleTranslation: "He/She is intelligent." },
        { spanish: "joven", english: "young", pronunciation: "HOH-behn", exampleSentence: "Somos jóvenes.", exampleTranslation: "We are young." },
        { spanish: "viejo/a", english: "old", pronunciation: "BYEH-hoh", exampleSentence: "Mi abuelo es viejo.", exampleTranslation: "My grandfather is old." },
      ];
      for (let i = 0; i < adjectives.length; i++) {
        const id = await ctx.db.insert("hola_vocabularyItems", { categoryId, ...adjectives[i], order: i + 1 });
        vocabIds.push(id);
        totalCreated.vocabulary++;
      }

      const grammarId = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Adjective Agreement",
        explanation: "Adjectives must match the noun in gender AND number. Most adjectives come AFTER the noun.",
        formula: "Noun + Adjective (matching gender/number)",
        examples: [
          { spanish: "el chico alto / la chica alta", english: "the tall boy / the tall girl" },
          { spanish: "los chicos altos / las chicas altas", english: "the tall boys / the tall girls" },
          { spanish: "un hombre inteligente / una mujer inteligente", english: "an intelligent man / woman (-e endings don't change for gender)" },
        ],
        tips: [
          "Adjectives ending in -o change to -a for feminine",
          "Adjectives ending in -e or consonants usually don't change for gender",
          "Add -s for plural (or -es after consonants)",
        ],
        order: 1,
      });
      totalCreated.grammar++;

      await ctx.db.patch(lesson2_6._id, { vocabularyIds: vocabIds, grammarIds: [grammarId] });
    }

    // ==================== LESSON 3.1: Days, Months, Seasons ====================
    const lesson3_1 = findLesson("3.1");
    if (lesson3_1 && lesson3_1.vocabularyIds.length === 0) {
      const vocabIds = [];
      const timeWords = [
        { spanish: "lunes", english: "Monday", pronunciation: "LOO-nehs", exampleSentence: "El lunes trabajo.", exampleTranslation: "On Monday I work." },
        { spanish: "martes", english: "Tuesday", pronunciation: "MAHR-tehs", exampleSentence: "Los martes estudio.", exampleTranslation: "On Tuesdays I study." },
        { spanish: "miércoles", english: "Wednesday", pronunciation: "MYEHR-koh-lehs" },
        { spanish: "jueves", english: "Thursday", pronunciation: "HWEH-behs" },
        { spanish: "viernes", english: "Friday", pronunciation: "BYEHR-nehs" },
        { spanish: "sábado", english: "Saturday", pronunciation: "SAH-bah-doh" },
        { spanish: "domingo", english: "Sunday", pronunciation: "doh-MEEN-goh" },
        { spanish: "enero", english: "January", pronunciation: "eh-NEH-roh" },
        { spanish: "primavera", english: "spring", pronunciation: "pree-mah-BEH-rah" },
        { spanish: "verano", english: "summer", pronunciation: "beh-RAH-noh" },
        { spanish: "otoño", english: "autumn/fall", pronunciation: "oh-TOH-nyoh" },
        { spanish: "invierno", english: "winter", pronunciation: "een-BYEHR-noh" },
      ];
      for (let i = 0; i < timeWords.length; i++) {
        const id = await ctx.db.insert("hola_vocabularyItems", { categoryId, ...timeWords[i], order: i + 1 });
        vocabIds.push(id);
        totalCreated.vocabulary++;
      }

      const grammarId = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Days and Dates in Spanish",
        explanation: "Days of the week are NOT capitalized in Spanish. Use 'el' for specific day, 'los' for recurring.",
        formula: "el + day (specific) | los + day (every week)",
        examples: [
          { spanish: "Hoy es lunes.", english: "Today is Monday." },
          { spanish: "El lunes voy al médico.", english: "On Monday I'm going to the doctor." },
          { spanish: "Los viernes salgo con amigos.", english: "On Fridays I go out with friends." },
        ],
        tips: [
          "Days and months are NOT capitalized in Spanish",
          "Date format: día + de + mes + de + año (15 de marzo de 2024)",
        ],
        order: 1,
      });
      totalCreated.grammar++;

      await ctx.db.patch(lesson3_1._id, { vocabularyIds: vocabIds, grammarIds: [grammarId] });
    }

    // ==================== LESSON 3.2: Telling Time ====================
    const lesson3_2 = findLesson("3.2");
    if (lesson3_2 && lesson3_2.grammarIds.length === 0) {
      const grammarId = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Telling Time in Spanish",
        explanation: "Use 'Es la...' for 1:00, 'Son las...' for all other hours. Add minutes with 'y', subtract with 'menos'.",
        formula: "Es la una / Son las [2-12] + y/menos + minutes",
        examples: [
          { spanish: "Es la una.", english: "It's one o'clock." },
          { spanish: "Son las tres.", english: "It's three o'clock." },
          { spanish: "Son las dos y media.", english: "It's 2:30 (two and a half)." },
          { spanish: "Son las cinco menos cuarto.", english: "It's 4:45 (five minus quarter)." },
        ],
        tips: [
          "Use 'y cuarto' for :15, 'y media' for :30, 'menos cuarto' for :45",
          "'¿Qué hora es?' = What time is it?",
          "For AM/PM: 'de la mañana', 'de la tarde', 'de la noche'",
        ],
        order: 1,
      });
      totalCreated.grammar++;

      const phraseIds = [];
      const phrases = [
        { spanish: "¿Qué hora es?", english: "What time is it?", context: "Asking for the current time", formalityLevel: "neutral" as const },
        { spanish: "Son las diez de la mañana.", english: "It's 10 in the morning.", context: "Specifying morning time", formalityLevel: "neutral" as const },
        { spanish: "A las ocho.", english: "At eight o'clock.", context: "Saying when something happens", formalityLevel: "neutral" as const },
      ];
      for (let i = 0; i < phrases.length; i++) {
        const id = await ctx.db.insert("hola_phrases", { categoryId, ...phrases[i], order: i + 1 });
        phraseIds.push(id);
        totalCreated.phrases++;
      }

      await ctx.db.patch(lesson3_2._id, { grammarIds: [grammarId], phraseIds });
    }

    // ==================== LESSON 3.4: TENER ====================
    const lesson3_4 = findLesson("3.4");
    if (lesson3_4 && lesson3_4.grammarIds.length === 0) {
      const grammarId = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Irregular Verb TENER (to have)",
        explanation: "TENER is irregular and essential for expressing possession, age, and many idiomatic expressions.",
        formula: "yo tengo, tú tienes, él/ella/usted tiene, nosotros tenemos, ellos/ustedes tienen",
        examples: [
          { spanish: "Tengo un perro.", english: "I have a dog." },
          { spanish: "¿Tienes hambre?", english: "Are you hungry? (Do you have hunger?)" },
          { spanish: "Tenemos que ir.", english: "We have to go." },
        ],
        tips: [
          "TENER + que + infinitive = 'have to' (obligation)",
          "Many feelings use TENER: hambre (hungry), sed (thirsty), sueño (sleepy), frío (cold), calor (hot)",
          "Age uses TENER: Tengo 25 años (I am 25 years old - I have 25 years)",
        ],
        order: 1,
      });
      totalCreated.grammar++;

      const phraseIds = [];
      const phrases = [
        { spanish: "Tengo hambre.", english: "I'm hungry.", context: "Literally: I have hunger", formalityLevel: "neutral" as const },
        { spanish: "Tengo sed.", english: "I'm thirsty.", context: "Literally: I have thirst", formalityLevel: "neutral" as const },
        { spanish: "Tengo sueño.", english: "I'm sleepy.", context: "Literally: I have sleep", formalityLevel: "neutral" as const },
        { spanish: "Tengo frío.", english: "I'm cold.", context: "Literally: I have cold", formalityLevel: "neutral" as const },
        { spanish: "Tengo calor.", english: "I'm hot.", context: "Literally: I have heat", formalityLevel: "neutral" as const },
      ];
      for (let i = 0; i < phrases.length; i++) {
        const id = await ctx.db.insert("hola_phrases", { categoryId, ...phrases[i], order: i + 1 });
        phraseIds.push(id);
        totalCreated.phrases++;
      }

      await ctx.db.patch(lesson3_4._id, { grammarIds: [grammarId], phraseIds });
    }

    // ==================== LESSON 4.1: Family Vocabulary ====================
    const lesson4_1 = findLesson("4.1");
    if (lesson4_1 && lesson4_1.vocabularyIds.length === 0) {
      const vocabIds = [];
      const family = [
        { spanish: "la madre / la mamá", english: "mother / mom", pronunciation: "MAH-dreh / mah-MAH" },
        { spanish: "el padre / el papá", english: "father / dad", pronunciation: "PAH-dreh / pah-PAH" },
        { spanish: "los padres", english: "parents", pronunciation: "PAH-drehs" },
        { spanish: "el hermano", english: "brother", pronunciation: "ehr-MAH-noh" },
        { spanish: "la hermana", english: "sister", pronunciation: "ehr-MAH-nah" },
        { spanish: "el abuelo", english: "grandfather", pronunciation: "ah-BWEH-loh" },
        { spanish: "la abuela", english: "grandmother", pronunciation: "ah-BWEH-lah" },
        { spanish: "el tío", english: "uncle", pronunciation: "TEE-oh" },
        { spanish: "la tía", english: "aunt", pronunciation: "TEE-ah" },
        { spanish: "el primo", english: "cousin (male)", pronunciation: "PREE-moh" },
        { spanish: "la prima", english: "cousin (female)", pronunciation: "PREE-mah" },
        { spanish: "el hijo", english: "son", pronunciation: "EE-hoh" },
        { spanish: "la hija", english: "daughter", pronunciation: "EE-hah" },
      ];
      for (let i = 0; i < family.length; i++) {
        const id = await ctx.db.insert("hola_vocabularyItems", { categoryId, ...family[i], order: i + 1 });
        vocabIds.push(id);
        totalCreated.vocabulary++;
      }

      await ctx.db.patch(lesson4_1._id, { vocabularyIds: vocabIds });
    }

    // ==================== LESSON 4.2: Possessive Adjectives ====================
    const lesson4_2 = findLesson("4.2");
    if (lesson4_2 && lesson4_2.grammarIds.length === 0) {
      const grammarId = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Possessive Adjectives",
        explanation: "Possessive adjectives show ownership. They agree with the THING possessed (not the owner) in number, and some in gender.",
        formula: "mi/mis, tu/tus, su/sus, nuestro/a/os/as, su/sus",
        examples: [
          { spanish: "mi libro / mis libros", english: "my book / my books" },
          { spanish: "tu casa / tus casas", english: "your house / your houses" },
          { spanish: "su perro / sus perros", english: "his/her/your(formal) dog / dogs" },
          { spanish: "nuestro padre / nuestra madre", english: "our father / our mother" },
        ],
        tips: [
          "'Su' can mean his, her, its, your (formal), or their - context clarifies",
          "Only 'nuestro' changes for gender: nuestro hermano, nuestra hermana",
        ],
        order: 1,
      });
      totalCreated.grammar++;

      await ctx.db.patch(lesson4_2._id, { grammarIds: [grammarId] });
    }

    // ==================== LESSON 4.4: IR (to go) ====================
    const lesson4_4 = findLesson("4.4");
    if (lesson4_4 && lesson4_4.grammarIds.length === 0) {
      const grammarId = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Irregular Verb IR (to go)",
        explanation: "IR is highly irregular but essential. It's used for movement and to express near future.",
        formula: "yo voy, tú vas, él/ella/usted va, nosotros vamos, ellos/ustedes van",
        examples: [
          { spanish: "Voy a la escuela.", english: "I go to school." },
          { spanish: "¿Adónde vas?", english: "Where are you going?" },
          { spanish: "Vamos a comer.", english: "We're going to eat. (near future)" },
        ],
        tips: [
          "IR + a + infinitive = near future (going to do something)",
          "¡Vamos! = Let's go!",
          "'a' + 'el' contracts to 'al': Voy al parque (not 'a el parque')",
        ],
        order: 1,
      });
      totalCreated.grammar++;

      const phraseIds = [];
      const phrases = [
        { spanish: "Voy a trabajar.", english: "I'm going to work.", context: "Near future with IR + a + infinitive", formalityLevel: "neutral" as const },
        { spanish: "¿Adónde vas?", english: "Where are you going?", context: "Asking about destination", formalityLevel: "informal" as const },
        { spanish: "¡Vamos!", english: "Let's go!", context: "Invitation to go together", formalityLevel: "neutral" as const },
      ];
      for (let i = 0; i < phrases.length; i++) {
        const id = await ctx.db.insert("hola_phrases", { categoryId, ...phrases[i], order: i + 1 });
        phraseIds.push(id);
        totalCreated.phrases++;
      }

      await ctx.db.patch(lesson4_4._id, { grammarIds: [grammarId], phraseIds });
    }

    // ==================== LESSON 5.2: GUSTAR ====================
    const lesson5_2 = findLesson("5.2");
    if (lesson5_2 && lesson5_2.grammarIds.length === 0) {
      const grammarId = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "Verb GUSTAR (to like/to please)",
        explanation: "GUSTAR works backwards from English! The thing liked is the subject. Literally 'X pleases me' not 'I like X'.",
        formula: "(A mí) me gusta/gustan + thing(s) | Indirect Object + gusta/gustan + subject",
        examples: [
          { spanish: "Me gusta el café.", english: "I like coffee. (Coffee pleases me)" },
          { spanish: "Me gustan los libros.", english: "I like books. (Books please me)" },
          { spanish: "¿Te gusta bailar?", english: "Do you like to dance?" },
          { spanish: "A ella le gusta la música.", english: "She likes music." },
        ],
        tips: [
          "Use 'gusta' for singular nouns or infinitives",
          "Use 'gustan' for plural nouns",
          "Indirect object pronouns: me, te, le, nos, les",
          "Add 'A mí/ti/él' for emphasis or clarity",
        ],
        order: 1,
      });
      totalCreated.grammar++;

      const ex1 = await ctx.db.insert("hola_exercises", {
        categoryId,
        type: "fill_blank",
        question: "Complete: Me _____ las manzanas. (I like apples)",
        correctAnswer: "gustan",
        explanation: "Use 'gustan' because 'manzanas' (apples) is plural.",
        difficulty: 2,
        order: 1,
      });
      totalCreated.exercises++;

      await ctx.db.patch(lesson5_2._id, { grammarIds: [grammarId], exerciseIds: [ex1] });
    }

    // ==================== LESSON 6.1: City Locations ====================
    const lesson6_1 = findLesson("6.1");
    if (lesson6_1 && lesson6_1.vocabularyIds.length === 0) {
      const vocabIds = [];
      const places = [
        { spanish: "el banco", english: "bank", pronunciation: "BAHN-koh" },
        { spanish: "el supermercado", english: "supermarket", pronunciation: "soo-pehr-mehr-KAH-doh" },
        { spanish: "la farmacia", english: "pharmacy", pronunciation: "fahr-MAH-syah" },
        { spanish: "el hospital", english: "hospital", pronunciation: "ohs-pee-TAHL" },
        { spanish: "la iglesia", english: "church", pronunciation: "ee-GLEH-syah" },
        { spanish: "el parque", english: "park", pronunciation: "PAHR-keh" },
        { spanish: "la biblioteca", english: "library", pronunciation: "bee-blyoh-TEH-kah" },
        { spanish: "el restaurante", english: "restaurant", pronunciation: "rehs-tow-RAHN-teh" },
        { spanish: "la estación", english: "station", pronunciation: "ehs-tah-SYOHN" },
        { spanish: "el aeropuerto", english: "airport", pronunciation: "ah-eh-roh-PWEHR-toh" },
      ];
      for (let i = 0; i < places.length; i++) {
        const id = await ctx.db.insert("hola_vocabularyItems", { categoryId, ...places[i], order: i + 1 });
        vocabIds.push(id);
        totalCreated.vocabulary++;
      }

      const grammarId = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "HAY - There is/There are",
        explanation: "'Hay' is used to express existence. It's the same for singular and plural.",
        formula: "Hay + noun(s)",
        examples: [
          { spanish: "Hay un banco aquí.", english: "There is a bank here." },
          { spanish: "Hay muchos restaurantes.", english: "There are many restaurants." },
          { spanish: "¿Hay una farmacia cerca?", english: "Is there a pharmacy nearby?" },
        ],
        tips: [
          "'Hay' never changes - use it for both singular and plural",
          "Use 'hay' for indefinite things (a, some) vs 'está/están' for definite (the)",
        ],
        order: 1,
      });
      totalCreated.grammar++;

      await ctx.db.patch(lesson6_1._id, { vocabularyIds: vocabIds, grammarIds: [grammarId] });
    }

    // ==================== LESSON 6.2: Prepositions of Place ====================
    const lesson6_2 = findLesson("6.2");
    if (lesson6_2 && lesson6_2.vocabularyIds.length === 0) {
      const vocabIds = [];
      const prepositions = [
        { spanish: "en", english: "in/on/at", pronunciation: "ehn", exampleSentence: "El libro está en la mesa.", exampleTranslation: "The book is on the table." },
        { spanish: "sobre", english: "on top of", pronunciation: "SOH-breh", exampleSentence: "El gato está sobre la cama.", exampleTranslation: "The cat is on the bed." },
        { spanish: "debajo de", english: "under", pronunciation: "deh-BAH-hoh deh", exampleSentence: "El perro está debajo de la mesa.", exampleTranslation: "The dog is under the table." },
        { spanish: "cerca de", english: "near", pronunciation: "SEHR-kah deh", exampleSentence: "Vivo cerca del parque.", exampleTranslation: "I live near the park." },
        { spanish: "lejos de", english: "far from", pronunciation: "LEH-hohs deh", exampleSentence: "El aeropuerto está lejos.", exampleTranslation: "The airport is far." },
        { spanish: "al lado de", english: "next to", pronunciation: "ahl LAH-doh deh", exampleSentence: "El banco está al lado del supermercado.", exampleTranslation: "The bank is next to the supermarket." },
        { spanish: "entre", english: "between", pronunciation: "EHN-treh", exampleSentence: "Está entre la iglesia y el parque.", exampleTranslation: "It's between the church and the park." },
        { spanish: "enfrente de", english: "in front of", pronunciation: "ehn-FREHN-teh deh" },
        { spanish: "detrás de", english: "behind", pronunciation: "deh-TRAHS deh" },
      ];
      for (let i = 0; i < prepositions.length; i++) {
        const id = await ctx.db.insert("hola_vocabularyItems", { categoryId, ...prepositions[i], order: i + 1 });
        vocabIds.push(id);
        totalCreated.vocabulary++;
      }

      await ctx.db.patch(lesson6_2._id, { vocabularyIds: vocabIds });
    }

    // ==================== LESSON 6.3: Where are you from? ====================
    const lesson6_3 = findLesson("6.3");
    if (lesson6_3 && lesson6_3.vocabularyIds.length === 0) {
      const vocabIds = [];
      const countries = [
        { spanish: "Estados Unidos", english: "United States", exampleSentence: "Soy de Estados Unidos.", exampleTranslation: "I'm from the United States." },
        { spanish: "México", english: "Mexico", exampleSentence: "Ella es mexicana.", exampleTranslation: "She is Mexican." },
        { spanish: "España", english: "Spain", exampleSentence: "Soy español.", exampleTranslation: "I'm Spanish (male)." },
        { spanish: "Argentina", english: "Argentina", exampleSentence: "Son argentinos.", exampleTranslation: "They are Argentinian." },
        { spanish: "Colombia", english: "Colombia", exampleSentence: "Eres colombiano.", exampleTranslation: "You are Colombian." },
        { spanish: "Francia", english: "France", exampleSentence: "Es de Francia.", exampleTranslation: "He/She is from France." },
        { spanish: "Alemania", english: "Germany", exampleSentence: "Somos alemanes.", exampleTranslation: "We are German." },
        { spanish: "China", english: "China" },
        { spanish: "Japón", english: "Japan" },
        { spanish: "Brasil", english: "Brazil" },
      ];
      for (let i = 0; i < countries.length; i++) {
        const id = await ctx.db.insert("hola_vocabularyItems", { categoryId, ...countries[i], order: i + 1 });
        vocabIds.push(id);
        totalCreated.vocabulary++;
      }

      const phraseIds = [];
      const phrases = [
        { spanish: "¿De dónde eres?", english: "Where are you from? (informal)", context: "Asking about origin", formalityLevel: "informal" as const },
        { spanish: "¿De dónde es usted?", english: "Where are you from? (formal)", context: "Formal version", formalityLevel: "formal" as const },
        { spanish: "Soy de...", english: "I'm from...", context: "Stating your origin", formalityLevel: "neutral" as const },
      ];
      for (let i = 0; i < phrases.length; i++) {
        const id = await ctx.db.insert("hola_phrases", { categoryId, ...phrases[i], order: i + 1 });
        phraseIds.push(id);
        totalCreated.phrases++;
      }

      await ctx.db.patch(lesson6_3._id, { vocabularyIds: vocabIds, phraseIds });
    }

    // ==================== LESSON 6.4: Asking for Directions ====================
    const lesson6_4 = findLesson("6.4");
    if (lesson6_4 && lesson6_4.vocabularyIds.length === 0) {
      const vocabIds = [];
      const directions = [
        { spanish: "izquierda", english: "left", pronunciation: "ees-KYEHR-dah", exampleSentence: "Gira a la izquierda.", exampleTranslation: "Turn left." },
        { spanish: "derecha", english: "right", pronunciation: "deh-REH-chah", exampleSentence: "Gira a la derecha.", exampleTranslation: "Turn right." },
        { spanish: "recto / derecho", english: "straight", pronunciation: "REHK-toh", exampleSentence: "Sigue recto.", exampleTranslation: "Go straight." },
        { spanish: "la esquina", english: "corner", pronunciation: "ehs-KEE-nah", exampleSentence: "En la esquina.", exampleTranslation: "At the corner." },
        { spanish: "la calle", english: "street", pronunciation: "KAH-yeh", exampleSentence: "En esta calle.", exampleTranslation: "On this street." },
        { spanish: "la cuadra / la manzana", english: "block", pronunciation: "KWAH-drah", exampleSentence: "Dos cuadras más.", exampleTranslation: "Two more blocks." },
      ];
      for (let i = 0; i < directions.length; i++) {
        const id = await ctx.db.insert("hola_vocabularyItems", { categoryId, ...directions[i], order: i + 1 });
        vocabIds.push(id);
        totalCreated.vocabulary++;
      }

      const phraseIds = [];
      const phrases = [
        { spanish: "¿Dónde está...?", english: "Where is...?", context: "Asking for location", formalityLevel: "neutral" as const },
        { spanish: "¿Cómo llego a...?", english: "How do I get to...?", context: "Asking for directions", formalityLevel: "neutral" as const },
        { spanish: "Está a dos cuadras.", english: "It's two blocks away.", context: "Giving distance", formalityLevel: "neutral" as const },
        { spanish: "Sigue recto y gira a la derecha.", english: "Go straight and turn right.", context: "Giving directions", formalityLevel: "neutral" as const },
      ];
      for (let i = 0; i < phrases.length; i++) {
        const id = await ctx.db.insert("hola_phrases", { categoryId, ...phrases[i], order: i + 1 });
        phraseIds.push(id);
        totalCreated.phrases++;
      }

      await ctx.db.patch(lesson6_4._id, { vocabularyIds: vocabIds, phraseIds });
    }

    // ==================== LESSON 7.3: Common Mistakes ====================
    const lesson7_3 = findLesson("7.3");
    if (lesson7_3 && lesson7_3.grammarIds.length === 0) {
      const grammarIds = [];

      const g1 = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "SER vs ESTAR - Common Mistakes",
        explanation: "The most common error for learners is mixing up SER and ESTAR. Remember: SER for permanent, ESTAR for temporary/location.",
        formula: "SER = D.O.C.T.O.R. | ESTAR = L.E.C.A.",
        examples: [
          { spanish: "✓ Soy alto. / ✗ Estoy alto.", english: "I am tall. (permanent trait = SER)" },
          { spanish: "✓ Estoy cansado. / ✗ Soy cansado.", english: "I am tired. (temporary state = ESTAR)" },
          { spanish: "✓ La fiesta es en mi casa. / ✓ Mi casa está en Madrid.", english: "Event location = SER, Physical location = ESTAR" },
        ],
        tips: [
          "SER for what something IS (identity)",
          "ESTAR for how or where something IS (condition/location)",
          "Some adjectives change meaning: ser aburrido (boring person) vs estar aburrido (feeling bored)",
        ],
        order: 1,
      });
      grammarIds.push(g1);
      totalCreated.grammar++;

      const g2 = await ctx.db.insert("hola_grammarRules", {
        categoryId,
        title: "False Cognates to Avoid",
        explanation: "Some Spanish words look like English words but have different meanings!",
        formula: "embarazada ≠ embarrassed, éxito ≠ exit, etc.",
        examples: [
          { spanish: "embarazada = pregnant (NOT embarrassed)", english: "avergonzado/a = embarrassed" },
          { spanish: "éxito = success (NOT exit)", english: "salida = exit" },
          { spanish: "asistir = to attend (NOT to assist)", english: "ayudar = to help/assist" },
          { spanish: "actualmente = currently (NOT actually)", english: "en realidad = actually" },
        ],
        tips: [
          "When in doubt, look it up!",
          "Many -tion words become -ción in Spanish (but verify meaning)",
        ],
        order: 2,
      });
      grammarIds.push(g2);
      totalCreated.grammar++;

      await ctx.db.patch(lesson7_3._id, { grammarIds });
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

    return { message: "Content cleared", counts };
  },
});
