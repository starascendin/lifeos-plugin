import { SignOutButton } from '@/components/auth/singout';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Code } from 'lucide-react-native';
import { useColor } from '@/hooks/useColor';

export default function SettingsScreen() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const textMuted = useColor('textMuted');

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Spinner variant='circle' />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Not Authenticated</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flex: 1,
        gap: 18,
        paddingTop: 96,
        alignItems: 'center',
      }}
    >
      <ModeToggle />

      <View style={{ alignItems: 'center' }}>
        <Text variant='title'>{user.fullName || user.emailAddresses[0]?.emailAddress}</Text>
        <Text variant='caption'>{user.id}</Text>
      </View>

      <SignOutButton />

      <View style={{ marginTop: 32, width: '100%', paddingHorizontal: 24 }}>
        <Text variant='caption' style={{ color: textMuted, marginBottom: 8, textAlign: 'center' }}>
          Developer
        </Text>
        <Button
          variant='outline'
          onPress={() => router.push('/settings/devpage')}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={Code} size={18} color={textMuted} />
          <Text style={{ marginLeft: 8, color: textMuted }}>Dev Page</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
