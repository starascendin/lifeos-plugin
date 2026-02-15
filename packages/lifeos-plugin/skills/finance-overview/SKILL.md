---
name: finance-overview
description: Financial overview with net worth summary, account balances, and net worth trend
---

Give me a financial overview. Use the LifeOS MCP tools:

1. Call get_finance_net_worth for current net worth and account breakdown
2. Call get_finance_accounts for all account details
3. Call get_finance_snapshots with days=90 for net worth trend

Present a financial dashboard:
- **Net Worth**: Current total with change over the period
- **Assets**: Total assets, broken down by account type (checking, savings, investments, retirement)
- **Liabilities**: Total liabilities, broken down by type (credit cards, loans)
- **Trend**: Net worth direction over the last 90 days (growing/declining/stable)
- **Accounts**: List each account with name, type, and current balance (convert cents to dollars)
- **Insights**: Notable changes or patterns

Convert all amounts from cents to dollars for display. Format as currency.

If $ARGUMENTS contains a number, use that as the number of days for trend data instead of 90.
