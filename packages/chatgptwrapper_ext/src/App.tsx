import { Sidebar } from './components/Sidebar/Sidebar';
import { PanelsContainer } from './components/PanelsContainer';
import { InputBar } from './components/InputBar';
import { CouncilContainer } from './components/Council/CouncilContainer';
import { useAuthStatus } from './hooks/useAuthStatus';
import { useRemoteCouncil } from './hooks/useRemoteCouncil';
import { useAppStore } from './store/appStore';

export function App() {
  useAuthStatus();
  useRemoteCouncil(); // Enable remote council execution via WebSocket
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
