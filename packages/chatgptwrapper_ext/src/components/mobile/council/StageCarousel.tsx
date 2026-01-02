import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Stage1Mobile } from './Stage1Mobile';
import { Stage2Mobile } from './Stage2Mobile';
import { Stage3Mobile } from './Stage3Mobile';
import type { CouncilMessage } from '../../../store/councilStore';

interface StageCarouselProps {
  message: CouncilMessage;
}

const STAGE_INFO = {
  stage1: { label: 'Stage 1: Responses', color: '#3b82f6' },
  stage2: { label: 'Stage 2: Rankings', color: '#8b5cf6' },
  stage3: { label: 'Stage 3: Synthesis', color: '#22c55e' },
};

export function StageCarousel({ message }: StageCarouselProps) {
  const { stage1, stage2, stage3, metadata, loading } = message;

  // Determine which stages are available
  const hasStage1 = stage1 && stage1.length > 0;
  const hasStage2 = stage2 && stage2.length > 0;
  const hasStage3 = stage3 && stage3.length > 0;

  // Default to the latest completed stage
  const defaultStage = hasStage3 ? 'stage3' : hasStage2 ? 'stage2' : 'stage1';
  const [activeStage, setActiveStage] = useState(defaultStage);

  if (!hasStage1 && !hasStage2 && !hasStage3) {
    return null;
  }

  const stages = [
    { key: 'stage1' as const, available: hasStage1, loading: loading?.stage1 },
    { key: 'stage2' as const, available: hasStage2, loading: loading?.stage2 },
    { key: 'stage3' as const, available: hasStage3, loading: loading?.stage3 },
  ];

  return (
    <div className="flex gap-2">
      {/* Stage indicator bars on left */}
      <div className="flex flex-col gap-1 pt-1">
        {stages.map(({ key, available, loading: isLoading }) => (
          <button
            key={key}
            className={cn(
              "w-1.5 h-6 rounded-full transition-all",
              available
                ? activeStage === key
                  ? "opacity-100"
                  : "opacity-40 hover:opacity-70"
                : isLoading
                  ? "opacity-30 animate-pulse"
                  : "opacity-20"
            )}
            style={{ backgroundColor: STAGE_INFO[key].color }}
            onClick={() => available && setActiveStage(key)}
            disabled={!available}
            title={STAGE_INFO[key].label}
            aria-label={STAGE_INFO[key].label}
          />
        ))}
      </div>

      {/* Main content */}
      <Tabs value={activeStage} onValueChange={(v) => setActiveStage(v as typeof activeStage)} className="flex-1">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="stage1" disabled={!hasStage1} className="text-xs">
            Responses
          </TabsTrigger>
          <TabsTrigger value="stage2" disabled={!hasStage2} className="text-xs">
            Rankings
          </TabsTrigger>
          <TabsTrigger value="stage3" disabled={!hasStage3} className="text-xs">
            Synthesis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stage1" className="mt-0">
          {hasStage1 && <Stage1Mobile responses={stage1} />}
        </TabsContent>

        <TabsContent value="stage2" className="mt-0">
          {hasStage2 && (
            <Stage2Mobile
              rankings={stage2}
              labelToModel={metadata?.labelToModel}
              aggregateRankings={metadata?.aggregateRankings}
            />
          )}
        </TabsContent>

        <TabsContent value="stage3" className="mt-0">
          {hasStage3 && <Stage3Mobile responses={stage3} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
