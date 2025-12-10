import { useState, useRef } from 'react';
import { ScrollView, StyleSheet, Dimensions, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { SmallAudioButton } from '@/components/audio/SmallAudioButton';
import { ChevronLeft, ChevronRight, BookOpen, FileText, MessageSquare } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { StageType } from '@/app/(drawer)/journey/learn/[lessonId]';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TeachingStageProps {
  stageType: StageType;
  content: any[];
  onContinue: () => void;
}

export function TeachingStage({ stageType, content, onContinue }: TeachingStageProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const primary = useColor('primary');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const background = useColor('background');

  const isVocab = stageType === 'teach_vocab';
  const isGrammar = stageType === 'teach_grammar';
  const isPhrases = stageType === 'teach_phrases';

  const getStageIcon = () => {
    if (isVocab) return BookOpen;
    if (isGrammar) return FileText;
    return MessageSquare;
  };

  const getStageColor = () => {
    if (isVocab) return '#3b82f6';
    if (isGrammar) return '#f59e0b';
    return '#22c55e';
  };

  const goToNext = () => {
    if (currentIndex < content.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1 });
      setCurrentIndex(currentIndex - 1);
    }
  };

  const renderVocabCard = (item: any) => (
    <View style={styles.cardContainer}>
      <Card style={styles.teachCard}>
        <CardContent style={styles.teachCardContent}>
          {/* Spanish word */}
          <View style={styles.mainWordRow}>
            <Text variant="heading" style={[styles.spanishWord, { color: primary }]}>
              {item.spanish}
            </Text>
            <SmallAudioButton text={item.spanish} color={primary} size={28} />
          </View>

          {/* Pronunciation */}
          {item.pronunciation && (
            <Text variant="body" style={[styles.pronunciation, { color: textMuted }]}>
              /{item.pronunciation}/
            </Text>
          )}

          {/* English translation */}
          <Text variant="title" style={styles.englishWord}>
            {item.english}
          </Text>

          {/* Example sentence */}
          {item.exampleSentence && (
            <View style={[styles.exampleContainer, { backgroundColor: `${primary}10` }]}>
              <View style={styles.exampleRow}>
                <Text variant="body" style={{ color: primary, flex: 1 }}>
                  {item.exampleSentence}
                </Text>
                <SmallAudioButton text={item.exampleSentence} color={primary} size={20} />
              </View>
              {item.exampleTranslation && (
                <Text variant="caption" style={{ color: textMuted, marginTop: 4 }}>
                  {item.exampleTranslation}
                </Text>
              )}
            </View>
          )}
        </CardContent>
      </Card>
    </View>
  );

  const renderGrammarCard = (item: any) => (
    <View style={styles.cardContainer}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Card style={styles.teachCard}>
          <CardContent style={styles.teachCardContent}>
            {/* Title */}
            <Text variant="heading" style={[styles.grammarTitle, { color: primary }]}>
              {item.title}
            </Text>

            {/* Explanation */}
            <Text variant="body" style={styles.explanation}>
              {item.explanation}
            </Text>

            {/* Formula */}
            {item.formula && (
              <View style={[styles.formulaContainer, { backgroundColor: card }]}>
                <Text variant="caption" style={{ color: textMuted, marginBottom: 4 }}>
                  Formula:
                </Text>
                <Text variant="subtitle" style={{ color: primary, fontWeight: '600' }}>
                  {item.formula}
                </Text>
              </View>
            )}

            {/* Examples */}
            {item.examples && item.examples.length > 0 && (
              <View style={styles.examplesSection}>
                <Text variant="subtitle" style={styles.sectionLabel}>
                  Examples:
                </Text>
                {item.examples.map((example: any, idx: number) => (
                  <View
                    key={idx}
                    style={[styles.exampleItem, { backgroundColor: `${primary}10` }]}
                  >
                    <View style={styles.exampleRow}>
                      <Text variant="body" style={{ color: primary, flex: 1 }}>
                        {example.spanish}
                      </Text>
                      <SmallAudioButton text={example.spanish} color={primary} size={18} />
                    </View>
                    <Text variant="caption" style={{ color: textMuted, marginTop: 2 }}>
                      {example.english}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Tips */}
            {item.tips && item.tips.length > 0 && (
              <View style={[styles.tipsContainer, { borderLeftColor: '#f59e0b' }]}>
                <Text variant="caption" style={{ color: '#f59e0b', fontWeight: '600' }}>
                  Tips:
                </Text>
                {item.tips.map((tip: string, idx: number) => (
                  <Text key={idx} variant="caption" style={{ marginTop: 4 }}>
                    • {tip}
                  </Text>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );

  const renderPhraseCard = (item: any) => (
    <View style={styles.cardContainer}>
      <Card style={styles.teachCard}>
        <CardContent style={styles.teachCardContent}>
          {/* Spanish phrase */}
          <View style={styles.mainWordRow}>
            <Text variant="heading" style={[styles.spanishWord, { color: primary }]}>
              {item.spanish}
            </Text>
            <SmallAudioButton text={item.spanish} color={primary} size={28} />
          </View>

          {/* English translation */}
          <Text variant="title" style={styles.englishWord}>
            {item.english}
          </Text>

          {/* Context */}
          {item.context && (
            <Text variant="body" style={[styles.context, { color: textMuted }]}>
              Context: {item.context}
            </Text>
          )}

          {/* Formality level */}
          {item.formalityLevel && (
            <View
              style={[
                styles.formalityBadge,
                {
                  backgroundColor:
                    item.formalityLevel === 'formal'
                      ? '#3b82f6'
                      : item.formalityLevel === 'informal'
                        ? '#22c55e'
                        : '#6b7280',
                },
              ]}
            >
              <Text style={styles.formalityText}>{item.formalityLevel}</Text>
            </View>
          )}
        </CardContent>
      </Card>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    if (isVocab) return renderVocabCard(item);
    if (isGrammar) return renderGrammarCard(item);
    return renderPhraseCard(item);
  };

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      {/* Header with icon */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${getStageColor()}20` }]}>
          <Icon name={getStageIcon()} size={24} color={getStageColor()} />
        </View>
        <Text variant="caption" style={{ color: textMuted }}>
          {currentIndex + 1} of {content.length}
        </Text>
      </View>

      {/* Content carousel */}
      <FlatList
        ref={flatListRef}
        data={content}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH - 32,
          offset: (SCREEN_WIDTH - 32) * index,
          index,
        })}
        style={styles.carousel}
      />

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {content.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index === currentIndex ? primary : `${primary}30`,
                width: index === currentIndex ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Navigation buttons */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.navRow}>
          <Button
            onPress={goToPrev}
            disabled={currentIndex === 0}
            style={[
              styles.navButton,
              { backgroundColor: currentIndex === 0 ? `${textMuted}30` : card },
            ]}
          >
            <Icon name={ChevronLeft} size={24} color={currentIndex === 0 ? textMuted : primary} />
          </Button>

          {currentIndex < content.length - 1 ? (
            <Button
              onPress={goToNext}
              style={[styles.navButton, { backgroundColor: card }]}
            >
              <Icon name={ChevronRight} size={24} color={primary} />
            </Button>
          ) : (
            <Button onPress={onContinue} style={styles.continueButton}>
              <Text style={styles.continueText}>Ready to Practice</Text>
            </Button>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  carousel: {
    flex: 1,
  },
  cardContainer: {
    width: SCREEN_WIDTH - 32,
    paddingHorizontal: 16,
  },
  teachCard: {
    flex: 1,
  },
  teachCardContent: {
    padding: 20,
  },
  mainWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  spanishWord: {
    fontSize: 32,
    fontWeight: 'bold',
    marginRight: 12,
  },
  pronunciation: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  englishWord: {
    textAlign: 'center',
    marginBottom: 20,
  },
  exampleContainer: {
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grammarTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  explanation: {
    lineHeight: 24,
    marginBottom: 16,
  },
  formulaContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  examplesSection: {
    marginTop: 8,
  },
  sectionLabel: {
    marginBottom: 12,
  },
  exampleItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  tipsContainer: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginTop: 16,
  },
  context: {
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  formalityBadge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 16,
  },
  formalityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  footer: {
    padding: 16,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButton: {
    flex: 1,
    marginLeft: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
