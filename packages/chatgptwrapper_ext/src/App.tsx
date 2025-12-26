import { Sidebar } from './components/Sidebar/Sidebar';
import { PanelsContainer } from './components/PanelsContainer';
import { InputBar } from './components/InputBar';
import { CouncilContainer } from './components/Council/CouncilContainer';
import { useAuthStatus } from './hooks/useAuthStatus';
import { useRemoteCouncil } from './hooks/useRemoteCouncil';
import { useAppStore } from './store/appStore';

// Check if we're running in server mode (no chrome APIs available)
const isServerMode = typeof chrome === 'undefined' || !chrome.storage?.local;

export function App() {
  useAuthStatus();
  // Only enable remote council in extension mode - server mode uses HTTP directly
  useRemoteCouncil({ enabled: !isServerMode });
  const currentTab = useAppStore((state) => state.currentTab);

  return (
    <div className="app">
      <Sidebar />
      <main className="main-content">
        {currentTab === 'chat' ? (
          <>
            <PanelsContainer />
            <InputBar />
          </>
        ) : (
          <CouncilContainer />
        )}
      </main>
    </div>
  );
}
