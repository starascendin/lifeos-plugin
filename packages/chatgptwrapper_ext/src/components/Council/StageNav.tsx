import { useCallback } from 'react';

interface StageNavProps {
  hasStage1: boolean;
  hasStage2: boolean;
  hasStage3: boolean;
  loadingStage1?: boolean;
  loadingStage2?: boolean;
  loadingStage3?: boolean;
  messageId: string;
}

const STAGE_INFO = {
  stage1: { label: 'Stage 1: Individual Responses', shortLabel: 'Responses' },
  stage2: { label: 'Stage 2: Peer Rankings', shortLabel: 'Rankings' },
  stage3: { label: 'Stage 3: Synthesis', shortLabel: 'Synthesis' },
};

export function StageNav({
  hasStage1,
  hasStage2,
  hasStage3,
  loadingStage1,
  loadingStage2,
  loadingStage3,
  messageId,
}: StageNavProps) {
  const scrollToStage = useCallback((stage: 'stage1' | 'stage2' | 'stage3') => {
    const element = document.getElementById(`${messageId}-${stage}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messageId]);

  const stages = [
    { key: 'stage1' as const, available: hasStage1, loading: loadingStage1 },
    { key: 'stage2' as const, available: hasStage2, loading: loadingStage2 },
    { key: 'stage3' as const, available: hasStage3, loading: loadingStage3 },
  ];

  // Only show if at least one stage is available or loading
  const shouldShow = stages.some(s => s.available || s.loading);
  if (!shouldShow) return null;

  return (
    <div className="stage-nav">
      {stages.map(({ key, available, loading }) => (
        <button
          key={key}
          className={`stage-nav-bar ${available ? 'available' : ''} ${loading ? 'loading' : ''}`}
          onClick={() => available && scrollToStage(key)}
          disabled={!available}
          title={STAGE_INFO[key].label}
          aria-label={STAGE_INFO[key].label}
        >
          <span className="stage-nav-tooltip">{STAGE_INFO[key].shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
