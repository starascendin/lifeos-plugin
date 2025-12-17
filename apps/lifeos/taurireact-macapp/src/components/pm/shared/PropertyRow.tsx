import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PropertyRowProps {
  label: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export function PropertyRow({ label, icon: Icon, children, className }: PropertyRowProps) {
  return (
    <div className={cn("flex items-center justify-between py-2", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" />}
        <span>{label}</span>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
