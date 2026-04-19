"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTransport } from "@/lib/transport/context";
import { useRouter } from "next/navigation";
import { useAttemptRoute, type RouteStage } from "./use-attempt-route";

export type EndStage =
  | "idle"
  | "grading"
  | "ending"
  | "copying"
  | "ending_attempt"
  | RouteStage
  | "done"
  | "error";

export interface UseAttemptEndReturn {
  /** Trigger AI grading on a chat. Optionally chain into endChat on completion. */
  grade: (params: {
    attemptId: string;
    chatId: string;
    endAfter?: boolean;
  }) => Promise<void>;

  /** End a single chat. Finds next chat — routes or ends attempt if none left. */
  endChat: (params: { attemptId: string; chatId: string }) => Promise<void>;

  /** End the entire attempt immediately (early exit). */
  endAttempt: (attemptId: string) => Promise<void>;

  /** Copy grades from previous chats, then chain into endChat-like routing. */
  usePrevious: (params: {
    attemptId: string;
    previousChatMap: Record<string, string>;
  }) => Promise<void>;

  stage: EndStage;
  error: string | null;
}

export function useAttemptEnd(): UseAttemptEndReturn {
  const transport = useTransport();
  const router = useRouter();
  const [stage, setStage] = useState<EndStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const routeHook = useAttemptRoute();

  // Propagate child stage/error
  useEffect(() => {
    if (routeHook.stage !== "idle") setStage(routeHook.stage);
    if (routeHook.error) setError(routeHook.error);
  }, [routeHook.stage, routeHook.error]);

  // Ref so grade can call endChat without circular dep
  const endChatRef = useRef<
    ((params: { attemptId: string; chatId: string }) => Promise<void>) | undefined
  >(undefined);

  // ── grade: trigger AI grading, optionally chain to endChat ──

  const grade = useCallback(
    async (params: {
      attemptId: string;
      chatId: string;
      endAfter?: boolean;
    }) => {
      try {
        setError(null);
        setStage("grading");

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            unsubComplete();
            unsubFail();
            reject(new Error("Grading timed out"));
          }, 120_000);

          const unsubComplete = transport.on(
            "attempt.chat_grade.completed",
            (data) => {
              if (data["chat_id"] !== params.chatId) return;
              clearTimeout(timeout);
              unsubComplete();
              unsubFail();
              resolve();
            },
          );
          const unsubFail = transport.on(
            "attempt.chat_grade.failed",
            (data) => {
              if (data["chat_id"] !== params.chatId) return;
              clearTimeout(timeout);
              unsubComplete();
              unsubFail();
              reject(
                new Error((data["message"] as string) || "Grading failed"),
              );
            },
          );

          transport
            .send("/attempt/generate", {
              instructions: ["Grade this attempt chat based on the rubric and conversation."],
              config: {
                operations: ["chat_grade", "chat_feedback", "chat_strengths", "chat_improvements", "chat_analyses", "chat_complete", "get"],
                params: {
                  attempt_id: params.attemptId,
                  chat_id: params.chatId,
                },
              },
            })
            .catch((err) => {
              clearTimeout(timeout);
              unsubComplete();
              unsubFail();
              reject(err);
            });
        });

        // Chain to endChat if requested
        if (params.endAfter) {
          await endChatRef.current?.({
            attemptId: params.attemptId,
            chatId: params.chatId,
          });
        } else {
          setStage("idle"); // Grade done, chat still active
        }
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [transport],
  );

  // ── Helper: find next pending chat and route or end attempt ──

  const findNextAndRoute = useCallback(
    async (attemptId: string) => {
      const attempt = await transport.send("/attempt/get", {
        attempt_id: attemptId,
      });

      const nextChatEntryId = attempt["next_chat_entry_id"] as
        | string
        | undefined;

      if (nextChatEntryId) {
        await routeHook.route({
          attemptId,
          chatId: nextChatEntryId,
        });
      } else {
        // All chats completed — navigate to results
        setStage("done");
        router.push(`/attempt/${attemptId}`);
        router.refresh();
      }
    },
    [transport, router, routeHook],
  );

  // ── endChat: complete chat → find next → route or end attempt ──

  const endChat = useCallback(
    async (params: { attemptId: string; chatId: string }) => {
      try {
        setStage("ending");
        // Mark the chat as completed (idempotent — safe if grading already did this)
        await transport.send("/attempt/chat/complete", {
          chat_id: params.chatId,
        });
        await findNextAndRoute(params.attemptId);
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [transport, findNextAndRoute],
  );

  // Wire up ref so grade can call endChat
  endChatRef.current = endChat;

  // ── endAttempt: end entire attempt immediately ──

  const endAttempt = useCallback(
    async (attemptId: string) => {
      try {
        setError(null);
        setStage("ending_attempt");
        await transport.send("/attempt/complete", { attempt_id: attemptId });
        setStage("done");
        router.push(`/attempt/${attemptId}`);
        router.refresh();
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [transport, router],
  );

  // ── usePrevious: copy grades → find next → route ──

  const usePrevious = useCallback(
    async (params: {
      attemptId: string;
      previousChatMap: Record<string, string>;
    }) => {
      try {
        setError(null);
        setStage("copying");
        await transport.send("/attempt/previous", {
          attempt_id: params.attemptId,
          previous_chat_map: params.previousChatMap,
        });
        await findNextAndRoute(params.attemptId);
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [transport, findNextAndRoute],
  );

  return { grade, endChat, endAttempt, usePrevious, stage, error };
}
