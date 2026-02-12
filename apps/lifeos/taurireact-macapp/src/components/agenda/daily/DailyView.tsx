import { AISummarySection } from "./AISummarySection";
import { CalendarEventsSection } from "./CalendarEventsSection";
import { DailyFieldsSection } from "./DailyFieldsSection";
import { DailyNoteSection } from "./DailyNoteSection";
import { HabitsSection } from "./HabitsSection";
import { TasksSection } from "./TasksSection";
import { VoiceMemoRecorder } from "./VoiceMemoRecorder";
import { ScreenTimeSummary } from "./ScreenTimeSummary";
import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card } from "@/components/ui/card";

export function DailyView() {
  const { dateString } = useAgenda();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Main + Sidebar */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 md:p-6">
        {/* Center column - cards */}
        <div className="flex-1 min-w-0 space-y-4">
          <Card>
            <DailyNoteSection />
          </Card>
          <Card>
            <AISummarySection />
          </Card>
          <Card>
            <CalendarEventsSection />
          </Card>
          <Card>
            <TasksSection />
          </Card>
          <Card>
            <HabitsSection />
          </Card>
        </div>

        {/* Right panel - compact, no cards */}
        <div className="w-full lg:w-72 xl:w-80 space-y-4">
          <DailyFieldsSection />
          <VoiceMemoRecorder date={dateString} />
          <ScreenTimeSummary />
        </div>
      </div>
    </div>
  );
}
