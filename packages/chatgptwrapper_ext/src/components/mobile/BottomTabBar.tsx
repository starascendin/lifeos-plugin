import { MessagesSquare, History, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MobileTab } from './MobileApp';

interface TabItem {
  id: MobileTab;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabItem[] = [
  { id: 'council', label: 'Council', icon: <MessagesSquare className="h-5 w-5" /> },
  { id: 'history', label: 'History', icon: <History className="h-5 w-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
];

interface BottomTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <nav className="flex items-center justify-around border-t bg-background/95 backdrop-blur shrink-0 safe-bottom">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex flex-col items-center justify-center gap-1 flex-1 h-16 min-w-[64px]",
            "transition-colors touch-manipulation active:bg-accent/50",
            activeTab === tab.id ? "text-primary" : "text-muted-foreground"
          )}
        >
          {tab.icon}
          <span className="text-xs font-medium">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
