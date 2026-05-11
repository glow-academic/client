/**
 * useTestComplete — complete a single invocation or the entire test, then route.
 *
 * Mirrors useAttemptEnd (without the use-previous variant — test has no
 * previous-invocation flow). Composes useTestRoute for next-invocation
 * handoff.
 *
 * API mapping (canonical, mirrors attempt):
 *   completeInvocation → POST /test/invocation/complete   (↔ /attempt/chat/complete)
 *   completeTest       → POST /test/complete              (↔ /attempt/complete)
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransport } from "@/lib/transport/context";
import { useTestRoute, type RouteStage } from "./use-test-route";

export type CompleteStage =
  | "idle"
  | "completing_invocation"
  | "completing_test"
  | RouteStage
  | "done"
  | "error";

export interface UseTestCompleteReturn {
  completeInvocation: (params: {
    testId: string;
    invocationId: string;
    message?: string;
  }) => Promise<void>;
  completeTest: (testId: string) => Promise<void>;
  stage: CompleteStage;
  error: string | null;
}

export function useTestComplete(): UseTestCompleteReturn {
  const transport = useTransport();
  const router = useRouter();
  const [stage, setStage] = useState<CompleteStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const routeHook = useTestRoute();

  useEffect(() => {
    if (routeHook.stage !== "idle") setStage(routeHook.stage);
    if (routeHook.error) setError(routeHook.error);
  }, [routeHook.stage, routeHook.error]);

  const findNextAndRoute = useCallback(
    async (testId: string) => {
      const next = (await transport.send("/test/next", {
        test_id: testId,
      })) as Record<string, unknown>;
      const invocationId = next["invocation_id"] as string | undefined;

      if (invocationId) {
        await routeHook.route({ testId, invocationId });
      } else {
        setStage("done");
        router.push(`/test/${testId}`);
        router.refresh();
      }
    },
    [transport, router, routeHook],
  );

  const completeInvocation = useCallback(
    async (params: {
      testId: string;
      invocationId: string;
      message?: string;
    }) => {
      try {
        setError(null);
        setStage("completing_invocation");
        await transport.send("/test/invocation_complete", {
          test_id: params.testId,
          test_invocation_id: params.invocationId,
          ...(params.message !== undefined && { message: params.message }),
        });
        await findNextAndRoute(params.testId);
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [transport, findNextAndRoute],
  );

  const completeTest = useCallback(
    async (testId: string) => {
      try {
        setError(null);
        setStage("completing_test");
        await transport.send("/test/complete", { test_id: testId });
        setStage("done");
        router.push(`/test/${testId}`);
        router.refresh();
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [transport, router],
  );

  return { completeInvocation, completeTest, stage, error };
}
