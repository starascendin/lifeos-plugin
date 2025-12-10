import { Stack } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function SettingsLayout() {
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
        name='index'
        options={{
          title: 'Settings',
          headerLeft: () => <DrawerToggleButton tintColor={text} />,
        }}
      />
      <Stack.Screen name='devpage' options={{ title: 'Developer' }} />
      <Stack.Screen name='livekit' options={{ title: 'LiveKit AI' }} />
      <Stack.Screen name='livekit-assistant' options={{ headerShown: false }} />
    </Stack>
  );
}
