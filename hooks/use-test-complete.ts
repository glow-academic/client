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
import { useGroupIdOptional } from "@/contexts/group-context";
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
  const groupCtx = useGroupIdOptional();
  const groupId = groupCtx?.groupId ?? null;
  const [stage, setStage] = useState<CompleteStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const routeHook = useTestRoute();

  useEffect(() => {
    if (routeHook.stage !== "idle") setStage(routeHook.stage);
    if (routeHook.error) setError(routeHook.error);
  }, [routeHook.stage, routeHook.error]);

  // Advance to the next test run. The server-side `test.next` impl
  // (core/app/infra/test/workflows.py :: test_next_impl) does NOT return the
  // next invocation in its ack — it drives the next group's runs directly and
  // EMITS events: a terminal client `test_all_complete` when every run is
  // done, or `test.next.error` on failure (per-run progress surfaces as
  // `test.grade.started` / `test.run.completed`, not a navigable ack id). The
  // old code read `next["invocation_id"]` off the ack, which is never present
  // — so it always fell through to the immediate-done branch. Route off the
  // emitted events instead.
  const findNextAndRoute = useCallback(
    (testId: string) =>
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          unsubComplete();
          unsubError();
          reject(new Error("Timed out waiting for the next test run"));
        }, 120_000);

        const scope = groupId ? { groupId } : undefined;
        const unsubComplete = transport.on(
          "test_all_complete",
          () => {
            clearTimeout(timeout);
            unsubComplete();
            unsubError();
            setStage("done");
            router.push(`/test/${testId}`);
            router.refresh();
            resolve();
          },
          scope,
        );
        const unsubError = transport.on(
          "test.next.error",
          (data) => {
            clearTimeout(timeout);
            unsubComplete();
            unsubError();
            reject(
              new Error(
                (data["message"] as string) ||
                  "Failed to advance to the next test run",
              ),
            );
          },
          scope,
        );

        transport
          .send("/test/next", { test_id: testId })
          .catch((err) => {
            clearTimeout(timeout);
            unsubComplete();
            unsubError();
            reject(err);
          });
      }),
    [transport, router, groupId],
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
