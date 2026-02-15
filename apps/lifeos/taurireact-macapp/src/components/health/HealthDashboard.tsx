import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { Moon, Activity, Zap, Heart, Wind, Footprints, Flame, Dumbbell, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

// ==================== HELPERS ====================

function formatDuration(seconds: number | undefined | null): string {
  if (!seconds) return "–";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getWeekRange(dateStr: string): { start: string; end: string; label: string } {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  const label = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  return { start: fmt(monday), end: fmt(sunday), label };
}

function scoreColor(score: number | undefined): string {
  if (!score) return "text-muted-foreground";
  if (score >= 85) return "text-green-500";
  if (score >= 70) return "text-yellow-500";
  return "text-red-500";
}

function scoreBadge(score: number | undefined) {
  if (score === undefined) return null;
  const variant = score >= 85 ? "default" : score >= 70 ? "secondary" : "destructive";
  const label = score >= 85 ? "Optimal" : score >= 70 ? "Good" : "Attention";
  return <Badge variant={variant} className="text-[10px] px-1.5 py-0">{label}</Badge>;
}

// ==================== SCORE RING ====================

function ScoreRing({ score, label, icon: Icon, color }: {
  score: number | undefined;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const s = score ?? 0;
  const pct = Math.min(s, 100);
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/20" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base sm:text-lg font-bold">{score ?? "–"}</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        {scoreBadge(score)}
      </div>
    </div>
  );
}

// ==================== DAY VIEW ====================

function DayView({ selectedDate, onDateChange }: { selectedDate: string; onDateChange: (d: string) => void }) {
  const sleep = useQuery(api.lifeos.oura.getDailySleep, { days: 30 });
  const activity = useQuery(api.lifeos.oura.getDailyActivity, { days: 30 });
  const readiness = useQuery(api.lifeos.oura.getDailyReadiness, { days: 30 });
  const heartRate = useQuery(api.lifeos.oura.getHeartRate, { days: 30 });
  const spo2 = useQuery(api.lifeos.oura.getDailySpo2, { days: 30 });
  const stress = useQuery(api.lifeos.oura.getDailyStress, { days: 30 });

  const daySleep = sleep?.find((s) => s.date === selectedDate);
  const dayActivity = activity?.find((a) => a.date === selectedDate);
  const dayReadiness = readiness?.find((r) => r.date === selectedDate);
  const dayHR = heartRate?.find((h) => h.date === selectedDate);
  const daySpo2 = spo2?.find((s) => s.date === selectedDate);
  const dayStress = stress?.find((s) => s.date === selectedDate);

  const navigateDay = (offset: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + offset);
    onDateChange(d.toISOString().slice(0, 10));
  };

  const hasAnyData = daySleep || dayActivity || dayReadiness || dayHR || daySpo2 || dayStress;

  return (
    <div className="space-y-3">
      {/* Date Navigator */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDay(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium text-sm sm:text-base min-w-[160px] text-center">{formatDateShort(selectedDate)}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDay(1)}
          disabled={selectedDate >= new Date().toISOString().slice(0, 10)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {!hasAnyData && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No data for this date. Try syncing or pick a different date.
          </CardContent>
        </Card>
      )}

      {hasAnyData && (
        <>
          {/* Scores + Quick Stats */}
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="grid grid-cols-3 place-items-center gap-2">
                <ScoreRing score={daySleep?.score ?? undefined} label="Sleep" icon={Moon} color="#8b5cf6" />
                <ScoreRing score={dayActivity?.score ?? undefined} label="Activity" icon={Activity} color="#22c55e" />
                <ScoreRing score={dayReadiness?.score ?? undefined} label="Readiness" icon={Zap} color="#f59e0b" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 mt-3 pt-3 border-t border-border">
                <MiniStat icon={<Heart className="h-3.5 w-3.5 text-red-500" />} label="Resting HR"
                  value={`${daySleep?.restingHeartRate ?? dayHR?.avgBpm ?? "–"}`} unit="bpm" />
                <MiniStat icon={<Activity className="h-3.5 w-3.5 text-violet-500" />} label="HRV"
                  value={`${daySleep?.hrv ?? "–"}`} unit="ms" />
                <MiniStat icon={<Wind className="h-3.5 w-3.5 text-blue-500" />} label="SpO2"
                  value={`${daySpo2?.spo2Average ?? "–"}`} unit="%" />
                <MiniStat icon={<Zap className="h-3.5 w-3.5 text-amber-500" />} label="Stress"
                  value={dayStress?.stressHigh != null ? `${dayStress.stressHigh}` : "–"} unit="high" />
              </div>
            </CardContent>
          </Card>

          {/* Details Grid */}
          <div className="grid gap-3 md:grid-cols-2">
            {daySleep && (
              <Card>
                <CardHeader className="px-3 sm:px-6 pb-1.5 pt-3 sm:pt-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Moon className="h-4 w-4 text-violet-500" /> Sleep
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pt-0 pb-3 sm:pb-4">
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-sm">
                    <Stat label="Total" value={formatDuration(daySleep.totalSleepDuration)} />
                    <Stat label="Deep" value={formatDuration(daySleep.deepSleepDuration)} />
                    <Stat label="REM" value={formatDuration(daySleep.remSleepDuration)} />
                    <Stat label="Light" value={formatDuration(daySleep.lightSleepDuration)} />
                    <Stat label="Efficiency" value={daySleep.efficiency ? `${daySleep.efficiency}%` : "–"} />
                    <Stat label="Latency" value={daySleep.latency ? `${Math.round(daySleep.latency / 60)}m` : "–"} />
                  </div>
                </CardContent>
              </Card>
            )}

            {dayActivity && (
              <Card>
                <CardHeader className="px-3 sm:px-6 pb-1.5 pt-3 sm:pt-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-500" /> Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pt-0 pb-3 sm:pb-4">
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-sm">
                    <Stat label="Steps" value={dayActivity.steps?.toLocaleString() ?? "–"} icon={<Footprints className="h-3 w-3" />} />
                    <Stat label="Active Cal" value={dayActivity.activeCalories?.toLocaleString() ?? "–"} icon={<Flame className="h-3 w-3" />} />
                    <Stat label="Total Cal" value={dayActivity.totalCalories?.toLocaleString() ?? "–"} />
                    <Stat label="High Activity" value={formatDuration(dayActivity.highActivityTime)} />
                    <Stat label="Distance" value={dayActivity.equivalentWalkingDistance ? `${(dayActivity.equivalentWalkingDistance / 1000).toFixed(1)} km` : "–"} />
                    <Stat label="Sedentary" value={formatDuration(dayActivity.sedentaryTime)} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ==================== WEEK VIEW ====================

function WeekView() {
  const sleep = useQuery(api.lifeos.oura.getDailySleep, { days: 30 });
  const activity = useQuery(api.lifeos.oura.getDailyActivity, { days: 30 });
  const readiness = useQuery(api.lifeos.oura.getDailyReadiness, { days: 30 });
  const workouts = useQuery(api.lifeos.oura.getWorkouts, { days: 30 });

  const weekData = useMemo(() => {
    if (!sleep && !activity && !readiness) return [];

    const allDates = new Set<string>();
    sleep?.forEach((s) => allDates.add(s.date));
    activity?.forEach((a) => allDates.add(a.date));
    readiness?.forEach((r) => allDates.add(r.date));

    const dailyMap = new Map<string, {
      date: string; sleepScore?: number; activityScore?: number; readinessScore?: number;
      steps?: number; totalSleep?: number; hrv?: number;
    }>();

    for (const date of allDates) dailyMap.set(date, { date });
    sleep?.forEach((s) => {
      const e = dailyMap.get(s.date)!;
      e.sleepScore = s.score ?? undefined;
      e.totalSleep = s.totalSleepDuration ?? undefined;
      e.hrv = s.hrv ?? undefined;
    });
    activity?.forEach((a) => {
      const e = dailyMap.get(a.date)!;
      e.activityScore = a.score ?? undefined;
      e.steps = a.steps ?? undefined;
    });
    readiness?.forEach((r) => {
      const e = dailyMap.get(r.date)!;
      e.readinessScore = r.score ?? undefined;
    });

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [sleep, activity, readiness]);

  const weeks = useMemo(() => {
    const weekMap = new Map<string, typeof weekData>();
    for (const day of weekData) {
      const { start } = getWeekRange(day.date);
      if (!weekMap.has(start)) weekMap.set(start, []);
      weekMap.get(start)!.push(day);
    }
    return Array.from(weekMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([weekStart, days]) => {
        const { label } = getWeekRange(weekStart);
        const avg = (arr: (number | undefined)[]) => {
          const nums = arr.filter((n): n is number => n !== undefined);
          return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : undefined;
        };
        const sum = (arr: (number | undefined)[]) => {
          const nums = arr.filter((n): n is number => n !== undefined);
          return nums.length ? nums.reduce((a, b) => a + b, 0) : undefined;
        };
        return {
          weekStart, label,
          days: days.length,
          avgSleep: avg(days.map((d) => d.sleepScore)),
          avgActivity: avg(days.map((d) => d.activityScore)),
          avgReadiness: avg(days.map((d) => d.readinessScore)),
          avgSteps: avg(days.map((d) => d.steps)),
          totalSteps: sum(days.map((d) => d.steps)),
          avgHRV: avg(days.map((d) => d.hrv)),
          avgTotalSleep: avg(days.map((d) => d.totalSleep)),
        };
      });
  }, [weekData]);

  if (weekData.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No data yet. Sync your Oura Ring data to see weekly trends.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Trend Chart */}
      {weekData.length > 1 && (
        <Card>
          <CardHeader className="px-3 sm:px-6 pb-1 pt-3 sm:pt-4">
            <CardTitle className="text-sm">Score Trends</CardTitle>
          </CardHeader>
          <CardContent className="px-1 sm:px-4 pb-3">
            <div className="h-48 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weekData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} width={40} />
                  <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 11, padding: "4px 8px" }} />
                  <Line type="monotone" dataKey="sleepScore" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Sleep" connectNulls />
                  <Line type="monotone" dataKey="activityScore" stroke="#22c55e" strokeWidth={2} dot={false} name="Activity" connectNulls />
                  <Line type="monotone" dataKey="readinessScore" stroke="#f59e0b" strokeWidth={2} dot={false} name="Readiness" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Steps Chart */}
      {weekData.some((d) => d.steps) && (
        <Card>
          <CardHeader className="px-3 sm:px-6 pb-1 pt-3 sm:pt-4">
            <CardTitle className="text-sm">Daily Steps</CardTitle>
          </CardHeader>
          <CardContent className="px-1 sm:px-4 pb-3">
            <div className="h-36 sm:h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} width={40} />
                  <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 11, padding: "4px 8px" }} />
                  <Bar dataKey="steps" fill="#22c55e" radius={[4, 4, 0, 0]} name="Steps" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Summaries */}
      <Card>
        <CardHeader className="px-3 sm:px-6 pb-1 pt-3 sm:pt-4">
          <CardTitle className="text-sm">Weekly Averages</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 space-y-0 divide-y divide-border">
          {weeks.map((week) => (
            <div key={week.weekStart} className="py-2.5 first:pt-0 last:pb-0">
              <p className="text-xs text-muted-foreground mb-1.5">{week.label} ({week.days}d)</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-x-3 gap-y-1.5 text-sm">
                <WeekStat value={week.avgSleep} label="sleep" colorize />
                <WeekStat value={week.avgActivity} label="activity" colorize />
                <WeekStat value={week.avgReadiness} label="readiness" colorize />
                <WeekStat value={week.avgSteps?.toLocaleString()} label="steps/d" />
                <WeekStat value={formatDuration(week.avgTotalSleep)} label="sleep" raw />
                <WeekStat value={week.avgHRV} label="HRV" />
                <WeekStat value={week.totalSteps?.toLocaleString()} label="total" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Workouts */}
      {workouts && workouts.length > 0 && (
        <Card>
          <CardHeader className="px-3 sm:px-6 pb-1 pt-3 sm:pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Dumbbell className="h-4 w-4" /> Recent Workouts
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3">
            <div className="space-y-0 divide-y divide-border">
              {workouts.slice(0, 8).map((w) => (
                <div key={w._id} className="py-2 first:pt-0 last:pb-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                  <span className="font-medium capitalize">{w.activity.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">{formatDateShort(w.date)}</span>
                  <span className="ml-auto text-xs text-muted-foreground flex gap-2">
                    {w.duration && <span>{formatDuration(w.duration)}</span>}
                    {w.calories && <span>{w.calories} cal</span>}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== SMALL COMPONENTS ====================

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground flex items-center gap-1 text-xs truncate">
        {icon}{label}
      </span>
      <p className="font-medium text-sm truncate">{value}</p>
    </div>
  );
}

function MiniStat({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground leading-tight truncate">{label}</p>
        <p className="text-sm font-semibold truncate">{value} <span className="text-[10px] font-normal text-muted-foreground">{unit}</span></p>
      </div>
    </div>
  );
}

function WeekStat({ value, label, colorize, raw }: {
  value: number | string | undefined;
  label: string;
  colorize?: boolean;
  raw?: boolean;
}) {
  const display = raw ? (value as string) : (value ?? "–");
  const color = colorize && typeof value === "number" ? scoreColor(value) : "";
  return (
    <div className="min-w-0 truncate">
      <span className={`font-semibold text-sm ${color}`}>{display}</span>
      <span className="text-[10px] text-muted-foreground ml-1">{label}</span>
    </div>
  );
}

// ==================== MAIN EXPORT ====================

export function HealthDashboard() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <Tabs defaultValue="day" className="space-y-3">
      <TabsList>
        <TabsTrigger value="day">Day</TabsTrigger>
        <TabsTrigger value="week">Week</TabsTrigger>
      </TabsList>

      <TabsContent value="day">
        <DayView selectedDate={selectedDate} onDateChange={setSelectedDate} />
      </TabsContent>

      <TabsContent value="week">
        <WeekView />
      </TabsContent>
    </Tabs>
  );
}
