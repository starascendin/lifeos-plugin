import { useRef, useEffect } from 'react';
import { marked } from 'marked';
import { useCouncilStore } from '../../store/councilStore';
import { useCouncilHistoryStore } from '../../store/councilHistoryStore';
import { useCouncil } from '../../hooks/useCouncil';
import { useCouncilAutoSave } from '../../hooks/useCouncilAutoSave';
import { Stage1 } from './Stage1';
import { Stage2 } from './Stage2';
import { Stage3 } from './Stage3';
import { CouncilInputBar } from './CouncilInputBar';

export function CouncilContainer() {
  const messages = useCouncilStore((state) => state.messages);
  const isLoading = useCouncilStore((state) => state.isLoading);
  const clearMessages = useCouncilStore((state) => state.clearMessages);
  const currentTitle = useCouncilHistoryStore((state) => state.currentTitle);
  const createNewConversation = useCouncilHistoryStore((state) => state.createNewConversation);
  const { runCouncil } = useCouncil();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Enable auto-save when Stage 3 completes
  useCouncilAutoSave();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewConversation = () => {
    createNewConversation();
  };

  const handleClearMessages = () => {
    clearMessages();
  };

  return (
    <div className="council-container">
      {/* Header Bar */}
      {messages.length > 0 && (
        <div className="council-header-bar">
          <div className="council-current-title">
            {currentTitle || 'New Conversation'}
          </div>
          <button
            className="council-header-btn"
            onClick={handleClearMessages}
            disabled={isLoading}
          >
            Clear
          </button>
          <button
            className="council-header-btn primary"
            onClick={handleNewConversation}
            disabled={isLoading}
          >
            New
          </button>
        </div>
      )}
      <div className="council-messages">
        {messages.length === 0 ? (
          <div className="council-empty">
            <h2>LLM Council</h2>
            <p>Ask a question to consult the council of AI models.</p>
            <p className="council-description">
              The council will gather responses from ChatGPT, Claude, and Gemini,
              have them rank each other's answers, then synthesize a final response.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="council-message-group">
              {msg.role === 'user' ? (
                <div className="council-user-message">
                  <div className="message-label">You</div>
                  <div
                    className="message-content markdown-content"
                    dangerouslySetInnerHTML={{ __html: marked(msg.content || '') }}
                  />
                </div>
              ) : (
                <div className="council-assistant-message">
                  <div className="message-label">LLM Council</div>

                  {/* Stage 1 Loading */}
                  {msg.loading?.stage1 && (
                    <div className="stage-loading">
                      <div className="spinner" />
                      <span>Stage 1: Collecting individual responses...</span>
                    </div>
                  )}

                  {/* Stage 1 Results */}
                  {msg.stage1 && <Stage1 responses={msg.stage1} />}

                  {/* Stage 2 Loading */}
                  {msg.loading?.stage2 && (
                    <div className="stage-loading">
                      <div className="spinner" />
                      <span>Stage 2: Peer rankings in progress...</span>
                    </div>
                  )}

                  {/* Stage 2 Results */}
                  {msg.stage2 && (
                    <Stage2
                      rankings={msg.stage2}
                      labelToModel={msg.metadata?.labelToModel}
                      aggregateRankings={msg.metadata?.aggregateRankings}
                    />
                  )}

                  {/* Stage 3 Loading */}
                  {msg.loading?.stage3 && (
                    <div className="stage-loading">
                      <div className="spinner" />
                      <span>Stage 3: Chairman synthesizing final answer...</span>
                    </div>
                  )}

                  {/* Stage 3 Results */}
                  {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}

                  {/* Error */}
                  {msg.error && (
                    <div className="council-error">
                      Error: {msg.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      <CouncilInputBar onSubmit={runCouncil} disabled={isLoading} />
    </div>
  );
}
