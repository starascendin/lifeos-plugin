import { useState, useCallback } from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useColor } from '@/hooks/useColor';
import { useSpanishTTS } from '@/hooks/useSpanishTTS';
import { SmallAudioButton } from '@/components/audio';
import { BookOpen, Languages, MessageSquare, Volume2 } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { Id } from '@holaai/convex/_generated/dataModel';

// Vocabulary Card Component with flip interaction
function VocabularyCard({
  item,
  levelColor,
}: {
  item: {
    _id: string;
    spanish: string;
    english: string;
    pronunciation?: string;
    exampleSentence?: string;
    exampleTranslation?: string;
  };
  levelColor: string;
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const textMuted = useColor('textMuted');
  const { speak } = useSpanishTTS();

  const handleSpeak = useCallback(async (text: string) => {
    setIsPlaying(true);
    try {
      await speak(text);
    } finally {
      setIsPlaying(false);
    }
  }, [speak]);

  return (
    <TouchableOpacity
      onPress={() => setIsFlipped(!isFlipped)}
      activeOpacity={0.9}
    >
      <Card style={{ marginBottom: 12 }}>
        <CardContent>
          {!isFlipped ? (
            // Front - Spanish
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 22, fontWeight: '600', color: levelColor, marginBottom: 4 }}>
                    {item.spanish}
                  </Text>
                  {item.pronunciation && (
                    <Text variant='caption' style={{ color: textMuted, fontStyle: 'italic' }}>
                      /{item.pronunciation}/
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleSpeak(item.spanish);
                  }}
                  style={{
                    padding: 8,
                    backgroundColor: `${levelColor}20`,
                    borderRadius: 8,
                  }}
                >
                  {isPlaying ? (
                    <Spinner size='sm' variant='circle' color={levelColor} />
                  ) : (
                    <Icon name={Volume2} color={levelColor} size={20} />
                  )}
                </TouchableOpacity>
              </View>
              <Text variant='caption' style={{ color: textMuted, marginTop: 8 }}>
                Tap to reveal translation
              </Text>
            </View>
          ) : (
            // Back - English + Example
            <View>
              <Text style={{ fontSize: 18, fontWeight: '500', marginBottom: 8 }}>
                {item.english}
              </Text>
              {item.exampleSentence && (
                <View
                  style={{
                    backgroundColor: `${levelColor}10`,
                    padding: 12,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ flex: 1, color: levelColor, fontStyle: 'italic' }}>
                      "{item.exampleSentence}"
                    </Text>
                    <SmallAudioButton text={item.exampleSentence} color={levelColor} size={16} />
                  </View>
                  {item.exampleTranslation && (
                    <Text variant='caption' style={{ color: textMuted, marginTop: 4 }}>
                      {item.exampleTranslation}
                    </Text>
                  )}
                </View>
              )}
              <Text variant='caption' style={{ color: textMuted, marginTop: 8 }}>
                Tap to flip back
              </Text>
            </View>
          )}
        </CardContent>
      </Card>
    </TouchableOpacity>
  );
}

// Grammar Rule Component
function GrammarRuleCard({
  rule,
  levelColor,
}: {
  rule: {
    _id: string;
    title: string;
    explanation: string;
    formula?: string;
    examples: { spanish: string; english: string }[];
    tips: string[];
  };
  levelColor: string;
}) {
  const textMuted = useColor('textMuted');

  return (
    <Card style={{ marginBottom: 16 }}>
      <CardContent>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
          {rule.title}
        </Text>

        <Text style={{ marginBottom: 12, lineHeight: 22 }}>
          {rule.explanation}
        </Text>

        {rule.formula && (
          <View
            style={{
              backgroundColor: `${levelColor}15`,
              padding: 12,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontFamily: 'monospace', color: levelColor, fontWeight: '500' }}>
              {rule.formula}
            </Text>
          </View>
        )}

        {rule.examples.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text variant='subtitle' style={{ marginBottom: 8 }}>
              Examples
            </Text>
            {rule.examples.map((ex, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 6,
                  borderBottomWidth: i < rule.examples.length - 1 ? 1 : 0,
                  borderBottomColor: `${textMuted}20`,
                }}
              >
                <SmallAudioButton text={ex.spanish} color={levelColor} size={14} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{ color: levelColor }}>{ex.spanish}</Text>
                  <Text variant='caption' style={{ color: textMuted }}>
                    {ex.english}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {rule.tips.length > 0 && (
          <View>
            <Text variant='subtitle' style={{ marginBottom: 8 }}>
              Tips
            </Text>
            {rule.tips.map((tip, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Text style={{ marginRight: 8 }}>💡</Text>
                <Text style={{ flex: 1, color: textMuted }}>{tip}</Text>
              </View>
            ))}
          </View>
        )}
      </CardContent>
    </Card>
  );
}

// Phrase Card Component
function PhraseCard({
  phrase,
  levelColor,
}: {
  phrase: {
    _id: string;
    spanish: string;
    english: string;
    context?: string;
    formalityLevel?: string;
  };
  levelColor: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const textMuted = useColor('textMuted');
  const { speak } = useSpanishTTS();

  const handleSpeak = useCallback(async () => {
    setIsPlaying(true);
    try {
      await speak(phrase.spanish);
    } finally {
      setIsPlaying(false);
    }
  }, [speak, phrase.spanish]);

  const formalityColors: Record<string, string> = {
    formal: '#3b82f6',
    informal: '#22c55e',
    neutral: '#8b5cf6',
  };

  return (
    <Card style={{ marginBottom: 12 }}>
      <CardContent>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, color: levelColor, fontWeight: '500', marginBottom: 4 }}>
              {phrase.spanish}
            </Text>
            <Text style={{ marginBottom: 4 }}>{phrase.english}</Text>
            {phrase.context && (
              <Text variant='caption' style={{ color: textMuted, fontStyle: 'italic' }}>
                {phrase.context}
              </Text>
            )}
            {phrase.formalityLevel && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 8,
                  backgroundColor: `${formalityColors[phrase.formalityLevel] || textMuted}15`,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                  alignSelf: 'flex-start',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: formalityColors[phrase.formalityLevel] || textMuted,
                    textTransform: 'capitalize',
                  }}
                >
                  {phrase.formalityLevel}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={handleSpeak}
            style={{
              padding: 8,
              backgroundColor: `${levelColor}20`,
              borderRadius: 8,
            }}
          >
            {isPlaying ? (
              <Spinner size='sm' variant='circle' color={levelColor} />
            ) : (
              <Icon name={Volume2} color={levelColor} size={20} />
            )}
          </TouchableOpacity>
        </View>
      </CardContent>
    </Card>
  );
}

export default function CategoryDetailScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('vocabulary');

  const categoryWithLevel = useQuery(api.holaai.content.getCategoryWithLevel, {
    categoryId: categoryId as Id<"hola_contentCategories">,
  });
  const vocabulary = useQuery(api.holaai.content.listVocabulary, {
    categoryId: categoryId as Id<"hola_contentCategories">,
  });
  const grammarRules = useQuery(api.holaai.content.listGrammarRules, {
    categoryId: categoryId as Id<"hola_contentCategories">,
  });
  const phrases = useQuery(api.holaai.content.listPhrases, {
    categoryId: categoryId as Id<"hola_contentCategories">,
  });

  const primary = useColor('primary');
  const background = useColor('background');
  const foreground = useColor('foreground');
  const textMuted = useColor('textMuted');

  if (
    categoryWithLevel === undefined ||
    vocabulary === undefined ||
    grammarRules === undefined ||
    phrases === undefined
  ) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Spinner variant='circle' />
      </View>
    );
  }

  if (!categoryWithLevel) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Text>Category not found</Text>
      </View>
    );
  }

  const levelColors: Record<string, string> = {
    A1: '#22c55e',
    A2: '#3b82f6',
    B1: '#f59e0b',
    B2: '#8b5cf6',
    C1: '#ef4444',
    C2: '#ec4899',
  };

  const levelColor = levelColors[categoryWithLevel.level?.name || ''] || primary;

  return (
    <>
      <Stack.Screen
        options={{
          title: categoryWithLevel.name,
          headerShown: true,
          headerTintColor: foreground,
          headerStyle: { backgroundColor: background },
        }}
      />

      <View style={{ flex: 1, backgroundColor: background }}>
        {/* Header */}
        <View style={{ padding: 16, paddingTop: 8 }}>
          <View
            style={{
              backgroundColor: levelColor,
              padding: 16,
              borderRadius: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                  {categoryWithLevel.level?.name} - {categoryWithLevel.level?.displayName}
                </Text>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '600' }}>
                  {categoryWithLevel.name}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                  {vocabulary.length} words • {grammarRules.length} rules • {phrases.length} phrases
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <View style={{ paddingHorizontal: 16 }}>
            <TabsList>
              <TabsTrigger value='vocabulary'>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={Languages} size={16} color={activeTab === 'vocabulary' ? levelColor : textMuted} />
                  <Text style={{ marginLeft: 6, color: activeTab === 'vocabulary' ? levelColor : textMuted }}>
                    Vocab ({vocabulary.length})
                  </Text>
                </View>
              </TabsTrigger>
              <TabsTrigger value='grammar'>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={BookOpen} size={16} color={activeTab === 'grammar' ? levelColor : textMuted} />
                  <Text style={{ marginLeft: 6, color: activeTab === 'grammar' ? levelColor : textMuted }}>
                    Grammar ({grammarRules.length})
                  </Text>
                </View>
              </TabsTrigger>
              <TabsTrigger value='phrases'>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={MessageSquare} size={16} color={activeTab === 'phrases' ? levelColor : textMuted} />
                  <Text style={{ marginLeft: 6, color: activeTab === 'phrases' ? levelColor : textMuted }}>
                    Phrases ({phrases.length})
                  </Text>
                </View>
              </TabsTrigger>
            </TabsList>
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: 16,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <TabsContent value='vocabulary'>
              {vocabulary.length === 0 ? (
                <Text style={{ textAlign: 'center', color: textMuted }}>
                  No vocabulary items yet
                </Text>
              ) : (
                vocabulary.map((item) => (
                  <VocabularyCard key={item._id} item={item} levelColor={levelColor} />
                ))
              )}
            </TabsContent>

            <TabsContent value='grammar'>
              {grammarRules.length === 0 ? (
                <Text style={{ textAlign: 'center', color: textMuted }}>
                  No grammar rules yet
                </Text>
              ) : (
                grammarRules.map((rule) => (
                  <GrammarRuleCard key={rule._id} rule={rule} levelColor={levelColor} />
                ))
              )}
            </TabsContent>

            <TabsContent value='phrases'>
              {phrases.length === 0 ? (
                <Text style={{ textAlign: 'center', color: textMuted }}>
                  No phrases yet
                </Text>
              ) : (
                phrases.map((phrase) => (
                  <PhraseCard key={phrase._id} phrase={phrase} levelColor={levelColor} />
                ))
              )}
            </TabsContent>
          </ScrollView>
        </Tabs>
      </View>
    </>
  );
}
