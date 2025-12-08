/**
 * EvalForm.tsx
 * Form component for creating evals with inline layout
 */
"use client";

import type {
  CreateEvalIn,
  CreateEvalOut,
} from "@/app/(main)/engine/evals/new/page";
import type { RubricsListOut } from "@/app/(main)/engine/rubrics/page";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import type { OutputOf } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ModelRunsSelector } from "./ModelRunsSelector";

type AgentsListOut = OutputOf<"/api/v3/agents/list", "post">;

export interface EvalFormProps {
  rubricsList: RubricsListOut;
  profileId: string;
  createEvalAction: (input: CreateEvalIn) => Promise<CreateEvalOut>;
}

export function EvalForm({
  rubricsList,
  profileId,
  createEvalAction,
}: EvalFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string[]>([]);
  const [selectedRubricId, setSelectedRubricId] = useState<string[]>([]);
  const [selectedModelRunIds, setSelectedModelRunIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agentsList, setAgentsList] = useState<AgentsListOut | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Fetch agents list
  useEffect(() => {
    const fetchAgents = async () => {
      setLoadingAgents(true);
      try {
        const response = await api.post("/agents/list", {
          body: { profileId },
        });
        setAgentsList(response);
      } catch (error) {
        console.error("Failed to fetch agents:", error);
        toast.error("Failed to load agents");
      } finally {
        setLoadingAgents(false);
      }
    };
    fetchAgents();
  }, [profileId]);

  // Build agent mapping for AgentPicker
  const agentMappingForPicker = useMemo(() => {
    if (!agentsList) return {};
    return agentsList.agents.reduce(
      (acc, agent) => {
        acc[agent.agent_id] = {
          name: agent.name,
          description: agent.description,
          roles: [agent.role],
        };
        return acc;
      },
      {} as Record<
        string,
        { name: string; description: string; roles: string[] }
      >
    );
  }, [agentsList]);

  // Build agent mapping for ModelRunsSelector (simple string mapping)
  const agentMappingForRuns = useMemo(() => {
    if (!agentsList) return {};
    return agentsList.agents.reduce(
      (acc, agent) => {
        acc[agent.agent_id] = agent.name;
        return acc;
      },
      {} as Record<string, string>
    );
  }, [agentsList]);

  const validAgentIds = useMemo(() => {
    if (!agentsList) return [];
    return agentsList.agents.map((a) => a.agent_id);
  }, [agentsList]);

  // Get selected agent's role
  const selectedAgentRole = useMemo(() => {
    if (selectedAgentId.length === 0 || !agentsList) return null;
    const agent = agentsList.agents.find(
      (a) => a.agent_id === selectedAgentId[0]
    );
    return agent?.role || null;
  }, [selectedAgentId, agentsList]);

  // Filter rubrics by agent role
  const filteredRubrics = useMemo(() => {
    if (!selectedAgentRole) return rubricsList.rubrics;
    return rubricsList.rubrics.filter((rubric) => {
      return rubric.agent_role === selectedAgentRole;
    });
  }, [rubricsList.rubrics, selectedAgentRole]);

  // Build rubric mapping from filtered rubrics
  const rubricMapping = useMemo(() => {
    return filteredRubrics.reduce(
      (acc, rubric) => {
        acc[rubric.rubric_id] = {
          name: rubric.name,
          description: rubric.description,
        };
        return acc;
      },
      {} as Record<string, { name: string; description: string }>
    );
  }, [filteredRubrics]);

  const validRubricIds = filteredRubrics.map((r) => r.rubric_id);

  // Reset rubric selection when agent changes
  useEffect(() => {
    if (selectedAgentId.length === 0) {
      setSelectedRubricId([]);
    } else if (selectedRubricId.length > 0) {
      // Check if selected rubric is still valid
      const isValid = validRubricIds.includes(selectedRubricId[0]!);
      if (!isValid) {
        setSelectedRubricId([]);
      }
    }
  }, [selectedAgentId, validRubricIds, selectedRubricId]);

  const handleSubmit = async (run: boolean) => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    if (selectedAgentId.length === 0) {
      toast.error("Please select an agent");
      return;
    }
    if (selectedRubricId.length === 0) {
      toast.error("Please select a rubric");
      return;
    }
    if (selectedModelRunIds.length === 0) {
      toast.error("Please select at least one model run");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createEvalAction({
        body: {
          name: name.trim(),
          description: description.trim(),
          agent_id: selectedAgentId[0]!,
          rubric_id: selectedRubricId[0]!,
          model_run_ids: selectedModelRunIds,
          profileId: "", // Will be filled by server action
          run: false, // Always create first, then run if needed
        },
      });

      if (result.success) {
        if (run) {
          // If run flag is set, call run endpoint
          try {
            const runResult = await api.post("/evals/run", {
              body: {
                evalId: result.evalId,
                profileId: "", // Will be filled by server action
              },
            });
            if (runResult.success) {
              toast.success(`Eval "${name}" created and started successfully`);
              router.push(`/engine/evals/e/${result.evalId}`);
            } else {
              toast.success(`Eval "${name}" created successfully`);
              router.push("/engine/evals");
            }
          } catch (runError) {
            toast.error(`Eval created but failed to start: ${runError}`);
            router.push("/engine/evals");
          }
        } else {
          toast.success(`Eval "${name}" created successfully`);
          router.push("/engine/evals");
        }
      }
    } catch (error) {
      toast.error(`Failed to create eval: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 py-4 px-4">
      {/* Form Fields */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="space-y-4"
      >
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter eval name"
            disabled={isSubmitting}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter eval description"
            rows={4}
            disabled={isSubmitting}
          />
        </div>

        {/* Agent Selection */}
        <div className="space-y-2">
          <Label>Agent *</Label>
          {loadingAgents ? (
            <div className="text-sm text-muted-foreground">
              Loading agents...
            </div>
          ) : (
            <GenericPicker
              items={agentMappingForPicker}
              itemIds={validAgentIds}
              selectedIds={selectedAgentId}
              onSelect={setSelectedAgentId}
              getId={(item) => (item as unknown as { id: string }).id}
              getLabel={(item) => item.name || ""}
              getSearchText={(item) => `${item.name} ${item.description || ""}`}
              renderPreview={(item) => (
                <div className="grid gap-2">
                  <h4 className="font-medium leading-none">{item.name || "No agent selected"}</h4>
                  <div className="text-sm text-muted-foreground">
                    {item.description || "No description available"}
                  </div>
                </div>
              )}
              renderItem={(item, isSelected) => (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              multiSelect={false}
              placeholder="Select an agent..."
              disabled={isSubmitting}
              hideSelectedChips={true}
              buttonClassName="w-full"
              groupHeading="Agents"
            />
          )}
        </div>

        {/* Rubric Selection - only show if agent is selected */}
        {selectedAgentId.length > 0 && (
          <div className="space-y-2">
            <Label>Rubric *</Label>
            {filteredRubrics.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No rubrics available for the selected agent role.
              </div>
            ) : (
              <GenericPicker
                items={rubricMapping}
                itemIds={validRubricIds}
                selectedIds={selectedRubricId}
                onSelect={setSelectedRubricId}
                getId={(rubric) => (rubric as unknown as { id: string }).id}
                getLabel={(rubric) => rubric.name || ""}
                getSearchText={(rubric) =>
                  `${rubric.name} ${rubric.description || ""}`
                }
                multiSelect={false}
                placeholder="Select a rubric..."
                hideSelectedChips={true}
                disabled={isSubmitting}
                buttonClassName="w-full"
              />
            )}
          </div>
        )}

        {/* Model Runs Selection - only show if agent is selected */}
        {selectedAgentId.length > 0 && (
          <div className="space-y-2">
            <Label>Model Runs *</Label>
            <ModelRunsSelector
              profileId={profileId}
              selectedModelRunIds={selectedModelRunIds}
              onSelect={setSelectedModelRunIds}
              modelMapping={rubricsList.model_mapping || {}}
              agentMapping={agentMappingForRuns}
              agentIds={selectedAgentId}
              eval={true}
            />
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
          >
            Create
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            Create and Run
          </Button>
        </div>
      </form>
    </div>
  );
}
