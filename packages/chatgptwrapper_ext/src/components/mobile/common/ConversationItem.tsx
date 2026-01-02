import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversationIndex } from '../../../types/councilHistory';

interface ConversationItemProps {
  conversation: ConversationIndex;
  isActive?: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

export function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete
}: ConversationItemProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center justify-between px-4 py-3 cursor-pointer",
        "transition-colors touch-manipulation active:bg-accent/50",
        isActive && "bg-accent"
      )}
    >
      <div className="flex-1 min-w-0 mr-3">
        <p className="font-medium truncate">{conversation.title}</p>
        <p className="text-sm text-muted-foreground">
          {conversation.messageCount} messages · {formatRelativeTime(conversation.updatedAt)}
        </p>
      </div>
      <button
        onClick={handleDelete}
        className="p-2 text-muted-foreground hover:text-destructive touch-manipulation"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
