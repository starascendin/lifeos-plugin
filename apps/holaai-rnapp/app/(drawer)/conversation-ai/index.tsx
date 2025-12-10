import { useState } from 'react';
import { ScrollView, TextInput, TouchableOpacity, Alert, StyleSheet, FlatList } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import {
  Sparkles,
  MessageSquare,
  CheckCircle,
  ChevronRight,
  Plus,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { TTSProviderToggle } from '@/components/audio/TTSProviderToggle';
import { useConversationGeneration } from '@/hooks/useConversationGeneration';
import type { Id } from '@holaai/convex/_generated/dataModel';

export default function ConversationAIScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [situation, setSituation] = useState('');
  const [selectedModuleIds, setSelectedModuleIds] = useState<Id<"hola_learningModules">[]>([]);
  const [showGenerator, setShowGenerator] = useState(false);

  // Use centralized AI hook
  const { generate, isGenerating } = useConversationGeneration();

  const currentUser = useQuery(api.common.users.currentUser);

  // Get A1 level and modules
  const levels = useQuery(api.holaai.content.listLevels);
  const a1Level = levels?.find(l => l.name === 'A1');

  const modules = useQuery(
    api.holaai.journey.listModules,
    a1Level ? { levelId: a1Level._id } : 'skip'
  );

  // Get all user's conversations
  const conversations = useQuery(
    api.holaai.ai.listJourneyConversations,
    currentUser ? { userId: currentUser._id } : 'skip'
  );

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const text = useColor('text');

  const toggleModuleSelection = (moduleId: Id<"hola_learningModules">) => {
    setSelectedModuleIds(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleGenerate = async () => {
    if (!situation.trim() || selectedModuleIds.length === 0) {
      Alert.alert('Missing Info', 'Please select at least one module and enter a scenario.');
      return;
    }

    try {
      // Generate conversation using the first selected module
      // (API currently supports single module, we use first selected)
      const result = await generate({
        moduleId: selectedModuleIds[0],
        situation: situation.trim(),
      });

      // Reset form
      setSituation('');
      setSelectedModuleIds([]);
      setShowGenerator(false);

      // Navigate to the conversation (within this stack)
      router.push(`/conversation-ai/view/${result.conversationId}`);
    } catch (error) {
      console.error('Error generating conversation:', error);
      Alert.alert('Error', 'Failed to generate conversation. Please try again.');
    }
  };

  const navigateToConversation = (conversationId: Id<"hola_journeyConversations">) => {
    router.push(`/conversation-ai/view/${conversationId}`);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (currentUser === undefined || levels === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Spinner variant='circle' />
      </View>
    );
  }

  const renderGenerator = () => (
    <Card style={{ marginBottom: 20 }}>
      <CardContent style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Icon name={Sparkles} color={primary} size={24} />
          <Text variant='title' style={{ marginLeft: 8, flex: 1 }}>
            Generate New Conversation
          </Text>
          <TouchableOpacity onPress={() => setShowGenerator(false)}>
            <Text variant='caption' style={{ color: textMuted }}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Module Selection */}
        <Text variant='subtitle' style={{ marginBottom: 8 }}>
          Select Module(s)
        </Text>
        <Text variant='caption' style={{ color: textMuted, marginBottom: 12 }}>
          Choose which module's vocabulary to use
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 16 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {modules?.map((module) => {
            const isSelected = selectedModuleIds.includes(module._id);
            return (
              <TouchableOpacity
                key={module._id}
                onPress={() => toggleModuleSelection(module._id)}
                style={[
                  styles.moduleChip,
                  {
                    backgroundColor: isSelected ? primary : card,
                    borderColor: isSelected ? primary : textMuted,
                  }
                ]}
              >
                {isSelected && (
                  <Icon name={CheckCircle} color="#fff" size={14} style={{ marginRight: 4 }} />
                )}
                <Text
                  variant='caption'
                  style={{
                    color: isSelected ? '#fff' : text,
                    fontWeight: isSelected ? '600' : '400',
                  }}
                >
                  {module.moduleNumber}. {module.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Scenario Input */}
        <Text variant='subtitle' style={{ marginBottom: 8 }}>
          Describe Your Scenario
        </Text>
        <TextInput
          value={situation}
          onChangeText={setSituation}
          placeholder="e.g., Ordering coffee at a café, Meeting a new neighbor..."
          placeholderTextColor={textMuted}
          multiline
          numberOfLines={3}
          style={[
            styles.textInput,
            { backgroundColor: background, color: text, borderColor: textMuted }
          ]}
        />

        {/* Example Scenarios */}
        <Text variant='caption' style={{ color: textMuted, marginTop: 12, marginBottom: 8 }}>
          Quick examples:
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['At a coffee shop', 'Asking for directions', 'Introducing yourself', 'Shopping at a market'].map((example) => (
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

        {/* Generate Button */}
        <Button
          onPress={handleGenerate}
          disabled={!situation.trim() || selectedModuleIds.length === 0 || isGenerating}
          style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
        >
          {isGenerating ? (
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
                Generate Conversation
              </Text>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );

  const renderConversationItem = ({ item: conv }: { item: NonNullable<typeof conversations>[number] }) => (
    <TouchableOpacity
      onPress={() => navigateToConversation(conv._id)}
      style={styles.conversationItem}
    >
      <View style={[styles.conversationIcon, { backgroundColor: `${primary}15` }]}>
        <Icon name={MessageSquare} size={20} color={primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant='body' style={{ fontWeight: '600' }} numberOfLines={1}>
          {conv.title}
        </Text>
        <Text variant='caption' style={{ color: textMuted, marginTop: 2 }} numberOfLines={1}>
          {conv.situation}
        </Text>
        <Text variant='caption' style={{ color: textMuted, marginTop: 4 }}>
          {formatDate(conv.createdAt)} • {conv.dialogue.length} exchanges
        </Text>
      </View>
      <Icon name={ChevronRight} size={20} color={textMuted} />
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <TTSProviderToggle /> }} />
      <View style={{ flex: 1, backgroundColor: background }}>
        <FlatList
          data={conversations || []}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
          }}
          ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            {/* New Conversation Button or Generator */}
            {showGenerator ? (
              renderGenerator()
            ) : (
              <TouchableOpacity
                onPress={() => setShowGenerator(true)}
                style={[styles.newButton, { borderColor: primary }]}
              >
                <Icon name={Plus} color={primary} size={20} />
                <Text variant='body' style={{ color: primary, marginLeft: 8, fontWeight: '600' }}>
                  New Conversation
                </Text>
              </TouchableOpacity>
            )}

            {/* Conversations Header */}
            {conversations && conversations.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <Text variant='subtitle'>My Conversations</Text>
                <Text variant='caption' style={{ color: textMuted, marginLeft: 8 }}>
                  ({conversations.length})
                </Text>
              </View>
            )}
          </View>
          }
          ListEmptyComponent={
          !showGenerator ? (
            <Card style={{ marginTop: 20 }}>
              <CardContent style={{ padding: 24, alignItems: 'center' }}>
                <Icon name={MessageSquare} color={textMuted} size={48} />
                <Text variant='title' style={{ marginTop: 16, textAlign: 'center' }}>
                  No Conversations Yet
                </Text>
                <Text variant='body' style={{ color: textMuted, textAlign: 'center', marginTop: 8 }}>
                  Generate AI-powered Spanish conversations based on A1 module vocabulary for speaking practice.
                </Text>
                <Button
                  onPress={() => setShowGenerator(true)}
                  style={{ marginTop: 16 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Create Your First Conversation</Text>
                </Button>
              </CardContent>
            </Card>
          ) : null
          }
          renderItem={renderConversationItem}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: card, marginVertical: 4 }} />}
        />
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
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  moduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  textInput: {
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  exampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  conversationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
});
