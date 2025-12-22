import { useAppStore } from '../../store/appStore';

const layouts = [1, 2, 3, 4] as const;

const layoutIcons = {
  1: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  ),
  2: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="8" height="18" rx="1" />
      <rect x="13" y="3" width="8" height="18" rx="1" />
    </svg>
  ),
  3: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="5.5" height="18" rx="1" />
      <rect x="9.5" y="3" width="5" height="18" rx="1" />
      <rect x="15.5" y="3" width="5.5" height="18" rx="1" />
    </svg>
  ),
  4: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  )
};

export function LayoutSelector() {
  const currentLayout = useAppStore((state) => state.currentLayout);
  const setLayout = useAppStore((state) => state.setLayout);

  return (
    <div className="sidebar-section">
      <div className="sidebar-title">Layout</div>
      <div className="layout-buttons">
        {layouts.map((layout) => (
          <button
            key={layout}
            className={`layout-btn ${currentLayout === layout ? 'active' : ''}`}
            onClick={() => setLayout(layout)}
            title={`${layout} panel${layout > 1 ? 's' : ''}`}
          >
            {layoutIcons[layout]}
          </button>
        ))}
      </div>
    </div>
  );
}
