---
name: finance-spending
description: Spending analysis with daily patterns, income vs spending, and recent transactions
---

Analyze my spending patterns. Use the LifeOS MCP tools:

1. Call get_finance_daily_spending with days=30 for daily income/spending aggregation
2. Call get_finance_transactions with limit=50 for recent transaction details

Present a spending analysis:
- **Summary**: Total income, total spending, net for the period
- **Daily Average**: Average daily spending
- **Spending Pattern**: Identify high-spending days and patterns
- **Recent Transactions**: Show the most notable recent transactions
- **Insights**: Spending trends, any unusual activity, suggestions

Convert all amounts from cents to dollars. Format as currency.

If $ARGUMENTS contains a number, use that as the number of days to analyze instead of 30.
