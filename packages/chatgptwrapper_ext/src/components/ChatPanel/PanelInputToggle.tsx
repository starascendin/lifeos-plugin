interface PanelInputToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function PanelInputToggle({ isOpen, onToggle }: PanelInputToggleProps) {
  return (
    <div className="panel-input-toggle">
      <button
        className={`panel-input-toggle-btn ${isOpen ? 'active' : ''}`}
        onClick={onToggle}
        title={isOpen ? 'Hide input' : 'Show input for this panel'}
      >
        {isOpen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        )}
      </button>
    </div>
  );
}
