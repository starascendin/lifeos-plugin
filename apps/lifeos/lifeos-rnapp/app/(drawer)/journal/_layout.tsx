import { Stack } from 'expo-router';
import { useColor } from '@/hooks/useColor';

export default function JournalLayout() {
  const background = useColor('background');
  const foreground = useColor('foreground');

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: background,
        },
        headerTintColor: foreground,
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: background,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Journal',
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="[date]"
        options={{
          title: '',
        }}
      />
      <Stack.Screen
        name="new"
        options={{
          title: 'New Entry',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
