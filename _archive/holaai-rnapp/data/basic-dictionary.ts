/**
 * Basic Spanish-English dictionary for offline translation fallback
 * Contains ~500 common words and phrases
 */

// Spanish to English dictionary
export const SPANISH_TO_ENGLISH: Record<string, string> = {
  // Greetings & Basics
  'hola': 'hello',
  'adiós': 'goodbye',
  'buenos días': 'good morning',
  'buenas tardes': 'good afternoon',
  'buenas noches': 'good night',
  'gracias': 'thank you',
  'muchas gracias': 'thank you very much',
  'de nada': "you're welcome",
  'por favor': 'please',
  'perdón': 'excuse me',
  'lo siento': "I'm sorry",
  'sí': 'yes',
  'no': 'no',
  'tal vez': 'maybe',
  'quizás': 'perhaps',

  // Common Questions
  '¿cómo estás?': 'how are you?',
  '¿cómo está usted?': 'how are you? (formal)',
  '¿qué tal?': "how's it going?",
  '¿cómo te llamas?': "what's your name?",
  '¿cuánto cuesta?': 'how much does it cost?',
  '¿dónde está?': 'where is?',
  '¿qué hora es?': 'what time is it?',
  '¿qué?': 'what?',
  '¿quién?': 'who?',
  '¿cuándo?': 'when?',
  '¿dónde?': 'where?',
  '¿por qué?': 'why?',
  '¿cómo?': 'how?',
  '¿cuánto?': 'how much?',
  '¿cuántos?': 'how many?',

  // Numbers
  'uno': 'one',
  'dos': 'two',
  'tres': 'three',
  'cuatro': 'four',
  'cinco': 'five',
  'seis': 'six',
  'siete': 'seven',
  'ocho': 'eight',
  'nueve': 'nine',
  'diez': 'ten',
  'veinte': 'twenty',
  'treinta': 'thirty',
  'cuarenta': 'forty',
  'cincuenta': 'fifty',
  'cien': 'one hundred',
  'mil': 'one thousand',

  // Days of the Week
  'lunes': 'Monday',
  'martes': 'Tuesday',
  'miércoles': 'Wednesday',
  'jueves': 'Thursday',
  'viernes': 'Friday',
  'sábado': 'Saturday',
  'domingo': 'Sunday',

  // Months
  'enero': 'January',
  'febrero': 'February',
  'marzo': 'March',
  'abril': 'April',
  'mayo': 'May',
  'junio': 'June',
  'julio': 'July',
  'agosto': 'August',
  'septiembre': 'September',
  'octubre': 'October',
  'noviembre': 'November',
  'diciembre': 'December',

  // Time
  'hoy': 'today',
  'mañana': 'tomorrow',
  'ayer': 'yesterday',
  'ahora': 'now',
  'después': 'later',
  'antes': 'before',
  'siempre': 'always',
  'nunca': 'never',
  'a veces': 'sometimes',

  // Family
  'familia': 'family',
  'padre': 'father',
  'madre': 'mother',
  'hijo': 'son',
  'hija': 'daughter',
  'hermano': 'brother',
  'hermana': 'sister',
  'abuelo': 'grandfather',
  'abuela': 'grandmother',
  'tío': 'uncle',
  'tía': 'aunt',
  'primo': 'cousin',
  'esposo': 'husband',
  'esposa': 'wife',

  // Colors
  'rojo': 'red',
  'azul': 'blue',
  'verde': 'green',
  'amarillo': 'yellow',
  'naranja': 'orange',
  'morado': 'purple',
  'negro': 'black',
  'blanco': 'white',
  'gris': 'gray',
  'marrón': 'brown',
  'rosa': 'pink',

  // Food & Drinks
  'agua': 'water',
  'café': 'coffee',
  'té': 'tea',
  'leche': 'milk',
  'jugo': 'juice',
  'cerveza': 'beer',
  'vino': 'wine',
  'pan': 'bread',
  'queso': 'cheese',
  'carne': 'meat',
  'pollo': 'chicken',
  'pescado': 'fish',
  'arroz': 'rice',
  'frijoles': 'beans',
  'huevo': 'egg',
  'fruta': 'fruit',
  'manzana': 'apple',
  'naranja': 'orange',
  'plátano': 'banana',
  'verdura': 'vegetable',
  'ensalada': 'salad',
  'sopa': 'soup',
  'desayuno': 'breakfast',
  'almuerzo': 'lunch',
  'cena': 'dinner',
  'comida': 'food',

  // Restaurant
  'restaurante': 'restaurant',
  'menú': 'menu',
  'mesa': 'table',
  'cuenta': 'bill',
  'propina': 'tip',
  'mesero': 'waiter',
  'mesera': 'waitress',

  // Places
  'casa': 'house',
  'apartamento': 'apartment',
  'hotel': 'hotel',
  'tienda': 'store',
  'mercado': 'market',
  'banco': 'bank',
  'hospital': 'hospital',
  'farmacia': 'pharmacy',
  'escuela': 'school',
  'universidad': 'university',
  'oficina': 'office',
  'aeropuerto': 'airport',
  'estación': 'station',
  'calle': 'street',
  'plaza': 'plaza',
  'parque': 'park',
  'playa': 'beach',
  'montaña': 'mountain',
  'ciudad': 'city',
  'país': 'country',

  // Transportation
  'carro': 'car',
  'autobús': 'bus',
  'tren': 'train',
  'avión': 'airplane',
  'taxi': 'taxi',
  'bicicleta': 'bicycle',
  'metro': 'subway',

  // Body Parts
  'cabeza': 'head',
  'cara': 'face',
  'ojos': 'eyes',
  'nariz': 'nose',
  'boca': 'mouth',
  'oreja': 'ear',
  'mano': 'hand',
  'brazo': 'arm',
  'pierna': 'leg',
  'pie': 'foot',
  'corazón': 'heart',

  // Adjectives
  'grande': 'big',
  'pequeño': 'small',
  'alto': 'tall',
  'bajo': 'short',
  'largo': 'long',
  'corto': 'short',
  'nuevo': 'new',
  'viejo': 'old',
  'joven': 'young',
  'bueno': 'good',
  'malo': 'bad',
  'bonito': 'pretty',
  'feo': 'ugly',
  'fácil': 'easy',
  'difícil': 'difficult',
  'rápido': 'fast',
  'lento': 'slow',
  'caliente': 'hot',
  'frío': 'cold',
  'rico': 'rich',
  'pobre': 'poor',
  'feliz': 'happy',
  'triste': 'sad',
  'cansado': 'tired',
  'enfermo': 'sick',
  'hambriento': 'hungry',
  'sediento': 'thirsty',

  // Common Verbs (infinitive)
  'ser': 'to be',
  'estar': 'to be',
  'tener': 'to have',
  'hacer': 'to do/make',
  'ir': 'to go',
  'venir': 'to come',
  'querer': 'to want',
  'poder': 'to be able to',
  'saber': 'to know',
  'conocer': 'to know/meet',
  'hablar': 'to speak',
  'comer': 'to eat',
  'beber': 'to drink',
  'vivir': 'to live',
  'trabajar': 'to work',
  'estudiar': 'to study',
  'aprender': 'to learn',
  'escribir': 'to write',
  'leer': 'to read',
  'escuchar': 'to listen',
  'ver': 'to see',
  'mirar': 'to watch/look',
  'comprar': 'to buy',
  'vender': 'to sell',
  'pagar': 'to pay',
  'dar': 'to give',
  'recibir': 'to receive',
  'esperar': 'to wait',
  'llamar': 'to call',
  'dormir': 'to sleep',
  'despertar': 'to wake up',
  'levantarse': 'to get up',
  'caminar': 'to walk',
  'correr': 'to run',
  'nadar': 'to swim',
  'jugar': 'to play',
  'bailar': 'to dance',
  'cantar': 'to sing',
  'cocinar': 'to cook',
  'limpiar': 'to clean',
  'abrir': 'to open',
  'cerrar': 'to close',
  'entrar': 'to enter',
  'salir': 'to leave',
  'llegar': 'to arrive',
  'comenzar': 'to begin',
  'terminar': 'to finish',
  'ayudar': 'to help',
  'necesitar': 'to need',
  'gustar': 'to like',
  'amar': 'to love',
  'pensar': 'to think',
  'creer': 'to believe',
  'entender': 'to understand',
  'recordar': 'to remember',
  'olvidar': 'to forget',

  // Common Phrases
  'me llamo': 'my name is',
  'mucho gusto': 'nice to meet you',
  'con permiso': 'excuse me',
  'no entiendo': "I don't understand",
  'no sé': "I don't know",
  '¿puede repetir?': 'can you repeat?',
  'más despacio': 'more slowly',
  '¿habla inglés?': 'do you speak English?',
  'no hablo español': "I don't speak Spanish",
  'un poco': 'a little',
  'está bien': "it's okay",
  'no hay problema': 'no problem',
  'claro': 'of course',
  'perfecto': 'perfect',
  'exactamente': 'exactly',
  '¡qué bueno!': 'how nice!',
  '¡qué lástima!': 'what a pity!',
  'me gusta': 'I like',
  'no me gusta': "I don't like",
  'tengo hambre': "I'm hungry",
  'tengo sed': "I'm thirsty",
  'tengo sueño': "I'm sleepy",
  'tengo frío': "I'm cold",
  'tengo calor': "I'm hot",
  'tengo prisa': "I'm in a hurry",
  '¡salud!': 'cheers!/bless you!',
  '¡buen provecho!': 'enjoy your meal!',
  '¡buena suerte!': 'good luck!',
  '¡felicidades!': 'congratulations!',
  '¡feliz cumpleaños!': 'happy birthday!',

  // Weather
  'tiempo': 'weather',
  'sol': 'sun',
  'lluvia': 'rain',
  'nieve': 'snow',
  'viento': 'wind',
  'nube': 'cloud',
  'tormenta': 'storm',
  'hace calor': "it's hot",
  'hace frío': "it's cold",
  'hace sol': "it's sunny",
  'está lloviendo': "it's raining",
  'está nevando': "it's snowing",

  // Miscellaneous
  'libro': 'book',
  'teléfono': 'phone',
  'computadora': 'computer',
  'dinero': 'money',
  'llave': 'key',
  'bolsa': 'bag',
  'ropa': 'clothes',
  'zapatos': 'shoes',
  'camisa': 'shirt',
  'pantalones': 'pants',
  'vestido': 'dress',
  'sombrero': 'hat',
  'reloj': 'watch/clock',
  'ventana': 'window',
  'puerta': 'door',
  'silla': 'chair',
  'cama': 'bed',
  'baño': 'bathroom',
  'cocina': 'kitchen',
  'trabajo': 'work/job',
  'problema': 'problem',
  'pregunta': 'question',
  'respuesta': 'answer',
  'nombre': 'name',
  'dirección': 'address',
  'número': 'number',
  'año': 'year',
  'mes': 'month',
  'semana': 'week',
  'día': 'day',
  'hora': 'hour',
  'minuto': 'minute',
  'segundo': 'second',
};

// English to Spanish dictionary (reverse mapping)
export const ENGLISH_TO_SPANISH: Record<string, string> = Object.fromEntries(
  Object.entries(SPANISH_TO_ENGLISH).map(([es, en]) => [en.toLowerCase(), es])
);

// Add some English-first entries that might not map well from Spanish
const additionalEnglishToSpanish: Record<string, string> = {
  'hi': 'hola',
  'bye': 'adiós',
  'thanks': 'gracias',
  'sorry': 'lo siento',
  'okay': 'está bien',
  'ok': 'está bien',
  'yes': 'sí',
  'no': 'no',
  'please': 'por favor',
  'help': 'ayuda',
  'help me': 'ayúdame',
  'i need': 'necesito',
  'i want': 'quiero',
  'i have': 'tengo',
  'i am': 'soy',
  "i'm": 'estoy',
  'where is': '¿dónde está?',
  'how much': '¿cuánto cuesta?',
  'what is': '¿qué es?',
  'who is': '¿quién es?',
  'bathroom': 'baño',
  'water': 'agua',
  'food': 'comida',
  'money': 'dinero',
  'taxi': 'taxi',
  'airport': 'aeropuerto',
  'hotel': 'hotel',
  'restaurant': 'restaurante',
  'beer': 'cerveza',
  'wine': 'vino',
  'coffee': 'café',
};

// Merge additional entries
Object.assign(ENGLISH_TO_SPANISH, additionalEnglishToSpanish);

/**
 * Look up a word in the offline dictionary
 * @param text - The text to translate
 * @param sourceLanguage - Source language ('es', 'en', or 'auto')
 * @param targetLanguage - Target language ('es' or 'en')
 * @returns Translation if found, null otherwise
 */
export function lookupOffline(
  text: string,
  sourceLanguage: 'es' | 'en' | 'auto',
  targetLanguage: 'es' | 'en'
): string | null {
  const normalizedText = text.toLowerCase().trim();

  // If auto-detect, try both dictionaries
  if (sourceLanguage === 'auto') {
    // Try Spanish first
    if (SPANISH_TO_ENGLISH[normalizedText]) {
      return SPANISH_TO_ENGLISH[normalizedText];
    }
    // Then try English
    if (ENGLISH_TO_SPANISH[normalizedText]) {
      return ENGLISH_TO_SPANISH[normalizedText];
    }
    return null;
  }

  // Specific language direction
  if (sourceLanguage === 'es' && targetLanguage === 'en') {
    return SPANISH_TO_ENGLISH[normalizedText] ?? null;
  }

  if (sourceLanguage === 'en' && targetLanguage === 'es') {
    return ENGLISH_TO_SPANISH[normalizedText] ?? null;
  }

  return null;
}

/**
 * Combined dictionary for export
 */
export const BASIC_DICTIONARY = {
  spanishToEnglish: SPANISH_TO_ENGLISH,
  englishToSpanish: ENGLISH_TO_SPANISH,
  lookup: lookupOffline,
};
