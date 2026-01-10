import { Stack } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function VocabBankLayout() {
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
          title: 'Vocab Bank',
          headerLeft: () => <DrawerToggleButton tintColor={text} />,
        }}
      />
    </Stack>
  );
}
