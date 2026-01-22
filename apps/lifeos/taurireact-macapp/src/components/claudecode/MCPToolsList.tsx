import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { getMCPToolsByCategory } from "@/lib/services/claudecode";
import { cn } from "@/lib/utils";

export function MCPToolsList() {
  const [isExpanded, setIsExpanded] = useState(false);
  const toolsByCategory = getMCPToolsByCategory();

  return (
    <div className="border-b">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <Wrench className="w-4 h-4" />
        <span>MCP Tools Available</span>
        <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
          {Object.values(toolsByCategory).flat().length} tools
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 max-h-[300px] overflow-y-auto">
          <div className="space-y-3">
            {Object.entries(toolsByCategory).map(([category, tools]) => (
              <div key={category}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {category}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {tools.map((tool) => (
                    <span
                      key={tool.name}
                      className={cn(
                        "px-2 py-0.5 text-xs rounded bg-muted hover:bg-muted/80 cursor-default",
                        "transition-colors"
                      )}
                      title={tool.description}
                    >
                      {tool.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
