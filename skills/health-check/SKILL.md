---
name: health-check
description: Quick health overview with recent Oura Ring scores, trends, and insights
---

Give me a quick health overview. Use the LifeOS MCP tools to gather Oura Ring data:

1. Call get_health_sleep with days=7 for sleep scores, durations, bedtime, breath rate
2. Call get_health_activity with days=7 for activity scores and steps
3. Call get_health_readiness with days=7 for readiness scores
4. Call get_health_heart_rate with days=7 for resting heart rate trends
5. Call get_health_resilience with days=7 for resilience levels
6. Call get_health_vo2_max with days=7 for VO2 max estimates
7. Call get_health_cardio_age with days=7 for cardiovascular age

Present a concise health dashboard:
- **Overall Status**: Quick assessment (great / good / needs attention)
- **Sleep**: Average score, total sleep trend, bedtime consistency, avg breath rate, any concerning nights
- **Activity**: Average score, daily steps, active calories
- **Readiness**: Average score, trend direction (improving/declining/stable)
- **Heart Rate**: Resting HR trend, HRV if available
- **Resilience**: Current level and trend (limited/adequate/solid/strong/exceptional)
- **Fitness**: VO2 max trend, cardiovascular age vs actual age
- **Insights**: 2-3 actionable observations based on the data

Keep it concise. Highlight anything unusual or noteworthy.

If $ARGUMENTS contains a number, use that as the number of days to review instead of 7.
