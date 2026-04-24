/**
 * Systems.tsx — canonical systems picker.
 *
 * Shows every existing systems_resource row as a selectable card (multi-
 * select — a setting can attach multiple systems) plus a collapsible
 * `+ New system` form that appends a draft to the value-array. Same
 * shape as Logins / StandardGroups:
 *   - `systems`: full catalog (server's existing systems_resource rows)
 *   - `system_ids`: currently-attached ids
 *   - `onChange(ids)`: parent updates system_ids
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
import { Check, Network, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface SystemResource {
  system_id?: string | null;
  name?: string | null;
  description?: string | null;
  agent_ids?: string[] | null;
  resolution_strategy?: string | null;
  resolution_threshold?: number | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface SystemAgent {
  agent_id?: string | null;
  name?: string | null;
  description?: string | null;
}

export interface SystemDraft {
  name: string;
  description: string;
  agent_ids: string[];
  resolution_strategy: string | null;
  resolution_threshold: number | null;
}

export interface SystemsProps {
  system_ids?: string[];
  systems?: SystemResource[];
  agents?: SystemAgent[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  onCreate?: (draft: SystemDraft) => void;
  label?: string;
  description?: string;
  show_systems?: boolean;
}

type GridItem = {
  id: string;
  name: string;
  description: string | null;
  agent_names: string[];
  strategy: string | null;
  threshold: number | null;
  suggested: boolean;
  pending: boolean;
};

export function Systems({
  system_ids,
  systems,
  agents,
  disabled = false,
  onChange,
  onCreate,
  label = "Systems",
  description = "Agents that route requests within this setting.",
  show_systems = true,
}: SystemsProps) {
  const ids = useMemo(() => system_ids ?? [], [system_ids]);
  const catalog = useMemo(() => systems ?? [], [systems]);
  const agentsList = useMemo(() => agents ?? [], [agents]);

  // Inline-create form state.
  const [createOpen, setCreateOpen] = useState(false);
  const [draftName, setDraftName] = useState<string>("");
  const [draftDescription, setDraftDescription] = useState<string>("");
  const [draftAgentIds, setDraftAgentIds] = useState<string[]>([]);
  const [draftStrategy, setDraftStrategy] = useState<string>("");
  const [draftThreshold, setDraftThreshold] = useState<string>("");

  const resetDraft = useCallback(() => {
    setDraftName("");
    setDraftDescription("");
    setDraftAgentIds([]);
    setDraftStrategy("");
    setDraftThreshold("");
  }, []);

  const agentLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agentsList) {
      if (a.agent_id && a.name) map.set(a.agent_id, a.name);
    }
    return map;
  }, [agentsList]);

  const gridItems = useMemo<GridItem[]>(
    () =>
      catalog
        .filter((s) => s.system_id)
        .map((s) => ({
          id: s.system_id!,
          name: s.name?.trim() || "Unnamed system",
          description: s.description?.trim() || null,
          agent_names:
            (s.agent_ids ?? [])
              .map((aid) => agentLookup.get(aid))
              .filter((n): n is string => !!n),
          strategy: s.resolution_strategy ?? null,
          threshold: s.resolution_threshold ?? null,
          suggested: s.suggested ?? false,
          pending: s.pending ?? false,
        })),
    [catalog, agentLookup]
  );

  const pendingIds = useMemo(
    () => new Set(gridItems.filter((g) => g.pending).map((g) => g.id)),
    [gridItems]
  );
  const showDiff = pendingIds.size > 0;

  const handleToggle = useCallback(
    (id: string) => {
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      onChange(next);
    },
    [ids, onChange]
  );

  const handleAccept = useCallback(() => {
    // Pending rows stay selected; next non-pending save confirms them.
  }, []);
  const handleReject = useCallback(() => {
    onChange(ids.filter((id) => !pendingIds.has(id)));
  }, [ids, pendingIds, onChange]);

  const toggleDraftAgent = useCallback((agentId: string) => {
    setDraftAgentIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((x) => x !== agentId)
        : [...prev, agentId]
    );
  }, []);

  const canSubmit = draftName.trim().length > 0;

  const handleCreateSubmit = useCallback(() => {
    if (!onCreate || !canSubmit) return;
    const parsedThreshold = draftThreshold.trim()
      ? Number.parseFloat(draftThreshold)
      : NaN;
    onCreate({
      name: draftName.trim(),
      description: draftDescription.trim(),
      agent_ids: draftAgentIds,
      resolution_strategy: draftStrategy.trim() || null,
      resolution_threshold: Number.isFinite(parsedThreshold)
        ? parsedThreshold
        : null,
    });
    resetDraft();
    setCreateOpen(false);
  }, [
    onCreate,
    canSubmit,
    draftName,
    draftDescription,
    draftAgentIds,
    draftStrategy,
    draftThreshold,
    resetDraft,
  ]);

  if (!show_systems) return null;

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
            {createOpen ? "Cancel" : "New system"}
          </Button>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {onCreate && createOpen && (
        <div className="rounded-md border bg-card p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. Eval System"
                disabled={disabled}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Resolution strategy</Label>
              <Select
                value={draftStrategy || "__none__"}
                onValueChange={(v) =>
                  setDraftStrategy(v === "__none__" ? "" : v)
                }
                disabled={disabled}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Default</SelectItem>
                  <SelectItem value="first">First match</SelectItem>
                  <SelectItem value="best">Best score</SelectItem>
                  <SelectItem value="all">All above threshold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="What this system routes"
                disabled={disabled}
                className="min-h-[32px] h-8 resize-y text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Resolution threshold
                <span className="text-muted-foreground ml-1">(0–1)</span>
              </Label>
              <Input
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={draftThreshold}
                onChange={(e) => setDraftThreshold(e.target.value)}
                placeholder="e.g. 0.7"
                disabled={disabled}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Agents
                {draftAgentIds.length > 0 && (
                  <span className="text-muted-foreground ml-1">
                    ({draftAgentIds.length})
                  </span>
                )}
              </Label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-auto rounded border p-1">
                {agentsList
                  .filter((a) => a.agent_id && a.name)
                  .map((a) => {
                    const selected = draftAgentIds.includes(a.agent_id!);
                    return (
                      <Button
                        key={a.agent_id!}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => toggleDraftAgent(a.agent_id!)}
                        disabled={disabled}
                      >
                        {a.name}
                      </Button>
                    );
                  })}
                {agentsList.length === 0 && (
                  <span className="text-xs text-muted-foreground py-1">
                    No agents available.
                  </span>
                )}
              </div>
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
              disabled={disabled || !canSubmit}
            >
              Add system
            </Button>
          </div>
        </div>
      )}

      {gridItems.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          {onCreate
            ? "No systems yet. Use + New system to add one."
            : "No systems available."}
        </div>
      ) : (
        <SelectableGrid<GridItem>
          horizontal
          items={gridItems}
          selectedId={null}
          selectedIds={ids}
          onSelect={handleToggle}
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
                <div className="flex items-start gap-2">
                  <Network className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {item.name}
                    </div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {item.description}
                      </div>
                    )}
                    {item.agent_names.length > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-1 truncate">
                        Agents: {item.agent_names.join(", ")}
                      </div>
                    )}
                    {(item.strategy || item.threshold !== null) && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {item.strategy ? `Strategy: ${item.strategy}` : ""}
                        {item.strategy && item.threshold !== null ? " · " : ""}
                        {item.threshold !== null
                          ? `Threshold: ${item.threshold}`
                          : ""}
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
