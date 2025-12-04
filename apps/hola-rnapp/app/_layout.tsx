import { Auth } from '@/components/auth/auth';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/theme/colors';
import { ThemeProvider } from '@/theme/theme-provider';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { osName } from 'expo-device';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { setBackgroundColorAsync } from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, ActivityIndicator, View as RNView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

SplashScreen.setOptions({
  duration: 200,
  fade: true,
});


const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
}

export default function RootLayout() {
  const colorScheme = useColorScheme() || 'light';

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync(
        colorScheme === 'light' ? 'dark' : 'light'
      );
    }
  }, [colorScheme]);

  // Keep the root view background color in sync with the current theme
  useEffect(() => {
    setBackgroundColorAsync(
      colorScheme === 'dark' ? Colors.dark.background : Colors.light.background
    );
  }, [colorScheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} animated />

        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <AuthGate colorScheme={colorScheme} />
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <RNView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </RNView>
    );
  }

  if (!isSignedIn) {
    return <Auth />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name='(drawer)' options={{ headerShown: false }} />
      <Stack.Screen
        name='sheet'
        options={{
          headerShown: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.4, 0.7, 1],
          contentStyle: {
            backgroundColor: isLiquidGlassAvailable()
              ? 'transparent'
              : colorScheme === 'dark'
                ? Colors.dark.card
                : Colors.light.card,
          },
          headerTransparent: Platform.OS === 'ios' ? true : false,
          headerLargeTitle: false,
          title: '',
          presentation:
            Platform.OS === 'ios'
              ? isLiquidGlassAvailable() && osName !== 'iPadOS'
                ? 'formSheet'
                : 'modal'
              : 'modal',
          sheetInitialDetentIndex: 0,
          headerStyle: {
            backgroundColor:
              Platform.OS === 'ios'
                ? 'transparent'
                : colorScheme === 'dark'
                  ? Colors.dark.card
                  : Colors.light.card,
          },
          headerBlurEffect: isLiquidGlassAvailable()
            ? undefined
            : colorScheme === 'dark'
              ? 'dark'
              : 'light',
        }}
      />
      <Stack.Screen name='+not-found' />
    </Stack>
  );
}
