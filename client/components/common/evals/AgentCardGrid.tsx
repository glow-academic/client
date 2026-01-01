"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Bot, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/schema";

// Extract AgentMappingItem type from schema
type AgentMappingItem =
  components["schemas"]["app__api__v4__evals__detail__AgentMappingItem"];

export interface AgentCardGridProps {
  agents: Array<{ agent_id: string; name: string; description?: string; roles?: string[] }>;
  validAgentIds: string[];
  selectedAgentIds: string[];
  onSelect: (ids: string[]) => void;
  label?: string;
  description?: string;
  readonly?: boolean;
}

export function AgentCardGrid({
  agents,
  validAgentIds,
  selectedAgentIds,
  onSelect,
  readonly = false,
}: AgentCardGridProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Build agents from array, filtered by validAgentIds
  const baseAgents = React.useMemo(() => {
    const validAgentIdsSet = new Set(validAgentIds);
    const filtered = agents
      .filter((agent) => validAgentIdsSet.has(agent.agent_id))
      .map((agent) => ({
        id: agent.agent_id,
        name: agent.name || "",
        description: agent.description,
        roles: agent.roles || [],
      }));

    // Sort by name
    return filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [agents, validAgentIds]);

  // Apply search filter, then sort selected first
  const filteredAgents = React.useMemo(() => {
    let filtered = baseAgents;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (agent) =>
          agent.name?.toLowerCase().includes(searchLower) ||
          agent.description?.toLowerCase().includes(searchLower) ||
          agent.roles?.some((role) => role.toLowerCase().includes(searchLower)),
      );
    }

    // Sort: selected agents first (preserving order from selectedAgentIds array), then unselected by name
    return filtered.sort((a, b) => {
      const aSelected = selectedAgentIds.includes(a.id);
      const bSelected = selectedAgentIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      if (aSelected && bSelected) {
        // Both selected - preserve order from selectedAgentIds array
        const aIndex = selectedAgentIds.indexOf(a.id);
        const bIndex = selectedAgentIds.indexOf(b.id);
        return aIndex - bIndex;
      }
      // Both unselected - sort by name
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [baseAgents, searchTerm, selectedAgentIds]);

  const handleSelect = (agentId: string) => {
    if (readonly) return;
    const isSelected = selectedAgentIds.includes(agentId);
    // Multiple selection: toggle this agent in the selection
    if (isSelected) {
      onSelect(selectedAgentIds.filter((id) => id !== agentId));
    } else {
      onSelect([...selectedAgentIds, agentId]);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={readonly}
          />
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
          {filteredAgents.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No agents found. Try adjusting your search or filters.
            </div>
          ) : (
            filteredAgents.map((agent) => {
              const isSelected = selectedAgentIds.includes(agent.id);

              return (
                <Tooltip key={agent.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleSelect(agent.id)}
                      disabled={readonly}
                      className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                        "hover:shadow-md hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:pointer-events-none disabled:opacity-50",
                        isSelected && "ring-2 ring-primary bg-accent",
                      )}
                    >
                      {/* Check icon - top right */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <Bot className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight">
                            {agent.name || "Unnamed Agent"}
                          </h3>
                          {agent.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {agent.description}
                            </p>
                          )}
                          {agent.roles && agent.roles.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {agent.roles.map((role) => (
                                <span
                                  key={role}
                                  className="text-xs px-1.5 py-0.5 bg-muted rounded"
                                >
                                  {role}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </TooltipTrigger>
                </Tooltip>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
