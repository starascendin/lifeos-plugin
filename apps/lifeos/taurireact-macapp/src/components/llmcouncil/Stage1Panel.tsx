import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Stage1Response } from "@/lib/contexts/LLMCouncilContext";

interface Stage1PanelProps {
  responses: Stage1Response[];
}

export function Stage1Panel({ responses }: Stage1PanelProps) {
  const [activeTab, setActiveTab] = useState(responses[0]?.modelId ?? "");

  // Get short model name for tab display
  const getShortName = (modelName: string) => {
    // Already short enough
    if (modelName.length <= 12) return modelName;
    // Take first part before space or version number
    const parts = modelName.split(/[\s-]/);
    return parts[0];
  };

  if (responses.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No responses yet
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="flex-wrap h-auto gap-1">
        {responses.map((response) => (
          <TabsTrigger
            key={response.modelId}
            value={response.modelId}
            className="text-xs"
          >
            {getShortName(response.modelName)}
            {response.error && (
              <AlertCircle className="ml-1 h-3 w-3 text-destructive" />
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {responses.map((response) => (
        <TabsContent
          key={response.modelId}
          value={response.modelId}
          className="mt-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">{response.modelName}</Badge>
            {response.error && (
              <Badge variant="destructive">Error</Badge>
            )}
          </div>

          <ScrollArea className="h-64 rounded-md border p-4">
            {response.error ? (
              <div className="text-destructive text-sm">
                {response.error}
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{response.response}</ReactMarkdown>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      ))}
    </Tabs>
  );
}
