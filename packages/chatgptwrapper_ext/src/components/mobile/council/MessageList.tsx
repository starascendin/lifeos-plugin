import { useRef, useEffect } from 'react';
import { marked } from 'marked';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StageCarousel } from './StageCarousel';
import type { CouncilMessage } from '../../../store/councilStore';

interface MessageListProps {
  messages: CouncilMessage[];
}

function LoadingIndicator({ stage, text }: { stage: number; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Stage {stage}: {text}</span>
    </div>
  );
}

export function MessageList({ messages }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 px-4 py-3">
      <div className="space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {msg.role === 'user' ? (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">You</div>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-sm p-3 bg-primary/10 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: marked(msg.content || '') }}
                />
              </div>
            ) : (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">LLM Council</div>

                {/* Loading states */}
                {msg.loading?.stage1 && (
                  <LoadingIndicator stage={1} text="Collecting individual responses..." />
                )}
                {msg.loading?.stage2 && (
                  <LoadingIndicator stage={2} text="Peer rankings in progress..." />
                )}
                {msg.loading?.stage3 && (
                  <LoadingIndicator stage={3} text="Synthesizing final answers..." />
                )}

                {/* Stage carousel */}
                {(msg.stage1 || msg.stage2 || msg.stage3) && (
                  <StageCarousel message={msg} />
                )}

                {/* Error */}
                {msg.error && (
                  <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-lg">
                    Error: {msg.error}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
