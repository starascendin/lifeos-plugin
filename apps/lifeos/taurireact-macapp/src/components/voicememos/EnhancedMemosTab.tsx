import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles } from "lucide-react";
import {
  ExtractionCard,
  LabelFilterSidebar,
  ExtractionHistoryPanel,
} from "./extraction";

export function EnhancedMemosTab() {
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedMemoId, setSelectedMemoId] = useState<Id<"life_voiceMemos"> | null>(null);
  const [selectedMemoName, setSelectedMemoName] = useState<string>("");

  // Query enhanced memos with optional label filter
  const enhancedMemos = useQuery(api.lifeos.voicememo_extraction.getEnhancedMemos, {
    labels: selectedLabels.length > 0 ? selectedLabels : undefined,
  });

  // Query all labels for the sidebar
  const allLabels = useQuery(api.lifeos.voicememo_extraction.getAllLabels, {});

  const handleLabelToggle = (label: string) => {
    setSelectedLabels((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  };

  const handleClearFilters = () => {
    setSelectedLabels([]);
  };

  const handleMemoClick = (memoId: Id<"life_voiceMemos">, memoName: string) => {
    if (selectedMemoId === memoId) {
      setSelectedMemoId(null);
      setSelectedMemoName("");
    } else {
      setSelectedMemoId(memoId);
      setSelectedMemoName(memoName);
    }
  };

  const isLoading = enhancedMemos === undefined || allLabels === undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* Label Filter Sidebar */}
      <Card className="w-64 flex-shrink-0 overflow-hidden">
        <LabelFilterSidebar
          labels={allLabels}
          selectedLabels={selectedLabels}
          onLabelToggle={handleLabelToggle}
          onClearFilters={handleClearFilters}
        />
      </Card>

      {/* Main Content - Enhanced Memos */}
      <div className="flex-1 overflow-hidden">
        {enhancedMemos.length === 0 ? (
          <Card className="h-full flex items-center justify-center">
            <div className="text-center p-8">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-purple-300" />
              <h3 className="text-lg font-medium mb-2">No Enhanced Memos</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {selectedLabels.length > 0
                  ? "No memos match the selected labels. Try removing some filters."
                  : "Extract AI insights from your voice memos to see them here. Go to the Voice Memos tab and click the sparkle icon on any transcribed memo."}
              </p>
            </div>
          </Card>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-4">
              {enhancedMemos.map(({ memo, extraction }) => (
                <ExtractionCard
                  key={extraction._id}
                  memo={memo}
                  extraction={extraction}
                  onClick={() => handleMemoClick(memo._id, memo.name)}
                  showFullDetails={selectedMemoId === memo._id}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* History Panel */}
      {selectedMemoId && (
        <Card className="w-80 flex-shrink-0 overflow-hidden">
          <ExtractionHistoryPanel
            voiceMemoId={selectedMemoId}
            memoName={selectedMemoName}
            onClose={() => {
              setSelectedMemoId(null);
              setSelectedMemoName("");
            }}
          />
        </Card>
      )}
    </div>
  );
}
