import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Bot,
  FolderKanban,
  Headphones,
  Kanban,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  RefreshCw,
  Settings,
  Target,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => runCommand(() => navigate("/lifeos"))}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
            <CommandShortcut>Go to home</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/lifeos/chatnexus"))}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat Nexus
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/lifeos/llmcouncil"))}
          >
            <Users className="mr-2 h-4 w-4" />
            LLM Council
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/lifeos/pm-ai"))}
          >
            <Bot className="mr-2 h-4 w-4" />
            PM AI
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/lifeos/habits"))}
          >
            <Target className="mr-2 h-4 w-4" />
            Habits
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/lifeos/voiceagent"))}
          >
            <Headphones className="mr-2 h-4 w-4" />
            Voice Agent
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/lifeos/settings"))}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Projects">
          <CommandItem
            onSelect={() => runCommand(() => navigate("/lifeos/pm"))}
          >
            <Kanban className="mr-2 h-4 w-4" />
            Projects Overview
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/lifeos/pm"))}
          >
            <ListTodo className="mr-2 h-4 w-4" />
            All Issues
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/lifeos/pm/projects"))}
          >
            <FolderKanban className="mr-2 h-4 w-4" />
            Projects List
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/lifeos/pm/cycles"))}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Cycles
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
