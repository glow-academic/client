/**
 * useTestEnd — end a single invocation or the entire test, then route.
 *
 * Mirrors useAttemptEnd (without the use-previous variant — test has no
 * previous-invocation flow). Composes useTestRoute for next-invocation
 * handoff.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransport } from "@/lib/transport/context";
import { useTestRoute, type RouteStage } from "./use-test-route";

export type EndStage =
  | "idle"
  | "ending"
  | "ending_test"
  | RouteStage
  | "done"
  | "error";

export interface UseTestEndReturn {
  endInvocation: (params: {
    testId: string;
    invocationId: string;
    runId: string;
    grade?: boolean;
  }) => Promise<void>;
  endTest: (testId: string) => Promise<void>;
  stage: EndStage;
  error: string | null;
}

export function useTestEnd(): UseTestEndReturn {
  const transport = useTransport();
  const router = useRouter();
  const [stage, setStage] = useState<EndStage>("idle");
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

  const endInvocation = useCallback(
    async (params: {
      testId: string;
      invocationId: string;
      runId: string;
      grade?: boolean;
    }) => {
      try {
        setError(null);
        setStage("ending");
        await transport.send("/test/end", {
          test_id: params.testId,
          test_invocation_id: params.invocationId,
          run_id: params.runId,
          grade: params.grade ?? true,
        });
        await findNextAndRoute(params.testId);
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [transport, findNextAndRoute],
  );

  const endTest = useCallback(
    async (testId: string) => {
      try {
        setError(null);
        setStage("ending_test");
        await transport.send("/test/end", { test_id: testId });
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

  return { endInvocation, endTest, stage, error };
}
