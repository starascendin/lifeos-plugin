import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { ScrollView } from '@/components/ui/scroll-view';
import { useColor } from '@/hooks/useColor';
import { useRouter } from 'expo-router';
import { Mic, Bot, Sparkles, ChevronRight } from 'lucide-react-native';
import { Pressable } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const primary = useColor('primary');
  const textMuted = useColor('textMuted');
  const blue = useColor('blue');

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        gap: 24,
        padding: 24,
        paddingTop: 48,
      }}
    >
      {/* Header */}
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Text
          variant='heading'
          style={{
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          LifeOS
        </Text>
        <Text
          variant='body'
          style={{
            textAlign: 'center',
            color: textMuted,
          }}
        >
          Your voice-first personal assistant
        </Text>
      </View>

      {/* Voice Memo Card */}
      <Pressable onPress={() => router.push('/voicememo' as any)}>
        <Card>
          <CardContent>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: blue + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}
              >
                <Icon name={Mic} size={24} color={blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant='subtitle' style={{ marginBottom: 4 }}>
                  Voice Memo
                </Text>
                <Text variant='caption' style={{ color: textMuted }}>
                  Record & Play
                </Text>
              </View>
              <Icon name={ChevronRight} size={20} color={textMuted} />
            </View>
            <Text variant='body' style={{ color: textMuted, lineHeight: 22 }}>
              Record voice memos and play them back. Capture your thoughts, ideas, and notes hands-free.
            </Text>
          </CardContent>
        </Card>
      </Pressable>

      {/* Voice AI Agents Card */}
      <Card>
        <CardContent>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
              }}
            >
              <Icon name={Bot} size={24} color={primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant='subtitle' style={{ marginBottom: 4 }}>
                Voice AI Agents
              </Text>
              <Text variant='caption' style={{ color: textMuted }}>
                Voice-first interactions
              </Text>
            </View>
          </View>
          <Text variant='body' style={{ color: textMuted, lineHeight: 22 }}>
            Interact with AI agents using natural voice conversations. Get help with tasks, brainstorm ideas, and more.
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 16,
              gap: 8,
            }}
          >
            <Icon name={Sparkles} size={16} color={textMuted} />
            <Text variant='caption' style={{ color: textMuted }}>
              Coming soon
            </Text>
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
