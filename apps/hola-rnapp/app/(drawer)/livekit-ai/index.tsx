import { useConnection } from '@/hooks/useLiveKitSandbox';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Waves } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { useColor } from '@/hooks/useColor';

export default function StartScreen() {
  const router = useRouter();
  const { isConnectionActive, connect } = useConnection();
  const background = useColor('background');
  const primary = useColor('primary');
  const textMuted = useColor('textMuted');

  // Navigate to Assistant screen when we have the connection details.
  useEffect(() => {
    if (isConnectionActive) {
      router.push('/(drawer)/livekit-ai/assistant');
    }
  }, [isConnectionActive, router]);

  let connectText: string;

  if (isConnectionActive) {
    connectText = 'Connecting';
  } else {
    connectText = 'Start Voice Assistant';
  }

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <Icon name={Waves} size={64} color={primary} />
      <Text style={[styles.title, { color: '#FFFFFF' }]}>LiveKit AI Assistant</Text>
      <Text style={[styles.text, { color: textMuted }]}>
        Chat live with your voice AI agent
      </Text>

      <TouchableOpacity
        onPress={() => {
          connect();
        }}
        style={[styles.button, { backgroundColor: primary }]}
        activeOpacity={0.7}
        disabled={isConnectionActive}
      >
        {isConnectionActive ? (
          <ActivityIndicator
            size="small"
            color="#ffffff"
            style={styles.activityIndicator}
          />
        ) : null}

        <Text style={styles.buttonText}>{connectText}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  text: {
    marginBottom: 24,
  },
  activityIndicator: {
    marginEnd: 8,
  },
  button: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
