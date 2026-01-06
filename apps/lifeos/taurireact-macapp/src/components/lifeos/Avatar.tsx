import { lazy, Suspense, useState } from "react";
import { AppShell } from "./AppShell";
import { AvatarProvider, type LifeCategory } from "@/lib/contexts/AvatarContext";
import { StatsOverlay, EditStatsDialog } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Settings2, Loader2 } from "lucide-react";

// Lazy load the 3D scene to improve initial load time
const AvatarScene = lazy(() =>
  import("@/components/avatar/AvatarScene").then((m) => ({ default: m.AvatarScene }))
);

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading 3D Avatar...</p>
      </div>
    </div>
  );
}

function AvatarContent() {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStat, setSelectedStat] = useState<LifeCategory | undefined>();

  const handleStatClick = (stat: LifeCategory) => {
    setSelectedStat(stat);
    setEditDialogOpen(true);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 3D Scene */}
      <Suspense fallback={<LoadingSpinner />}>
        <AvatarScene className="h-full w-full" />
      </Suspense>

      {/* Stats Overlay */}
      <StatsOverlay onStatClick={handleStatClick} />

      {/* Edit Button - Bottom Right */}
      <div className="absolute bottom-4 right-4 z-10">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => setEditDialogOpen(true)}
          className="shadow-lg"
        >
          <Settings2 className="h-5 w-5 mr-2" />
          Edit Stats
        </Button>
      </div>

      {/* Edit Dialog */}
      <EditStatsDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        initialStat={selectedStat}
      />
    </div>
  );
}

export function LifeOSAvatar() {
  return (
    <AppShell>
      <AvatarProvider>
        <AvatarContent />
      </AvatarProvider>
    </AppShell>
  );
}
