import { useState, useCallback, useEffect } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
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
import { Code, Volume2, Smartphone, Cloud, Play, AlertCircle, CheckCircle } from 'lucide-react-native';
import { useColor } from '@/hooks/useColor';
import { useTTSSettings, TTSProvider } from '@/contexts/TTSSettingsContext';
import { useSpanishTTS } from '@/hooks/useSpanishTTS';
import Slider from '@react-native-community/slider';

export default function SettingsScreen() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const textMuted = useColor('textMuted');
  const primary = useColor('primary');
  const foreground = useColor('foreground');
  const background = useColor('background');
  const card = useColor('card');

  const { settings, isLoading: ttsLoading, setProvider, setSpeed, isGeminiTTS } = useTTSSettings();
  const { speak, isPlaying, didFallback, providerUsed, clearFallback, error } = useSpanishTTS();

  const [testPlaying, setTestPlaying] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fallback' | 'error' | null>(null);

  // Clear test result after a delay
  useEffect(() => {
    if (testResult) {
      const timer = setTimeout(() => setTestResult(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [testResult]);

  // Track fallback during test
  useEffect(() => {
    if (didFallback && testPlaying) {
      setTestResult('fallback');
    }
  }, [didFallback, testPlaying]);

  const handleProviderChange = useCallback(async (provider: TTSProvider) => {
    await setProvider(provider);
  }, [setProvider]);

  const handleSpeedChange = useCallback(async (value: number) => {
    await setSpeed(value);
  }, [setSpeed]);

  const handleTestVoice = useCallback(async () => {
    if (testPlaying) return;
    setTestPlaying(true);
    setTestResult(null);
    clearFallback();
    try {
      await speak('Hola, como estas? Me llamo Claude.');
      // If we didn't fall back, mark as success (only for Gemini - on-device is always "success")
      if (!didFallback) {
        setTestResult('success');
      }
    } catch (err) {
      setTestResult('error');
    } finally {
      setTestPlaying(false);
    }
  }, [speak, testPlaying, didFallback, clearFallback]);

  const getSpeedLabel = (speed: number): string => {
    if (speed <= 0.55) return 'Slow';
    if (speed <= 0.7) return 'Normal';
    if (speed <= 0.85) return 'Fast';
    return 'Very Fast';
  };

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

      {/* TTS Settings */}
      <Card>
        <CardContent>
          <View style={styles.sectionHeader}>
            <Icon name={Volume2} size={20} color={primary} />
            <Text style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>
              Text-to-Speech
            </Text>
          </View>

          {ttsLoading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Spinner size='sm' variant='circle' />
            </View>
          ) : (
            <>
              {/* Provider Selection */}
              <Text style={[styles.label, { color: textMuted }]}>Voice Provider</Text>
              <View style={styles.providerButtons}>
                <TouchableOpacity
                  onPress={() => handleProviderChange('ondevice')}
                  style={[
                    styles.providerButton,
                    { backgroundColor: settings.provider === 'ondevice' ? primary : card },
                    { borderColor: settings.provider === 'ondevice' ? primary : textMuted },
                  ]}
                >
                  <Icon
                    name={Smartphone}
                    size={18}
                    color={settings.provider === 'ondevice' ? '#fff' : textMuted}
                  />
                  <Text
                    style={[
                      styles.providerButtonText,
                      { color: settings.provider === 'ondevice' ? '#fff' : foreground },
                    ]}
                  >
                    On-Device
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleProviderChange('gemini')}
                  style={[
                    styles.providerButton,
                    { backgroundColor: settings.provider === 'gemini' ? primary : card },
                    { borderColor: settings.provider === 'gemini' ? primary : textMuted },
                  ]}
                >
                  <Icon
                    name={Cloud}
                    size={18}
                    color={settings.provider === 'gemini' ? '#fff' : textMuted}
                  />
                  <Text
                    style={[
                      styles.providerButtonText,
                      { color: settings.provider === 'gemini' ? '#fff' : foreground },
                    ]}
                  >
                    Gemini Cloud
                  </Text>
                </TouchableOpacity>
              </View>

              <Text variant='caption' style={{ color: textMuted, marginTop: 4 }}>
                {settings.provider === 'ondevice'
                  ? 'Uses your device\'s built-in voice. Works offline.'
                  : 'Uses Google Gemini for natural voice. Requires internet.'}
              </Text>

              {/* Speed Slider */}
              <Text style={[styles.label, { color: textMuted, marginTop: 20 }]}>
                Speech Speed: {getSpeedLabel(settings.speed)} ({settings.speed.toFixed(2)}x)
              </Text>
              <View style={styles.sliderContainer}>
                <Text style={{ color: textMuted, fontSize: 12 }}>Slow</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0.5}
                  maximumValue={1.0}
                  value={settings.speed}
                  onSlidingComplete={handleSpeedChange}
                  minimumTrackTintColor={primary}
                  maximumTrackTintColor={textMuted}
                  thumbTintColor={primary}
                  step={0.05}
                />
                <Text style={{ color: textMuted, fontSize: 12 }}>Fast</Text>
              </View>

              {/* Test Voice Button */}
              <Button
                variant='outline'
                onPress={handleTestVoice}
                disabled={testPlaying || isPlaying}
                style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
              >
                {testPlaying || isPlaying ? (
                  <Spinner size='sm' variant='circle' color={primary} />
                ) : (
                  <Icon name={Play} size={16} color={primary} fill={primary} />
                )}
                <Text style={{ marginLeft: 8, color: primary }}>
                  {testPlaying || isPlaying ? 'Playing...' : 'Test Voice'}
                </Text>
              </Button>

              {/* Test Result Feedback */}
              {testResult === 'fallback' && (
                <View style={styles.testResultContainer}>
                  <View style={[styles.testResultBadge, { backgroundColor: '#fef3c7' }]}>
                    <Icon name={AlertCircle} size={14} color="#f59e0b" />
                    <Text style={[styles.testResultText, { color: '#92400e' }]}>
                      Gemini unavailable - used device TTS instead
                    </Text>
                  </View>
                  <Text variant='caption' style={{ color: textMuted, marginTop: 4 }}>
                    Check your GEMINI_API_KEY configuration in Convex environment.
                  </Text>
                </View>
              )}

              {testResult === 'success' && isGeminiTTS && (
                <View style={styles.testResultContainer}>
                  <View style={[styles.testResultBadge, { backgroundColor: '#dcfce7' }]}>
                    <Icon name={CheckCircle} size={14} color="#22c55e" />
                    <Text style={[styles.testResultText, { color: '#166534' }]}>
                      Gemini TTS working correctly
                    </Text>
                  </View>
                </View>
              )}

              {testResult === 'error' && (
                <View style={styles.testResultContainer}>
                  <View style={[styles.testResultBadge, { backgroundColor: '#fee2e2' }]}>
                    <Icon name={AlertCircle} size={14} color="#ef4444" />
                    <Text style={[styles.testResultText, { color: '#991b1b' }]}>
                      TTS Error: {error || 'Unknown error'}
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  providerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  providerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  providerButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  testResultContainer: {
    marginTop: 12,
  },
  testResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 8,
  },
  testResultText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});
