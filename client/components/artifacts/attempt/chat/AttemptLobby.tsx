"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSocket } from "@/contexts/socket-context";
import type { components } from "@/lib/api/schema";
import type { ServerToClientEvents } from "@/lib/ws/types";
import { Play, SlidersHorizontal, SkipForward } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  trainingBundleEntryId: string;
  simulationName: string | null;
  mode: "home" | "practice";
  draftId: string | null;
  infiniteMode?: boolean;
  userInstructions?: string | null;
  continuationOptions?: AvailableContinuationOptions | null;
}

export function AttemptLobby({
  attemptId,
  trainingBundleEntryId,
  simulationName,
  mode,
  draftId,
  infiniteMode,
  userInstructions,
  continuationOptions,
}: AttemptLobbyProps) {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const [isStarting, setIsStarting] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<string>("");

  const options = useMemo(
    () => continuationOptions?.options ?? [],
    [continuationOptions],
  );

  // Listen for training_started or attempt_chat_ended to refresh the page
  useEffect(() => {
    if (!socket) return;

    const handleStarted = (
      data: Parameters<ServerToClientEvents["training_started"]>[0],
    ) => {
      if (!isStarting) return;
      setIsStarting(false);
      if (data.attempt_id === attemptId) {
        router.refresh();
      }
    };

    const handleError = (
      data: Parameters<ServerToClientEvents["training_error"]>[0],
    ) => {
      if (!isStarting) return;
      setIsStarting(false);
      toast.error(data.message || "Failed to start training.");
    };

    const handleChatEnded = () => {
      if (!isStarting) return;
      setIsStarting(false);
      router.refresh();
    };

    const handleAttemptError = (data: { type: string; message: string }) => {
      if (!isStarting) return;
      if (data.type === "end") {
        setIsStarting(false);
        toast.error(data.message || "Failed to use previous scores.");
      }
    };

    socket.on("training_started", handleStarted);
    socket.on("training_error", handleError);
    socket.on("attempt_chat_ended", handleChatEnded);
    socket.on("attempt_error", handleAttemptError);

    return () => {
      socket.off("training_started", handleStarted);
      socket.off("training_error", handleError);
      socket.off("attempt_chat_ended", handleChatEnded);
      socket.off("attempt_error", handleAttemptError);
    };
  }, [socket, isStarting, attemptId, router]);

  const handleStart = useCallback(() => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    setIsStarting(true);

    const payload: Record<string, unknown> = {
      training_bundle_entry_id: trainingBundleEntryId,
      attempt_id: attemptId,
    };

    if (draftId) {
      payload.draft_id = draftId;
    }
    if (infiniteMode) {
      payload.infinite = true;
    }
    if (userInstructions?.trim()) {
      payload.user_instructions = [userInstructions.trim()];
    }

    socket.emit("training_start", payload);
  }, [
    socket,
    isConnected,
    trainingBundleEntryId,
    attemptId,
    draftId,
    infiniteMode,
    userInstructions,
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

    // Emit attempt_end with previous_chat_map — server creates skipped chats
    // with copied grades, then client refreshes on attempt_chat_ended
    socket.emit("attempt_end", {
      attempt_id: attemptId,
      previous_chat_map: previousChatMap,
    });
  }, [selectedOptionIndex, options, socket, isConnected, attemptId]);

  const handleCustomize = useCallback(() => {
    const basePath = mode === "practice" ? "/practice" : "/home";
    router.push(`${basePath}/${attemptId}/${trainingBundleEntryId}`);
  }, [mode, router, attemptId, trainingBundleEntryId]);

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
