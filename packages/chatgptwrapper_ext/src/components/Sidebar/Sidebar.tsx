import { useAppStore } from '../../store/appStore';
import { TabSelector } from './TabSelector';
import { LayoutSelector } from './LayoutSelector';
import { TierSelector } from './TierSelector';
import { AuthStatus } from './AuthStatus';
import { CouncilHistory } from './CouncilHistory';

export function Sidebar() {
  const currentTab = useAppStore((state) => state.currentTab);

  return (
    <aside className="sidebar">
      <div className="logo">LLM Hub</div>
      <TabSelector />
      {currentTab === 'chat' && <LayoutSelector />}
      {currentTab === 'council' && <CouncilHistory />}
      <TierSelector />
      <AuthStatus />
    </aside>
  );
}
