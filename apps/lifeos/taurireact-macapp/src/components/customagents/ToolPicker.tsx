import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckSquare,
  Folder,
  RefreshCw,
  Layers,
  Calendar,
  Building2,
  Users,
  BookOpen,
  Mic,
  Sparkles,
  MessageSquare,
  Video,
  Briefcase,
  Target,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ==================== TOOL CATEGORIES ====================

const TOOL_CATEGORIES = [
  { id: "tasks", name: "Tasks / Issues", icon: CheckSquare },
  { id: "projects", name: "Projects", icon: Folder },
  { id: "cycles", name: "Cycles / Sprints", icon: RefreshCw },
  { id: "phases", name: "Phases", icon: Layers },
  { id: "agenda", name: "Agenda", icon: Calendar },
  { id: "clients", name: "Clients", icon: Building2 },
  { id: "contacts", name: "Contacts / FRM", icon: Users },
  { id: "notes", name: "Notes / Journal", icon: BookOpen },
  { id: "voice", name: "Voice Memos", icon: Mic },
  { id: "ai_summaries", name: "AI Summaries", icon: Sparkles },
  { id: "beeper", name: "Beeper / Messaging", icon: MessageSquare },
  { id: "meetings", name: "Meetings / Granola", icon: Video },
  { id: "crm", name: "CRM / Business", icon: Briefcase },
  { id: "initiatives", name: "Initiatives", icon: Target },
] as const;

// ==================== TOOL REGISTRY (UI-side) ====================

interface ToolEntry {
  name: string;
  description: string;
  category: string;
}

const TOOLS: ToolEntry[] = [
  // Tasks
  { name: "get_todays_tasks", description: "Get today's tasks including top priority items", category: "tasks" },
  { name: "get_tasks", description: "Get tasks with optional filters", category: "tasks" },
  { name: "create_issue", description: "Create a new task/issue", category: "tasks" },
  { name: "mark_issue_complete", description: "Mark a task as complete", category: "tasks" },
  { name: "get_issue", description: "Get a single issue/task's full details", category: "tasks" },
  { name: "update_issue", description: "Update an issue/task's details", category: "tasks" },
  { name: "delete_issue", description: "Delete an issue/task permanently", category: "tasks" },
  // Projects
  { name: "get_projects", description: "Get user's projects with stats", category: "projects" },
  { name: "get_project", description: "Get a single project's details", category: "projects" },
  { name: "create_project", description: "Create a new project", category: "projects" },
  { name: "update_project", description: "Update a project's details", category: "projects" },
  { name: "delete_project", description: "Delete a project", category: "projects" },
  // Cycles
  { name: "get_current_cycle", description: "Get active cycle with progress stats", category: "cycles" },
  { name: "get_cycles", description: "Get all cycles/sprints", category: "cycles" },
  { name: "create_cycle", description: "Create a new cycle/sprint", category: "cycles" },
  { name: "update_cycle", description: "Update a cycle's details", category: "cycles" },
  { name: "delete_cycle", description: "Delete a cycle", category: "cycles" },
  { name: "close_cycle", description: "Close/complete a cycle", category: "cycles" },
  { name: "generate_cycles", description: "Generate upcoming cycles", category: "cycles" },
  { name: "assign_issue_to_cycle", description: "Assign a task to a cycle", category: "cycles" },
  // Phases
  { name: "get_phases", description: "Get all phases for a project", category: "phases" },
  { name: "get_phase", description: "Get a single phase with issues", category: "phases" },
  { name: "create_phase", description: "Create a new phase in a project", category: "phases" },
  { name: "update_phase", description: "Update a phase's details", category: "phases" },
  { name: "delete_phase", description: "Delete a phase", category: "phases" },
  { name: "assign_issue_to_phase", description: "Assign issue to a phase", category: "phases" },
  // Agenda
  { name: "get_daily_agenda", description: "Get today's full agenda", category: "agenda" },
  { name: "get_weekly_agenda", description: "Get weekly agenda", category: "agenda" },
  { name: "get_monthly_agenda", description: "Get monthly agenda", category: "agenda" },
  { name: "regenerate_daily_summary", description: "Regenerate daily AI summary", category: "agenda" },
  { name: "regenerate_weekly_summary", description: "Regenerate weekly AI summary", category: "agenda" },
  { name: "regenerate_monthly_summary", description: "Regenerate monthly AI summary", category: "agenda" },
  { name: "update_weekly_prompt", description: "Update weekly summary prompt", category: "agenda" },
  { name: "update_monthly_prompt", description: "Update monthly summary prompt", category: "agenda" },
  // Clients
  { name: "get_clients", description: "Get all clients", category: "clients" },
  { name: "get_client", description: "Get a single client's details", category: "clients" },
  { name: "get_projects_for_client", description: "Get projects for a client", category: "clients" },
  { name: "create_client", description: "Create a new client", category: "clients" },
  { name: "update_client", description: "Update a client's details", category: "clients" },
  { name: "delete_client", description: "Delete a client", category: "clients" },
  // Contacts
  { name: "get_people", description: "Get all contacts/people", category: "contacts" },
  { name: "get_person", description: "Get a person's details", category: "contacts" },
  { name: "search_people", description: "Search contacts by name", category: "contacts" },
  { name: "get_memos_for_person", description: "Get memos for a person", category: "contacts" },
  { name: "get_person_timeline", description: "Get interaction timeline", category: "contacts" },
  { name: "create_person", description: "Create a new contact", category: "contacts" },
  { name: "update_person", description: "Update a contact", category: "contacts" },
  { name: "link_memo_to_person", description: "Link a memo to a person", category: "contacts" },
  // Notes
  { name: "search_notes", description: "Search voice notes by content", category: "notes" },
  { name: "get_recent_notes", description: "Get recent voice notes", category: "notes" },
  { name: "create_quick_note", description: "Create a quick text note", category: "notes" },
  { name: "add_tags_to_note", description: "Add tags to a note", category: "notes" },
  // Voice
  { name: "get_voice_memo", description: "Get a voice memo with details", category: "voice" },
  { name: "get_voice_memos_by_date", description: "Get memos by date range", category: "voice" },
  { name: "get_voice_memos_by_labels", description: "Get memos by labels", category: "voice" },
  { name: "get_voice_memo_labels", description: "Get all memo labels", category: "voice" },
  // AI Summaries
  { name: "create_ai_convo_summary", description: "Save AI conversation summary", category: "ai_summaries" },
  { name: "get_ai_convo_summaries", description: "Get AI conversation summaries", category: "ai_summaries" },
  { name: "get_ai_convo_summary", description: "Get a single summary", category: "ai_summaries" },
  { name: "search_ai_convo_summaries", description: "Search AI summaries", category: "ai_summaries" },
  { name: "update_ai_convo_summary", description: "Update an AI summary", category: "ai_summaries" },
  { name: "delete_ai_convo_summary", description: "Delete an AI summary", category: "ai_summaries" },
  // Beeper
  { name: "get_beeper_threads", description: "List Beeper threads", category: "beeper" },
  { name: "get_beeper_thread", description: "Get a Beeper thread", category: "beeper" },
  { name: "get_beeper_thread_messages", description: "Get thread messages", category: "beeper" },
  { name: "search_beeper_messages", description: "Search Beeper messages", category: "beeper" },
  { name: "get_beeper_threads_for_person", description: "Get threads for a person", category: "beeper" },
  { name: "get_beeper_threads_for_client", description: "Get threads for a client", category: "beeper" },
  // Meetings
  { name: "get_granola_meetings", description: "List Granola meetings", category: "meetings" },
  { name: "get_granola_meeting", description: "Get a meeting", category: "meetings" },
  { name: "get_granola_transcript", description: "Get meeting transcript", category: "meetings" },
  { name: "search_granola_meetings", description: "Search meetings", category: "meetings" },
  { name: "get_granola_meetings_for_person", description: "Get meetings for a person", category: "meetings" },
  { name: "get_granola_meetings_for_thread", description: "Get meetings for a thread", category: "meetings" },
  { name: "get_contact_dossier", description: "Get full contact dossier", category: "meetings" },
  { name: "get_meeting_calendar_links", description: "Get calendar links", category: "meetings" },
  // CRM
  { name: "sync_beeper_contacts_to_frm", description: "Sync Beeper to FRM contacts", category: "crm" },
  { name: "link_beeper_thread_to_person", description: "Link thread to person", category: "crm" },
  { name: "get_business_contacts", description: "Get business contacts", category: "crm" },
  { name: "get_merge_suggestions", description: "Get merge suggestions", category: "crm" },
  { name: "accept_merge_suggestion", description: "Accept merge suggestion", category: "crm" },
  { name: "reject_merge_suggestion", description: "Reject merge suggestion", category: "crm" },
  { name: "dismiss_all_merge_suggestions", description: "Dismiss all merge suggestions", category: "crm" },
  { name: "unlink_meeting_from_business_contact", description: "Unlink meeting from contact", category: "crm" },
  // Initiatives
  { name: "get_initiatives", description: "Get yearly initiatives", category: "initiatives" },
  { name: "get_initiative", description: "Get initiative details", category: "initiatives" },
  { name: "get_initiative_with_stats", description: "Get initiative with stats", category: "initiatives" },
  { name: "create_initiative", description: "Create an initiative", category: "initiatives" },
  { name: "update_initiative", description: "Update an initiative", category: "initiatives" },
  { name: "archive_initiative", description: "Archive an initiative", category: "initiatives" },
  { name: "delete_initiative", description: "Delete an initiative", category: "initiatives" },
  { name: "link_project_to_initiative", description: "Link project to initiative", category: "initiatives" },
  { name: "link_issue_to_initiative", description: "Link issue to initiative", category: "initiatives" },
  { name: "get_initiative_yearly_rollup", description: "Get yearly rollup", category: "initiatives" },
];

// ==================== COMPONENT ====================

interface ToolPickerProps {
  selectedTools: string[];
  onChange: (tools: string[]) => void;
}

export function ToolPicker({ selectedTools, onChange }: ToolPickerProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(TOOL_CATEGORIES.map((c) => c.id))
  );

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const toggleTool = (toolName: string) => {
    if (selectedTools.includes(toolName)) {
      onChange(selectedTools.filter((t) => t !== toolName));
    } else {
      onChange([...selectedTools, toolName]);
    }
  };

  const selectAllInCategory = (categoryId: string) => {
    const categoryTools = TOOLS.filter((t) => t.category === categoryId).map(
      (t) => t.name
    );
    const allSelected = categoryTools.every((t) => selectedTools.includes(t));
    if (allSelected) {
      onChange(selectedTools.filter((t) => !categoryTools.includes(t)));
    } else {
      const newTools = new Set([...selectedTools, ...categoryTools]);
      onChange([...newTools]);
    }
  };

  const selectAll = () => {
    if (selectedTools.length === TOOLS.length) {
      onChange([]);
    } else {
      onChange(TOOLS.map((t) => t.name));
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <Badge variant="secondary">
          {selectedTools.length} / {TOOLS.length} tools
        </Badge>
        <Button variant="ghost" size="sm" onClick={selectAll}>
          {selectedTools.length === TOOLS.length ? "Deselect All" : "Select All"}
        </Button>
      </div>

      {TOOL_CATEGORIES.map((category) => {
        const CategoryIcon = category.icon;
        const categoryTools = TOOLS.filter((t) => t.category === category.id);
        const selectedCount = categoryTools.filter((t) =>
          selectedTools.includes(t.name)
        ).length;
        const isExpanded = expandedCategories.has(category.id);
        const allSelected = selectedCount === categoryTools.length;

        return (
          <div
            key={category.id}
            className="border rounded-md overflow-hidden"
          >
            <div
              className="flex items-center gap-2 px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted/80"
              onClick={() => toggleCategory(category.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <CategoryIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium flex-1">{category.name}</span>
              <Badge
                variant={selectedCount > 0 ? "default" : "outline"}
                className="text-xs"
              >
                {selectedCount}/{categoryTools.length}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  selectAllInCategory(category.id);
                }}
              >
                {allSelected ? "None" : "All"}
              </Button>
            </div>

            {isExpanded && (
              <div className="px-3 py-1.5 space-y-0.5">
                {categoryTools.map((tool) => (
                  <Tooltip key={tool.name}>
                    <TooltipTrigger asChild>
                      <label
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-muted/50 text-sm",
                          selectedTools.includes(tool.name) && "bg-primary/5"
                        )}
                      >
                        <Checkbox
                          checked={selectedTools.includes(tool.name)}
                          onCheckedChange={() => toggleTool(tool.name)}
                        />
                        <span className="truncate">{tool.name}</span>
                      </label>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      {tool.description}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
