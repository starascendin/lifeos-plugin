import { useState, useEffect } from 'react';
import { useAuthStatus } from '../../hooks/useAuthStatus';
import { useCouncilHistoryStore } from '../../store/councilHistoryStore';
import { BottomTabBar } from './BottomTabBar';
import { CouncilScreen } from './screens/CouncilScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export type MobileTab = 'council' | 'history' | 'settings';

export function MobileApp() {
  const [activeTab, setActiveTab] = useState<MobileTab>('council');

  // Initialize auth status
  useAuthStatus();

  // Initialize history on mount
  const initFromStorage = useCouncilHistoryStore((state) => state.initFromStorage);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">
      {/* Screen content area */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'council' && <CouncilScreen />}
        {activeTab === 'history' && <HistoryScreen onNavigate={setActiveTab} />}
        {activeTab === 'settings' && <SettingsScreen />}
      </main>

      {/* Fixed bottom tab bar */}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
