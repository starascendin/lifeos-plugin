---
name: health-weekly
description: Weekly health review with sleep, activity, readiness trends, workouts, and recovery insights
---

Run a weekly health review. Use the LifeOS MCP tools:

1. Call get_health_sleep with days=14 for sleep data
2. Call get_health_activity with days=14 for activity data
3. Call get_health_readiness with days=14 for readiness data
4. Call get_health_stress with days=14 for stress/recovery data
5. Call get_health_workouts with days=14 for workout history
6. Call get_health_heart_rate with days=14 for HR trends

Present a detailed weekly health review:
- **Sleep Quality**: Weekly average scores, best/worst nights, sleep duration trends, deep/REM balance
- **Activity Patterns**: Weekly step averages, active days vs rest days, calorie burn
- **Readiness & Recovery**: Score trends, stress vs recovery balance
- **Workouts**: List workouts with type, duration, calories burned
- **Heart Rate**: Resting HR trend, HRV trend (if available)
- **Week-over-Week**: Compare this week vs last week
- **Recommendations**: 3-5 specific, actionable health recommendations

Group data by week for easy comparison.

If $ARGUMENTS contains a number, use that as the number of weeks to review instead of 2.
