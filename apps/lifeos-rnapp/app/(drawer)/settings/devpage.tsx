import { useState } from 'react';
import { ScrollView, TouchableOpacity, Clipboard, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import {
  CheckCircle,
  XCircle,
  Copy,
  RefreshCw,
  Server,
  Key,
  Mic,
  Sparkles,
  Waves,
  ChevronRight,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

// Environment variables
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || 'Not configured';
const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL || 'Not configured';

// Extract Clerk domain from publishable key
function getClerkDomain(key: string): string {
  if (!key) return 'Not configured';
  try {
    // Clerk publishable key is base64 encoded
    const decoded = atob(key.replace('pk_test_', '').replace('pk_live_', ''));
    return decoded || 'Unknown';
  } catch {
    return 'Unable to decode';
  }
}

interface TestResult {
  success: boolean;
  error?: string | null;
  status?: number;
  response?: string;
  configured?: Record<string, boolean>;
  url?: string | null;
}

export default function DevPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [geminiStatus, setGeminiStatus] = useState<TestResult | null>(null);
  const [geminiTesting, setGeminiTesting] = useState(false);

  const [livekitStatus, setLivekitStatus] = useState<TestResult | null>(null);
  const [livekitTesting, setLivekitTesting] = useState(false);

  const testGemini = useAction(api.common.dev.testGeminiConnection);
  const testLiveKit = useAction(api.common.dev.testLiveKitConnection);

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const success = '#22c55e';
  const error = '#ef4444';

  const handleCopy = (value: string, label: string) => {
    Clipboard.setString(value);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const handleTestGemini = async () => {
    setGeminiTesting(true);
    setGeminiStatus(null);
    try {
      const result = await testGemini();
      setGeminiStatus(result);
    } catch (e) {
      setGeminiStatus({
        success: false,
        error: e instanceof Error ? e.message : 'Test failed',
      });
    } finally {
      setGeminiTesting(false);
    }
  };

  const handleTestLiveKit = async () => {
    setLivekitTesting(true);
    setLivekitStatus(null);
    try {
      const result = await testLiveKit();
      setLivekitStatus(result);
    } catch (e) {
      setLivekitStatus({
        success: false,
        error: e instanceof Error ? e.message : 'Test failed',
      });
    } finally {
      setLivekitTesting(false);
    }
  };

  const StatusIcon = ({ success: isSuccess }: { success: boolean }) => (
    <Icon
      name={isSuccess ? CheckCircle : XCircle}
      size={20}
      color={isSuccess ? success : error}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
        }}
      >
        {/* Environment Info */}
        <Card style={{ marginBottom: 16 }}>
          <CardHeader>
            <CardTitle>Environment Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Convex URL */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Icon name={Server} size={16} color={primary} />
                <Text variant='subtitle' style={{ marginLeft: 8, fontSize: 14 }}>
                  Convex URL
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCopy(CONVEX_URL, 'Convex URL')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: `${textMuted}10`,
                  padding: 10,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{ flex: 1, fontSize: 12, fontFamily: 'monospace' }}
                  numberOfLines={1}
                >
                  {CONVEX_URL}
                </Text>
                <Icon name={Copy} size={14} color={textMuted} />
              </TouchableOpacity>
            </View>

            {/* Clerk Domain */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Icon name={Key} size={16} color={primary} />
                <Text variant='subtitle' style={{ marginLeft: 8, fontSize: 14 }}>
                  Clerk Domain
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCopy(getClerkDomain(CLERK_KEY), 'Clerk Domain')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: `${textMuted}10`,
                  padding: 10,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{ flex: 1, fontSize: 12, fontFamily: 'monospace' }}
                  numberOfLines={1}
                >
                  {getClerkDomain(CLERK_KEY)}
                </Text>
                <Icon name={Copy} size={14} color={textMuted} />
              </TouchableOpacity>
            </View>

            {/* LiveKit URL */}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Icon name={Mic} size={16} color={primary} />
                <Text variant='subtitle' style={{ marginLeft: 8, fontSize: 14 }}>
                  LiveKit URL
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCopy(LIVEKIT_URL, 'LiveKit URL')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: `${textMuted}10`,
                  padding: 10,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{ flex: 1, fontSize: 12, fontFamily: 'monospace' }}
                  numberOfLines={1}
                >
                  {LIVEKIT_URL}
                </Text>
                <Icon name={Copy} size={14} color={textMuted} />
              </TouchableOpacity>
            </View>
          </CardContent>
        </Card>

        {/* Connection Tests */}
        <Card style={{ marginBottom: 16 }}>
          <CardHeader>
            <CardTitle>Connection Tests</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Gemini Test */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={Sparkles} size={20} color={primary} />
                  <Text variant='subtitle' style={{ marginLeft: 8 }}>
                    Gemini API
                  </Text>
                </View>
                <Button
                  variant='outline'
                  onPress={handleTestGemini}
                  disabled={geminiTesting}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}
                >
                  {geminiTesting ? (
                    <Spinner variant='circle' size='sm' />
                  ) : (
                    <>
                      <Icon name={RefreshCw} size={14} color={textMuted} />
                      <Text style={{ marginLeft: 6, color: textMuted, fontSize: 12 }}>Test</Text>
                    </>
                  )}
                </Button>
              </View>
              {geminiStatus && (
                <View
                  style={{
                    marginTop: 8,
                    padding: 10,
                    backgroundColor: geminiStatus.success ? `${success}15` : `${error}15`,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <StatusIcon success={geminiStatus.success} />
                  <Text style={{ marginLeft: 8, flex: 1, fontSize: 13 }}>
                    {geminiStatus.success
                      ? `Connected - Response: "${geminiStatus.response}"`
                      : geminiStatus.error || 'Connection failed'}
                  </Text>
                </View>
              )}
            </View>

            {/* LiveKit Test */}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={Mic} size={20} color={primary} />
                  <Text variant='subtitle' style={{ marginLeft: 8 }}>
                    LiveKit
                  </Text>
                </View>
                <Button
                  variant='outline'
                  onPress={handleTestLiveKit}
                  disabled={livekitTesting}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}
                >
                  {livekitTesting ? (
                    <Spinner variant='circle' size='sm' />
                  ) : (
                    <>
                      <Icon name={RefreshCw} size={14} color={textMuted} />
                      <Text style={{ marginLeft: 6, color: textMuted, fontSize: 12 }}>Test</Text>
                    </>
                  )}
                </Button>
              </View>
              {livekitStatus && (
                <View
                  style={{
                    marginTop: 8,
                    padding: 10,
                    backgroundColor: livekitStatus.success ? `${success}15` : `${error}15`,
                    borderRadius: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <StatusIcon success={livekitStatus.success} />
                    <Text style={{ marginLeft: 8, fontSize: 13 }}>
                      {livekitStatus.success ? 'All configured' : 'Configuration incomplete'}
                    </Text>
                  </View>
                  {livekitStatus.configured && (
                    <View style={{ marginLeft: 28 }}>
                      <Text style={{ fontSize: 12, color: textMuted }}>
                        API Key: {livekitStatus.configured.apiKey ? '✓' : '✗'}
                      </Text>
                      <Text style={{ fontSize: 12, color: textMuted }}>
                        API Secret: {livekitStatus.configured.apiSecret ? '✓' : '✗'}
                      </Text>
                      <Text style={{ fontSize: 12, color: textMuted }}>
                        URL: {livekitStatus.configured.url ? '✓' : '✗'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </CardContent>
        </Card>

        {/* LiveKit AI Assistant */}
        <Card style={{ marginBottom: 16 }}>
          <CardHeader>
            <CardTitle>Voice AI Assistant</CardTitle>
          </CardHeader>
          <CardContent>
            <TouchableOpacity
              onPress={() => router.push('/settings/livekit')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: `${primary}15`,
                padding: 16,
                borderRadius: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name={Waves} size={24} color={primary} />
                <View style={{ marginLeft: 12 }}>
                  <Text variant='subtitle' style={{ fontSize: 16 }}>
                    LiveKit AI
                  </Text>
                  <Text style={{ fontSize: 13, color: textMuted, marginTop: 2 }}>
                    Chat live with your voice AI agent
                  </Text>
                </View>
              </View>
              <Icon name={ChevronRight} size={20} color={textMuted} />
            </TouchableOpacity>
          </CardContent>
        </Card>

        {/* Info */}
        <Card style={{ backgroundColor: `${primary}10` }}>
          <CardContent>
            <Text variant='caption' style={{ color: textMuted, textAlign: 'center' }}>
              API keys are stored securely on the server and never exposed to the client.
              Tests verify the connection without revealing sensitive credentials.
            </Text>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
