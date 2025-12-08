import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import type { TranscriptMessage } from '@/hooks/useLiveKitVoice';

interface ChatBubbleProps {
  message: TranscriptMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const primary = useColor('primary');
  const card = useColor('card');
  const textMuted = useColor('textMuted');

  const isUser = message.role === 'user';

  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
        marginVertical: 6,
        marginHorizontal: 16,
      }}
    >
      <Text
        variant="caption"
        style={{
          marginBottom: 4,
          marginLeft: isUser ? 0 : 12,
          marginRight: isUser ? 12 : 0,
          textAlign: isUser ? 'right' : 'left',
          color: textMuted,
        }}
      >
        {isUser ? 'You' : 'Bella'}
      </Text>
      <View
        style={{
          backgroundColor: isUser ? primary : card,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 18,
          borderBottomRightRadius: isUser ? 4 : 18,
          borderBottomLeftRadius: isUser ? 18 : 4,
        }}
      >
        <Text
          style={{
            color: isUser ? '#fff' : undefined,
            lineHeight: 20,
          }}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}
