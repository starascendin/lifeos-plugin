import { WeeklyAISummarySection } from "./WeeklyAISummarySection";
import { WeeklyCalendarSection } from "./WeeklyCalendarSection";
import { WeeklyHabitsSection } from "./WeeklyHabitsSection";
import { WeeklyNoteSection } from "./WeeklyNoteSection";
import { WeeklyNotesSection } from "./WeeklyNotesSection";
import { WeeklyRollupSection } from "./WeeklyRollupSection";
import { WeeklyTasksSection } from "./WeeklyTasksSection";
import { WeeklyMemosSection } from "./WeeklyMemosSection";

export function WeeklyView() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Main + Sidebar */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 md:p-6">
        {/* Left column - main content */}
        <div className="flex-1 min-w-0 space-y-4">
          <WeeklyAISummarySection />
          <WeeklyNoteSection />
          <WeeklyHabitsSection />
          <WeeklyTasksSection />
        </div>

        {/* Right column - sidebar widgets */}
        <div className="w-full lg:w-72 xl:w-80 space-y-4">
          <WeeklyRollupSection />
          <WeeklyNotesSection />
          <WeeklyCalendarSection />
          <WeeklyMemosSection />
        </div>
      </div>
    </div>
  );
}
