import { Stack } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function JournalLayout() {
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
          title: 'DayOne',
          headerLeft: () => <DrawerToggleButton tintColor={text} />,
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
          headerShown: false,
        }}
      />
    </Stack>
  );
}
