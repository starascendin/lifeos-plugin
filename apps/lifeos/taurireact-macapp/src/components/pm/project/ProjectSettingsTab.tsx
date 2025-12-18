import type { Doc, Id } from "@holaai/convex";
import { CycleSettingsCard } from "./CycleSettingsCard";
import { usePM, CycleSettings } from "@/lib/contexts/PMContext";

interface ProjectSettingsTabProps {
  project: Doc<"lifeos_pmProjects">;
}

export function ProjectSettingsTab({ project }: ProjectSettingsTabProps) {
  const { updateProject, generateCycles } = usePM();

  const handleUpdateCycleSettings = async (settings: CycleSettings) => {
    await updateProject({
      projectId: project._id,
      cycleSettings: settings,
    });
  };

  const handleGenerateCycles = async (count: number) => {
    await generateCycles({
      projectId: project._id,
      count,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Project Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure settings for this project
        </p>
      </div>

      <div className="max-w-md">
        <CycleSettingsCard
          settings={project.cycleSettings as CycleSettings | undefined}
          onChange={handleUpdateCycleSettings}
          onGenerateCycles={handleGenerateCycles}
        />
      </div>
    </div>
  );
}
