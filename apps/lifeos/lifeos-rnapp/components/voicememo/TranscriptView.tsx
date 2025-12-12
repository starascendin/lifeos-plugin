import { View, ViewStyle, Pressable, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import {
  Copy,
  FileText,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';

type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface TranscriptViewProps {
  status?: TranscriptionStatus;
  transcript?: string;
  language?: string;
  onRetry?: () => void;
  onTranscribe?: () => void;
}

export function TranscriptView({
  status,
  transcript,
  language,
  onRetry,
  onTranscribe,
}: TranscriptViewProps) {
  const cardColor = useColor('card');
  const textColor = useColor('text');
  const textMuted = useColor('textMuted');
  const blueColor = useColor('blue');
  const redColor = useColor('red');
  const greenColor = useColor('green');
  const backgroundColor = useColor('background');

  const [copied, setCopied] = useState(false);
  const copyOpacity = useSharedValue(1);

  const handleCopy = useCallback(async () => {
    if (!transcript) return;

    await Clipboard.setStringAsync(transcript);
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setCopied(true);
    copyOpacity.value = withTiming(0.5, { duration: 100 }, () => {
      copyOpacity.value = withTiming(1, { duration: 100 });
    });

    setTimeout(() => setCopied(false), 2000);
  }, [transcript, copyOpacity]);

  const copyAnimatedStyle = useAnimatedStyle(() => ({
    opacity: copyOpacity.value,
  }));

  const containerStyle: ViewStyle = {
    backgroundColor: backgroundColor,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  };

  // Pending state - not yet transcribed
  if (!status || status === 'pending') {
    return (
      <View style={containerStyle}>
        <View style={headerStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={FileText} size={14} color={textMuted} />
            <Text variant="caption" style={{ color: textMuted }}>
              Transcript
            </Text>
          </View>
        </View>
        {onTranscribe ? (
          <Pressable
            onPress={onTranscribe}
            style={{
              backgroundColor: blueColor + '20',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 6,
              alignItems: 'center',
            }}
          >
            <Text variant="caption" style={{ color: blueColor, fontWeight: '500' }}>
              Transcribe
            </Text>
          </Pressable>
        ) : (
          <Text variant="caption" style={{ color: textMuted, fontStyle: 'italic' }}>
            Sync to cloud to enable transcription
          </Text>
        )}
      </View>
    );
  }

  // Processing state
  if (status === 'processing') {
    return (
      <View style={containerStyle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={Loader2} size={16} color={blueColor} />
          <Text variant="caption" style={{ color: blueColor }}>
            Transcribing...
          </Text>
        </View>
      </View>
    );
  }

  // Failed state
  if (status === 'failed') {
    return (
      <View style={containerStyle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={AlertCircle} size={16} color={redColor} />
          <Text variant="caption" style={{ color: redColor, flex: 1 }}>
            Transcription failed
          </Text>
          {onRetry && (
            <Pressable
              onPress={onRetry}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: blueColor + '20',
                paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: 4,
              }}
            >
              <Icon name={RefreshCw} size={12} color={blueColor} />
              <Text variant="caption" style={{ color: blueColor }}>
                Retry
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // Completed state with transcript
  return (
    <View style={containerStyle}>
      <View style={headerStyle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={FileText} size={14} color={greenColor} />
          <Text variant="caption" style={{ color: textMuted }}>
            Transcript
          </Text>
          {language && (
            <Text
              variant="caption"
              style={{
                color: textMuted,
                backgroundColor: cardColor,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                fontSize: 10,
                textTransform: 'uppercase',
              }}
            >
              {language}
            </Text>
          )}
        </View>
        <Animated.View style={copyAnimatedStyle}>
          <Pressable
            onPress={handleCopy}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              padding: 4,
            }}
            hitSlop={8}
          >
            <Icon name={Copy} size={14} color={copied ? greenColor : textMuted} />
            <Text
              variant="caption"
              style={{ color: copied ? greenColor : textMuted }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
      <Text
        variant="body"
        style={{
          color: textColor,
          lineHeight: 22,
        }}
      >
        {transcript || 'No transcript available'}
      </Text>
    </View>
  );
}
