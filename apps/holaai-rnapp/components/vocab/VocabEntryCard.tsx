import { StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { SmallAudioButton } from '@/components/audio/SmallAudioButton';
import { useColor } from '@/hooks/useColor';
import { Trash2 } from 'lucide-react-native';
import type { Id, Doc } from '@holaai/convex/_generated/dataModel';

interface VocabEntryCardProps {
  entry: Doc<'hola_vocabBank'>;
  compact?: boolean;
  onDelete?: () => void;
}

/**
 * Card component displaying a single vocabulary bank entry
 */
export function VocabEntryCard({ entry, compact = false, onDelete }: VocabEntryCardProps) {
  const primary = useColor('primary');
  const text = useColor('text');
  const textMuted = useColor('textMuted');
  const destructive = useColor('destructive');

  const removeFromVocabBank = useMutation(api.holaai.vocab.removeFromVocabBank);

  const handleDelete = () => {
    Alert.alert(
      'Delete Entry',
      `Remove "${entry.sourceText}" from your vocabulary bank?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFromVocabBank({ entryId: entry._id });
              onDelete?.();
            } catch (error) {
              console.error('Failed to delete vocab entry:', error);
              Alert.alert('Error', 'Failed to delete entry. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Format timestamp
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const isSpanishSource = entry.sourceLanguage === 'es';

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactContent}>
          <View style={styles.compactTextRow}>
            <Text
              variant="body"
              style={[styles.sourceText, { color: isSpanishSource ? primary : text }]}
              numberOfLines={1}
            >
              {entry.sourceText}
            </Text>
            <SmallAudioButton
              text={entry.sourceText}
              language={isSpanishSource ? 'es-ES' : 'en-US'}
              color={primary}
              size={16}
            />
          </View>
          <Text variant="caption" style={{ color: textMuted }} numberOfLines={1}>
            {entry.translatedText}
          </Text>
        </View>
        <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name={Trash2} size={16} color={textMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Card style={styles.card}>
      <CardContent style={styles.cardContent}>
        <View style={styles.mainContent}>
          {/* Source text with audio */}
          <View style={styles.textRow}>
            <View style={styles.languageBadge}>
              <Text variant="caption" style={styles.languageText}>
                {isSpanishSource ? 'ES' : 'EN'}
              </Text>
            </View>
            <Text
              variant="body"
              style={[styles.sourceText, { color: isSpanishSource ? primary : text }]}
            >
              {entry.sourceText}
            </Text>
            <SmallAudioButton
              text={entry.sourceText}
              language={isSpanishSource ? 'es-ES' : 'en-US'}
              color={primary}
              size={20}
            />
          </View>

          {/* Translation with audio */}
          <View style={styles.textRow}>
            <View style={[styles.languageBadge, { backgroundColor: textMuted + '30' }]}>
              <Text variant="caption" style={[styles.languageText, { color: textMuted }]}>
                {isSpanishSource ? 'EN' : 'ES'}
              </Text>
            </View>
            <Text variant="body" style={[styles.translationText, { color: text }]}>
              {entry.translatedText}
            </Text>
            <SmallAudioButton
              text={entry.translatedText}
              language={isSpanishSource ? 'en-US' : 'es-ES'}
              color={textMuted}
              size={20}
            />
          </View>

          {/* Metadata row */}
          <View style={styles.metaRow}>
            <Text variant="caption" style={{ color: textMuted }}>
              {formatDate(entry.addedAt)}
            </Text>
            {entry.context && (
              <Text variant="caption" style={{ color: textMuted }}>
                • from {entry.context}
              </Text>
            )}
          </View>
        </View>

        {/* Delete button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name={Trash2} size={18} color={destructive} />
        </TouchableOpacity>
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  mainContent: {
    flex: 1,
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  languageBadge: {
    backgroundColor: '#3b82f620',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  languageText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3b82f6',
  },
  sourceText: {
    flex: 1,
    fontWeight: '500',
    fontSize: 16,
  },
  translationText: {
    flex: 1,
    fontSize: 15,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
    justifyContent: 'center',
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  compactContent: {
    flex: 1,
    marginRight: 8,
  },
  compactTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
});
