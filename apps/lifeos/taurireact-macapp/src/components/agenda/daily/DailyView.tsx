import { AISummarySection } from "./AISummarySection";
import { DailyFieldsSection } from "./DailyFieldsSection";
import { HabitsSection } from "./HabitsSection";
import { TasksSection } from "./TasksSection";
import { VoiceMemoRecorder } from "./VoiceMemoRecorder";
import { ScreenTimeSummary } from "./ScreenTimeSummary";

export function DailyView() {
  return (
    <div className="p-4 space-y-4 md:p-6 md:space-y-6">
      {/* AI Summary at top */}
      <AISummarySection />

      {/* Daily Fields section */}
      <DailyFieldsSection />

      {/* Two-column layout for habits and tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
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
