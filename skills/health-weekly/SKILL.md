---
name: health-weekly
description: Weekly health review with sleep, activity, readiness trends, workouts, and recovery insights
---

Run a weekly health review. Use the LifeOS MCP tools:

1. Call get_health_sleep with days=14 for sleep data (scores, durations, bedtime, breath rate, restless periods)
2. Call get_health_activity with days=14 for activity data
3. Call get_health_readiness with days=14 for readiness data
4. Call get_health_stress with days=14 for stress/recovery data
5. Call get_health_workouts with days=14 for workout history (prefer label over activity for display name)
6. Call get_health_heart_rate with days=14 for HR trends
7. Call get_health_resilience with days=14 for resilience levels and contributors
8. Call get_health_vo2_max with days=14 for VO2 max estimates
9. Call get_health_cardio_age with days=14 for cardiovascular age
10. Call get_health_spo2 with days=14 for SpO2 and breathing disturbance index

Present a detailed weekly health review:
- **Sleep Quality**: Weekly average scores, best/worst nights, sleep duration trends, deep/REM balance, bedtime consistency, avg breath rate
- **Activity Patterns**: Weekly step averages, active days vs rest days, calorie burn
- **Readiness & Recovery**: Score trends, stress vs recovery balance, temperature trend
- **Resilience**: Daily levels trend (limited to exceptional), contributor breakdown (sleep recovery, daytime recovery, stress)
- **Fitness**: VO2 max trend (ml/kg/min), cardiovascular age trend, week-over-week changes
- **Workouts**: List workouts with type/label, duration, calories burned
- **Heart Rate & Breathing**: Resting HR trend, HRV trend, SpO2, breathing disturbance index
- **Week-over-Week**: Compare this week vs last week
- **Recommendations**: 3-5 specific, actionable health recommendations

Group data by week for easy comparison.

If $ARGUMENTS contains a number, use that as the number of weeks to review instead of 2.
