import { marked } from 'marked';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LLM_CONFIG } from '../../../config/llm';
import type { Stage1Result } from '../../../store/councilStore';

interface Stage1MobileProps {
  responses: Stage1Result[];
}

export function Stage1Mobile({ responses }: Stage1MobileProps) {
  if (responses.length === 0) return null;

  return (
    <div className="mt-3">
      <h4 className="text-sm font-medium text-muted-foreground mb-2">
        Stage 1: Individual Responses
      </h4>
      <Tabs defaultValue={responses[0]?.llmType} className="w-full">
        <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${responses.length}, 1fr)` }}>
          {responses.map((r) => {
            const config = LLM_CONFIG[r.llmType];
            return (
              <TabsTrigger
                key={r.llmType}
                value={r.llmType}
                className="text-xs gap-1"
                style={{ color: config.color }}
              >
                <span>{config.icon}</span>
                <span className="hidden sm:inline">{config.name}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {responses.map((r) => (
          <TabsContent key={r.llmType} value={r.llmType} className="mt-2">
            <ScrollArea className="max-h-[300px]">
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm p-3 bg-muted/50 rounded-lg"
                dangerouslySetInnerHTML={{ __html: marked(r.response) }}
              />
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
