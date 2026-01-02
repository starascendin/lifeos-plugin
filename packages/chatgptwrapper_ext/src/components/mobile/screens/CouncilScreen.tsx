import { MessagesSquare, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCouncilStore } from '../../../store/councilStore';
import { useCouncilHistoryStore } from '../../../store/councilHistoryStore';
import { useCouncil } from '../../../hooks/useCouncil';
import { useCouncilAutoSave } from '../../../hooks/useCouncilAutoSave';
import { LLMChips } from '../council/LLMChips';
import { MessageList } from '../council/MessageList';
import { InputBar } from '../council/InputBar';
import { EmptyState } from '../common/EmptyState';

export function CouncilScreen() {
  const messages = useCouncilStore((state) => state.messages);
  const isLoading = useCouncilStore((state) => state.isLoading);
  const clearMessages = useCouncilStore((state) => state.clearMessages);
  const currentTitle = useCouncilHistoryStore((state) => state.currentTitle);
  const createNewConversation = useCouncilHistoryStore((state) => state.createNewConversation);
  const { runCouncil } = useCouncil();

  // Enable auto-save
  useCouncilAutoSave();

  const handleClear = () => {
    clearMessages();
  };

  const handleNew = () => {
    createNewConversation();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header with LLM chips */}
      <div className="shrink-0 px-4 py-3 border-b bg-background/95 backdrop-blur safe-top">
        {messages.length > 0 && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium truncate flex-1 mr-2">
              {currentTitle || 'New Conversation'}
            </span>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNew}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        <LLMChips />
      </div>

      {/* Message area */}
      {messages.length === 0 ? (
        <div className="flex-1 overflow-hidden">
          <EmptyState
            icon={<MessagesSquare className="h-12 w-12" />}
            title="LLM Council"
            description="Ask a question to consult the council of AI models. They'll respond, rank each other, and synthesize a final answer."
          />
        </div>
      ) : (
        <MessageList messages={messages} />
      )}

      {/* Fixed input bar */}
      <InputBar onSubmit={runCouncil} disabled={isLoading} />
    </div>
  );
}
