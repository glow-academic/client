/**
 * useTestRoute — composed routing for a single test_invocation card click.
 *
 * Mirrors useAttemptRoute. Given { testId, invocationId } where
 * invocationId is the BENCHMARK template id (the row the user clicked),
 * fetches the template; if it's `use_custom`, drops into the lobby (the
 * user fills inputs and resubmits); otherwise hands off to useTestGenerate
 * which fires /test/generate so the LLM materializes a test_invocation
 * and runs it.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransport } from "@/lib/transport/context";
import { useTestGenerate, type GenerateStage } from "./use-test-generate";

export type RouteStage = "idle" | "loading" | "lobby" | GenerateStage | "error";

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
  const generator = useTestGenerate();

  // Propagate child stage/error
  useEffect(() => {
    if (generator.stage !== "idle") setStage(generator.stage);
    if (generator.error) setError(generator.error);
  }, [generator.stage, generator.error]);

  const route = useCallback(
    async (params: { testId: string; invocationId: string }) => {
      try {
        setError(null);
        setStage("loading");

        const invocation = (await transport.send("/test/invocation_get", {
          invocation_id: params.invocationId,
        })) as Record<string, unknown>;

        if (invocation["use_custom"]) {
          setStage("lobby");
          router.push(`/test/${params.testId}`);
          router.refresh();
          return;
        }

        await generator.generate({
          testId: params.testId,
          invocationId: params.invocationId,
          invocationConfig: invocation,
        });
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [transport, router, generator],
  );

  return { route, stage, error };
}
