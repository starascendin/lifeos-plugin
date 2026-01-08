import { WeeklyAISummarySection } from "./WeeklyAISummarySection";
import { WeeklyCalendarSection } from "./WeeklyCalendarSection";
import { WeeklyRollupSection } from "./WeeklyRollupSection";
import { WeeklyTasksSection } from "./WeeklyTasksSection";
import { WeeklyMemosSection } from "./WeeklyMemosSection";

export function WeeklyView() {
  return (
    <div className="p-4 space-y-4 md:p-6 md:space-y-6">
      {/* AI Summary at top */}
      <WeeklyAISummarySection />

      {/* End Day Scores rollup */}
      <WeeklyRollupSection />

      {/* Calendar events grouped by day */}
      <WeeklyCalendarSection />

      {/* Tasks grouped by day */}
      <WeeklyTasksSection />

      {/* Voice memos */}
      <WeeklyMemosSection />
    </div>
  );
}
