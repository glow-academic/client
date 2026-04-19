"use client";

import { useCallback, useEffect, useState } from "react";
import { useTransport } from "@/lib/transport/context";
import { useAttemptRoute, type RouteStage } from "./use-attempt-route";

export type StartStage = "idle" | "starting" | RouteStage | "error";

export interface UseAttemptStartReturn {
  start: (opts: {
    practiceId?: string;
    homeId?: string;
    infiniteMode?: boolean;
  }) => Promise<void>;
  stage: StartStage;
  error: string | null;
}

export function useAttemptStart(): UseAttemptStartReturn {
  const transport = useTransport();
  const [stage, setStage] = useState<StartStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const routeHook = useAttemptRoute();

  // Propagate child stage/error
  useEffect(() => {
    if (routeHook.stage !== "idle") setStage(routeHook.stage);
    if (routeHook.error) setError(routeHook.error);
  }, [routeHook.stage, routeHook.error]);

  const start = useCallback(
    async (opts: {
      practiceId?: string;
      homeId?: string;
      infiniteMode?: boolean;
    }) => {
      try {
        setError(null);
        setStage("starting");

        const endpoint = opts.practiceId
          ? "/attempt/practice/start"
          : "/attempt/home/start";

        const result = await transport.send(endpoint, {
          ...(opts.practiceId && { practice_id: opts.practiceId }),
          ...(opts.homeId && { home_id: opts.homeId }),
          infinite_mode: opts.infiniteMode ?? false,
        });

        const attemptId = result["attempt_id"] as string;
        const chatId = result["chat_id"] as string | undefined;

        // No chat returned — end attempt immediately
        if (!chatId) {
          await transport.send("/attempt/complete", { attempt_id: attemptId });
          setStage("idle");
          return;
        }

        await routeHook.route({ attemptId, chatId });
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [transport, routeHook],
  );

  return { start, stage, error };
}
