import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Coins, Infinity, Loader2 } from "lucide-react";
import { useState } from "react";
import { RequestCreditsModal } from "./RequestCreditsModal";

interface CreditBalanceProps {
  isCollapsed?: boolean;
}

export function CreditBalance({ isCollapsed = false }: CreditBalanceProps) {
  const credits = useQuery(api.common.credits.getMyCredits);
  const [showRequestModal, setShowRequestModal] = useState(false);

  if (!credits) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          isCollapsed && "justify-center px-2"
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Unlimited access users see infinity symbol
  if (credits.hasUnlimitedAccess) {
    const content = (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70",
          isCollapsed && "justify-center px-2"
        )}
      >
        <Infinity className="h-4 w-4 text-green-500" />
        {!isCollapsed && (
          <span className="text-xs text-green-500 font-medium">Unlimited</span>
        )}
      </div>
    );

    return isCollapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">Unlimited Credits</TooltipContent>
      </Tooltip>
    ) : (
      content
    );
  }

  // Format balance for display
  const formatBalance = (balance: number) => {
    if (balance >= 1000000) {
      return `${(balance / 1000000).toFixed(1)}M`;
    }
    if (balance >= 1000) {
      return `${(balance / 1000).toFixed(1)}K`;
    }
    return balance.toString();
  };

  const balance = credits.balance;
  const isLowBalance = balance < 1000;
  const isZeroBalance = balance <= 0;

  const content = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setShowRequestModal(true)}
      className={cn(
        "w-full rounded-md text-sm transition-colors",
        isCollapsed ? "justify-center px-2" : "justify-start gap-2 px-3",
        isZeroBalance
          ? "text-red-500 hover:text-red-600 hover:bg-red-50"
          : isLowBalance
            ? "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
      )}
    >
      <Coins
        className={cn(
          "h-4 w-4",
          isZeroBalance
            ? "text-red-500"
            : isLowBalance
              ? "text-yellow-500"
              : "text-muted-foreground"
        )}
      />
      {!isCollapsed && (
        <span className="flex items-center gap-1.5">
          <span className="font-medium">{formatBalance(balance)}</span>
          <span className="text-xs text-muted-foreground">credits</span>
        </span>
      )}
    </Button>
  );

  return (
    <>
      {isCollapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">
            {isZeroBalance
              ? "No credits - Click to request"
              : `${formatBalance(balance)} credits`}
          </TooltipContent>
        </Tooltip>
      ) : (
        content
      )}

      <RequestCreditsModal
        open={showRequestModal}
        onOpenChange={setShowRequestModal}
      />
    </>
  );
}
