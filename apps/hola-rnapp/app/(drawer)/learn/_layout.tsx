import { Stack } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function LearnLayout() {
  const text = useColor('text');
  const background = useColor('background');

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: background },
        headerTintColor: text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          title: 'Learn Spanish',
          headerLeft: () => <DrawerToggleButton tintColor={text} />,
        }}
      />
      <Stack.Screen
        name="[levelId]"
        options={{
          headerShown: true,
          title: 'Level',
        }}
      />
      <Stack.Screen
        name="category/[categoryId]"
        options={{
          headerShown: true,
          title: 'Category',
        }}
      />
    </Stack>
  );
}
