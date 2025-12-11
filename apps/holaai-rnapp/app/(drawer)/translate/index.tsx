import { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/components/ui/icon';
import { useColor } from '@/hooks/useColor';
import { useTranslation } from '@/hooks/useTranslation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { SmallAudioButton } from '@/components/audio/SmallAudioButton';
import { VocabBankList } from '@/components/vocab/VocabBankList';
import {
  X,
  WifiOff,
  BookMarked,
  Languages,
  Eraser,
} from 'lucide-react-native';

// Debounce timings
const TRANSLATION_DEBOUNCE_MS = 800; // Quick feedback for translation
const VOCAB_SAVE_DEBOUNCE_MS = 2000; // Longer wait before saving to vocab bank

type ViewMode = 'translate' | 'vocab';

export default function TranslateScreen() {
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState<ViewMode>('translate');

  // Translation state - both fields are editable
  const [englishText, setEnglishText] = useState('');
  const [spanishText, setSpanishText] = useState('');
  const [isTranslatingToSpanish, setIsTranslatingToSpanish] = useState(false);
  const [isTranslatingToEnglish, setIsTranslatingToEnglish] = useState(false);
  const [isOfflineResult, setIsOfflineResult] = useState(false);
  const [lastEditedField, setLastEditedField] = useState<'en' | 'es' | null>(null);

  // Track what's been saved to vocab bank to avoid duplicates
  const [lastSavedText, setLastSavedText] = useState<string | null>(null);

  // Debounce timer refs for translation
  const englishDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spanishDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Separate debounce refs for vocab bank saving
  const vocabSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hooks
  const { translate, error } = useTranslation();
  const { isOnline } = useNetworkStatus();
  const addToVocabBank = useMutation(api.holaai.vocab.addToVocabBank);

  // Colors
  const background = useColor('background');
  const card = useColor('card');
  const text = useColor('text');
  const textMuted = useColor('textMuted');
  const primary = useColor('primary');
  const destructive = useColor('destructive');

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (englishDebounceRef.current) clearTimeout(englishDebounceRef.current);
      if (spanishDebounceRef.current) clearTimeout(spanishDebounceRef.current);
      if (vocabSaveDebounceRef.current) clearTimeout(vocabSaveDebounceRef.current);
    };
  }, []);

  // Debounced vocab bank save function
  const scheduleVocabSave = useCallback((
    sourceText: string,
    translatedText: string,
    sourceLanguage: 'en' | 'es',
    targetLanguage: 'en' | 'es'
  ) => {
    // Clear any pending save
    if (vocabSaveDebounceRef.current) {
      clearTimeout(vocabSaveDebounceRef.current);
    }

    // Schedule new save after user stops typing
    vocabSaveDebounceRef.current = setTimeout(async () => {
      const normalizedSource = sourceText.trim().toLowerCase();

      // Skip if already saved this exact text
      if (normalizedSource === lastSavedText) {
        return;
      }

      try {
        await addToVocabBank({
          sourceText: sourceText.trim(),
          translatedText,
          sourceLanguage,
          targetLanguage,
          context: 'translate',
        });
        setLastSavedText(normalizedSource);
      } catch (err) {
        console.warn('Failed to auto-save to vocab bank:', err);
      }
    }, VOCAB_SAVE_DEBOUNCE_MS);
  }, [addToVocabBank, lastSavedText]);

  // Translate English to Spanish
  const translateToSpanish = useCallback(async (inputText: string) => {
    if (!inputText.trim()) {
      setSpanishText('');
      return;
    }

    setIsTranslatingToSpanish(true);
    try {
      const result = await translate({
        text: inputText,
        sourceLanguage: 'en',
        targetLanguage: 'es',
      });

      if (result.translation) {
        setSpanishText(result.translation);
        setIsOfflineResult(result.isOffline ?? false);

        // Schedule vocab bank save with longer debounce
        scheduleVocabSave(inputText, result.translation, 'en', 'es');
      }
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setIsTranslatingToSpanish(false);
    }
  }, [translate, scheduleVocabSave]);

  // Translate Spanish to English
  const translateToEnglish = useCallback(async (inputText: string) => {
    if (!inputText.trim()) {
      setEnglishText('');
      return;
    }

    setIsTranslatingToEnglish(true);
    try {
      const result = await translate({
        text: inputText,
        sourceLanguage: 'es',
        targetLanguage: 'en',
      });

      if (result.translation) {
        setEnglishText(result.translation);
        setIsOfflineResult(result.isOffline ?? false);

        // Schedule vocab bank save with longer debounce
        scheduleVocabSave(inputText, result.translation, 'es', 'en');
      }
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setIsTranslatingToEnglish(false);
    }
  }, [translate, scheduleVocabSave]);

  // Handle English text change
  const handleEnglishChange = useCallback((newText: string) => {
    setEnglishText(newText);
    setLastEditedField('en');

    // Clear previous debounce timers
    if (englishDebounceRef.current) {
      clearTimeout(englishDebounceRef.current);
    }
    if (vocabSaveDebounceRef.current) {
      clearTimeout(vocabSaveDebounceRef.current);
    }

    // Clear Spanish if empty
    if (!newText.trim()) {
      setSpanishText('');
      return;
    }

    // Debounce translation
    englishDebounceRef.current = setTimeout(() => {
      translateToSpanish(newText);
    }, TRANSLATION_DEBOUNCE_MS);
  }, [translateToSpanish]);

  // Handle Spanish text change
  const handleSpanishChange = useCallback((newText: string) => {
    setSpanishText(newText);
    setLastEditedField('es');

    // Clear previous debounce timers
    if (spanishDebounceRef.current) {
      clearTimeout(spanishDebounceRef.current);
    }
    if (vocabSaveDebounceRef.current) {
      clearTimeout(vocabSaveDebounceRef.current);
    }

    // Clear English if empty
    if (!newText.trim()) {
      setEnglishText('');
      return;
    }

    // Debounce translation
    spanishDebounceRef.current = setTimeout(() => {
      translateToEnglish(newText);
    }, TRANSLATION_DEBOUNCE_MS);
  }, [translateToEnglish]);

  // Clear all
  const handleClearAll = useCallback(() => {
    // Cancel any pending vocab save
    if (vocabSaveDebounceRef.current) {
      clearTimeout(vocabSaveDebounceRef.current);
    }

    setEnglishText('');
    setSpanishText('');
    setLastEditedField(null);
    setIsOfflineResult(false);
    setLastSavedText(null);
    Keyboard.dismiss();
  }, []);

  const hasContent = englishText.length > 0 || spanishText.length > 0;

  const renderTranslateView = () => (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Offline indicator */}
        {!isOnline && (
          <View style={[styles.offlineBar, { backgroundColor: `${destructive}20` }]}>
            <Icon name={WifiOff} size={16} color={destructive} />
            <Text variant="caption" style={{ color: destructive, marginLeft: 8 }}>
              Offline - Using basic dictionary
            </Text>
          </View>
        )}

        {/* English Panel (Top) */}
        <Card style={styles.translationCard}>
          <View style={styles.languageHeader}>
            <Text variant="caption" style={{ color: primary, fontWeight: '600' }}>
              English
            </Text>
            <View style={styles.headerRight}>
              {isTranslatingToEnglish && <Spinner variant="circle" size="sm" />}
              {isOfflineResult && lastEditedField === 'es' && !isTranslatingToEnglish && englishText && (
                <Text variant="caption" style={{ color: textMuted, fontSize: 10 }}>
                  (offline)
                </Text>
              )}
            </View>
          </View>

          <TextInput
            style={[styles.textInput, { color: text }]}
            placeholder="Enter English text..."
            placeholderTextColor={textMuted}
            value={englishText}
            onChangeText={handleEnglishChange}
            multiline
            textAlignVertical="top"
            autoCapitalize="sentences"
            autoCorrect={false}
            editable={!isTranslatingToEnglish}
          />

          {englishText.length > 0 && (
            <View style={styles.audioRow}>
              <SmallAudioButton
                text={englishText}
                language="en-US"
                color={primary}
                size={22}
              />
            </View>
          )}
        </Card>

        {/* Spanish Panel (Bottom) */}
        <Card style={[styles.translationCard, { marginTop: 12 }]}>
          <View style={styles.languageHeader}>
            <Text variant="caption" style={{ color: primary, fontWeight: '600' }}>
              Spanish
            </Text>
            <View style={styles.headerRight}>
              {isTranslatingToSpanish && <Spinner variant="circle" size="sm" />}
              {isOfflineResult && lastEditedField === 'en' && !isTranslatingToSpanish && spanishText && (
                <Text variant="caption" style={{ color: textMuted, fontSize: 10 }}>
                  (offline)
                </Text>
              )}
            </View>
          </View>

          <TextInput
            style={[styles.textInput, { color: text }]}
            placeholder="Ingrese texto en español..."
            placeholderTextColor={textMuted}
            value={spanishText}
            onChangeText={handleSpanishChange}
            multiline
            textAlignVertical="top"
            autoCapitalize="sentences"
            autoCorrect={false}
            editable={!isTranslatingToSpanish}
          />

          {spanishText.length > 0 && (
            <View style={styles.audioRow}>
              <SmallAudioButton
                text={spanishText}
                language="es-ES"
                color={primary}
                size={22}
              />
            </View>
          )}
        </Card>

        {/* Clear All Button */}
        {hasContent && (
          <TouchableOpacity
            style={[styles.clearButton, { borderColor: destructive }]}
            onPress={handleClearAll}
          >
            <Icon name={Eraser} size={18} color={destructive} />
            <Text variant="body" style={{ color: destructive, marginLeft: 8, fontWeight: '600' }}>
              Clear All
            </Text>
          </TouchableOpacity>
        )}

        {/* Error display */}
        {error && (
          <View style={[styles.errorBar, { backgroundColor: `${destructive}15` }]}>
            <Text variant="caption" style={{ color: destructive }}>
              {error}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <View style={[styles.screen, { backgroundColor: background, paddingBottom: insets.bottom }]}>
      {/* View Mode Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: card }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            viewMode === 'translate' && { borderBottomColor: primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setViewMode('translate')}
        >
          <Icon
            name={Languages}
            size={18}
            color={viewMode === 'translate' ? primary : textMuted}
          />
          <Text
            variant="caption"
            style={[
              styles.tabText,
              { color: viewMode === 'translate' ? primary : textMuted },
            ]}
          >
            Translate
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            viewMode === 'vocab' && { borderBottomColor: primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setViewMode('vocab')}
        >
          <Icon
            name={BookMarked}
            size={18}
            color={viewMode === 'vocab' ? primary : textMuted}
          />
          <Text
            variant="caption"
            style={[
              styles.tabText,
              { color: viewMode === 'vocab' ? primary : textMuted },
            ]}
          >
            Vocab Bank
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {viewMode === 'translate' ? renderTranslateView() : <VocabBankList compact />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorBar: {
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  translationCard: {
    padding: 16,
    minHeight: 150,
  },
  languageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    minHeight: 80,
  },
  audioRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  tabText: {
    fontWeight: '600',
  },
});
