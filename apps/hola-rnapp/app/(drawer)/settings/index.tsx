import { SignOutButton } from '@/components/auth/singout';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { useUser } from '@clerk/clerk-expo';

export default function SettingsScreen() {
  const { user, isLoaded } = useUser();

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
    </ScrollView>
  );
}
