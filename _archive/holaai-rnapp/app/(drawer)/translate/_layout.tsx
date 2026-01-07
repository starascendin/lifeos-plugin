import { Stack } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { TTSProviderToggle } from '@/components/audio/TTSProviderToggle';
import { useUserRole } from '@/hooks/useUserRole';

export default function TranslateLayout() {
  const background = useColor('background');
  const text = useColor('text');
  const { isDeveloper } = useUserRole();

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
          title: 'Translate',
          headerLeft: () => <DrawerToggleButton tintColor={text} />,
          headerRight: isDeveloper ? () => <TTSProviderToggle /> : undefined,
        }}
      />
    </Stack>
  );
}
