import { Stack } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function ConversationAILayout() {
  const background = useColor('background');
  const text = useColor('text');

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: background },
        headerTintColor: text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Conversation AI',
          headerLeft: () => <DrawerToggleButton tintColor={text} />,
        }}
      />
      <Stack.Screen
        name="view/[conversationId]"
        options={{
          title: 'Conversation',
        }}
      />
    </Stack>
  );
}
