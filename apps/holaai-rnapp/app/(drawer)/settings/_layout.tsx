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
        headerLeft: () => <DrawerToggleButton tintColor={text} />,
      }}
    >
      <Stack.Screen name='index' options={{ title: 'Settings' }} />
      <Stack.Screen name='devpage' options={{ title: 'Developer' }} />
    </Stack>
  );
}
