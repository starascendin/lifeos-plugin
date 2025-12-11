import { useState } from 'react';
import { ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import {
  Heart,
  Trash2,
  MessageSquare,
  BookOpen,
  Lightbulb,
  ChevronLeft,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { SmallAudioButton } from '@/components/audio/SmallAudioButton';
import { TTSProviderToggle } from '@/components/audio/TTSProviderToggle';
import { SelectableText } from '@/components/ui/selectable-text';
import { TranslationModal } from '@/components/translate/TranslationModal';
import { TextSelectionPopup } from '@/components/translate/TextSelectionPopup';
import type { Id } from '@holaai/convex/_generated/dataModel';

type TabType = 'dialogue' | 'grammar' | 'phrases';

export default function ConversationScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('dialogue');

  // Text selection state
  const [selectedText, setSelectedText] = useState('');
  const [showSelectionPopup, setShowSelectionPopup] = useState(false);
  const [showTranslationModal, setShowTranslationModal] = useState(false);

  const handleTextSelection = (text: string) => {
    setSelectedText(text);
    setShowSelectionPopup(true);
  };

  const handleTranslate = () => {
    setShowSelectionPopup(false);
    setShowTranslationModal(true);
  };

  const handleAddToVocab = () => {
    // Open translation modal which has the add to vocab functionality
    setShowSelectionPopup(false);
    setShowTranslationModal(true);
  };

  const conversation = useQuery(
    api.holaai.ai.getJourneyConversation,
    conversationId ? { conversationId: conversationId as Id<"hola_journeyConversations"> } : 'skip'
  );

  const toggleFavorite = useMutation(api.holaai.ai.toggleJourneyConversationFavorite);
  const deleteConversation = useMutation(api.holaai.ai.deleteJourneyConversation);

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const text = useColor('text');
  const card = useColor('card');

  const handleToggleFavorite = async () => {
    if (!conversationId) return;
    try {
      await toggleFavorite({ conversationId: conversationId as Id<"hola_journeyConversations"> });
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!conversationId) return;
            try {
              await deleteConversation({ conversationId: conversationId as Id<"hola_journeyConversations"> });
              router.back();
            } catch (error) {
              console.error('Error deleting conversation:', error);
            }
          },
        },
      ]
    );
  };

  if (conversation === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Spinner variant='circle' />
      </View>
    );
  }

  if (!conversation) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Text variant='body' style={{ color: textMuted }}>
          Conversation not found
        </Text>
      </View>
    );
  }

  const tabs: { key: TabType; label: string; icon: any; count: number }[] = [
    { key: 'dialogue', label: 'Dialogue', icon: MessageSquare, count: conversation.dialogue.length },
    { key: 'grammar', label: 'Grammar', icon: BookOpen, count: conversation.grammarHints.length },
    { key: 'phrases', label: 'Phrases', icon: Lightbulb, count: conversation.keyPhrases.length },
  ];

  const renderDialogue = () => {
    // Determine the first speaker to establish sides
    const firstSpeaker = conversation.dialogue[0]?.speaker || conversation.dialogue[0]?.speakerName;

    return (
      <View style={{ padding: 16 }}>
        {conversation.dialogue.map((line, index) => {
          // Determine side based on speaker - first speaker goes left, others go right
          const currentSpeaker = line.speaker || line.speakerName;
          const isLeft = currentSpeaker === firstSpeaker;

          const spanishText = (line as any).spanish || (line as any).text || (line as any).spanishText || '';
          const englishText = (line as any).english || (line as any).translation || (line as any).englishText || '';

          return (
            <View
              key={index}
              style={{
                alignItems: isLeft ? 'flex-start' : 'flex-end',
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  backgroundColor: isLeft ? card : `${primary}20`,
                  padding: 12,
                  borderRadius: 12,
                  borderBottomLeftRadius: isLeft ? 4 : 12,
                  borderBottomRightRadius: isLeft ? 12 : 4,
                  maxWidth: '80%',
                }}
              >
                {line.speakerName && (
                  <Text variant='caption' style={{ color: isLeft ? textMuted : primary, marginBottom: 4, fontWeight: '600' }}>
                    {line.speakerName}
                  </Text>
                )}
                <SelectableText
                  style={{ color: text, fontWeight: '500', marginBottom: 4, fontSize: 16 }}
                  onLongPressText={handleTextSelection}
                >
                  {spanishText}
                </SelectableText>
                <Text variant='caption' style={{ color: textMuted }}>
                  {englishText}
                </Text>
                <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
                  <SmallAudioButton text={spanishText} color={isLeft ? primary : primary} size={20} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderGrammar = () => (
    <View style={{ padding: 16 }}>
      {conversation.grammarHints.length === 0 ? (
        <Text variant='body' style={{ color: textMuted, textAlign: 'center' }}>
          No grammar hints for this conversation
        </Text>
      ) : (
        conversation.grammarHints.map((hint, index) => (
          <Card key={index} style={{ marginBottom: 12 }}>
            <CardContent style={{ padding: 16 }}>
              <Text variant='title' style={{ marginBottom: 8 }}>
                {hint.topic}
              </Text>
              <Text variant='body' style={{ color: textMuted, marginBottom: 12 }}>
                {hint.explanation}
              </Text>
              {hint.examples.length > 0 && (
                <View>
                  <Text variant='caption' style={{ color: textMuted, marginBottom: 8 }}>
                    Examples:
                  </Text>
                  {hint.examples.map((ex, i) => (
                    <View key={i} style={styles.exampleRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <SelectableText
                          style={{ color: primary, flex: 1, fontSize: 16 }}
                          onLongPressText={handleTextSelection}
                        >
                          {ex.spanish}
                        </SelectableText>
                        <SmallAudioButton text={ex.spanish} color={primary} size={16} />
                      </View>
                      <Text variant='caption' style={{ color: textMuted }}>
                        {ex.english}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </View>
  );

  const renderPhrases = () => (
    <View style={{ padding: 16 }}>
      {conversation.keyPhrases.length === 0 ? (
        <Text variant='body' style={{ color: textMuted, textAlign: 'center' }}>
          No key phrases for this conversation
        </Text>
      ) : (
        conversation.keyPhrases.map((phrase, index) => (
          <Card key={index} style={{ marginBottom: 12 }}>
            <CardContent style={{ padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <SelectableText
                      style={{ color: primary, fontWeight: '600', fontSize: 16, flex: 1 }}
                      onLongPressText={handleTextSelection}
                    >
                      {phrase.spanish}
                    </SelectableText>
                    <View style={{ marginLeft: 8 }}>
                      <SmallAudioButton text={phrase.spanish} color={primary} size={18} />
                    </View>
                  </View>
                  <Text variant='body' style={{ marginTop: 4 }}>
                    {phrase.english}
                  </Text>
                  {phrase.usage && (
                    <Text variant='caption' style={{ color: textMuted, marginTop: 4 }}>
                      {phrase.usage}
                    </Text>
                  )}
                </View>
              </View>
            </CardContent>
          </Card>
        ))
      )}
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dialogue': return renderDialogue();
      case 'grammar': return renderGrammar();
      case 'phrases': return renderPhrases();
      default: return null;
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: conversation.title,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
              <Icon name={ChevronLeft} size={28} color={text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TTSProviderToggle />
              <TouchableOpacity onPress={handleToggleFavorite} style={{ padding: 8 }}>
                <Icon
                  name={Heart}
                  size={22}
                  color={conversation.isFavorite ? '#ef4444' : textMuted}
                  fill={conversation.isFavorite ? '#ef4444' : 'transparent'}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={{ padding: 8 }}>
                <Icon name={Trash2} size={22} color={textMuted} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: background }}>
        {/* Header Info */}
        <View style={[styles.header, { borderBottomColor: card }]}>
          <Text variant='caption' style={{ color: textMuted }}>
            Scenario: {conversation.situation}
          </Text>
          {conversation.module && (
            <Text variant='caption' style={{ color: primary, marginTop: 4 }}>
              Module {conversation.module.moduleNumber}: {conversation.module.title}
            </Text>
          )}
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabsContainer, { borderBottomColor: card }]}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tab,
                  isActive && { borderBottomColor: primary, borderBottomWidth: 2 }
                ]}
              >
                <Icon
                  name={tab.icon}
                  color={isActive ? primary : textMuted}
                  size={18}
                />
                <Text
                  variant='caption'
                  style={[
                    styles.tabText,
                    { color: isActive ? primary : textMuted }
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: isActive ? primary : textMuted }]}>
                    <Text style={styles.tabBadgeText}>{tab.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        >
          {renderContent()}
        </ScrollView>
      </View>

      {/* Text Selection Popup */}
      <TextSelectionPopup
        visible={showSelectionPopup}
        selectedText={selectedText}
        onTranslate={handleTranslate}
        onAddToVocab={handleAddToVocab}
        onClose={() => setShowSelectionPopup(false)}
      />

      {/* Translation Modal */}
      <TranslationModal
        visible={showTranslationModal}
        text={selectedText}
        sourceLanguage="es"
        onClose={() => setShowTranslationModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    maxHeight: 50,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 4,
  },
  tabText: {
    marginLeft: 6,
    fontWeight: '600',
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  exampleRow: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#e5e7eb',
  },
});
