"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSocket } from "@/contexts/socket-context";
import { useAttemptLifecycle } from "@/hooks/use-attempt-lifecycle";
import type {
  AttemptChatStartedEvent,
  AttemptEndedEvent,
  AttemptErrorEvent,
} from "@/hooks/use-attempt-lifecycle";
import type { components } from "@/lib/api/schema";
import { Play, SlidersHorizontal, SkipForward } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type AvailableContinuationOptions =
  components["schemas"]["AvailableContinuationOptions"];
type ContinuationOption = components["schemas"]["ContinuationOption"];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

interface AttemptLobbyProps {
  attemptId: string;
  chatEntryId: string;
  simulationName: string | null;
  draftId: string | null;
  infiniteMode?: boolean;
  userInstructions?: string | null;
  continuationOptions?: AvailableContinuationOptions | null;
}

export function AttemptLobby({
  attemptId,
  chatEntryId,
  simulationName,
  draftId,
  infiniteMode,
  userInstructions,
  continuationOptions,
}: AttemptLobbyProps) {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const [isStarting, setIsStarting] = useState(false);
  const isStartingRef = useRef(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<string>("");

  const options = useMemo(
    () => continuationOptions?.options ?? [],
    [continuationOptions],
  );

  // Listen for attempt lifecycle events
  const { nextScenario, usePrevious } = useAttemptLifecycle({
    socket,
    attemptId,
    onChatStarted: useCallback((data: AttemptChatStartedEvent) => {
      if (!isStartingRef.current) return;
      setIsStarting(false);
      isStartingRef.current = false;
      if (data.attempt_id === attemptId) {
        router.refresh();
      }
    }, [attemptId, router]),
    onChatEnded: useCallback(() => {
      if (!isStartingRef.current) return;
      setIsStarting(false);
      isStartingRef.current = false;
      router.refresh();
    }, [router]),
    onEnded: useCallback((data: AttemptEndedEvent) => {
      if (!isStartingRef.current) return;
      setIsStarting(false);
      isStartingRef.current = false;
      if (data.attempt_id === attemptId) {
        router.push(`/attempt/${attemptId}/results`);
      }
    }, [attemptId, router]),
    onError: useCallback((data: AttemptErrorEvent) => {
      if (!isStartingRef.current) return;
      if (data.type === "end" || data.type === "start" || data.type === "next") {
        setIsStarting(false);
        isStartingRef.current = false;
        toast.error(data.message || "Failed to start training.");
      }
    }, []),
  });

  const handleStart = useCallback(() => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    setIsStarting(true);
    isStartingRef.current = true;

    nextScenario(attemptId, {
      draftId: draftId ?? undefined,
    });
  }, [
    socket,
    isConnected,
    attemptId,
    draftId,
    userInstructions,
    nextScenario,
  ]);

  const handleUsePrevious = useCallback(() => {
    const idx = parseInt(selectedOptionIndex, 10);
    const selected = options[idx];
    if (!selected) return;

    if (!socket || !isConnected) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    // Build previous_chat_map from selected option's scenarios
    const previousChatMap: Record<string, string> = {};
    for (const scenario of selected.scenarios) {
      if (scenario.scenario_id && scenario.previous_chat_id) {
        previousChatMap[scenario.scenario_id] = scenario.previous_chat_id;
      }
    }

    setIsStarting(true);
    isStartingRef.current = true;

    usePrevious(attemptId, previousChatMap);
  }, [selectedOptionIndex, options, socket, isConnected, attemptId, usePrevious]);

  const handleCustomize = useCallback(() => {
    router.push(`/attempt/${attemptId}/${chatEntryId}`);
  }, [router, attemptId, chatEntryId]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">
          {simulationName || "Training Simulation"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Ready to begin your next scenario.
        </p>
      </div>

      {/* Continuation options ("Use Previous") */}
      {options.length > 0 && (
        <div className="w-full max-w-lg space-y-3">
          <p className="text-sm font-medium text-center">
            Use scores from a previous attempt:
          </p>
          <RadioGroup
            value={selectedOptionIndex}
            onValueChange={setSelectedOptionIndex}
            className="space-y-2"
          >
            {options.map((opt, idx) => (
              <div
                key={idx}
                className={`rounded-lg border-2 transition-colors ${
                  selectedOptionIndex === String(idx)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Label
                  htmlFor={`opt-${idx}`}
                  className="cursor-pointer block"
                >
                  <div className="flex items-center gap-3 p-3 pb-2">
                    <RadioGroupItem
                      value={String(idx)}
                      id={`opt-${idx}`}
                      className="flex-shrink-0"
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-medium">
                        Skip {opt.scenarios.length}{" "}
                        {opt.scenarios.length === 1 ? "scenario" : "scenarios"}
                      </span>
                      <Badge variant="secondary">
                        {opt.total_score} pts
                      </Badge>
                      {opt.total_time > 0 && (
                        <span className="text-sm text-muted-foreground">
                          ({formatTime(opt.total_time)})
                        </span>
                      )}
                      {idx === 0 && (
                        <Badge variant="default" className="ml-auto">
                          Best
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 px-3 pb-3 pl-11">
                    {opt.scenarios.map((s, sIdx) => (
                      <div
                        key={sIdx}
                        className="text-sm text-muted-foreground"
                      >
                        <span>{s.scenario_name || `Scenario ${sIdx + 1}`}</span>
                        {s.score != null && (
                          <>
                            {" ("}
                            {s.percentage != null
                              ? `${s.percentage}%`
                              : `${s.score} pts`}
                            {s.time_taken != null &&
                              s.time_taken > 0 &&
                              ` - ${formatTime(s.time_taken)}`}
                            {")"}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={handleStart}
          disabled={isStarting || !isConnected}
          size="lg"
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          {isStarting ? "Starting..." : "Start Next"}
        </Button>
        {options.length > 0 && selectedOptionIndex !== "" && (
          <Button
            onClick={handleUsePrevious}
            disabled={isStarting || !isConnected}
            size="lg"
            variant="secondary"
            className="gap-2"
          >
            <SkipForward className="h-4 w-4" />
            {isStarting ? "Starting..." : "Use Previous"}
          </Button>
        )}
        <Button
          onClick={handleCustomize}
          disabled={isStarting}
          variant="outline"
          size="lg"
          className="gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Customize
        </Button>
      </div>
    </div>
  );
}
