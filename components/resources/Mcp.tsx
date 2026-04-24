"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface McpOption {
  agent_id?: string | null;
  agent_name?: string | null;
  agent_description?: string | null;
}

export interface McpValue {
  id: string | null;
  agent_id: string;
}

export interface McpExisting {
  id?: string | null;
  agent_id?: string | null;
  pending?: boolean | null;
}

export interface McpProps {
  options?: McpOption[];
  value?: McpValue | null;
  existing?: McpExisting[];
  disabled?: boolean;
  onChange: (value: McpValue | null) => void;
  label?: string;
  description?: string;
  show_mcp?: boolean;
}

export function Mcp({
  options,
  value,
  existing,
  disabled = false,
  onChange,
  label = "MCP",
  description = "Pick the agent to expose as this setting's MCP server.",
  show_mcp = true,
}: McpProps) {
  const opts = useMemo(() => options ?? [], [options]);
  const selectedAgentId = value?.agent_id ?? null;

  const existingByAgent = useMemo(() => {
    const map = new Map<string, McpExisting>();
    for (const e of existing ?? []) {
      if (e.agent_id) map.set(e.agent_id, e);
    }
    return map;
  }, [existing]);

  const pendingAgents = useMemo(() => {
    const set = new Set<string>();
    for (const e of existing ?? []) {
      if (e.pending && e.agent_id) set.add(e.agent_id);
    }
    return set;
  }, [existing]);
  const showDiff = pendingAgents.size > 0;

  type GridItem = {
    id: string;
    agent_id: string;
    name: string;
    description: string | null;
  };

  const items = useMemo<GridItem[]>(
    () =>
      opts
        .filter((o) => !!o.agent_id)
        .map((o) => ({
          id: o.agent_id!,
          agent_id: o.agent_id!,
          name: o.agent_name ?? "Unnamed agent",
          description: o.agent_description ?? null,
        })),
    [opts]
  );

  const handleSelect = useCallback(
    (agentId: string) => {
      if (selectedAgentId === agentId) {
        onChange(null);
        return;
      }
      const existingId = existingByAgent.get(agentId)?.id ?? null;
      onChange({ id: existingId, agent_id: agentId });
    },
    [selectedAgentId, existingByAgent, onChange]
  );

  const handleAccept = useCallback(() => {
    // Pending mcp stays selected; next non-pending save confirms it.
  }, []);

  const handleReject = useCallback(() => {
    if (selectedAgentId && pendingAgents.has(selectedAgentId)) onChange(null);
  }, [onChange, pendingAgents, selectedAgentId]);

  if (!show_mcp) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="flex items-center gap-1">{label}</Label>
        {showDiff && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-success hover:text-success"
                    onClick={handleAccept}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Accept</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={handleReject}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reject</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          No agents available.
        </div>
      ) : (
        <SelectableGrid
          items={items}
          selectedId={selectedAgentId}
          onSelect={handleSelect}
          getId={(item) => item.agent_id}
          renderItem={(item, isSelected) => (
            <div
              className={cn(
                "rounded-md border p-3 transition-colors",
                isSelected && "border-primary bg-primary/5",
                pendingAgents.has(item.agent_id) &&
                  "ring-2 ring-success bg-success/10"
              )}
            >
              <div className="font-medium text-sm">{item.name}</div>
              {item.description ? (
                <div className="text-xs text-muted-foreground mt-1">
                  {item.description}
                </div>
              ) : null}
            </div>
          )}
          disabled={disabled}
        />
      )}
    </div>
  );
}
