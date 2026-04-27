/**
 * useTestStart — composed entry point for starting a test.
 *
 * Mirrors useAttemptStart exactly: calls /test/start, then hands off to
 * useTestRoute. NO direct navigation — routeHook decides whether to
 * drop into the lobby (use_custom templates) or fire useTestGenerate
 * which runs the agentic /test/generate loop and navigates only when
 * the model has materialized the row.
 *
 * Direct router.push() here would tear down the hook tree before
 * useTestGenerate gets a chance to send /test/generate — which is why
 * "deterministic only, no AI call" happens when navigation is fired
 * eagerly.
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

  // Propagate child stage/error
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

        if (!testId) {
          throw new Error("test.start did not return test_id");
        }

        // No template invocation to drive — let the page render.
        // (Mirrors attempt_start_impl returning chat_id=null when
        // there are no chat templates on the parent.)
        if (!invocationId) {
          setStage("idle");
          return;
        }

        // Hand off to useTestRoute — it inspects the template, drops to
        // lobby on use_custom, otherwise fires useTestGenerate which
        // runs /test/generate (agentic, with operations) and navigates
        // only when the model has materialized the test_invocation row.
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
