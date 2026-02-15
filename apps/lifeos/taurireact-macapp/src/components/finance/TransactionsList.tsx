import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { useState, useMemo } from "react";

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `-$${formatted}` : `$${formatted}`;
}

interface TransactionsListProps {
  selectedAccountId: Id<"lifeos_financeAccounts"> | null;
}

export function TransactionsList({
  selectedAccountId,
}: TransactionsListProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [limit, setLimit] = useState(50);

  const accounts = useQuery(api.lifeos.finance.getAccounts);
  const transactions = useQuery(api.lifeos.finance.getTransactions, {
    accountId: selectedAccountId ?? undefined,
    limit: 200,
  });

  const accountMap = useMemo(() => {
    const map = new Map<
      string,
      { institution: string; accountNum: string }
    >();
    for (const a of accounts ?? []) {
      map.set(a._id, {
        institution: a.institution,
        accountNum: a.accountNum,
      });
    }
    return map;
  }, [accounts]);

  const categories = useMemo(() => {
    if (!transactions) return [];
    const set = new Set(transactions.map((t) => t.category));
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    if (!transactions) return [];
    let result = transactions;
    if (categoryFilter !== "all") {
      result = result.filter((t) => t.category === categoryFilter);
    }
    return result.slice(0, limit);
  }, [transactions, categoryFilter, limit]);

  if (!transactions) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No transactions found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Transactions
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({filtered.length}
              {transactions.length > filtered.length
                ? ` of ${transactions.length}`
                : ""}
              )
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Date</TableHead>
                {!selectedAccountId && (
                  <TableHead className="w-[140px]">Account</TableHead>
                )}
                <TableHead>Description</TableHead>
                <TableHead className="w-[140px]">Category</TableHead>
                <TableHead className="w-[120px] text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((txn) => {
                const acct = accountMap.get(txn.accountId);
                const isInvestment = !!txn.action;
                return (
                  <TableRow key={txn._id}>
                    <TableCell className="tabular-nums text-sm">
                      {txn.date}
                    </TableCell>
                    {!selectedAccountId && (
                      <TableCell className="text-sm">
                        <span className="text-muted-foreground">
                          {acct
                            ? `${acct.institution} ...${acct.accountNum}`
                            : "—"}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[300px]">
                          {txn.description}
                        </span>
                        {isInvestment && txn.action && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge
                                variant="outline"
                                className="text-xs flex-shrink-0"
                              >
                                {txn.action}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {txn.quantity != null && (
                                <div>Qty: {txn.quantity}</div>
                              )}
                              {txn.priceCents != null && (
                                <div>
                                  Price: {formatCents(txn.priceCents)}
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {txn.category}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-medium ${
                        txn.amountCents < 0 ? "text-red-500" : "text-green-600"
                      }`}
                    >
                      {formatCents(txn.amountCents)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {transactions.length > limit && (
          <div className="mt-3 text-center">
            <button
              onClick={() => setLimit((prev) => prev + 50)}
              className="text-sm text-primary hover:underline"
            >
              Show more
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
