import { Stack } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function JourneyLayout() {
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
          title: 'A1 Learning Journey',
          headerLeft: () => <DrawerToggleButton tintColor={text} />,
        }}
      />
      <Stack.Screen
        name="module/[moduleId]"
        options={{
          headerShown: true,
          title: 'Module',
        }}
      />
      <Stack.Screen
        name="lesson/[lessonId]"
        options={{
          headerShown: true,
          title: 'Lesson',
        }}
      />
    </Stack>
  );
}
