import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";

// Note: These API paths will be available after running `convex codegen`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initiativesApi = (api as any).lifeos.initiatives;
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InitiativeProgressBar } from "./InitiativeProgressBar";
import { INITIATIVE_CATEGORIES } from "@/lib/contexts/InitiativesContext";
import { cn } from "@/lib/utils";
import type { Id } from "@holaai/convex";
import {
  Search,
  Rocket,
  X,
  Check,
  Briefcase,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Sparkles,
} from "lucide-react";

// Icon mapping
const CategoryIcons = {
  Briefcase,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Sparkles,
} as const;

interface LinkToInitiativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentInitiativeId?: Id<"lifeos_yearlyInitiatives"> | null;
  onSelect: (initiativeId: Id<"lifeos_yearlyInitiatives"> | null) => void;
  title?: string;
  description?: string;
}

export function LinkToInitiativeDialog({
  open,
  onOpenChange,
  currentInitiativeId,
  onSelect,
  title = "Link to Initiative",
  description = "Select a yearly initiative to link this item to.",
}: LinkToInitiativeDialogProps) {
  const currentYear = new Date().getFullYear();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] =
    useState<Id<"lifeos_yearlyInitiatives"> | null>(
      currentInitiativeId ?? null,
    );

  // Get initiatives for the current year
  const initiatives = useQuery(initiativesApi.getInitiativesWithStats, {
    year: currentYear,
  });

  // Filter initiatives by search query
  const filteredInitiatives = initiatives?.filter(
    (initiative: { title: string; category: string; description?: string }) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        initiative.title.toLowerCase().includes(query) ||
        initiative.category.toLowerCase().includes(query) ||
        initiative.description?.toLowerCase().includes(query)
      );
    },
  );

  const handleSelect = () => {
    onSelect(selectedId);
    onOpenChange(false);
  };

  const handleClear = () => {
    onSelect(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search initiatives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Initiative List */}
        <ScrollArea className="h-[300px] -mx-6 px-6">
          {!initiatives ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : filteredInitiatives && filteredInitiatives.length > 0 ? (
            <div className="space-y-2">
              {filteredInitiatives.map(
                (initiative: {
                  _id: Id<"lifeos_yearlyInitiatives">;
                  title: string;
                  category: string;
                  description?: string;
                  icon?: string;
                  color?: string;
                  calculatedProgress: number;
                }) => {
                  const categoryMeta =
                    INITIATIVE_CATEGORIES[
                      initiative.category as keyof typeof INITIATIVE_CATEGORIES
                    ];
                  const IconComponent =
                    CategoryIcons[
                      categoryMeta?.icon as keyof typeof CategoryIcons
                    ] || Sparkles;
                  const displayColor =
                    initiative.color || categoryMeta?.color || "#6366f1";
                  const isSelected = selectedId === initiative._id;
                  const isCurrent = currentInitiativeId === initiative._id;

                  return (
                    <button
                      key={initiative._id}
                      onClick={() => setSelectedId(initiative._id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent",
                      )}
                    >
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${displayColor}20` }}
                      >
                        {initiative.icon ? (
                          <span className="text-lg">{initiative.icon}</span>
                        ) : (
                          <IconComponent
                            className="h-5 w-5"
                            style={{ color: displayColor }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {initiative.title}
                          </span>
                          {isCurrent && (
                            <Badge variant="secondary" className="text-[10px]">
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            style={{
                              borderColor: displayColor,
                              color: displayColor,
                            }}
                          >
                            {categoryMeta?.label || initiative.category}
                          </Badge>
                          <div className="flex-1">
                            <InitiativeProgressBar
                              progress={initiative.calculatedProgress}
                              color={displayColor}
                              size="sm"
                              showLabel={false}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {initiative.calculatedProgress}%
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-5 w-5 text-primary shrink-0" />
                      )}
                    </button>
                  );
                },
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center">
              <Rocket className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "No initiatives match your search."
                  : "No initiatives for this year."}
              </p>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentInitiativeId && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              className="sm:mr-auto"
            >
              <X className="h-4 w-4 mr-2" />
              Remove Link
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSelect}>
            {selectedId ? "Link to Initiative" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Compact selector for use in forms
interface InitiativeSelectorProps {
  value?: Id<"lifeos_yearlyInitiatives"> | null;
  onChange: (initiativeId: Id<"lifeos_yearlyInitiatives"> | null) => void;
  className?: string;
}

export function InitiativeSelector({
  value,
  onChange,
  className,
}: InitiativeSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  // Get the selected initiative details
  const initiative = useQuery(
    initiativesApi.getInitiative,
    value ? { initiativeId: value } : "skip",
  );

  const categoryMeta = initiative
    ? INITIATIVE_CATEGORIES[
        initiative.category as keyof typeof INITIATIVE_CATEGORIES
      ]
    : null;
  const displayColor = initiative?.color || categoryMeta?.color || "#6366f1";

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg border text-left transition-colors hover:bg-accent",
          className,
        )}
      >
        {initiative ? (
          <>
            <div
              className="h-6 w-6 rounded flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${displayColor}20` }}
            >
              {initiative.icon ? (
                <span className="text-xs">{initiative.icon}</span>
              ) : (
                <Rocket className="h-3 w-3" style={{ color: displayColor }} />
              )}
            </div>
            <span className="text-sm truncate flex-1">{initiative.title}</span>
            <Badge
              variant="outline"
              className="text-[10px] shrink-0"
              style={{ borderColor: displayColor, color: displayColor }}
            >
              {categoryMeta?.label || initiative.category}
            </Badge>
          </>
        ) : (
          <>
            <Rocket className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Link to Initiative...
            </span>
          </>
        )}
      </button>

      <LinkToInitiativeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentInitiativeId={value}
        onSelect={onChange}
      />
    </>
  );
}
