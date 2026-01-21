import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import type { Doc, Id } from "@holaai/convex";
import { Plus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhaseCard } from "./PhaseCard";
import { CreatePhaseDialog } from "../CreatePhaseDialog";

interface PhasesSectionProps {
  projectId: Id<"lifeos_pmProjects">;
  issues: Doc<"lifeos_pmIssues">[] | undefined;
  onAddIssueToPhase?: (phaseId: Id<"lifeos_pmPhases">) => void;
}

export function PhasesSection({ projectId, issues, onAddIssueToPhase }: PhasesSectionProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const phases = useQuery(api.lifeos.pm_phases.getPhases, { projectId });

  // Group issues by phase
  const issuesByPhase = new Map<Id<"lifeos_pmPhases">, Doc<"lifeos_pmIssues">[]>();
  if (issues) {
    for (const issue of issues) {
      if (issue.phaseId) {
        const phaseIssues = issuesByPhase.get(issue.phaseId) ?? [];
        phaseIssues.push(issue);
        issuesByPhase.set(issue.phaseId, phaseIssues);
      }
    }
  }

  // Sort issues within each phase by status and priority
  const sortIssues = (phaseIssues: Doc<"lifeos_pmIssues">[]) => {
    const statusOrder = {
      in_progress: 0,
      in_review: 1,
      todo: 2,
      backlog: 3,
      done: 4,
      cancelled: 5,
    };
    const priorityOrder = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
      none: 4,
    };

    return [...phaseIssues].sort((a, b) => {
      const statusDiff =
        (statusOrder[a.status as keyof typeof statusOrder] ?? 99) -
        (statusOrder[b.status as keyof typeof statusOrder] ?? 99);
      if (statusDiff !== 0) return statusDiff;

      const priorityDiff =
        (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 99) -
        (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 99);
      return priorityDiff;
    });
  };

  if (phases === undefined) {
    return null; // Loading
  }

  if (phases.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Phases
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Phase
          </Button>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          No phases yet. Create phases to organize your project work into distinct stages.
        </p>
        <CreatePhaseDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          projectId={projectId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          Phases
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Phase
        </Button>
      </div>

      <div className="space-y-3">
        {phases.map((phase) => (
          <PhaseCard
            key={phase._id}
            phase={phase}
            issues={sortIssues(issuesByPhase.get(phase._id) ?? [])}
            onAddIssue={onAddIssueToPhase}
          />
        ))}
      </div>

      <CreatePhaseDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        projectId={projectId}
      />
    </div>
  );
}
