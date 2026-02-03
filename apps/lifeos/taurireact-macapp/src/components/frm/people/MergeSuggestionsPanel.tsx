import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@holaai/convex";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Sparkles,
  Check,
  X,
  GitMerge,
  ArrowRight,
  User,
  MessageSquare,
  Mail,
  Phone,
  Bot,
  AlertCircle,
} from "lucide-react";

interface MergeSuggestionsPanelProps {
  hideHeader?: boolean;
}

export function MergeSuggestionsPanel({ hideHeader }: MergeSuggestionsPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useQuery(api.lifeos.frm_contact_merge.getMergeSuggestions);
  const analyzeMerges = useAction(api.lifeos.frm_contact_merge_actions.analyzeMergeSuggestions);
  const acceptMerge = useMutation(api.lifeos.frm_contact_merge.acceptMergeSuggestion);
  const rejectMerge = useMutation(api.lifeos.frm_contact_merge.rejectMergeSuggestion);
  const dismissAll = useMutation(api.lifeos.frm_contact_merge.dismissAllSuggestions);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeMerges();
      if (!result.success) {
        setError(result.message || "Analysis failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAccept = async (suggestionId: string) => {
    try {
      await acceptMerge({ suggestionId: suggestionId as any });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    }
  };

  const handleReject = async (suggestionId: string) => {
    try {
      await rejectMerge({ suggestionId: suggestionId as any });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    }
  };

  const handleDismissAll = async () => {
    try {
      await dismissAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dismiss failed");
    }
  };

  const pendingSuggestions = (suggestions?.filter((s): s is NonNullable<typeof s> => s !== null) ?? []);

  return (
    <div className="h-full flex flex-col">
      {!hideHeader && (
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium text-sm">Contact Deduplication</h3>
            {pendingSuggestions.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingSuggestions.length}
              </Badge>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Analyze Button */}
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          variant="outline"
          className="w-full gap-2"
          size="sm"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing contacts...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Find Duplicates
            </>
          )}
        </Button>

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 ml-auto"
              onClick={() => setError(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* No Suggestions */}
        {suggestions && pendingSuggestions.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <GitMerge className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No duplicate contacts found</p>
            <p className="text-xs mt-1">
              Click "Find Duplicates" to scan for potential merges
            </p>
          </div>
        )}

        {/* Suggestions List */}
        {pendingSuggestions.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {pendingSuggestions.length} potential merge{pendingSuggestions.length !== 1 ? "s" : ""}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={handleDismissAll}
              >
                Dismiss All
              </Button>
            </div>

            {pendingSuggestions.map((suggestion) => (
              <Card key={suggestion._id} className="overflow-hidden">
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <GitMerge className="h-4 w-4 text-primary" />
                      Merge Suggestion
                    </CardTitle>
                    <Badge
                      variant={suggestion.confidence >= 0.8 ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {Math.round(suggestion.confidence * 100)}% match
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {suggestion.reasons.join(" · ")}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-3 pt-0">
                  <div className="flex items-center gap-2">
                    {/* Source Person (to be merged) */}
                    <div className="flex-1 p-2 rounded-lg bg-muted/50 border border-dashed">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs">
                          <User className="h-3 w-3" />
                        </div>
                        <span className="font-medium text-sm truncate">
                          {suggestion.sourcePerson.name}
                        </span>
                      </div>
                      <div className="space-y-0.5 text-[10px] text-muted-foreground">
                        {suggestion.sourcePerson.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-2.5 w-2.5" />
                            <span className="truncate">{suggestion.sourcePerson.email}</span>
                          </div>
                        )}
                        {suggestion.sourcePerson.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" />
                            <span>{suggestion.sourcePerson.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-2.5 w-2.5" />
                          <span>{suggestion.sourcePerson.memoCount || 0} memos</span>
                        </div>
                        {suggestion.sourcePerson.autoCreatedFrom && (
                          <div className="flex items-center gap-1">
                            <Bot className="h-2.5 w-2.5" />
                            <span>via {suggestion.sourcePerson.autoCreatedFrom}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                    {/* Target Person (to keep) */}
                    <div className="flex-1 p-2 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <span className="font-medium text-sm truncate">
                          {suggestion.targetPerson.name}
                        </span>
                      </div>
                      <div className="space-y-0.5 text-[10px] text-muted-foreground">
                        {suggestion.targetPerson.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-2.5 w-2.5" />
                            <span className="truncate">{suggestion.targetPerson.email}</span>
                          </div>
                        )}
                        {suggestion.targetPerson.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" />
                            <span>{suggestion.targetPerson.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-2.5 w-2.5" />
                          <span>{suggestion.targetPerson.memoCount || 0} memos</span>
                        </div>
                        {suggestion.targetPerson.autoCreatedFrom && (
                          <div className="flex items-center gap-1">
                            <Bot className="h-2.5 w-2.5" />
                            <span>via {suggestion.targetPerson.autoCreatedFrom}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-3 pt-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8"
                    onClick={() => handleReject(suggestion._id)}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-8"
                    onClick={() => handleAccept(suggestion._id)}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Merge
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
