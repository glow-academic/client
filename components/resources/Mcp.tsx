/**
 * Mcp.tsx — canonical mcp picker.
 *
 * Shows every existing mcp_resource row as a selectable card (single-select
 * — one MCP config per setting) plus a collapsible `+ New MCP` form that
 * appends a draft to the value-array. Same shape as StandardGroups /
 * Logins:
 *   - `mcp`: full catalog (server's existing mcp_resource rows)
 *   - `mcp_id`: currently-attached id
 *   - `onChange(id)`: parent updates mcp_id
 *   - `onCreate(draft)`: parent appends {id: null, ...} to the value-array
 */
"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Server, X } from "lucide-react";
import { Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface McpResource {
  mcp_id?: string | null;
  agent_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface McpAgent {
  agent_id?: string | null;
  name?: string | null;
  description?: string | null;
}

export interface McpDraft {
  agent_id: string;
  name: string;
  description: string;
}

export interface McpProps {
  mcp_id?: string | null;
  mcp?: McpResource[];
  agents?: McpAgent[];
  disabled?: boolean;
  onChange: (id: string | null) => void;
  onCreate?: (draft: McpDraft) => void;
  label?: string;
  description?: string;
  show_mcp?: boolean;
  /** Per-field pending lifecycle (single-value). See Instructions.tsx. */
  onAcceptPending?: (pendingId: string) => void;
  onRejectPending?: (pendingId: string) => void;
}

type GridItem = {
  id: string;
  name: string;
  description: string | null;
  agent_name: string | null;
  suggested: boolean;
  pending: boolean;
};

export function Mcp({
  mcp_id,
  mcp,
  agents,
  disabled = false,
  onChange,
  onCreate,
  label = "MCP",
  description = "Pick the agent exposed as this setting's MCP server.",
  show_mcp = true,
  onAcceptPending,
  onRejectPending,
}: McpProps) {
  const selectedId = mcp_id ?? null;
  const catalog = useMemo(() => mcp ?? [], [mcp]);
  const agentsList = useMemo(() => agents ?? [], [agents]);

  // Inline-create form state (mirrors StandardGroups / Logins pattern).
  const [createOpen, setCreateOpen] = useState(false);
  const [draftAgentId, setDraftAgentId] = useState<string>("");
  const [draftName, setDraftName] = useState<string>("");
  const [draftDescription, setDraftDescription] = useState<string>("");

  const resetDraft = useCallback(() => {
    setDraftAgentId("");
    setDraftName("");
    setDraftDescription("");
  }, []);

  const agentLookup = useMemo(() => {
    const map = new Map<string, McpAgent>();
    for (const a of agentsList) {
      if (a.agent_id) map.set(a.agent_id, a);
    }
    return map;
  }, [agentsList]);

  const gridItems = useMemo<GridItem[]>(
    () =>
      catalog
        .filter((m) => m.mcp_id)
        .map((m) => {
          const agent = m.agent_id ? agentLookup.get(m.agent_id) : null;
          return {
            id: m.mcp_id!,
            name: m.name?.trim() || agent?.name || "Unnamed MCP",
            description: m.description?.trim() || agent?.description || null,
            agent_name: agent?.name ?? null,
            suggested: m.suggested ?? false,
            pending: m.pending ?? false,
          };
        }),
    [catalog, agentLookup]
  );

  const pendingIds = useMemo(
    () => new Set(gridItems.filter((g) => g.pending).map((g) => g.id)),
    [gridItems]
  );
  const showDiff = pendingIds.size > 0;

  const handleSelect = useCallback(
    (id: string) => {
      onChange(selectedId === id ? null : id);
    },
    [selectedId, onChange]
  );

  const handleAccept = useCallback(() => {
    // Pending mcp row is already selected (if selected); next save confirms.
    if (onAcceptPending && selectedId && pendingIds.has(selectedId)) {
      onAcceptPending(selectedId);
    }
  }, [onAcceptPending, selectedId, pendingIds]);
  const handleReject = useCallback(() => {
    if (selectedId && pendingIds.has(selectedId)) {
      if (onRejectPending) {
        onRejectPending(selectedId);
        return;
      }
      onChange(null);
    }
  }, [selectedId, pendingIds, onChange, onRejectPending]);

  const handleCreateSubmit = useCallback(() => {
    if (!onCreate || !draftAgentId) return;
    const fallbackName = agentLookup.get(draftAgentId)?.name ?? "";
    onCreate({
      agent_id: draftAgentId,
      name: draftName.trim() || fallbackName,
      description: draftDescription.trim(),
    });
    resetDraft();
    setCreateOpen(false);
  }, [
    onCreate,
    draftAgentId,
    draftName,
    draftDescription,
    agentLookup,
    resetDraft,
  ]);

  if (!show_mcp) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {label && <Label className="flex items-center gap-1">{label}</Label>}
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
        {onCreate && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setCreateOpen((v) => !v)}
            disabled={disabled}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {createOpen ? "Cancel" : "New MCP"}
          </Button>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {onCreate && createOpen && (
        <div className="rounded-md border bg-card p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Agent</Label>
              <Select
                value={draftAgentId}
                onValueChange={setDraftAgentId}
                disabled={disabled}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select agent…" />
                </SelectTrigger>
                <SelectContent>
                  {agentsList
                    .filter((a) => a.agent_id && a.name)
                    .map((a) => (
                      <SelectItem key={a.agent_id!} value={a.agent_id!}>
                        {a.name!}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Defaults to agent name"
                disabled={disabled}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Optional"
                disabled={disabled}
                className="min-h-[32px] h-8 resize-y text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                resetDraft();
                setCreateOpen(false);
              }}
              disabled={disabled}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateSubmit}
              disabled={disabled || !draftAgentId}
            >
              Add MCP
            </Button>
          </div>
        </div>
      )}

      {gridItems.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          {onCreate
            ? "No MCP configs yet. Use + New MCP to add one."
            : "No MCP configs available."}
        </div>
      ) : (
        <SelectableGrid<GridItem>
          horizontal
          items={gridItems}
          selectedId={selectedId}
          onSelect={handleSelect}
          getId={(item) => item.id}
          renderItem={(item, isSelected) => {
            const isPending = pendingIds.has(item.id);
            return (
              <div
                className={cn(
                  "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition-all",
                  "hover:shadow-md hover:bg-accent/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSelected && !isPending && "ring-2 ring-primary bg-accent",
                  isPending && "ring-2 ring-success bg-success/10"
                )}
              >
                {isSelected && !isPending && (
                  <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
                {isPending && (
                  <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                    Pending
                  </div>
                )}
                {!isSelected && !isPending && item.suggested && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                      </TooltipTrigger>
                      <TooltipContent side="top">Suggested</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {item.name}
                    </div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </div>
                    )}
                    {item.agent_name && item.agent_name !== item.name && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Agent: {item.agent_name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }}
          disabled={disabled}
        />
      )}
    </div>
  );
}
