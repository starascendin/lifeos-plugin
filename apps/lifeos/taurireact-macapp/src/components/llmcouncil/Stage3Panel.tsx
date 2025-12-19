import { Badge } from "@/components/ui/badge";
import { Crown, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Stage3Response } from "@/lib/contexts/LLMCouncilContext";

interface Stage3PanelProps {
  response: Stage3Response;
}

export function Stage3Panel({ response }: Stage3PanelProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Crown className="h-4 w-4 text-yellow-500" />
        <Badge variant="outline">{response.modelName}</Badge>
        {response.error && <Badge variant="destructive">Error</Badge>}
      </div>

      {response.error ? (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {response.error}
        </div>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{response.response}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
