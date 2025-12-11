import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Modal, Pressable, Alert } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/components/ui/icon';
import { SmallAudioButton } from '@/components/audio/SmallAudioButton';
import { useColor } from '@/hooks/useColor';
import { useTranslation } from '@/hooks/useTranslation';
import { X, BookPlus, Check, WifiOff } from 'lucide-react-native';

interface TranslationModalProps {
  visible: boolean;
  text: string;
  sourceLanguage?: 'es' | 'en' | 'auto';
  onClose: () => void;
  onAddedToVocab?: () => void;
}

/**
 * Modal that displays translation results with option to add to vocab bank
 */
export function TranslationModal({
  visible,
  text,
  sourceLanguage = 'auto',
  onClose,
  onAddedToVocab,
}: TranslationModalProps) {
  const [translatedText, setTranslatedText] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState<string | undefined>();
  const [isOffline, setIsOffline] = useState(false);
  const [addedToVocab, setAddedToVocab] = useState(false);

  const { translate, isTranslating, error } = useTranslation();
  const addToVocabBank = useMutation(api.holaai.vocab.addToVocabBank);

  const background = useColor('background');
  const card = useColor('card');
  const textColor = useColor('text');
  const textMuted = useColor('textMuted');
  const primary = useColor('primary');
  const destructive = useColor('destructive');
  const success = useColor('success');

  // Perform translation when modal opens
  useEffect(() => {
    if (visible && text) {
      setAddedToVocab(false);
      performTranslation();
    }
  }, [visible, text]);

  const performTranslation = async () => {
    try {
      // Detect target language based on source
      let targetLang: 'es' | 'en' = 'en';
      if (sourceLanguage === 'en') {
        targetLang = 'es';
      } else if (sourceLanguage === 'es') {
        targetLang = 'en';
      }
      // For 'auto', default to English (most chat content is Spanish)

      const result = await translate({
        text,
        sourceLanguage,
        targetLanguage: targetLang,
      });

      setTranslatedText(result.translation);
      setDetectedLanguage(result.detectedLanguage);
      setIsOffline(result.isOffline ?? false);
    } catch (err) {
      console.error('Translation error:', err);
    }
  };

  const handleAddToVocab = async () => {
    if (!translatedText) return;

    try {
      const srcLang = detectedLanguage || (sourceLanguage === 'auto' ? 'es' : sourceLanguage);
      const tgtLang = srcLang === 'es' ? 'en' : 'es';

      await addToVocabBank({
        sourceText: text,
        translatedText,
        sourceLanguage: srcLang,
        targetLanguage: tgtLang,
        context: 'chat_highlight',
      });

      setAddedToVocab(true);
      onAddedToVocab?.();
    } catch (err) {
      console.error('Failed to add to vocab:', err);
      Alert.alert('Error', 'Failed to add to vocabulary bank');
    }
  };

  const srcLang = detectedLanguage || (sourceLanguage === 'auto' ? 'es' : sourceLanguage);
  const tgtLang = srcLang === 'es' ? 'en' : 'es';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.modal, { backgroundColor: card }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text variant="title">Translation</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name={X} size={24} color={textMuted} />
            </TouchableOpacity>
          </View>

          {/* Offline indicator */}
          {isOffline && (
            <View style={[styles.offlineBar, { backgroundColor: `${destructive}15` }]}>
              <Icon name={WifiOff} size={14} color={destructive} />
              <Text variant="caption" style={{ color: destructive, marginLeft: 6 }}>
                Offline - Basic dictionary
              </Text>
            </View>
          )}

          {/* Source text */}
          <Card style={styles.textCard}>
            <View style={styles.languageLabel}>
              <Text variant="caption" style={{ color: textMuted, fontWeight: '600' }}>
                {srcLang === 'es' ? 'Spanish' : 'English'}
              </Text>
            </View>
            <Text variant="body" style={[styles.mainText, { color: primary }]}>
              {text}
            </Text>
            <View style={styles.audioRow}>
              <SmallAudioButton
                text={text}
                language={srcLang === 'es' ? 'es-ES' : 'en-US'}
                color={primary}
                size={20}
              />
            </View>
          </Card>

          {/* Arrow divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: textMuted + '30' }]} />
            <Text variant="caption" style={{ color: textMuted, marginHorizontal: 8 }}>
              →
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: textMuted + '30' }]} />
          </View>

          {/* Translation result */}
          <Card style={styles.textCard}>
            <View style={styles.languageLabel}>
              <Text variant="caption" style={{ color: textMuted, fontWeight: '600' }}>
                {tgtLang === 'es' ? 'Spanish' : 'English'}
              </Text>
              {isTranslating && <Spinner variant="circle" size="sm" />}
            </View>

            {isTranslating ? (
              <View style={styles.loadingContainer}>
                <Spinner variant="circle" />
                <Text variant="caption" style={{ color: textMuted, marginTop: 8 }}>
                  Translating...
                </Text>
              </View>
            ) : error ? (
              <Text variant="body" style={{ color: destructive }}>
                {error}
              </Text>
            ) : translatedText ? (
              <>
                <Text variant="body" style={[styles.mainText, { color: textColor }]}>
                  {translatedText}
                </Text>
                <View style={styles.audioRow}>
                  <SmallAudioButton
                    text={translatedText}
                    language={tgtLang === 'es' ? 'es-ES' : 'en-US'}
                    color={textMuted}
                    size={20}
                  />
                </View>
              </>
            ) : (
              <Text variant="body" style={{ color: textMuted }}>
                Translation will appear here
              </Text>
            )}
          </Card>

          {/* Add to Vocab Button */}
          {translatedText && !isTranslating && (
            <TouchableOpacity
              style={[
                styles.addButton,
                addedToVocab
                  ? { backgroundColor: success }
                  : { backgroundColor: primary },
              ]}
              onPress={handleAddToVocab}
              disabled={addedToVocab}
            >
              <Icon
                name={addedToVocab ? Check : BookPlus}
                size={20}
                color="#fff"
              />
              <Text variant="body" style={styles.addButtonText}>
                {addedToVocab ? 'Added to Vocab Bank' : 'Add to Vocab Bank'}
              </Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  textCard: {
    padding: 16,
  },
  languageLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mainText: {
    fontSize: 18,
    lineHeight: 26,
  },
  audioRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
