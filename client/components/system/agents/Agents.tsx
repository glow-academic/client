/**
 * Agents.tsx
 * Used to display the agents page.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { Brain, Copy, Edit, Thermometer } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/contexts/profile-context";
import { useAgentsList, useDuplicateAgent } from "@/lib/api/v2/hooks/agents";
import { useLogger } from "@/lib/api/v2/hooks/logs";
import { useMemo } from "react";
import { toast } from "sonner";
import { AgentsDataTable } from "./AgentsDataTable";

export default function Agents() {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const log = useLogger();  
  // V2 API hook
  const profileId = effectiveProfile?.id || "";
  const { data: agentsData, isLoading } = useAgentsList(profileId, !!profileId);
  const duplicateMutation = useDuplicateAgent();

  // Extract data from V2 response
  const agents = useMemo(() => agentsData?.agents || [], [agentsData?.agents]);
  const modelMapping = useMemo(
    () =>
      (agentsData?.model_mapping as Record<
        string,
        { name: string; description: string }
      >) || {},
    [agentsData?.model_mapping]
  );

  // Filter options (inline)
  const reasoningOptions = useMemo(
    () => [
      { value: "cot", label: "Chain of Thought" },
      { value: "none", label: "None" },
      { value: "null", label: "Not Set" },
    ],
    []
  );

  const modelOptions = useMemo(
    () =>
      Object.entries(modelMapping).map(([id, name]) => ({
        value: id,
        label: name.name,
      })),
    [modelMapping]
  );

  const temperatureOptions = useMemo(() => {
    const temps = agents.map((a) => a.temperature);
    const uniqueTemps = [...new Set(temps)].sort((a, b) => a - b);
    return uniqueTemps.map((temp) => ({
      value: temp.toString(),
      label: temp.toFixed(2),
    }));
  }, [agents]);

  // Build role options from unique agent roles
  const roleOptions = useMemo(() => {
    const roles = agents.map((a) => a.role).filter(Boolean);
    const uniqueRoles = [...new Set(roles)].sort();
    return uniqueRoles.map((role) => ({
      value: role,
      label: role,
    }));
  }, [agents]);

  // Build department options from mapping
  const departmentMapping = useMemo(
    () =>
      (agentsData?.department_mapping as Record<
        string,
        { name: string; description: string }
      >) || {},
    [agentsData?.department_mapping]
  );

  const departmentOptions = useMemo(() => {
    return Object.entries(departmentMapping).map(([id, obj]) => ({
      value: id,
      label: obj?.name || id,
    }));
  }, [departmentMapping]);

  const handleEdit = (id: string) => {
    router.push(`/system/agents/a/${id}`);
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateMutation.mutateAsync({ agentId: id });
      // Optional: show success toast
    } catch {
      log.error("agent.duplicate.failed", {
        error: new Error("Failed to duplicate agent"),
        context: { component: "Agents", function: "handleDuplicate" },
      });
      toast.error("Failed to duplicate agent");
    }
  };

  const formatTemperature = (temp: number) => {
    return temp.toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderAgentCard = (agent: (typeof agents)[0]) => (
    <Card key={agent.agent_id} className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">
                {agent.name || "Unnamed Agent"}
              </CardTitle>
              <div className="flex gap-1">
                {agent.reasoning && (
                  <Badge variant="outline" className="text-xs">
                    <Brain className="h-3 w-3 mr-1" />
                    {agent.reasoning}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  <Thermometer className="h-3 w-3 mr-1" />
                  {formatTemperature(agent.temperature)}
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {agent.description || "No description available"}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {agent.can_duplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(agent.agent_id)}
                disabled={duplicateMutation.isPending}
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
            {agent.can_edit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(agent.agent_id)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
          <span className="text-muted-foreground">Updated:</span>
          <span className="font-medium ml-2">
            {formatDate(agent.updated_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading agents...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
        <AgentsDataTable
          data={agents}
          modelMapping={modelMapping}
          reasoningOptions={reasoningOptions}
          modelOptions={modelOptions}
          temperatureOptions={temperatureOptions}
          roleOptions={roleOptions}
          departmentOptions={departmentOptions}
          renderAgentCard={renderAgentCard}
        />
    </div>
  );
}
