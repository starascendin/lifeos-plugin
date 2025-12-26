import { useEffect } from 'react';
import { useCouncilHistoryStore } from '../../store/councilHistoryStore';
import { useServerRequests, type ServerRequest } from '../../hooks/useServerRequests';

/**
 * Check if we're running in server mode
 */
function isServerMode(): boolean {
  return typeof chrome === 'undefined' || !chrome.storage?.local;
}

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

function truncateQuery(query: string, maxLen: number = 40): string {
  if (query.length <= maxLen) return query;
  return query.slice(0, maxLen) + '...';
}

function StatusBadge({ status }: { status: ServerRequest['status'] }) {
  const config = {
    pending: { icon: '⏳', color: '#f59e0b', label: 'Pending' },
    processing: { icon: '⏳', color: '#f59e0b', label: 'Processing' },
    completed: { icon: '✓', color: '#22c55e', label: 'Completed' },
    error: { icon: '✕', color: '#ef4444', label: 'Error' }
  };

  const { icon, color } = config[status];

  return (
    <span
      className="status-badge"
      style={{ color, marginRight: 6 }}
      title={config[status].label}
    >
      {icon}
    </span>
  );
}

/**
 * Server mode history - shows requests from server persistence
 */
function ServerHistory() {
  const {
    requests,
    isLoading,
    selectedRequestId,
    selectRequest,
    deleteRequest,
    clearSelection
  } = useServerRequests();

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this request?')) {
      await deleteRequest(id);
    }
  };

  return (
    <div className="sidebar-section council-history">
      <div className="council-history-header">
        <span className="sidebar-title">Requests</span>
        <button
          className="new-conversation-btn"
          onClick={clearSelection}
          title="New request"
        >
          +
        </button>
      </div>

      {isLoading && requests.length === 0 ? (
        <div className="history-loading">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="history-empty">No requests yet</div>
      ) : (
        <div className="conversation-list">
          {requests.map((req) => (
            <div
              key={req.id}
              className={`conversation-item ${req.id === selectedRequestId ? 'active' : ''}`}
              onClick={() => selectRequest(req.id)}
            >
              <div className="conversation-title">
                <StatusBadge status={req.status} />
                {truncateQuery(req.query)}
              </div>
              <div className="conversation-meta">
                {req.tier} · {formatTimestamp(req.createdAt)}
              </div>
              <button
                className="conversation-delete"
                onClick={(e) => handleDelete(e, req.id)}
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

/**
 * Extension mode history - shows conversations from chrome.storage
 */
function ExtensionHistory() {
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

/**
 * Main CouncilHistory component - always uses extension history
 * In server mode, it fetches via HTTP proxy to extension's chrome.storage
 * In extension mode, it accesses chrome.storage directly
 */
export function CouncilHistory() {
  // Always use ExtensionHistory - it works in both modes:
  // - Extension mode: direct chrome.storage access
  // - Server mode: fetches via /conversations endpoint which proxies to extension
  return <ExtensionHistory />;
}
