/**
 * useTestStart — composed entry point for starting a test run.
 *
 * Mirrors useAttemptStart. Calls /test/start, then hands off to useTestRoute
 * which decides between the lobby (use_custom) and direct run execution.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useTransport } from "@/lib/transport/context";
import { useTestRoute, type RouteStage } from "./use-test-route";

export type StartStage = "idle" | "starting" | RouteStage | "error";

export interface UseTestStartReturn {
  start: (opts: {
    evalId: string;
    infiniteMode?: boolean;
  }) => Promise<void>;
  stage: StartStage;
  error: string | null;
}

export function useTestStart(): UseTestStartReturn {
  const transport = useTransport();
  const [stage, setStage] = useState<StartStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const routeHook = useTestRoute();

  useEffect(() => {
    if (routeHook.stage !== "idle") setStage(routeHook.stage);
    if (routeHook.error) setError(routeHook.error);
  }, [routeHook.stage, routeHook.error]);

  const start = useCallback(
    async (opts: { evalId: string; infiniteMode?: boolean }) => {
      try {
        setError(null);
        setStage("starting");

        const result = (await transport.send("/test/start", {
          eval_id: opts.evalId,
          infinite_mode: opts.infiniteMode ?? false,
        })) as Record<string, unknown>;

        const testId = result["test_id"] as string;
        const invocationId = result["invocation_id"] as string | undefined;

        if (!invocationId) {
          // Test created but no invocations to drive — let the page render.
          setStage("idle");
          return;
        }

        await routeHook.route({ testId, invocationId });
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [transport, routeHook],
  );

  return { start, stage, error };
}
