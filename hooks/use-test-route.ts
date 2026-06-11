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

        // /test/invocation_get returns GetSuiteResponse — hydrated resource
        // *lists* where each item has an `id` + a `selected` boolean. It does
        // NOT expose flat `*_ids` arrays, nor `agent_ids`/`rubric_ids` (those
        // live on the materialized GetTestInvocationResponse, not the
        // template). So the draft-bound level selections must be derived from
        // the nested lists rather than read as flat top-level fields.
        const selectedIds = (key: string): string[] => {
          const list = invocation[key];
          if (!Array.isArray(list)) return [];
          return list
            .filter(
              (r): r is Record<string, unknown> =>
                !!r && typeof r === "object" && r["selected"] === true,
            )
            .map((r) => r["id"])
            .filter((id): id is string => typeof id === "string");
        };

        const invocationConfig: Record<string, unknown> = {
          reasoning_level_ids: selectedIds("reasoning_levels"),
          temperature_level_ids: selectedIds("temperature_levels"),
        };

        // `use_custom` is the benchmark template's lobby gate. GetSuiteResponse
        // now surfaces it directly (api >= 1.1.10, read from the underlying
        // test_invocation_entry.use_custom — the same source the materialized
        // GetTestInvocationResponse uses), so we read the real per-template
        // value instead of the derived fallback the #112 fix had to leave out.
        if (invocation["use_custom"] === true) {
          setStage("lobby");
          router.push(`/test/${params.testId}`);
          router.refresh();
          return;
        }

        await generator.generate({
          testId: params.testId,
          invocationId: params.invocationId,
          invocationConfig,
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
