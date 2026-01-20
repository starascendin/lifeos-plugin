import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import type { Id } from "@holaai/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownEditor } from "@/components/shared/MarkdownEditor";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  FileText,
  AlertCircle,
  Layers,
  Edit2,
  Check,
  X,
  Building2,
} from "lucide-react";

interface ProjectViewProps {
  projectId: Id<"lifeos_pmProjects">;
  onBack: () => void;
}

export function ProjectView({ projectId, onBack }: ProjectViewProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const project = useQuery(api.lifeos.pm_projects.getProject, { projectId });
  const client = useQuery(
    api.lifeos.pm_clients.getClient,
    project?.clientId ? { clientId: project.clientId } : "skip"
  );
  const phases = useQuery(api.lifeos.pm_phases.getPhases, { projectId });
  const notes = useQuery(api.lifeos.pm_notes.getNotes, { projectId });
  const issues = useQuery(api.lifeos.pm_issues.getIssues, { projectId });

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{project.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{project.key}</span>
              {client && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {client.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="phases">
            Phases ({phases?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="issues">
            Issues ({issues?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="notes">
            Notes ({notes?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="overview" className="h-full m-0 p-4">
            <ProjectOverview projectId={projectId} />
          </TabsContent>
          <TabsContent value="phases" className="h-full m-0 p-4">
            <PhasesTab projectId={projectId} />
          </TabsContent>
          <TabsContent value="issues" className="h-full m-0 p-4">
            <IssuesTab projectId={projectId} />
          </TabsContent>
          <TabsContent value="notes" className="h-full m-0 p-4">
            <NotesTab projectId={projectId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function ProjectOverview({ projectId }: { projectId: Id<"lifeos_pmProjects"> }) {
  const [isEditing, setIsEditing] = useState(false);
  const project = useQuery(api.lifeos.pm_projects.getProject, { projectId });
  const client = useQuery(
    api.lifeos.pm_clients.getClient,
    project?.clientId ? { clientId: project.clientId } : "skip"
  );
  const updateProject = useMutation(api.lifeos.pm_projects.updateProject);
  const [description, setDescription] = useState("");

  if (!project) return null;

  const handleSave = async () => {
    await updateProject({
      projectId,
      description: description || undefined,
    });
    setIsEditing(false);
  };

  const startEditing = () => {
    setDescription(project.description ?? "");
    setIsEditing(true);
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 max-w-3xl">
        {/* Client Info Section */}
        {client && (
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-muted-foreground">Client</h2>
            </div>
            <h3 className="text-lg font-medium">{client.name}</h3>
            {client.description && (
              <div className="mt-2 text-sm text-muted-foreground">
                <MarkdownRenderer content={client.description} />
              </div>
            )}
          </div>
        )}

        {/* Project Status Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <ProjectStatusBadge status={project.status} />
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Health</p>
            <HealthBadge health={project.health} />
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Priority</p>
            <PriorityBadge priority={project.priority} />
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Progress</p>
            <p className="text-sm font-medium">
              {project.completedIssueCount}/{project.issueCount} issues
            </p>
          </div>
        </div>

        {/* Project Description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-medium">Description</h2>
            {!isEditing && (
              <Button variant="ghost" size="sm" onClick={startEditing}>
                <Edit2 className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <MarkdownEditor
                value={description}
                onChange={setDescription}
                placeholder="Add a description... (supports markdown: **bold**, - [ ] checkboxes, etc.)"
                minHeight="150px"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>
                  <Check className="h-4 w-4 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : project.description ? (
            <MarkdownRenderer content={project.description} />
          ) : (
            <p className="text-muted-foreground text-sm italic">
              No description. Click Edit to add one.
            </p>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function PhasesTab({ projectId }: { projectId: Id<"lifeos_pmProjects"> }) {
  const [showNewPhaseDialog, setShowNewPhaseDialog] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [editingPhaseId, setEditingPhaseId] = useState<Id<"lifeos_pmPhases"> | null>(null);
  const [editingDescription, setEditingDescription] = useState("");

  const phases = useQuery(api.lifeos.pm_phases.getPhases, { projectId });
  const createPhase = useMutation(api.lifeos.pm_phases.createPhase);
  const updatePhase = useMutation(api.lifeos.pm_phases.updatePhase);

  const handleCreatePhase = async () => {
    if (!newPhaseName.trim()) return;
    await createPhase({ projectId, name: newPhaseName.trim() });
    setNewPhaseName("");
    setShowNewPhaseDialog(false);
  };

  const startEditingPhase = (phaseId: Id<"lifeos_pmPhases">, description: string | undefined) => {
    setEditingPhaseId(phaseId);
    setEditingDescription(description ?? "");
  };

  const savePhaseDescription = async () => {
    if (!editingPhaseId) return;
    await updatePhase({
      phaseId: editingPhaseId,
      description: editingDescription || null,
    });
    setEditingPhaseId(null);
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Project Phases</h2>
          <Button size="sm" onClick={() => setShowNewPhaseDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Phase
          </Button>
        </div>

        {phases?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No phases yet</p>
            <p className="text-sm">Add phases to track project progress</p>
          </div>
        ) : (
          <div className="space-y-3">
            {phases?.map((phase) => (
              <div
                key={phase._id}
                className="border border-border rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{phase.name}</h3>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={phase.status} />
                    {editingPhaseId !== phase._id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditingPhase(phase._id, phase.description)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {editingPhaseId === phase._id ? (
                  <div className="space-y-2">
                    <MarkdownEditor
                      value={editingDescription}
                      onChange={setEditingDescription}
                      placeholder="Phase description..."
                      minHeight="150px"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={savePhaseDescription}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingPhaseId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : phase.description ? (
                  <MarkdownRenderer content={phase.description} />
                ) : (
                  <p className="text-muted-foreground text-sm italic">
                    No description
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <Dialog open={showNewPhaseDialog} onOpenChange={setShowNewPhaseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Phase</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Phase name"
                value={newPhaseName}
                onChange={(e) => setNewPhaseName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreatePhase()}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewPhaseDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePhase} disabled={!newPhaseName.trim()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}

function IssuesTab({ projectId }: { projectId: Id<"lifeos_pmProjects"> }) {
  const [showNewIssueDialog, setShowNewIssueDialog] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");

  const issues = useQuery(api.lifeos.pm_issues.getIssues, { projectId });
  const createIssue = useMutation(api.lifeos.pm_issues.createIssue);
  const updateIssueStatus = useMutation(api.lifeos.pm_issues.updateIssueStatus);

  const handleCreateIssue = async () => {
    if (!newIssueTitle.trim()) return;
    await createIssue({ projectId, title: newIssueTitle.trim() });
    setNewIssueTitle("");
    setShowNewIssueDialog(false);
  };

  const toggleIssueStatus = async (issueId: Id<"lifeos_pmIssues">, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "todo" : "done";
    await updateIssueStatus({ issueId, status: newStatus as any });
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Issues</h2>
          <Button size="sm" onClick={() => setShowNewIssueDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Issue
          </Button>
        </div>

        {issues?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No issues yet</p>
            <p className="text-sm">Track bugs and tasks here</p>
          </div>
        ) : (
          <div className="space-y-1">
            {issues?.map((issue) => (
              <div
                key={issue._id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border border-border",
                  issue.status === "done" && "opacity-60"
                )}
              >
                <button
                  onClick={() => toggleIssueStatus(issue._id, issue.status)}
                  className={cn(
                    "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
                    issue.status === "done"
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground hover:border-primary"
                  )}
                >
                  {issue.status === "done" && <Check className="h-3 w-3" />}
                </button>
                <span className="text-sm text-muted-foreground font-mono">
                  {issue.identifier}
                </span>
                <span
                  className={cn(
                    "flex-1",
                    issue.status === "done" && "line-through"
                  )}
                >
                  {issue.title}
                </span>
                <PriorityBadge priority={issue.priority} />
              </div>
            ))}
          </div>
        )}

        <Dialog open={showNewIssueDialog} onOpenChange={setShowNewIssueDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Issue</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Issue title"
                value={newIssueTitle}
                onChange={(e) => setNewIssueTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateIssue()}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewIssueDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateIssue} disabled={!newIssueTitle.trim()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}

function NotesTab({ projectId }: { projectId: Id<"lifeos_pmProjects"> }) {
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<Id<"lifeos_pmNotes"> | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const notes = useQuery(api.lifeos.pm_notes.getNotes, { projectId });
  const selectedNote = useQuery(
    api.lifeos.pm_notes.getNote,
    selectedNoteId ? { noteId: selectedNoteId } : "skip"
  );
  const createNote = useMutation(api.lifeos.pm_notes.createNote);
  const updateNote = useMutation(api.lifeos.pm_notes.updateNote);

  const handleCreateNote = async () => {
    if (!newNoteTitle.trim()) return;
    const noteId = await createNote({
      projectId,
      title: newNoteTitle.trim(),
      content: newNoteContent,
    });
    setNewNoteTitle("");
    setNewNoteContent("");
    setShowNewNoteDialog(false);
    setSelectedNoteId(noteId);
  };

  const startEditing = () => {
    if (selectedNote) {
      setEditingContent(selectedNote.content);
      setIsEditing(true);
    }
  };

  const saveNote = async () => {
    if (!selectedNoteId) return;
    await updateNote({
      noteId: selectedNoteId,
      content: editingContent,
    });
    setIsEditing(false);
  };

  return (
    <div className="h-full flex gap-4">
      {/* Notes list */}
      <div className="w-56 border-r border-border pr-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">Notes</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowNewNoteDialog(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {notes?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet</p>
        ) : (
          <div className="space-y-1">
            {notes?.map((note) => (
              <button
                key={note._id}
                onClick={() => {
                  setSelectedNoteId(note._id);
                  setIsEditing(false);
                }}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded text-sm",
                  "hover:bg-muted transition-colors",
                  selectedNoteId === note._id && "bg-muted"
                )}
              >
                <FileText className="h-3.5 w-3.5 inline-block mr-1.5 text-muted-foreground" />
                {note.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Note content */}
      <div className="flex-1">
        {selectedNote ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">{selectedNote.title}</h2>
              {!isEditing && (
                <Button variant="ghost" size="sm" onClick={startEditing}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <MarkdownEditor
                    value={editingContent}
                    onChange={setEditingContent}
                    placeholder="Write your notes... (supports markdown)"
                    minHeight="300px"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveNote}>
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : selectedNote.content ? (
                <MarkdownRenderer content={selectedNote.content} />
              ) : (
                <p className="text-muted-foreground italic">
                  Empty note. Click Edit to add content.
                </p>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Select a note or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* New Note Dialog */}
      <Dialog open={showNewNoteDialog} onOpenChange={setShowNewNoteDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Note</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Input
              placeholder="Note title"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              autoFocus
            />
            <MarkdownEditor
              value={newNoteContent}
              onChange={setNewNoteContent}
              placeholder="Note content... (supports markdown)"
              minHeight="200px"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewNoteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNote} disabled={!newNoteTitle.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    not_started: "bg-gray-500/20 text-gray-600",
    in_progress: "bg-blue-500/20 text-blue-600",
    completed: "bg-green-500/20 text-green-600",
  };

  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-xs font-medium",
        colors[status] ?? "bg-gray-500/20 text-gray-600"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    none: "bg-gray-500/20 text-gray-600",
    low: "bg-gray-500/20 text-gray-600",
    medium: "bg-yellow-500/20 text-yellow-600",
    high: "bg-orange-500/20 text-orange-600",
    urgent: "bg-red-500/20 text-red-600",
  };

  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-xs font-medium",
        colors[priority] ?? "bg-gray-500/20 text-gray-600"
      )}
    >
      {priority}
    </span>
  );
}

function ProjectStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    planned: "bg-gray-500/20 text-gray-600",
    in_progress: "bg-blue-500/20 text-blue-600",
    paused: "bg-yellow-500/20 text-yellow-600",
    completed: "bg-green-500/20 text-green-600",
    cancelled: "bg-red-500/20 text-red-600",
  };

  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-xs font-medium",
        colors[status] ?? "bg-gray-500/20 text-gray-600"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function HealthBadge({ health }: { health: string }) {
  const colors: Record<string, string> = {
    on_track: "bg-green-500/20 text-green-600",
    at_risk: "bg-yellow-500/20 text-yellow-600",
    off_track: "bg-red-500/20 text-red-600",
  };

  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-xs font-medium",
        colors[health] ?? "bg-gray-500/20 text-gray-600"
      )}
    >
      {health.replace("_", " ")}
    </span>
  );
}
