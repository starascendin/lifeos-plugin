import { useEffect } from 'react';
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

export function CouncilHistory() {
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

  return (
    <div className="sidebar-section council-history">
      <div className="council-history-header">
        <span className="sidebar-title">History</span>
        <button
          className="new-conversation-btn"
          onClick={createNewConversation}
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
              onClick={() => loadConversationById(conv.id)}
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
  );
}
