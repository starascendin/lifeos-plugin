import { useAuth } from '@clerk/clerk-expo';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export const SignOutButton = () => {
  const router = useRouter();
  const { signOut, isSignedIn } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.dismissAll();
    } catch (error) {
      console.error('Sign out error:', error);
      router.dismissAll();
    }
  };

  return isSignedIn ? (
    <Button
      size='lg'
      variant='destructive'
      onPress={handleSignOut}
      icon={LogOut}
    >
      Logout
    </Button>
  ) : null;
};
