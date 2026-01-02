import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useCouncilHistoryStore } from '../store/councilHistoryStore';
import { LayoutSelector } from './Sidebar/LayoutSelector';
import { TierSelector } from './Sidebar/TierSelector';
import { AuthStatus } from './Sidebar/AuthStatus';
import { XaiSettings } from './Sidebar/XaiSettings';

interface MobileToolbarProps {
  onClose: () => void;
}

export function MobileToolbar({ onClose }: MobileToolbarProps) {
  const currentTab = useAppStore((state) => state.currentTab);
  const [showXaiSettings, setShowXaiSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Council history state
  const conversations = useCouncilHistoryStore((state) => state.conversations);
  const currentConversationId = useCouncilHistoryStore((state) => state.currentConversationId);
  const loadConversationById = useCouncilHistoryStore((state) => state.loadConversationById);
  const createNewConversation = useCouncilHistoryStore((state) => state.createNewConversation);

  const handleSelectConversation = (id: string) => {
    loadConversationById(id);
    setShowHistory(false);
    onClose();
  };

  const handleNewConversation = () => {
    createNewConversation();
    setShowHistory(false);
    onClose();
  };

  return (
    <>
      <div className="mobile-toolbar-backdrop" onClick={onClose} />
      <div className="mobile-toolbar">
        {currentTab === 'chat' && (
          <div className="mobile-toolbar-section">
            <LayoutSelector />
          </div>
        )}
        {currentTab === 'council' && (
          <div className="mobile-toolbar-section">
            <div className="mobile-toolbar-history-header">
              <span className="mobile-toolbar-label">History</span>
              <button className="mobile-toolbar-new-btn" onClick={handleNewConversation}>+ New</button>
            </div>
            {showHistory ? (
              <div className="mobile-toolbar-history-list">
                {conversations.length === 0 ? (
                  <div className="mobile-toolbar-history-empty">No conversations</div>
                ) : (
                  conversations.slice(0, 5).map((conv) => (
                    <button
                      key={conv.id}
                      className={`mobile-toolbar-history-item ${conv.id === currentConversationId ? 'active' : ''}`}
                      onClick={() => handleSelectConversation(conv.id)}
                    >
                      {conv.title}
                    </button>
                  ))
                )}
              </div>
            ) : (
              <button className="mobile-toolbar-history-toggle" onClick={() => setShowHistory(true)}>
                Show recent ({conversations.length})
              </button>
            )}
          </div>
        )}
        <div className="mobile-toolbar-section">
          <TierSelector />
        </div>
        <div className="mobile-toolbar-row">
          <button
            className="mobile-toolbar-settings-btn"
            onClick={() => setShowXaiSettings(true)}
          >
            Settings
          </button>
          <AuthStatus />
        </div>
      </div>
      {showXaiSettings && <XaiSettings onClose={() => setShowXaiSettings(false)} />}
    </>
  );
}
