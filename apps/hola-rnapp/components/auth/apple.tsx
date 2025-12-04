import { useState, useCallback } from 'react';
import { useSSO } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';

WebBrowser.maybeCompleteAuthSession();

export const SignInWithApple = () => {
  const { startSSOFlow } = useSSO();
  const secondary = useColor('secondary');
  const [loading, setLoading] = useState(false);

  const handleAppleSignIn = useCallback(async () => {
    setLoading(true);

    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_apple',
      });

      if (createdSessionId) {
        await setActive!({ session: createdSessionId });
      }
    } catch (err) {
      console.error('Apple sign in error:', err);
    } finally {
      setLoading(false);
    }
  }, [startSSOFlow]);

  return (
    <Button disabled={loading} onPress={handleAppleSignIn}>
      <View
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Ionicons name='logo-apple' size={22} color={secondary} />
        <Text style={{ color: secondary, fontWeight: 500 }}>
          Login with Apple
        </Text>
      </View>
    </Button>
  );
};
