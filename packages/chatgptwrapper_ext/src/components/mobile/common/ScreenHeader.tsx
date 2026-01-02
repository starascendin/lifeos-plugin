import type { ReactNode } from 'react';

interface ScreenHeaderProps {
  title: string;
  action?: ReactNode;
}

export function ScreenHeader({ title, action }: ScreenHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-background shrink-0 safe-top">
      <h1 className="text-lg font-semibold">{title}</h1>
      {action && <div>{action}</div>}
    </header>
  );
}
