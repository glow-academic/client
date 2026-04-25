/**
 * useTestRoute — composed routing after a test starts.
 *
 * Mirrors useAttemptRoute. Given { testId, invocationId } from /test/start,
 * fetches the invocation config; if it's `use_custom`, drops into the lobby
 * (the user fills inputs and calls /test/invocation/create). Otherwise hands
 * off to useTestRun for actual replay execution.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransport } from "@/lib/transport/context";
import { useTestRun, type RunStage } from "./use-test-run";

export type RouteStage = "idle" | "loading" | "lobby" | RunStage | "error";

export interface UseTestRouteReturn {
  route: (params: { testId: string; invocationId: string }) => Promise<void>;
  stage: RouteStage;
  error: string | null;
}

export function useTestRoute(): UseTestRouteReturn {
  const transport = useTransport();
  const router = useRouter();
  const [stage, setStage] = useState<RouteStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const runner = useTestRun();

  useEffect(() => {
    if (runner.stage !== "idle") setStage(runner.stage);
    if (runner.error) setError(runner.error);
  }, [runner.stage, runner.error]);

  const route = useCallback(
    async (params: { testId: string; invocationId: string }) => {
      try {
        setError(null);
        setStage("loading");

        const invocation = await transport.send("/test/invocation/get", {
          invocation_id: params.invocationId,
        });

        if (invocation["use_custom"]) {
          setStage("lobby");
          router.push(`/test/${params.testId}`);
          router.refresh();
          return;
        }

        await runner.run({ testId: params.testId, invocationId: params.invocationId });
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [transport, router, runner],
  );

  return { route, stage, error };
}
