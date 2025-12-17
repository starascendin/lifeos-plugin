import { InlineEditableText } from "../shared";
import { cn } from "@/lib/utils";
import type { Doc } from "@holaai/convex";

interface IssueHeaderProps {
  issue: Doc<"lifeos_pmIssues">;
  onUpdateTitle: (title: string) => Promise<void>;
}

export function IssueHeader({ issue, onUpdateTitle }: IssueHeaderProps) {
  return (
    <div className="space-y-2">
      {/* Identifier Badge */}
      <span className="inline-block rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
        {issue.identifier}
      </span>

      {/* Editable Title */}
      <InlineEditableText
        value={issue.title}
        onSave={onUpdateTitle}
        className="block text-lg font-semibold leading-tight"
        inputClassName="text-lg font-semibold"
        placeholder="Issue title"
      />
    </div>
  );
}
