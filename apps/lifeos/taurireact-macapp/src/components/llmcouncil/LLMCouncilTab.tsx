import { useLLMCouncil } from "@/lib/contexts/LLMCouncilContext";
import { CouncilHeader } from "./CouncilHeader";
import { ConversationSidebar } from "./ConversationSidebar";
import { CouncilInput } from "./CouncilInput";
import { StageDisplay } from "./StageDisplay";

export function LLMCouncilTab() {
  const { isLoadingMessages, messages, deliberationState, currentConversationId } =
    useLLMCouncil();

  // Find the latest deliberation from messages or use current state
  const latestDeliberation = messages
    ? [...messages].reverse().find((m) => m.type === "deliberation")
    : undefined;
  const latestQuery = messages
    ? [...messages].reverse().find((m) => m.type === "query")
    : undefined;

  // Use live state if deliberating, otherwise use stored data
  const isLiveDeliberation =
    deliberationState.status !== "idle" &&
    deliberationState.status !== "complete" &&
    deliberationState.status !== "error";

  const displayDeliberation = isLiveDeliberation
    ? {
        stage1Responses: deliberationState.stage1Responses,
        stage2Evaluations: deliberationState.stage2Evaluations,
        stage3Response: deliberationState.stage3Response,
        aggregateRankings: deliberationState.aggregateRankings,
        labelToModel: deliberationState.labelToModel,
        status: deliberationState.status,
      }
    : latestDeliberation
      ? {
          stage1Responses: latestDeliberation.stage1Responses ?? [],
          stage2Evaluations: latestDeliberation.stage2Evaluations ?? [],
          stage3Response: latestDeliberation.stage3Response,
          aggregateRankings: latestDeliberation.aggregateRankings,
          labelToModel: latestDeliberation.labelToModel,
          status: latestDeliberation.isComplete ? "complete" : "idle",
        }
      : null;

  return (
    <div className="flex h-full">
      {/* Conversation sidebar */}
      <ConversationSidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header with tier selector */}
        <CouncilHeader />

        {/* Stage display area */}
        <div className="flex-1 overflow-auto p-4">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading...
            </div>
          ) : !currentConversationId && !displayDeliberation ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <div className="text-lg font-medium mb-2">Welcome to LLM Council</div>
              <div className="text-sm text-center max-w-md">
                Ask a question and watch as multiple AI models deliberate to provide
                the best answer. Each model responds, then evaluates the others,
                and finally a chairman synthesizes everything into a final answer.
              </div>
            </div>
          ) : displayDeliberation ? (
            <StageDisplay
              query={latestQuery?.userQuery}
              stage1Responses={displayDeliberation.stage1Responses}
              stage2Evaluations={displayDeliberation.stage2Evaluations}
              stage3Response={displayDeliberation.stage3Response}
              aggregateRankings={displayDeliberation.aggregateRankings}
              labelToModel={displayDeliberation.labelToModel}
              currentStage={
                isLiveDeliberation
                  ? deliberationState.status === "stage1"
                    ? 1
                    : deliberationState.status === "stage2"
                      ? 2
                      : deliberationState.status === "stage3"
                        ? 3
                        : 0
                  : 3
              }
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Ask a question to start a council deliberation
            </div>
          )}
        </div>

        {/* Input bar */}
        <CouncilInput />
      </div>
    </div>
  );
}
