---
name: screentime-report
description: Screen time analysis with usage patterns, top time-sink apps, social media alerts, and category breakdown
---

Generate a screen time report. Use the LifeOS MCP tools to gather data:

1. Call get_screentime_summary with days=7 for daily totals and app breakdowns
2. Call get_screentime_top_apps with days=7 and limit=15 for top time-sink apps
3. Call get_screentime_categories with days=7 for category-level aggregation

Present a structured report:

**USAGE OVERVIEW**
- Total screen time over the period and daily average
- Trend: increasing / decreasing / stable

**TOP APPS**
- Rank apps by total usage time
- Flag any social media or entertainment apps in the top 5

**CATEGORY BREAKDOWN**
- Show % split: Productivity vs Social vs Entertainment vs Communication vs Other
- Highlight if Entertainment + Social > 40% of total

**SOCIAL MEDIA ALERT**
- If any social media app (Twitter/X, Instagram, TikTok, Reddit, Facebook, YouTube) exceeds 1 hour/day average, call it out
- Estimate weekly hours on social media

**INSIGHTS**
- 2-3 actionable observations
- Compare productive vs non-productive time
- Suggest one app to reduce and one habit to build

Keep it concise and direct. This is an accountability report.

If $ARGUMENTS contains a number, use that as the number of days to analyze instead of 7.
