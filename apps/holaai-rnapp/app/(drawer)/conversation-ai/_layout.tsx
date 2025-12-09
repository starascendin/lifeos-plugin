import { Stack } from 'expo-router';
import { useColor } from '@/hooks/useColor';

export default function ConversationAILayout() {
  const background = useColor('background');
  const text = useColor('text');

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: background },
        headerTintColor: text,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Conversation AI',
        }}
      />
    </Stack>
  );
}
