import { TouchableOpacity, StyleSheet } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { useColor } from '@/hooks/useColor';
import {
  Heart,
  Trash2,
  ChevronRight,
  Clock,
  MessageSquare,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { Doc } from '@holaai/convex/_generated/dataModel';

interface ConversationCardProps {
  conversation: Doc<"hola_journeyConversations">;
  onPress: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

export function ConversationCard({
  conversation,
  onPress,
  onToggleFavorite,
  onDelete,
}: ConversationCardProps) {
  const primary = useColor('primary');
  const textMuted = useColor('textMuted');

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card}>
        <CardContent style={{ padding: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: `${primary}15` }]}>
              <Icon name={MessageSquare} size={20} color={primary} />
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
              <Text variant='body' style={{ fontWeight: '600', marginBottom: 4 }}>
                {conversation.title}
              </Text>
              <Text variant='caption' style={{ color: textMuted }} numberOfLines={2}>
                {conversation.situation}
              </Text>

              {/* Meta info */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <Icon name={Clock} size={12} color={textMuted} />
                <Text variant='caption' style={{ color: textMuted, marginLeft: 4 }}>
                  {formatDate(conversation.createdAt)}
                </Text>
                <Text variant='caption' style={{ color: textMuted, marginLeft: 12 }}>
                  {conversation.dialogue.length} lines
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                style={{ padding: 8 }}
              >
                <Icon
                  name={Heart}
                  size={18}
                  color={conversation.isFavorite ? '#ef4444' : textMuted}
                  fill={conversation.isFavorite ? '#ef4444' : 'transparent'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                style={{ padding: 8 }}
              >
                <Icon name={Trash2} size={18} color={textMuted} />
              </TouchableOpacity>
              <Icon name={ChevronRight} size={18} color={textMuted} />
            </View>
          </View>
        </CardContent>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
});
