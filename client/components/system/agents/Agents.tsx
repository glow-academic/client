/**
 * Agents.tsx
 * Used to display the agents page.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { Brain, Edit, Thermometer } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/contexts/profile-context";
import { useAgentsList } from "@/lib/api/v2/hooks/agents";
import { useMemo } from "react";
import { AgentsDataTable } from "./AgentsDataTable";

export default function Agents() {
  const router = useRouter();
  const { effectiveProfile } = useProfile();

  // V2 API hook
  const profileId = effectiveProfile?.id || "";
  const { data: agentsData, isLoading } = useAgentsList(profileId, !!profileId);

  // Extract data from V2 response
  const agents = useMemo(() => agentsData?.agents || [], [agentsData?.agents]);
  const modelMapping = useMemo(
    () => agentsData?.model_mapping || {},
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
        label: name,
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

  const handleEdit = (id: string) => {
    router.push(`/system/agents/a/${id}`);
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEdit(agent.agent_id)}
            >
              <Edit className="h-4 w-4" />
            </Button>
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
        renderAgentCard={renderAgentCard}
      />
    </div>
  );
}
