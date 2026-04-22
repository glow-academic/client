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

export interface McpResourceItem {
  mcp_id?: string | null;
  agent_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
}

type AgentOption = {
  agent_id?: string | null;
  name?: string | null;
  description?: string | null;
};

export interface McpProps {
  mcp_id?: string | null;
  mcp?: McpResourceItem[];
  agents?: AgentOption[];
  show_mcp?: boolean;
  disabled?: boolean;
  onChange: (id: string | null) => void;
  label?: string;
  description?: string;
}

export function Mcp({
  mcp_id,
  mcp,
  agents,
  show_mcp = true,
  disabled = false,
  onChange,
  label = "MCP",
  description = "Pick the agent to expose as this setting's MCP server.",
}: McpProps) {
  const selectedId = mcp_id ?? null;
  const allMcp = useMemo(() => mcp ?? [], [mcp]);

  const agentLookup = useMemo(() => {
    const map = new Map<string, AgentOption>();
    (agents ?? []).forEach((a) => {
      if (a.agent_id) map.set(a.agent_id, a);
    });
    return map;
  }, [agents]);

  const pendingIds = useMemo(
    () =>
      new Set(
        allMcp
          .filter((item) => item.pending && item.mcp_id)
          .map((item) => item.mcp_id as string)
      ),
    [allMcp]
  );
  const showDiff = pendingIds.size > 0;

  type GridItem = {
    id: string;
    name: string;
    description: string | null;
    agentName: string | null;
    suggested: boolean;
  };

  const items = useMemo<GridItem[]>(
    () =>
      allMcp
        .filter((item) => item.mcp_id)
        .map((item) => {
          const agent = item.agent_id ? agentLookup.get(item.agent_id) : null;
          return {
            id: item.mcp_id!,
            name: item.name || agent?.name || "Unnamed MCP",
            description: item.description || agent?.description || null,
            agentName: agent?.name ?? null,
            suggested: !!item.suggested,
          };
        }),
    [allMcp, agentLookup]
  );

  const handleSelect = useCallback(
    (id: string) => {
      onChange(selectedId === id ? null : id);
    },
    [selectedId, onChange]
  );

  const handleAccept = useCallback(() => {
    // Pending mcp stays selected; next non-pending save confirms it.
  }, []);

  const handleReject = useCallback(() => {
    if (selectedId && pendingIds.has(selectedId)) onChange(null);
  }, [onChange, pendingIds, selectedId]);

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
          No MCP configs available.
        </div>
      ) : (
        <SelectableGrid
          items={items}
          selectedId={selectedId}
          onSelect={handleSelect}
          getId={(item) => item.id}
          renderItem={(item, isSelected) => (
            <div
              className={cn(
                "rounded-md border p-3 transition-colors",
                isSelected && "border-primary bg-primary/5",
                pendingIds.has(item.id) && "ring-2 ring-success bg-success/10"
              )}
            >
              <div className="font-medium text-sm">{item.name}</div>
              {item.description ? (
                <div className="text-xs text-muted-foreground mt-1">
                  {item.description}
                </div>
              ) : null}
              {item.agentName && item.agentName !== item.name ? (
                <div className="text-[10px] text-muted-foreground mt-1">
                  Agent: {item.agentName}
                </div>
              ) : null}
              {item.suggested ? (
                <div className="text-[10px] uppercase tracking-wide text-primary mt-2">
                  Suggested
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
