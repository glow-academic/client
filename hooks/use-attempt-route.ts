"use client";

import { useCallback, useEffect, useState } from "react";
import { useTransport } from "@/lib/transport/context";
import { useRouter } from "next/navigation";
import {
  useAttemptGenerate,
  type GenerateStage,
} from "./use-attempt-generate";

export type RouteStage = "idle" | "loading" | "lobby" | GenerateStage | "error";

export interface UseAttemptRouteReturn {
  route: (params: { attemptId: string; chatId: string }) => Promise<void>;
  stage: RouteStage;
  error: string | null;
}

export function useAttemptRoute(): UseAttemptRouteReturn {
  const transport = useTransport();
  const router = useRouter();
  const [stage, setStage] = useState<RouteStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const generator = useAttemptGenerate();

  // Propagate child stage/error
  useEffect(() => {
    if (generator.stage !== "idle") setStage(generator.stage);
    if (generator.error) setError(generator.error);
  }, [generator.stage, generator.error]);

  const route = useCallback(
    async (params: { attemptId: string; chatId: string }) => {
      try {
        setError(null);
        setStage("loading");
        const chat = await transport.send("/attempt/chat/get", {
          chat_entry_id: params.chatId,
        });

        if (chat["is_lobby"] || chat["continuation_options"]) {
          setStage("lobby");
          router.push(`/attempt/${params.attemptId}`);
          router.refresh();
          return;
        }

        await generator.generate({
          attemptId: params.attemptId,
          chatId: params.chatId,
          chatConfig: chat,
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
