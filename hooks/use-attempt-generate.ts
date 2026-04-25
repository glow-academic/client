"use client";

import { useCallback, useState } from "react";
import { useTransport } from "@/lib/transport/context";
import { useRouter } from "next/navigation";
import { useGroupIdOptional } from "@/contexts/group-context";

export type GenerateStage = "idle" | "drafting" | "generating" | "ready" | "error";

export interface UseAttemptGenerateConfig {
  /**
   * Group id to scope SSE event subscriptions to. Required for the
   * per-(artifact, group_id) stream model — generation completion events
   * are routed to `/attempt/stream?group_id=…`. WS mode ignores it.
   * Falls back to the surrounding GroupProviderClient context if omitted.
   */
  groupId?: string | null;
}

export interface UseAttemptGenerateReturn {
  generate: (params: {
    attemptId: string;
    chatId: string;
    chatConfig: Record<string, unknown>;
    draftId?: string;
  }) => Promise<void>;
  stage: GenerateStage;
  error: string | null;
}

export function useAttemptGenerate(
  config: UseAttemptGenerateConfig = {},
): UseAttemptGenerateReturn {
  const transport = useTransport();
  const router = useRouter();
  const groupCtx = useGroupIdOptional();
  const groupId = config.groupId ?? groupCtx?.groupId ?? null;
  const [stage, setStage] = useState<GenerateStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (params: {
      attemptId: string;
      chatId: string;
      chatConfig: Record<string, unknown>;
      draftId?: string;
    }) => {
      try {
        setError(null);

        let draftId = params.draftId;

        if (!draftId) {
          // Step 1: Create draft from chat config
          setStage("drafting");
          const draftResult = await transport.send("/attempt/draft", {
            chat_id: params.chatId,
            scenario_ids: params.chatConfig["scenario_ids"],
            persona_ids: params.chatConfig["persona_ids"],
            objective_ids: params.chatConfig["objective_ids"],
            problem_statement_ids: params.chatConfig["problem_statement_ids"],
            question_ids: params.chatConfig["question_ids"],
            image_ids: params.chatConfig["image_ids"],
            video_ids: params.chatConfig["video_ids"],
            document_ids: params.chatConfig["document_ids"],
          });
          draftId = draftResult["draft_id"] as string;
        }

        // Step 2: Generate and wait for completion
        setStage("generating");
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            unsubComplete();
            unsubFail();
            reject(new Error("Generation timed out"));
          }, 120_000);

          const scope = groupId ? { groupId } : undefined;
          const unsubComplete = transport.on(
            "attempt.generate.completed",
            () => {
              clearTimeout(timeout);
              unsubComplete();
              unsubFail();
              resolve();
            },
            scope,
          );
          const unsubFail = transport.on(
            "attempt.generate.failed",
            (data) => {
              clearTimeout(timeout);
              unsubComplete();
              unsubFail();
              reject(
                new Error((data["message"] as string) || "Generation failed"),
              );
            },
            scope,
          );

          transport
            .send("/attempt/generate", {
              instructions: ["Set up this training scenario based on the draft configuration."],
              config: {
                operations: ["chat_get", "chat_create", "draft", "group"],
                params: {
                  draft_id: draftId,
                  chat_id: params.chatId,
                  attempt_id: params.attemptId,
                },
              },
            })
            .catch((err) => {
              clearTimeout(timeout);
              unsubComplete();
              unsubFail();
              reject(err);
            });
        });

        // Step 3: Navigate
        setStage("ready");
        router.push(`/attempt/${params.attemptId}`);
        router.refresh();
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [transport, router, groupId],
  );

  return { generate, stage, error };
}
