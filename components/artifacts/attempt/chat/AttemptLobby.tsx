"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTransport } from "@/lib/transport/context";
import { useAttemptGenerate } from "@/hooks/use-attempt-generate";
import { useAttemptEnd } from "@/hooks/use-attempt-end";
import type { components } from "@/lib/api/schema";
import { Play, SlidersHorizontal, SkipForward } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

type AvailableContinuationOptions =
  components["schemas"]["AvailableContinuationOptions"];
type _ContinuationOption = components["schemas"]["ContinuationOption"];

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
  infiniteMode: _infiniteMode,
  userInstructions: _userInstructions,
  continuationOptions,
}: AttemptLobbyProps) {
  const router = useRouter();
  const transport = useTransport();
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<string>("");

  const { generate, stage: generateStage, error: generateError } = useAttemptGenerate();
  const { usePrevious: applyPrevious, stage: endStage, error: endError } = useAttemptEnd();

  const options = useMemo(
    () => continuationOptions?.options ?? [],
    [continuationOptions],
  );

  const isStarting =
    (generateStage !== "idle" && generateStage !== "error") ||
    (endStage !== "idle" && endStage !== "error" && endStage !== "done");
  const hookError = generateError || endError;

  // Show errors via toast
  if (hookError) {
    toast.error(hookError);
  }

  const handleStart = useCallback(async () => {
    if (draftId) {
      // Draft already exists — skip to generate
      await generate({ attemptId, chatId: chatEntryId, chatConfig: {}, draftId });
    } else {
      // Fetch chat config, then generate
      const chat = await transport.send("/attempt/chat/get", { id: chatEntryId });
      await generate({ attemptId, chatId: chatEntryId, chatConfig: chat });
    }
  }, [attemptId, chatEntryId, draftId, generate, transport]);

  const handleUsePrevious = useCallback(async () => {
    const idx = parseInt(selectedOptionIndex, 10);
    const selected = options[idx];
    if (!selected) return;

    // Build previous_chat_map from selected option's scenarios
    const previousChatMap: Record<string, string> = {};
    for (const scenario of selected.scenarios) {
      if (scenario.chat_entry_id && scenario.attempt_chat_id) {
        previousChatMap[scenario.chat_entry_id] = scenario.attempt_chat_id;
      }
    }

    await applyPrevious({ attemptId, previousChatMap });
  }, [selectedOptionIndex, options, attemptId, applyPrevious]);

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
          disabled={isStarting}
          size="lg"
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          {isStarting ? "Starting..." : "Start Next"}
        </Button>
        {options.length > 0 && selectedOptionIndex !== "" && (
          <Button
            onClick={handleUsePrevious}
            disabled={isStarting}
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
