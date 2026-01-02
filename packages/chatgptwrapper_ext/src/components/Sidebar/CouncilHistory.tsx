import { useEffect, useState } from 'react';
import { useCouncilHistoryStore } from '../../store/councilHistoryStore';

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const date = new Date(timestamp);

  // Less than 24 hours ago
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Less than 7 days ago
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }

  // Otherwise show date
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Extension mode history - shows conversations from chrome.storage
 * Works in both extension mode (direct storage) and server mode (via HTTP proxy)
 */
function ExtensionHistory({ isMobileOpen, onClose }: { isMobileOpen?: boolean; onClose?: () => void }) {
  const conversations = useCouncilHistoryStore((state) => state.conversations);
  const currentConversationId = useCouncilHistoryStore((state) => state.currentConversationId);
  const isHistoryLoading = useCouncilHistoryStore((state) => state.isHistoryLoading);
  const loadConversationById = useCouncilHistoryStore((state) => state.loadConversationById);
  const deleteConversation = useCouncilHistoryStore((state) => state.deleteConversation);
  const createNewConversation = useCouncilHistoryStore((state) => state.createNewConversation);
  const initFromStorage = useCouncilHistoryStore((state) => state.initFromStorage);

  // Initialize on mount
  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      await deleteConversation(id);
    }
  };

  const handleSelectConversation = (id: string) => {
    loadConversationById(id);
    onClose?.(); // Close mobile drawer after selection
  };

  const handleNewConversation = () => {
    createNewConversation();
    onClose?.(); // Close mobile drawer after creating new
  };

  return (
    <div
      className={`sidebar-section council-history ${isMobileOpen ? 'mobile-open' : ''}`}
      onClick={(e) => {
        // Close when clicking the backdrop (not the content)
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {isMobileOpen && (
        <button className="mobile-history-close" onClick={onClose}>×</button>
      )}
      <div className="council-history-content">
        <div className="council-history-header">
          <span className="sidebar-title">History</span>
          <button
            className="new-conversation-btn"
            onClick={handleNewConversation}
            title="New conversation"
          >
            +
          </button>
        </div>

        {isHistoryLoading ? (
          <div className="history-loading">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="history-empty">No conversations yet</div>
        ) : (
          <div className="conversation-list">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <div className="conversation-title">{conv.title}</div>
                <div className="conversation-meta">
                  {conv.messageCount} msg{conv.messageCount !== 1 ? 's' : ''} · {formatTimestamp(conv.updatedAt)}
                </div>
                <button
                  className="conversation-delete"
                  onClick={(e) => handleDelete(e, conv.id)}
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main CouncilHistory component - always uses extension history
 * In server mode, it fetches via HTTP proxy to extension's chrome.storage
 * In extension mode, it accesses chrome.storage directly
 */
export function CouncilHistory() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle button - shown in sidebar on mobile */}
      <button
        className="mobile-history-toggle"
        onClick={() => setIsMobileOpen(true)}
      >
        📋 History
      </button>

      {/* History component - inline on desktop, modal on mobile */}
      <ExtensionHistory
        isMobileOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
      />
    </>
  );
}
