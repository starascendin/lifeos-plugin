import { useState, useRef } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { useUser } from '@clerk/clerk-expo';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import { Send } from 'lucide-react-native';

export default function ChatScreen() {
  const { user } = useUser();
  const messages = useQuery(api.messages.list);
  const sendMessage = useMutation(api.messages.send);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  const muted = useColor('muted');
  const primary = useColor('primary');
  const card = useColor('card');
  const background = useColor('background');

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage({ content: input.trim() });
      setInput('');
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  if (messages === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Spinner variant='circle' />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 56 + insets.bottom : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          flexGrow: 1,
        }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text variant='caption'>No messages yet. Start the conversation!</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => {
          const isOwnMessage = item.userId === user?.id;

          return (
            <View
              style={{
                alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
              }}
            >
              <Text
                variant='caption'
                style={{
                  marginBottom: 4,
                  marginLeft: isOwnMessage ? 0 : 12,
                  marginRight: isOwnMessage ? 12 : 0,
                  textAlign: isOwnMessage ? 'right' : 'left',
                }}
              >
                {item.userName}
              </Text>
              <View
                style={{
                  backgroundColor: isOwnMessage ? primary : card,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 18,
                  borderBottomRightRadius: isOwnMessage ? 4 : 18,
                  borderBottomLeftRadius: isOwnMessage ? 18 : 4,
                }}
              >
                <Text
                  style={{
                    color: isOwnMessage ? '#fff' : undefined,
                  }}
                >
                  {item.content}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View
        style={{
          flexDirection: 'row',
          padding: 12,
          paddingBottom: 12 + insets.bottom,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: muted,
          backgroundColor: card,
        }}
      >
        <Input
          value={input}
          onChangeText={setInput}
          placeholder='Type a message...'
          variant='outline'
          containerStyle={{ flex: 1 }}
          onSubmitEditing={handleSend}
          returnKeyType='send'
          editable={!sending}
        />
        <Button
          onPress={handleSend}
          disabled={!input.trim() || sending}
          style={{ width: 48, height: 48, paddingHorizontal: 0 }}
        >
          <Send color='#fff' size={20} />
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
