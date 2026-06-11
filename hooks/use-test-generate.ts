/**
 * useTestGenerate — composed entry point for materializing a test_invocation.
 *
 * Mirrors useAttemptGenerate. Given a benchmark invocation template id, fires
 * /test/generate with operations=[invocation_get, invocation_create, draft, group]
 * so the LLM (Test Grade agent) materializes one test_invocation_entry per
 * call and fills its content. Awaits test.generate.{completed,failed} on the
 * SSE channel scoped to groupId.
 *
 * Inputs match the attempt parallel:
 *   - testId         (analog: attemptId)
 *   - invocationId   (analog: chatId — the benchmark template's id)
 *   - draftId        (optional, same as attempt)
 */
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransport } from "@/lib/transport/context";
import { useGroupIdOptional } from "@/contexts/group-context";

export type GenerateStage = "idle" | "drafting" | "generating" | "ready" | "error";

export interface UseTestGenerateConfig {
  /**
   * Group id to scope SSE event subscriptions to. Required for the
   * per-(artifact, group_id) stream model — generation completion events
   * are routed to `/test/watch?group_id=…`. WS mode ignores it.
   * Falls back to the surrounding GroupProviderClient context if omitted.
   */
  groupId?: string | null;
}

export interface UseTestGenerateReturn {
  generate: (params: {
    testId: string;
    invocationId: string;
    invocationConfig?: Record<string, unknown>;
    draftId?: string;
  }) => Promise<void>;
  stage: GenerateStage;
  error: string | null;
}

export function useTestGenerate(
  config: UseTestGenerateConfig = {},
): UseTestGenerateReturn {
  const transport = useTransport();
  const router = useRouter();
  const groupCtx = useGroupIdOptional();
  const groupId = config.groupId ?? groupCtx?.groupId ?? null;
  const [stage, setStage] = useState<GenerateStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (params: {
      testId: string;
      invocationId: string;
      invocationConfig?: Record<string, unknown>;
      draftId?: string;
    }) => {
      try {
        setError(null);

        let draftId = params.draftId;

        if (!draftId && params.invocationConfig) {
          // Step 1: Create the invocation draft (parallel to /attempt/draft
          // from chat config).
          //
          // Contract: POST /test/draft → PatchInvocationDraftApiRequest. It
          // does NOT accept `invocation_id`, `agent_ids`, or `rubric_ids`;
          // sending them produced an empty draft. The materialized bundle
          // (agent_ids/rubric_ids/quality/department/voice/modality) is the
          // job of /test/invocation_create — which runs as the
          // `invocation_create` operation in the agentic /test/generate loop
          // below and materializes from the template `invocation_id`,
          // inheriting its model→agent / model_rubric→rubric bundle. The
          // draft only carries the level knobs the model contract persists:
          // the plural `reasoning_level_ids` / `temperature_level_ids`
          // (added to the draft model by API #328).
          setStage("drafting");
          const cfg = params.invocationConfig;
          const draftResult = await transport.send("/test/draft", {
            reasoning_level_ids: cfg["reasoning_level_ids"],
            temperature_level_ids: cfg["temperature_level_ids"],
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
            "test.generate.completed",
            () => {
              clearTimeout(timeout);
              unsubComplete();
              unsubFail();
              resolve();
            },
            scope,
          );
          const unsubFail = transport.on(
            "test.generate.failed",
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
            .send("/test/generate", {
              instructions: [
                "Materialize this test invocation from the benchmark template.",
              ],
              config: {
                operations: [
                  "invocation_get",
                  "invocation_create",
                  "draft",
                  "title",
                ],
                params: {
                  test_id: params.testId,
                  invocation_id: params.invocationId,
                  ...(draftId ? { draft_id: draftId } : {}),
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
        router.push(`/test/${params.testId}`);
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
