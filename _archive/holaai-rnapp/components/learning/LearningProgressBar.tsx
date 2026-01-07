import { TouchableOpacity, StyleSheet } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import { X } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

interface LearningProgressBarProps {
  progress: number; // 0-100
  currentStage: string;
  onExit: () => void;
}

export function LearningProgressBar({
  progress,
  currentStage,
  onExit,
}: LearningProgressBarProps) {
  const primary = useColor('primary');
  const textMuted = useColor('textMuted');
  const card = useColor('card');

  return (
    <View style={[styles.container, { borderBottomColor: card }]}>
      {/* Top row: Progress bar and exit button */}
      <View style={styles.topRow}>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBackground, { backgroundColor: `${primary}30` }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: primary, width: `${progress}%` },
              ]}
            />
          </View>
          <Text variant="caption" style={[styles.progressText, { color: textMuted }]}>
            {progress}%
          </Text>
        </View>
        <TouchableOpacity onPress={onExit} style={styles.exitButton}>
          <Icon name={X} size={24} color={textMuted} />
        </TouchableOpacity>
      </View>

      {/* Bottom row: Current stage */}
      <Text variant="caption" style={[styles.stageText, { color: textMuted }]}>
        {currentStage}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    width: 40,
    textAlign: 'right',
    fontWeight: '600',
  },
  exitButton: {
    marginLeft: 12,
    padding: 4,
  },
  stageText: {
    marginTop: 8,
    fontWeight: '500',
  },
});
