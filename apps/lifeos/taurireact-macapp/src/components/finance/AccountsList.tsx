import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Id } from "@holaai/convex/convex/_generated/dataModel";

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `-$${formatted}` : `$${formatted}`;
}

const TYPE_LABELS: Record<string, string> = {
  cash: "Cash",
  investment: "Investments",
  credit_card: "Credit Cards",
  loan: "Loans",
  other: "Other",
};

const TYPE_ORDER = ["cash", "investment", "credit_card", "loan", "other"];

interface AccountsListProps {
  selectedAccountId: Id<"lifeos_financeAccounts"> | null;
  onSelectAccount: (id: Id<"lifeos_financeAccounts"> | null) => void;
}

export function AccountsList({
  selectedAccountId,
  onSelectAccount,
}: AccountsListProps) {
  const accounts = useQuery(api.lifeos.finance.getAccounts);

  if (!accounts) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No accounts synced yet. Run the Empower scraper to get started.
        </CardContent>
      </Card>
    );
  }

  // Group by asset class, then by account type
  const assets = accounts.filter((a) => a.assetClass === "asset");
  const liabilities = accounts.filter((a) => a.assetClass === "liability");

  const renderGroup = (
    label: string,
    accts: typeof accounts,
    colorClass: string,
  ) => {
    if (accts.length === 0) return null;

    // Sub-group by type
    const byType = TYPE_ORDER.map((type) => ({
      type,
      label: TYPE_LABELS[type],
      accounts: accts.filter((a) => a.accountType === type),
    })).filter((g) => g.accounts.length > 0);

    const total = accts.reduce((sum, a) => sum + a.balanceCents, 0);

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{label}</CardTitle>
            <span className={`text-lg font-semibold ${colorClass}`}>
              {formatCents(total)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {byType.map((group) => (
            <div key={group.type}>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.accounts.map((acct) => (
                  <button
                    key={acct._id}
                    onClick={() =>
                      onSelectAccount(
                        selectedAccountId === acct._id ? null : acct._id,
                      )
                    }
                    className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent ${
                      selectedAccountId === acct._id
                        ? "bg-accent ring-1 ring-primary"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-left min-w-0">
                        <div className="font-medium truncate">
                          {acct.institution}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {acct.accountName} ...{acct.accountNum}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                        {acct.accountSubtype.replace("_", " ")}
                      </Badge>
                      <span
                        className={`font-medium tabular-nums text-sm ${
                          acct.isDebt ? "text-red-500" : ""
                        }`}
                      >
                        {formatCents(acct.balanceCents)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {renderGroup("Assets", assets, "text-green-600")}
      {renderGroup("Liabilities", liabilities, "text-red-500")}
    </div>
  );
}
