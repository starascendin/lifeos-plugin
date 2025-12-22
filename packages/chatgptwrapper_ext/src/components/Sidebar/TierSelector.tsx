import { useAppStore } from '../../store/appStore';
import { usePanelsStore } from '../../store/panelsStore';
import type { Tier } from '../../config/llm';

const tiers: { value: Tier; label: string }[] = [
  { value: 'mini', label: 'Mini' },
  { value: 'normal', label: 'Normal' },
  { value: 'pro', label: 'Pro' }
];

export function TierSelector() {
  const currentTier = useAppStore((state) => state.currentTier);
  const setTier = useAppStore((state) => state.setTier);
  const updateAllPanelsTier = usePanelsStore((state) => state.updateAllPanelsTier);

  const handleTierChange = (tier: Tier) => {
    setTier(tier);
    updateAllPanelsTier(tier);
  };

  return (
    <div className="sidebar-section">
      <div className="sidebar-title">Model Tier</div>
      <div className="tier-buttons">
        {tiers.map((tier) => (
          <button
            key={tier.value}
            className={`tier-btn ${currentTier === tier.value ? 'active' : ''}`}
            onClick={() => handleTierChange(tier.value)}
            data-tier={tier.value}
          >
            {tier.label}
          </button>
        ))}
      </div>
    </div>
  );
}
