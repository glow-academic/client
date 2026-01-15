/**
 * AgentConfigCards.tsx
 * Container component for agent configuration cards in benchmark attempts
 * Manages draft state and fetches agent details
 */
"use client";

import { AgentConfigCard } from "./AgentConfigCard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type EvalAttemptFullOut = OutputOf<"/api/v4/attempts/benchmark/get", "post">;
type AgentsListOut = OutputOf<"/api/v4/agents/list", "post">;
type AgentDetailOut = OutputOf<"/api/v4/agents/detail", "post">;
type PatchAttemptDraftIn = InputOf<"/api/v4/attempts/draft", "patch">;
type PatchAttemptDraftOut = OutputOf<"/api/v4/attempts/draft", "patch">;

export interface AgentConfigCardsProps {
  attemptId: string;
  evalInfo: EvalAttemptFullOut["eval"];
  agentsList: AgentsListOut;
  isDynamic: boolean;
  patchAttemptDraftAction?: (input: PatchAttemptDraftIn) => Promise<PatchAttemptDraftOut>;
}

type AgentConfig = {
  model_id: string | null;
  provider_id: string | null;
  base_url: string | null;
  system_prompt: string;
  temperature_level_id: string | null;
  reasoning_level_id: string | null;
  voice_ids: string[];
};

type DraftState = {
  agent_configs: Record<string, AgentConfig>;
};

export function AgentConfigCards({
  attemptId: _attemptId,
  evalInfo,
  agentsList,
  isDynamic,
  patchAttemptDraftAction,
}: AgentConfigCardsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [agentDetails, setAgentDetails] = useState<
    Record<string, AgentDetailOut | null>
  >({});
  const [loadingAgents, setLoadingAgents] = useState<Record<string, boolean>>({});
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  // Get agent IDs from eval
  const agentIds = useMemo(() => {
    return evalInfo?.agent_ids || [];
  }, [evalInfo?.agent_ids]);

  // Get draft ID from URL
  const urlDraftId = searchParams.get("draftId") || null;
  const draftId = urlDraftId;

  // Initialize draft state from eval defaults
  // Note: Loading existing drafts would require a get draft endpoint for attempts
  // For now, drafts are created when user makes changes via autosave hook
  const initialDraftState = useMemo((): DraftState => {
    const configs: Record<string, AgentConfig> = {};

    agentIds.forEach((agentId) => {
      // Find agent in agentsList to get defaults
      const agent = (agentsList.agents ?? []).find((a) => a.agent_id === agentId);
      configs[agentId] = {
        model_id: agent?.model_id || null,
        provider_id: null,
        base_url: null,
        system_prompt: evalInfo?.system_prompt || "",
        temperature_level_id: null,
        reasoning_level_id: null,
        voice_ids: [],
      };
    });

    return {
      agent_configs: configs,
    };
  }, [agentIds, agentsList.agents, evalInfo?.system_prompt]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

  // Track previous initialDraftState to avoid unnecessary updates
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState)
  );

  useEffect(() => {
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);
    if (currentStateStr !== newStateStr) {
      prevInitialDraftStateRef.current = newStateStr;
      setDraftState(initialDraftState);
    }
  }, [initialDraftState]);

  // Fetch agent details for each agent
  useEffect(() => {
    const fetchAgentDetails = async () => {
      for (const agentId of agentIds) {
        // Skip if already fetched or currently loading
        if (agentDetails[agentId] !== undefined || loadingAgents[agentId]) {
          continue;
        }

        setLoadingAgents((prev) => ({ ...prev, [agentId]: true }));
        try {
          const detail = await api.post("/agents/detail", {
            body: { agent_id: agentId },
          });
          setAgentDetails((prev) => ({ ...prev, [agentId]: detail }));
        } catch {
          // Failed to fetch agent detail - set to null
          setAgentDetails((prev) => ({ ...prev, [agentId]: null }));
        } finally {
          setLoadingAgents((prev) => ({ ...prev, [agentId]: false }));
        }
      }
    };

    if (agentIds.length > 0) {
      fetchAgentDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentIds]); // Only depend on agentIds, not agentDetails or loadingAgents

  // Integrate autosave hook
  const { saveStatus: _saveStatus, lastSavedVersion: _lastSavedVersion } =
    useDraftAutosave({
      draftId,
      draftState,
      patchDraftAction: patchAttemptDraftAction
        ? async (input) => {
            // Transform hook API → backend API
            const result = await patchAttemptDraftAction({
              body: {
                input_draft_id: input.body.draft_id || null,
                patch: input.body.patch as Record<string, unknown>,
                expected_version: input.body.expected_version,
              } as PatchAttemptDraftIn["body"],
            });
            // Transform backend API → hook API
            return {
              draftId: result.draft_id || "",
              newVersion: result.new_version || 0,
              draftExists: result.draft_exists || false,
            };
          }
        : async () => ({ draftId: "", newVersion: 0, draftExists: false }),
      debounceMs: 1000,
      onDraftCreated: useCallback(
        (newDraftId: string) => {
          const currentUrlDraftId = searchParams.get("draftId");
          if (newDraftId === currentUrlDraftId) {
            return;
          }
          const params = new URLSearchParams(searchParams.toString());
          params.set("draftId", newDraftId);
          const newUrl = `?${params.toString()}`;
          router.replace(newUrl, { scroll: false });
          router.refresh();
        },
        [router, searchParams]
      ),
    });

  // Handle config change for a specific agent
  const handleConfigChange = useCallback(
    (agentId: string, updates: Partial<AgentConfig>) => {
      setDraftState((prev) => {
        const currentConfig = prev.agent_configs[agentId] || {
          model_id: null,
          provider_id: null,
          base_url: null,
          system_prompt: "",
          temperature_level_id: null,
          reasoning_level_id: null,
          voice_ids: [],
        };
        return {
          ...prev,
          agent_configs: {
            ...prev.agent_configs,
            [agentId]: {
              ...currentConfig,
              ...updates,
            },
          },
        };
      });
    },
    []
  );

  // Handle API key change (runtime-only, not in draft)
  const handleApiKeyChange = useCallback((agentId: string, apiKey: string) => {
    setApiKeys((prev) => ({ ...prev, [agentId]: apiKey }));
  }, []);

  // Build provider mapping from models (simplified - would need to fetch providers)
  const providerMapping = useMemo(() => {
    // For now, return empty - would need to fetch providers separately
    return {} as Record<string, { name: string; description?: string }>;
  }, []);

  const validProviderIds = useMemo(() => {
    return [] as string[];
  }, []);

  if (agentIds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No agents configured for this evaluation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {agentIds.map((agentId) => {
            const agent = (agentsList.agents ?? []).find((a) => a.agent_id === agentId);
            const agentName = agent?.name || `Agent ${agentId.substring(0, 8)}`;
            const isLoading = loadingAgents[agentId];
            const agentDetail = agentDetails[agentId] ?? null;
            const agentConfig = draftState.agent_configs[agentId] || {
              model_id: null,
              provider_id: null,
              base_url: null,
              system_prompt: "",
              temperature_level_id: null,
              reasoning_level_id: null,
              voice_ids: [],
            };
            const apiKey = apiKeys[agentId] || "";

            if (isLoading) {
              return (
                <Card key={agentId}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <AgentConfigCard
                key={agentId}
                agentId={agentId}
                agentName={agentName}
                agentDetail={agentDetail}
                agentConfig={agentConfig}
                apiKey={apiKey}
                onConfigChange={(updates) => handleConfigChange(agentId, updates)}
                onApiKeyChange={(key) => handleApiKeyChange(agentId, key)}
                isReadonly={!isDynamic}
                providerMapping={providerMapping}
                validProviderIds={validProviderIds}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

