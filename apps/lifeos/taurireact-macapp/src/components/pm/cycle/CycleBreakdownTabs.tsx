import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { PRIORITY_CONFIG, Priority } from "@/lib/contexts/PMContext";
import { cn } from "@/lib/utils";

interface BreakdownItem {
  count: number;
  percent: number;
}

interface PriorityBreakdown extends BreakdownItem {
  priority: string;
}

interface LabelBreakdown extends BreakdownItem {
  labelId: string;
  labelName: string;
  color: string;
}

interface ProjectBreakdown extends BreakdownItem {
  projectId: string;
  projectName: string;
  projectIcon?: string;
}

interface CycleBreakdownTabsProps {
  breakdowns: {
    byPriority: PriorityBreakdown[];
    byLabel: LabelBreakdown[];
    byProject: ProjectBreakdown[];
  };
}

export function CycleBreakdownTabs({ breakdowns }: CycleBreakdownTabsProps) {
  return (
    <Tabs defaultValue="priority" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="priority" className="text-xs">
          Priority
        </TabsTrigger>
        <TabsTrigger value="labels" className="text-xs">
          Labels
        </TabsTrigger>
        <TabsTrigger value="projects" className="text-xs">
          Projects
        </TabsTrigger>
      </TabsList>

      <TabsContent value="priority" className="mt-3 space-y-2">
        {breakdowns.byPriority.length === 0 ? (
          <EmptyState text="No issues with priority set" />
        ) : (
          breakdowns.byPriority.map((item) => {
            const config = PRIORITY_CONFIG[item.priority as Priority];
            return (
              <BreakdownRow
                key={item.priority}
                icon={
                  <span className={cn("text-sm", config?.color)}>
                    {config?.icon || "-"}
                  </span>
                }
                label={config?.label || item.priority}
                count={item.count}
                percent={item.percent}
              />
            );
          })
        )}
      </TabsContent>

      <TabsContent value="labels" className="mt-3 space-y-2">
        {breakdowns.byLabel.length === 0 ? (
          <EmptyState text="No labels assigned" />
        ) : (
          breakdowns.byLabel.map((item) => (
            <BreakdownRow
              key={item.labelId}
              icon={
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              }
              label={item.labelName}
              count={item.count}
              percent={item.percent}
            />
          ))
        )}
      </TabsContent>

      <TabsContent value="projects" className="mt-3 space-y-2">
        {breakdowns.byProject.length === 0 ? (
          <EmptyState text="No project assigned" />
        ) : (
          breakdowns.byProject.map((item) => (
            <BreakdownRow
              key={item.projectId}
              icon={
                item.projectIcon ? (
                  <span className="text-sm">{item.projectIcon}</span>
                ) : (
                  <div className="h-2.5 w-2.5 rounded bg-muted-foreground" />
                )
              }
              label={item.projectName}
              count={item.count}
              percent={item.percent}
            />
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}

function BreakdownRow({
  icon,
  label,
  count,
  percent,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  percent: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{count}</span>
          <span>({percent}%)</span>
        </div>
      </div>
      <Progress value={percent} className="h-1" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-4 text-center text-sm text-muted-foreground">{text}</div>
  );
}
