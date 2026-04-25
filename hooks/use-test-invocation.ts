/**
 * useTestInvocation — create a test invocation for the use_custom flow.
 *
 * Mirrors the /attempt/chat/create path on the test side. Used when the
 * workflow pauses on a use_custom invocation and the user supplies inputs.
 */
"use client";

import { useCallback, useState } from "react";
import { useTransport } from "@/lib/transport/context";

export type CreateStage = "idle" | "creating" | "done" | "error";

export interface CreateInvocationParams {
  testId: string;
  title?: string;
  useCustom?: boolean;
  position?: number;
  agentIds?: string[];
  rubricIds?: string[];
  qualityIds?: string[];
  departmentIds?: string[];
  voiceIds?: string[];
  reasoningLevelIds?: string[];
  temperatureLevelIds?: string[];
  modalityIds?: string[];
}

export interface UseTestInvocationReturn {
  create: (params: CreateInvocationParams) => Promise<string | null>;
  stage: CreateStage;
  error: string | null;
}

export function useTestInvocation(): UseTestInvocationReturn {
  const transport = useTransport();
  const [stage, setStage] = useState<CreateStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (params: CreateInvocationParams): Promise<string | null> => {
      try {
        setError(null);
        setStage("creating");

        const result = (await transport.send("/test/invocation/create", {
          test_id: params.testId,
          title: params.title ?? "",
          use_custom: params.useCustom ?? false,
          position: params.position ?? 0,
          ...(params.agentIds && { agent_ids: params.agentIds }),
          ...(params.rubricIds && { rubric_ids: params.rubricIds }),
          ...(params.qualityIds && { quality_ids: params.qualityIds }),
          ...(params.departmentIds && { department_ids: params.departmentIds }),
          ...(params.voiceIds && { voice_ids: params.voiceIds }),
          ...(params.reasoningLevelIds && {
            reasoning_level_ids: params.reasoningLevelIds,
          }),
          ...(params.temperatureLevelIds && {
            temperature_level_ids: params.temperatureLevelIds,
          }),
          ...(params.modalityIds && { modality_ids: params.modalityIds }),
        })) as Record<string, unknown>;

        setStage("done");
        return (result["invocation_id"] as string) ?? null;
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [transport],
  );

  return { create, stage, error };
}
