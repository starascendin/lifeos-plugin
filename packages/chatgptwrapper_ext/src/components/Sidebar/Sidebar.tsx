import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { TabSelector } from './TabSelector';
import { LayoutSelector } from './LayoutSelector';
import { TierSelector } from './TierSelector';
import { AuthStatus } from './AuthStatus';
import { CouncilHistory } from './CouncilHistory';
import { XaiSettings } from './XaiSettings';

export function Sidebar() {
  const currentTab = useAppStore((state) => state.currentTab);
  const [showXaiSettings, setShowXaiSettings] = useState(false);

  return (
    <aside className="sidebar">
      <div className="logo">LLM Hub</div>
      <TabSelector />
      {currentTab === 'chat' && <LayoutSelector />}
      {currentTab === 'council' && <CouncilHistory />}
      <TierSelector />
      <div className="xai-settings-trigger">
        <button onClick={() => setShowXaiSettings(true)} className="settings-btn">
          Settings
        </button>
      </div>
      <AuthStatus />
      {showXaiSettings && <XaiSettings onClose={() => setShowXaiSettings(false)} />}
    </aside>
  );
}
