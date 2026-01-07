import { TrackReference, useLocalParticipant } from '@livekit/components-react';
import { BarVisualizer } from '@livekit/react-native';
import { useEffect, useState } from 'react';
import {
  ViewStyle,
  StyleSheet,
  View,
  TouchableOpacity,
  StyleProp,
} from 'react-native';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  MessageCircle,
  PhoneOff,
} from 'lucide-react-native';

type ControlBarProps = {
  style?: StyleProp<ViewStyle>;
  options: ControlBarOptions;
};

type ControlBarOptions = {
  isMicEnabled: boolean;
  onMicClick: () => void;
  isCameraEnabled: boolean;
  onCameraClick: () => void;
  isScreenShareEnabled: boolean;
  onScreenShareClick: () => void;
  isChatEnabled: boolean;
  onChatClick: () => void;
  onExitClick: () => void;
};

export default function ControlBar({ style = {}, options }: ControlBarProps) {
  const { microphoneTrack, localParticipant } = useLocalParticipant();
  const [trackRef, setTrackRef] = useState<TrackReference | undefined>(undefined);

  useEffect(() => {
    if (microphoneTrack) {
      setTrackRef({
        participant: localParticipant,
        publication: microphoneTrack,
        source: microphoneTrack.source,
      });
    } else {
      setTrackRef(undefined);
    }
  }, [microphoneTrack, localParticipant]);

  const iconColor = '#CCCCCC';
  const iconSize = 20;

  return (
    <View style={[style, styles.container]}>
      <TouchableOpacity
        style={[
          styles.button,
          options.isMicEnabled ? styles.enabledButton : undefined,
        ]}
        activeOpacity={0.7}
        onPress={() => options.onMicClick()}
      >
        {options.isMicEnabled ? (
          <Mic color={iconColor} size={iconSize} />
        ) : (
          <MicOff color={iconColor} size={iconSize} />
        )}
        <BarVisualizer
          barCount={3}
          trackRef={trackRef}
          style={styles.micVisualizer}
          options={{
            minHeight: 0.1,
            barColor: '#CCCCCC',
            barWidth: 2,
          }}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          options.isCameraEnabled ? styles.enabledButton : undefined,
        ]}
        activeOpacity={0.7}
        onPress={() => options.onCameraClick()}
      >
        {options.isCameraEnabled ? (
          <Video color={iconColor} size={iconSize} />
        ) : (
          <VideoOff color={iconColor} size={iconSize} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          options.isScreenShareEnabled ? styles.enabledButton : undefined,
        ]}
        activeOpacity={0.7}
        onPress={() => options.onScreenShareClick()}
      >
        {options.isScreenShareEnabled ? (
          <ScreenShare color={iconColor} size={iconSize} />
        ) : (
          <ScreenShareOff color={iconColor} size={iconSize} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          options.isChatEnabled ? styles.enabledButton : undefined,
        ]}
        activeOpacity={0.7}
        onPress={() => options.onChatClick()}
      >
        <MessageCircle
          color={options.isChatEnabled ? '#FFFFFF' : iconColor}
          size={iconSize}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.exitButton]}
        activeOpacity={0.7}
        onPress={() => options.onExitClick()}
      >
        <PhoneOff color="#ef4444" size={iconSize} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 8,
    backgroundColor: '#070707',
    borderColor: '#202020',
    borderRadius: 53,
    borderWidth: 1,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    padding: 10,
    marginHorizontal: 4,
    marginVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enabledButton: {
    backgroundColor: '#131313',
  },
  exitButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  micVisualizer: {
    width: 20,
    height: 20,
  },
});
