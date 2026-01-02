import { useAppStore, type TabType } from '../../store/appStore';

const TABS: { id: TabType; label: string }[] = [
  { id: 'council', label: 'Council' },
  { id: 'chat', label: 'Multi-Chat' }
];

export function TabSelector() {
  const currentTab = useAppStore((state) => state.currentTab);
  const setTab = useAppStore((state) => state.setTab);

  return (
    <div className="tab-selector">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab-button ${currentTab === tab.id ? 'active' : ''}`}
          onClick={() => setTab(tab.id)}
          data-tab={tab.id}
          title={tab.label}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
