import { AISummarySection } from "./AISummarySection";
import { HabitsSection } from "./HabitsSection";
import { TasksSection } from "./TasksSection";
import { VoiceMemoRecorder } from "./VoiceMemoRecorder";
import { ScreenTimeSummary } from "./ScreenTimeSummary";

export function DailyView() {
  return (
    <div className="p-6 space-y-6">
      {/* AI Summary at top */}
      <AISummarySection />

      {/* Two-column layout for habits and tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HabitsSection />
        <TasksSection />
      </div>

      {/* Voice memo recording */}
      <VoiceMemoRecorder />

      {/* Screen time summary */}
      <ScreenTimeSummary />
    </div>
  );
}
