import { useState, useEffect } from 'react';
import { ScrollView, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useAction } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import { Sparkles, MessageSquare, Lightbulb, RefreshCw } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { Id } from '@holaai/convex/_generated/dataModel';

interface Suggestion {
  title: string;
  description: string;
  scenario: string;
}

export default function GenerateConversationScreen() {
  const router = useRouter();
  const { moduleId, sessionId, scenario } = useLocalSearchParams<{
    moduleId: string;
    sessionId?: string;
    scenario?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [situation, setSituation] = useState(scenario || '');
  const [generating, setGenerating] = useState(false);

  const isAddingToSession = !!sessionId;

  // AI Suggestions state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const currentUser = useQuery(api.common.users.currentUser);
  const moduleContext = useQuery(
    api.holaai.ai.getModuleContext,
    moduleId ? { moduleId: moduleId as Id<"hola_learningModules"> } : 'skip'
  );

  const generateConversation = useAction(api.holaai.ai.generateJourneyConversation);
  const generateSuggestions = useAction(api.holaai.ai.generateSuggestions);

  // Fetch AI suggestions on mount (only for new sessions, not when adding to existing)
  useEffect(() => {
    if (currentUser && moduleId && !isAddingToSession && !scenario) {
      fetchSuggestions();
    }
  }, [currentUser?._id, moduleId]);

  const fetchSuggestions = async () => {
    if (!currentUser || !moduleId) return;

    setLoadingSuggestions(true);
    try {
      const result = await generateSuggestions({
        userId: currentUser._id,
        moduleId: moduleId as Id<"hola_learningModules">,
        context: "before_generation",
      });
      setSuggestions(result.suggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const text = useColor('text');

  const handleGenerate = async () => {
    if (!situation.trim() || !currentUser || !moduleId) return;

    setGenerating(true);
    try {
      const result = await generateConversation({
        userId: currentUser._id,
        moduleId: moduleId as Id<"hola_learningModules">,
        sessionId: sessionId ? (sessionId as Id<"hola_conversationSessions">) : undefined,
        situation: situation.trim(),
      });
      // Navigate to session detail page
      router.replace(`/journey/session/${result.sessionId}`);
    } catch (error) {
      console.error('Error generating conversation:', error);
      Alert.alert('Error', 'Failed to generate conversation. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Get example scenarios based on module
  const getExampleScenarios = () => {
    if (!moduleContext) return [];

    const moduleTitle = moduleContext.title?.toLowerCase() || '';

    if (moduleTitle.includes('foundation')) {
      return ['Meeting someone new', 'Introducing yourself', 'Asking for directions'];
    } else if (moduleTitle.includes('present') || moduleTitle.includes('daily')) {
      return ['Describing your daily routine', 'Talking about your family', 'What you do for work'];
    } else if (moduleTitle.includes('question') || moduleTitle.includes('communication')) {
      return ['Asking about prices', 'Making a reservation', 'Getting information'];
    } else {
      return ['At a coffee shop', 'Meeting a neighbor', 'Shopping at a market'];
    }
  };

  if (moduleContext === undefined || currentUser === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Spinner variant='circle' />
      </View>
    );
  }

  if (!moduleContext) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Text variant='body' style={{ color: textMuted }}>
          Module not found
        </Text>
      </View>
    );
  }

  const exampleScenarios = getExampleScenarios();

  return (
    <>
      <Stack.Screen options={{ title: isAddingToSession ? 'Add Conversation' : 'Generate Conversation' }} />
      <View style={{ flex: 1, backgroundColor: background }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        >
          {/* Module Context Card */}
          <Card style={{ marginBottom: 20 }}>
            <CardContent style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={[styles.moduleBadge, { backgroundColor: primary }]}>
                  <Text style={styles.moduleBadgeText}>{moduleContext.moduleNumber}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant='title'>{moduleContext.title}</Text>
                  <Text variant='caption' style={{ color: textMuted }}>A1 Level</Text>
                </View>
              </View>
              <Text variant='caption' style={{ color: textMuted }}>
                {moduleContext.description}
              </Text>

              {/* Show sample vocabulary if available */}
              {moduleContext.sampleVocabulary && moduleContext.sampleVocabulary.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text variant='caption' style={{ color: textMuted, marginBottom: 4 }}>
                    Key vocabulary:
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {moduleContext.sampleVocabulary.slice(0, 5).map((vocab: { spanish: string; english: string }, i: number) => (
                      <View key={i} style={[styles.vocabChip, { backgroundColor: card }]}>
                        <Text variant='caption' style={{ color: primary }}>
                          {vocab.spanish}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </CardContent>
          </Card>

          {/* AI Suggestions Section - Only show for new sessions */}
          {!isAddingToSession && !scenario && (
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={Lightbulb} size={18} color={primary} />
                  <Text variant='subtitle' style={{ marginLeft: 8 }}>
                    Suggested for You
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={fetchSuggestions}
                  disabled={loadingSuggestions}
                  style={{ padding: 8 }}
                >
                  <Icon
                    name={RefreshCw}
                    size={16}
                    color={loadingSuggestions ? textMuted : primary}
                  />
                </TouchableOpacity>
              </View>

              {loadingSuggestions ? (
                <View style={{ gap: 10 }}>
                  {[1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[styles.suggestionCardSkeleton, { backgroundColor: card }]}
                    >
                      <View style={[styles.skeletonLine, { width: '60%', backgroundColor: textMuted }]} />
                      <View style={[styles.skeletonLine, { width: '90%', backgroundColor: textMuted, marginTop: 6 }]} />
                    </View>
                  ))}
                </View>
              ) : suggestions.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setSituation(suggestion.scenario)}
                      style={[
                        styles.suggestionCard,
                        { backgroundColor: card, borderColor: situation === suggestion.scenario ? primary : 'transparent' }
                      ]}
                    >
                      <Text variant='body' style={{ fontWeight: '600', color: text, marginBottom: 4 }}>
                        {suggestion.title}
                      </Text>
                      <Text variant='caption' style={{ color: textMuted }}>
                        {suggestion.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          )}

          {/* Scenario Input */}
          <Text variant='subtitle' style={{ marginBottom: 12 }}>
            What scenario do you want to practice?
          </Text>
          <TextInput
            value={situation}
            onChangeText={setSituation}
            placeholder="Describe a situation you'd like to practice..."
            placeholderTextColor={textMuted}
            multiline
            numberOfLines={4}
            style={[
              styles.textInput,
              { backgroundColor: card, color: text }
            ]}
          />

          {/* Example Scenarios */}
          <Text variant='caption' style={{ color: textMuted, marginTop: 12, marginBottom: 8 }}>
            Example scenarios for this module:
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {exampleScenarios.map((example) => (
              <TouchableOpacity
                key={example}
                onPress={() => setSituation(example)}
                style={[styles.exampleChip, { backgroundColor: card }]}
              >
                <Text variant='caption' style={{ color: primary }}>
                  {example}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Info Card */}
          <Card style={{ marginTop: 24, backgroundColor: `${primary}10` }}>
            <CardContent style={{ padding: 16, flexDirection: 'row', alignItems: 'flex-start' }}>
              <Icon name={MessageSquare} size={20} color={primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text variant='caption' style={{ color: text }}>
                  AI will generate a realistic conversation using vocabulary and phrases from this module.
                  You can then practice speaking the dialogue!
                </Text>
              </View>
            </CardContent>
          </Card>
        </ScrollView>

        {/* Generate Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: background }]}>
          <Button
            onPress={handleGenerate}
            disabled={!situation.trim() || generating}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          >
            {generating ? (
              <>
                <Spinner variant='circle' size='sm' />
                <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                  Generating...
                </Text>
              </>
            ) : (
              <>
                <Icon name={Sparkles} color='#fff' size={18} />
                <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                  {isAddingToSession ? 'Add to Session' : 'Generate Conversation'}
                </Text>
              </>
            )}
          </Button>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  moduleBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  vocabChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  textInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  exampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  suggestionCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  suggestionCardSkeleton: {
    padding: 14,
    borderRadius: 12,
    height: 70,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 4,
    opacity: 0.3,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});
