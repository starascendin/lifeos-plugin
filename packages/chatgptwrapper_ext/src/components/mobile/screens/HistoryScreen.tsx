import { useEffect } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCouncilHistoryStore } from '../../../store/councilHistoryStore';
import { ScreenHeader } from '../common/ScreenHeader';
import { EmptyState } from '../common/EmptyState';
import { ConversationItem } from '../common/ConversationItem';
import type { MobileTab } from '../MobileApp';

interface HistoryScreenProps {
  onNavigate: (tab: MobileTab) => void;
}

export function HistoryScreen({ onNavigate }: HistoryScreenProps) {
  const conversations = useCouncilHistoryStore((state) => state.conversations);
  const currentConversationId = useCouncilHistoryStore((state) => state.currentConversationId);
  const isHistoryLoading = useCouncilHistoryStore((state) => state.isHistoryLoading);
  const loadHistory = useCouncilHistoryStore((state) => state.loadHistory);
  const loadConversationById = useCouncilHistoryStore((state) => state.loadConversationById);
  const deleteConversation = useCouncilHistoryStore((state) => state.deleteConversation);
  const createNewConversation = useCouncilHistoryStore((state) => state.createNewConversation);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSelect = async (id: string) => {
    await loadConversationById(id);
    onNavigate('council');
  };

  const handleNew = () => {
    createNewConversation();
    onNavigate('council');
  };

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader
        title="History"
        action={
          <Button size="sm" onClick={handleNew}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        }
      />

      {isHistoryLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-12 w-12" />}
          title="No conversations yet"
          description="Start a new council session to see your history"
          action={
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-1" />
              Start New
            </Button>
          }
        />
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === currentConversationId}
                onSelect={() => handleSelect(conv.id)}
                onDelete={() => deleteConversation(conv.id)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
