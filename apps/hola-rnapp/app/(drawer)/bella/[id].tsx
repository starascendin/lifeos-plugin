import { useCallback, useState, useRef } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useColor } from '@/hooks/useColor';
import { useSpanishTTS } from '@/hooks/useSpanishTTS';
import { GrammarAudioCard, PhraseAudioCard } from '@/components/audio';
import {
  MessageSquare,
  Heart,
  Volume2,
  BookOpen,
  Key,
  RefreshCw,
  Play,
  Square,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { Id } from '@holaai/convex/_generated/dataModel';

export default function BellaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('dialogue');

  // Play All state
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState<number | null>(null);
  const playingRef = useRef(false);

  const conversation = useQuery(api.ai.getBellaConversation, {
    conversationId: id as Id<'bellaConversations'>,
  });
  const toggleFavorite = useMutation(api.ai.toggleBellaFavorite);

  const primary = useColor('primary');
  const background = useColor('background');
  const foreground = useColor('foreground');
  const textMuted = useColor('textMuted');
  const card = useColor('card');

  const { speak, stop, isPlaying } = useSpanishTTS();

  const speakSpanish = useCallback(async (text: string) => {
    await speak(text);
  }, [speak]);

  const handleToggleFavorite = async () => {
    if (!conversation) return;
    try {
      await toggleFavorite({ conversationId: conversation._id });
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Play All Dialogue feature
  const playAllDialogue = useCallback(async () => {
    if (!conversation) return;

    playingRef.current = true;
    setIsPlayingAll(true);

    for (let i = 0; i < conversation.dialogue.length; i++) {
      if (!playingRef.current) break;

      setCurrentDialogueIndex(i);
      await speak(conversation.dialogue[i].spanish);

      // Wait a bit between lines
      if (playingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    setIsPlayingAll(false);
    setCurrentDialogueIndex(null);
    playingRef.current = false;
  }, [conversation, speak]);

  const stopPlayback = useCallback(async () => {
    playingRef.current = false;
    await stop();
    setIsPlayingAll(false);
    setCurrentDialogueIndex(null);
  }, [stop]);

  if (conversation === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Spinner variant='circle' />
      </View>
    );
  }

  if (!conversation) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Text>Conversation not found</Text>
      </View>
    );
  }

  const levelColors: Record<string, string> = {
    A1: '#22c55e',
    A2: '#3b82f6',
  };
  const levelColor = levelColors[conversation.level] || primary;

  return (
    <>
      <Stack.Screen
        options={{
          title: conversation.title,
          headerShown: true,
          headerTintColor: foreground,
          headerStyle: { backgroundColor: background },
          headerRight: () => (
            <TouchableOpacity onPress={handleToggleFavorite} style={{ padding: 8 }}>
              <Icon
                name={Heart}
                size={24}
                color={conversation.isFavorite ? '#ef4444' : textMuted}
                fill={conversation.isFavorite ? '#ef4444' : 'transparent'}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={{ flex: 1, backgroundColor: background }}>
        {/* Header */}
        <View style={{ padding: 16 }}>
          <View
            style={{
              backgroundColor: levelColor,
              padding: 16,
              borderRadius: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>
                  {conversation.level}
                </Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.8)', marginLeft: 8, fontSize: 12 }}>
                {conversation.dialogue.length} exchanges
              </Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
              {conversation.title}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 }}>
              {conversation.situation}
            </Text>
          </View>
        </View>

        {/* Play All Button */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Button
            variant={isPlayingAll ? 'destructive' : 'outline'}
            onPress={isPlayingAll ? stopPlayback : playAllDialogue}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon
              name={isPlayingAll ? Square : Play}
              size={16}
              color={isPlayingAll ? '#fff' : levelColor}
              fill={isPlayingAll ? '#fff' : levelColor}
            />
            <Text style={{ marginLeft: 8, color: isPlayingAll ? '#fff' : levelColor, fontWeight: '600' }}>
              {isPlayingAll ? 'Stop Playback' : 'Play All Dialogue'}
            </Text>
          </Button>
        </View>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <View style={{ paddingHorizontal: 16 }}>
            <TabsList>
              <TabsTrigger value='dialogue'>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={MessageSquare} size={14} color={activeTab === 'dialogue' ? levelColor : textMuted} />
                  <Text style={{ marginLeft: 4, color: activeTab === 'dialogue' ? levelColor : textMuted }}>
                    Dialogue
                  </Text>
                </View>
              </TabsTrigger>
              <TabsTrigger value='grammar'>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={BookOpen} size={14} color={activeTab === 'grammar' ? levelColor : textMuted} />
                  <Text style={{ marginLeft: 4, color: activeTab === 'grammar' ? levelColor : textMuted }}>
                    Grammar
                  </Text>
                </View>
              </TabsTrigger>
              <TabsTrigger value='phrases'>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={Key} size={14} color={activeTab === 'phrases' ? levelColor : textMuted} />
                  <Text style={{ marginLeft: 4, color: activeTab === 'phrases' ? levelColor : textMuted }}>
                    Key Phrases
                  </Text>
                </View>
              </TabsTrigger>
              {conversation.responseVariations && conversation.responseVariations.length > 0 && (
                <TabsTrigger value='variations'>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon name={RefreshCw} size={14} color={activeTab === 'variations' ? levelColor : textMuted} />
                    <Text style={{ marginLeft: 4, color: activeTab === 'variations' ? levelColor : textMuted }}>
                      Variations
                    </Text>
                  </View>
                </TabsTrigger>
              )}
            </TabsList>
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: 16,
              paddingBottom: insets.bottom + 16,
            }}
          >
            {/* Dialogue Tab */}
            <TabsContent value='dialogue'>
              {conversation.dialogue.map((exchange, index) => {
                const isFirst = exchange.speaker === 'A';
                const isHighlighted = currentDialogueIndex === index;

                return (
                  <View
                    key={index}
                    style={{
                      flexDirection: 'row',
                      justifyContent: isFirst ? 'flex-start' : 'flex-end',
                      marginBottom: 12,
                    }}
                  >
                    <View
                      style={[
                        styles.dialogueBubble,
                        {
                          backgroundColor: isFirst ? card : levelColor,
                          borderBottomLeftRadius: isFirst ? 4 : 16,
                          borderBottomRightRadius: isFirst ? 16 : 4,
                        },
                        isHighlighted && styles.highlightedBubble,
                        isHighlighted && { borderColor: isFirst ? levelColor : '#fff' },
                      ]}
                    >
                      {exchange.speakerName && (
                        <Text
                          variant='caption'
                          style={{
                            color: isFirst ? textMuted : 'rgba(255,255,255,0.7)',
                            marginBottom: 4,
                          }}
                        >
                          {exchange.speakerName}
                        </Text>
                      )}
                      <TouchableOpacity
                        onPress={() => speakSpanish(exchange.spanish)}
                        style={{ flexDirection: 'row', alignItems: 'flex-start' }}
                        disabled={isPlayingAll}
                      >
                        <Text
                          style={{
                            flex: 1,
                            color: isFirst ? foreground : '#fff',
                            fontSize: 16,
                          }}
                        >
                          {exchange.spanish}
                        </Text>
                        {isHighlighted && isPlaying ? (
                          <Spinner size='sm' variant='circle' color={isFirst ? levelColor : '#fff'} style={{ marginLeft: 8 }} />
                        ) : (
                          <Icon
                            name={Volume2}
                            size={16}
                            color={isFirst ? levelColor : 'rgba(255,255,255,0.8)'}
                            style={{ marginLeft: 8 }}
                          />
                        )}
                      </TouchableOpacity>
                      <Text
                        variant='caption'
                        style={{
                          color: isFirst ? textMuted : 'rgba(255,255,255,0.7)',
                          marginTop: 4,
                          fontStyle: 'italic',
                        }}
                      >
                        {exchange.english}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </TabsContent>

            {/* Grammar Tab - using GrammarAudioCard */}
            <TabsContent value='grammar'>
              {conversation.grammarHints.map((hint, index) => (
                <GrammarAudioCard
                  key={index}
                  topic={hint.topic}
                  explanation={hint.explanation}
                  examples={hint.examples}
                  accentColor={levelColor}
                  style={{ marginBottom: 12 }}
                />
              ))}
            </TabsContent>

            {/* Key Phrases Tab - using PhraseAudioCard */}
            <TabsContent value='phrases'>
              {conversation.keyPhrases.map((phrase, index) => (
                <PhraseAudioCard
                  key={index}
                  spanish={phrase.spanish}
                  english={phrase.english}
                  context={phrase.usage}
                  accentColor={levelColor}
                  style={{ marginBottom: 12 }}
                />
              ))}
            </TabsContent>

            {/* Response Variations Tab */}
            {conversation.responseVariations && (
              <TabsContent value='variations'>
                {conversation.responseVariations.map((variation, index) => (
                  <Card key={index} style={{ marginBottom: 12 }}>
                    <CardContent>
                      <Text style={{ fontWeight: '600', marginBottom: 12 }}>
                        {variation.prompt}
                      </Text>

                      <View style={{ gap: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          <View
                            style={{
                              backgroundColor: '#3b82f620',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 4,
                              marginRight: 8,
                            }}
                          >
                            <Text style={{ color: '#3b82f6', fontSize: 12 }}>Formal</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => speakSpanish(variation.formal)}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                          >
                            <Text style={{ flex: 1, color: '#3b82f6' }}>{variation.formal}</Text>
                            <Icon name={Volume2} size={14} color='#3b82f6' />
                          </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          <View
                            style={{
                              backgroundColor: '#22c55e20',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 4,
                              marginRight: 8,
                            }}
                          >
                            <Text style={{ color: '#22c55e', fontSize: 12 }}>Casual</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => speakSpanish(variation.informal)}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                          >
                            <Text style={{ flex: 1, color: '#22c55e' }}>{variation.informal}</Text>
                            <Icon name={Volume2} size={14} color='#22c55e' />
                          </TouchableOpacity>
                        </View>

                        {variation.polite && (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            <View
                              style={{
                                backgroundColor: '#8b5cf620',
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 4,
                                marginRight: 8,
                              }}
                            >
                              <Text style={{ color: '#8b5cf6', fontSize: 12 }}>Polite</Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => speakSpanish(variation.polite!)}
                              style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                            >
                              <Text style={{ flex: 1, color: '#8b5cf6' }}>{variation.polite}</Text>
                              <Icon name={Volume2} size={14} color='#8b5cf6' />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            )}
          </ScrollView>
        </Tabs>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  dialogueBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  highlightedBubble: {
    borderWidth: 2,
    transform: [{ scale: 1.02 }],
  },
});
