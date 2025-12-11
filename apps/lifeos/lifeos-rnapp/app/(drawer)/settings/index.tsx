import { StyleSheet } from 'react-native';
import { SignOutButton } from '@/components/auth/singout';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
        gap: 18,
        paddingTop: 32,
        paddingBottom: 48,
        paddingHorizontal: 16,
      }}
    >
      {/* User Info */}
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Text variant='title'>{user.fullName || user.emailAddresses[0]?.emailAddress}</Text>
        <Text variant='caption' style={{ color: textMuted }}>{user.id}</Text>
      </View>

      {/* Theme */}
      <Card>
        <CardContent>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <ModeToggle />
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardContent>
          <Text style={styles.sectionTitle}>Account</Text>
          <SignOutButton />
        </CardContent>
      </Card>

      {/* Developer */}
      <Card>
        <CardContent>
          <Text style={styles.sectionTitle}>Developer</Text>
          <Button
            variant='outline'
            onPress={() => router.push('/settings/devpage')}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name={Code} size={18} color={textMuted} />
            <Text style={{ marginLeft: 8, color: textMuted }}>Dev Page</Text>
          </Button>
        </CardContent>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
});
