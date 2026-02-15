import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Bot,
  Briefcase,
  Calendar,
  Cat,
  Clock,
  Cpu,
  FileAudio,
  FolderKanban,
  Globe,
  Headphones,
  Heart,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Network,
  NotebookPen,
  RefreshCw,
  Rocket,
  Settings,
  Target,
  Terminal,
  Timer,
  User,
  UserCircle,
  Users,
  Video,
} from "lucide-react";

interface CommandRoute {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
}

const ROUTES: { group: string; items: CommandRoute[] }[] = [
  {
    group: "LifeOS",
    items: [
      { name: "Dashboard", href: "/lifeos", icon: LayoutDashboard, keywords: ["home"] },
      { name: "Agenda", href: "/lifeos/agenda", icon: Calendar, keywords: ["daily", "weekly", "schedule"] },
      { name: "Initiatives", href: "/lifeos/initiatives", icon: Rocket, keywords: ["goals", "okr"] },
      { name: "Habits", href: "/lifeos/habits", icon: Target, keywords: ["tracking", "routine"] },
      { name: "Focus", href: "/lifeos/focus", icon: Timer, keywords: ["pomodoro", "timer"] },
      { name: "Voice Notes", href: "/lifeos/voicenotes", icon: FileAudio, keywords: ["memo", "recording"] },
      { name: "Voice AI", href: "/lifeos/voiceagent", icon: Headphones, keywords: ["butler", "assistant"] },
      { name: "AI Agent", href: "/lifeos/aiagent", icon: Cpu, keywords: ["chat", "ai"] },
      { name: "CatGirlAI", href: "/lifeos/catgirl", icon: Cat },
      { name: "Settings", href: "/lifeos/settings", icon: Settings },
    ],
  },
  {
    group: "CRM",
    items: [
      { name: "All Issues", href: "/lifeos/pm", icon: ListTodo, keywords: ["tasks", "kanban", "board"] },
      { name: "Projects", href: "/lifeos/pm/projects", icon: FolderKanban },
      { name: "Cycles", href: "/lifeos/pm/cycles", icon: RefreshCw, keywords: ["sprint"] },
      { name: "Clients", href: "/lifeos/pm/clients", icon: Briefcase },
      { name: "Contacts", href: "/lifeos/pm/contacts", icon: User, keywords: ["people"] },
      { name: "PM AI", href: "/lifeos/pm-ai", icon: Bot },
      { name: "Beeper", href: "/lifeos/beeper", icon: MessageSquare, keywords: ["chat", "messages"] },
      { name: "GranolaAI", href: "/lifeos/granola", icon: NotebookPen, keywords: ["meetings", "notes"] },
      { name: "FathomAI", href: "/lifeos/fathom", icon: Video, keywords: ["meetings", "video"] },
      { name: "People", href: "/lifeos/frm/people", icon: Users, keywords: ["contacts", "relationships", "frm"] },
      { name: "Timeline", href: "/lifeos/frm/timeline", icon: Clock, keywords: ["frm"] },
      { name: "Atlas", href: "/lifeos/atlas", icon: Globe },
      { name: "Avatar", href: "/lifeos/avatar", icon: UserCircle },
      { name: "Proxy Council", href: "/lifeos/proxy-council", icon: Network },
      { name: "Council API", href: "/lifeos/council-api", icon: Cpu },
      { name: "Chat Nexus", href: "/lifeos/chatnexus", icon: MessageSquare },
      { name: "LLM Council", href: "/lifeos/llmcouncil", icon: Users },
      { name: "ClaudeCode", href: "/lifeos/claudecode", icon: Terminal },
      { name: "Custom Agents", href: "/lifeos/custom-agents", icon: Bot },
    ],
  },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback(
    (href: string) => {
      setOpen(false);
      navigate(href);
    },
    [navigate],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Type to search..."
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          }
        }}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {ROUTES.map((group, gi) => (
          <CommandGroup key={group.group} heading={group.group}>
            {group.items.map((item) => (
              <CommandItem
                key={item.href}
                value={`${item.name} ${item.keywords?.join(" ") ?? ""}`}
                onSelect={() => runCommand(item.href)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
