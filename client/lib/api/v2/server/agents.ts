/**
 * Server-side fetcher functions for agents v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import { AgentDetailResponseSchema } from "../schemas/agents";

export const fetchAgentDetail = cache(
  async (agentId: string, profileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/agents/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ agentId, profileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch agent detail");
    }

    const data = await res.json();
    return AgentDetailResponseSchema.parse(data);
  }
);

export const fetchAgentDetailDefault = cache(async (profileId: string) => {
  const res = await fetch(`${getApiBase()}/api/v2/agents/detail-default`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profileId }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Failed to fetch default agent detail: ${res.status} ${errorText}`
    );
  }

  const data = await res.json();
  return AgentDetailResponseSchema.parse(data);
});
