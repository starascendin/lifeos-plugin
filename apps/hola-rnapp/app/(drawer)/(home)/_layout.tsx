import { Stack } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function HomeLayout() {
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
      <Stack.Screen name='index' options={{ title: 'Home' }} />
    </Stack>
  );
}
