/**
 * Agents.tsx
 * Used to display the agents page.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { useQuery } from "@tanstack/react-query";
import { Bot, Brain, Edit, Thermometer } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Agent } from "@/types";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { AgentsDataTable } from "./AgentsDataTable";
import { useAgentColumns } from "@/hooks/use-agent-columns";

export default function Agents() {
  const router = useRouter();

  // Fetch agents data
  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  // Get table columns and filter options
  const { columns, reasoningOptions, modelOptions, temperatureOptions } =
    useAgentColumns();

  const handleEdit = (id: string) => {
    router.push(`/system/agents/a/${id}`);
  };

  const formatTemperature = (temp: number) => {
    return (temp / 100).toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderAgentCard = (agent: Agent) => (
    <Card key={agent.id} className="hover:shadow-md transition-shadow">
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
              onClick={() => handleEdit(agent.id)}
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
            {formatDate(agent.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <AgentsDataTable
        columns={columns}
        data={agents}
        reasoningOptions={reasoningOptions}
        modelOptions={modelOptions}
        temperatureOptions={temperatureOptions}
        renderAgentCard={renderAgentCard}
      />
    </div>
  );
}
