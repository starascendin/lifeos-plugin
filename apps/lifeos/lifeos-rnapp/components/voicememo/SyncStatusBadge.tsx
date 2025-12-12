import { View, ViewStyle, ActivityIndicator } from 'react-native';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { Cloud, CloudOff, Check, AlertCircle } from 'lucide-react-native';

type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

interface SyncStatusBadgeProps {
  status: SyncStatus;
  size?: number;
}

export function SyncStatusBadge({ status, size = 16 }: SyncStatusBadgeProps) {
  const textMuted = useColor('textMuted');
  const greenColor = useColor('green');
  const redColor = useColor('red');
  const blueColor = useColor('blue');

  const containerStyle: ViewStyle = {
    width: size + 4,
    height: size + 4,
    justifyContent: 'center',
    alignItems: 'center',
  };

  switch (status) {
    case 'local':
      return (
        <View style={containerStyle}>
          <Icon name={CloudOff} size={size} color={textMuted} />
        </View>
      );

    case 'syncing':
      return (
        <View style={containerStyle}>
          <ActivityIndicator size="small" color={blueColor} />
        </View>
      );

    case 'synced':
      return (
        <View style={containerStyle}>
          <Icon name={Check} size={size} color={greenColor} />
        </View>
      );

    case 'error':
      return (
        <View style={containerStyle}>
          <Icon name={AlertCircle} size={size} color={redColor} />
        </View>
      );

    default:
      return null;
  }
}
