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

// Clear all seeded content (for development)
export const clearContent = mutation({
  args: { confirm: v.boolean() },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      return { message: "Pass confirm: true to clear all content" };
    }

    // Delete in reverse order of dependencies
    const tables = [
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
