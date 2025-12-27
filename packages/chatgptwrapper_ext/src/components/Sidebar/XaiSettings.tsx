import { useState, useEffect } from 'react';
import { getVercelApiKey, setVercelApiKey, removeVercelApiKey } from '../../services/xai';
import { useAppStore } from '../../store/appStore';

interface SettingsProps {
  onClose: () => void;
}

export function XaiSettings({ onClose }: SettingsProps) {
  const [apiKey, setApiKeyState] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const setAuthStatus = useAppStore((state) => state.setAuthStatus);

  useEffect(() => {
    getVercelApiKey().then((key) => {
      setIsConfigured(!!key);
      if (key) {
        setApiKeyState(key);
      }
    });
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await setVercelApiKey(apiKey.trim());
      setIsConfigured(true);
      setAuthStatus({ xai: true });
      setMessage({ type: 'success', text: 'API key saved successfully' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save API key' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeVercelApiKey();
      setApiKeyState('');
      setIsConfigured(false);
      setAuthStatus({ xai: false });
      setMessage({ type: 'success', text: 'API key removed' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove API key' });
    }
  };

  return (
    <div className="xai-settings-overlay" onClick={onClose}>
      <div className="xai-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="xai-settings-header">
          <h3>Vercel AI Gateway Settings</h3>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="xai-settings-content">
          <p className="settings-description">
            Add your Vercel AI Gateway API key to enable Grok models.
            <br />
            Get your API key from{' '}
            <a href="https://vercel.com/docs/ai-gateway" target="_blank" rel="noopener noreferrer">
              Vercel AI Gateway
            </a>
          </p>

          <div className="api-key-input-group">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              placeholder="Enter your Vercel API key..."
              className="api-key-input"
            />
            <button onClick={() => setShowKey(!showKey)} className="toggle-btn">
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>

          {message && (
            <div className={`message ${message.type}`}>{message.text}</div>
          )}

          <div className="settings-actions">
            <button
              onClick={handleSave}
              disabled={isSaving || !apiKey.trim()}
              className="save-btn"
            >
              {isSaving ? 'Saving...' : 'Save API Key'}
            </button>
            {isConfigured && (
              <button onClick={handleRemove} className="remove-btn">
                Remove Key
              </button>
            )}
          </div>

          {isConfigured && (
            <p className="status-configured">Vercel AI Gateway is configured. Grok models are available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
