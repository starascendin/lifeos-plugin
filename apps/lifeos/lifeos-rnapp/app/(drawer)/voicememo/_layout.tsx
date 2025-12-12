import { Stack } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function VoiceMemoLayout() {
  const text = useColor('text');
  const background = useColor('background');

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: text,
        headerStyle: { backgroundColor: background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Voice Memos',
          headerLeft: () => <DrawerToggleButton tintColor={text} />,
        }}
      />
      <Stack.Screen
        name="record"
        options={{
          title: 'Recording',
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
