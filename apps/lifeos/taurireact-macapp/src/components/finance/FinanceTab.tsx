import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { useState } from "react";
import { SyncStatusBar } from "./SyncStatusBar";
import { NetWorthCard } from "./NetWorthCard";
import { NetWorthChart } from "./NetWorthChart";
import { AccountsList } from "./AccountsList";
import { TransactionsList } from "./TransactionsList";
import { SpendingByCategory } from "./SpendingByCategory";
import { DailySpendingChart } from "./DailySpendingChart";
import { CryptoTab } from "./CryptoTab";

export function FinanceTab() {
  const [selectedAccountId, setSelectedAccountId] =
    useState<Id<"lifeos_financeAccounts"> | null>(null);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">Personal Finance</h1>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="crypto">Crypto</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SyncStatusBar />
          <NetWorthCard />
          <NetWorthChart />
          <DailySpendingChart />
          <div className="grid gap-6 lg:grid-cols-2">
            <AccountsList
              selectedAccountId={selectedAccountId}
              onSelectAccount={setSelectedAccountId}
            />
            <SpendingByCategory />
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <SyncStatusBar />
          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <AccountsList
              selectedAccountId={selectedAccountId}
              onSelectAccount={setSelectedAccountId}
            />
            <TransactionsList selectedAccountId={selectedAccountId} />
          </div>
        </TabsContent>

        <TabsContent value="crypto" className="space-y-4">
          <CryptoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
