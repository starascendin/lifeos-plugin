import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Stage1Mobile } from './Stage1Mobile';
import { Stage2Mobile } from './Stage2Mobile';
import { Stage3Mobile } from './Stage3Mobile';
import type { CouncilMessage } from '../../../store/councilStore';

interface StageCarouselProps {
  message: CouncilMessage;
}

export function StageCarousel({ message }: StageCarouselProps) {
  const { stage1, stage2, stage3, metadata } = message;

  // Determine which stages are available
  const hasStage1 = stage1 && stage1.length > 0;
  const hasStage2 = stage2 && stage2.length > 0;
  const hasStage3 = stage3 && stage3.length > 0;

  // Default to the latest completed stage
  const defaultStage = hasStage3 ? 'stage3' : hasStage2 ? 'stage2' : 'stage1';

  if (!hasStage1 && !hasStage2 && !hasStage3) {
    return null;
  }

  return (
    <Tabs defaultValue={defaultStage} className="w-full">
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
  );
}
