import { useCallback } from 'react';
import { ListRenderItemInfo, StyleProp, ViewStyle } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { useColor } from '@/hooks/useColor';
import { MessageCircle } from 'lucide-react-native';
import { ChatBubble } from './ChatBubble';
import type { TranscriptMessage } from '@/hooks/useLiveKitVoice';

interface VoiceChatLogProps {
  messages: TranscriptMessage[];
  style?: StyleProp<ViewStyle>;
}

export function VoiceChatLog({ messages, style }: VoiceChatLogProps) {
  const textMuted = useColor('textMuted');

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TranscriptMessage>) => {
      return <ChatBubble message={item} />;
    },
    []
  );

  const keyExtractor = useCallback(
    (item: TranscriptMessage, index: number) => `${item.timestamp}-${index}`,
    []
  );

  if (messages.length === 0) {
    return (
      <View
        style={[
          {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 32,
          },
          style,
        ]}
      >
        <Icon name={MessageCircle} size={48} color={textMuted} />
        <Text
          variant="body"
          style={{
            color: textMuted,
            textAlign: 'center',
            marginTop: 16,
          }}
        >
          Start a conversation with Bella
        </Text>
        <Text
          variant="caption"
          style={{
            color: textMuted,
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          Tap the call button below to begin
        </Text>
      </View>
    );
  }

  return (
    <Animated.FlatList
      data={messages.slice().reverse()}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      style={style}
      inverted
      itemLayoutAnimation={LinearTransition}
      contentContainerStyle={{
        paddingVertical: 16,
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}
