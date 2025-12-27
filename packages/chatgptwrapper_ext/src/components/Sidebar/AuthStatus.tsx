import { useAppStore } from '../../store/appStore';

export function AuthStatus() {
  const authStatus = useAppStore((state) => state.authStatus);

  const items = [
    { key: 'chatgpt', label: 'ChatGPT', ok: authStatus.chatgpt },
    { key: 'claude', label: 'Claude', ok: authStatus.claude },
    { key: 'gemini', label: 'Gemini', ok: authStatus.gemini },
    { key: 'xai', label: 'Grok', ok: authStatus.xai }
  ];

  return (
    <div className="auth-status">
      {items.map((item, i) => (
        <span key={item.key}>
          {item.label} {item.ok ? '✓' : '✗'}
          {i < items.length - 1 && ' | '}
        </span>
      ))}
    </div>
  );
}
