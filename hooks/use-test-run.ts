/**
 * useTestRun — kick off test execution for an invocation and await completion.
 *
 * Mirrors useAttemptGenerate. Sends /test/next to find the next pending run
 * within the invocation, then /test/run to execute it. Resolves on
 * `artifacts.test.run.replay_completed`, rejects on `artifacts.test.run.failed`.
 */
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransport } from "@/lib/transport/context";
import { useGroupIdOptional } from "@/contexts/group-context";

export type RunStage = "idle" | "queueing" | "running" | "ready" | "error";

export interface UseTestRunConfig {
  groupId?: string | null;
}

export interface UseTestRunReturn {
  run: (params: { testId: string; invocationId: string }) => Promise<void>;
  stage: RunStage;
  error: string | null;
}

export function useTestRun(config: UseTestRunConfig = {}): UseTestRunReturn {
  const transport = useTransport();
  const router = useRouter();
  const groupCtx = useGroupIdOptional();
  const groupId = config.groupId ?? groupCtx?.groupId ?? null;
  const [stage, setStage] = useState<RunStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (params: { testId: string; invocationId: string }) => {
      try {
        setError(null);
        setStage("queueing");

        const next = (await transport.send("/test/next", {
          test_id: params.testId,
        })) as Record<string, unknown>;
        const runId = next["run_id"] as string | undefined;
        if (!runId) {
          // Nothing to run — leave the test page to handle empty state.
          setStage("ready");
          router.push(`/test/${params.testId}`);
          router.refresh();
          return;
        }

        setStage("running");
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            unsubComplete();
            unsubFail();
            reject(new Error("Run timed out"));
          }, 120_000);

          const scope = groupId ? { groupId } : undefined;
          const unsubComplete = transport.on(
            "artifacts.test.run.replay_completed",
            (data) => {
              if (data["run_id"] !== runId) return;
              clearTimeout(timeout);
              unsubComplete();
              unsubFail();
              resolve();
            },
            scope,
          );
          const unsubFail = transport.on(
            "artifacts.test.run.failed",
            (data) => {
              clearTimeout(timeout);
              unsubComplete();
              unsubFail();
              reject(new Error((data["message"] as string) || "Run failed"));
            },
            scope,
          );

          transport
            .send("/test/run", {
              test_id: params.testId,
              test_invocation_id: params.invocationId,
              run_id: runId,
            })
            .catch((err) => {
              clearTimeout(timeout);
              unsubComplete();
              unsubFail();
              reject(err);
            });
        });

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

  return { run, stage, error };
}
