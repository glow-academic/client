/**
 * RunSelector.tsx
 * Bottom composer bar — the source of truth for which run configurations
 * get queued on the next Run. Layout: [picker] [textarea] [Run button].
 *
 * Picker uses two-axis pagination:
 *   • Outer: 10 group headers per page (Prev / Next at the bottom).
 *   • Inner: per group, expansion is URL-driven; expanded groups
 *     reveal the first N rows, with a "Show more" button to load
 *     additional row windows for that group.
 *
 * Pressing Run fans out to every run config currently selected. The
 * textarea value is one-shot extra instructions. After Run fires, the
 * parent resets the picker selection and the textarea clears.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Loader2,
  Play,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface RunSelectorRunOption {
  id: string;
  label: string;
  status?: string;
  /** Group_id used to bucket this run under the right section header. */
  group_id?: string | null;
}

export interface RunSelectorGroupHeader {
  group_id: string;
  name?: string | null;
  run_count: number;
  last_run_at?: string | null;
}

export interface RunSelectorPagination {
  /** Outer page (group headers). */
  groups_page: number;
  groups_page_size: number;
  /** Server-reported (offset + len + 1 if full page). Used as a bound
      for the Next button — exact total isn't computed for cost. */
  groups_total_bound: number;
  on_groups_page_change: (page: number) => void;

  /** Inner: which group_ids are expanded (URL-driven). */
  expanded: string[];
  on_expanded_change: (next: string[]) => void;
  /** Inner page size — bumping this shows more rows in every expanded
      group on the next SSR refetch. */
  expanded_page_size: number;
  on_expanded_page_size_change: (size: number) => void;
}

export interface RunSelectorProps {
  /** True while at least one of the selected runs is starting. */
  is_starting: boolean;
  /** Whether the parent has any selected runs to fire on. */
  has_selection: boolean;
  on_run: (extra_instructions: string) => void;
  is_connected: boolean;
  disabled?: boolean;

  /** Multi-select run picker. */
  runs?: RunSelectorRunOption[];
  /** Group section headers for the current outer page. */
  groups?: RunSelectorGroupHeader[];
  /** group_id → total rows in that group (for "Show more" math). */
  per_group_total?: Record<string, number>;
  /** Universe size — total rows across all groups (display only). */
  total_runs?: number;
  selected_run_ids?: string[];
  on_select_runs?: (ids: string[]) => void;
  pagination?: RunSelectorPagination;
}

function statusDot(status?: string) {
  if (status === "completed")
    return <CheckCircle2 className="h-3 w-3 text-green-500" />;
  if (status === "in_progress")
    return <Clock className="h-3 w-3 text-blue-500" />;
  return null;
}

function formatLastRun(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RunSelector({
  is_starting,
  has_selection,
  on_run,
  is_connected,
  disabled,
  runs = [],
  groups = [],
  per_group_total = {},
  total_runs,
  selected_run_ids = [],
  on_select_runs,
  pagination,
}: RunSelectorProps) {
  const [text, setText] = useState("");

  const handleRun = useCallback(() => {
    on_run(text);
    setText("");
  }, [on_run, text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!disabled && is_connected && has_selection && !is_starting) {
          handleRun();
        }
      }
    },
    [disabled, is_connected, has_selection, is_starting, handleRun],
  );

  const selectedSet = new Set(selected_run_ids);
  const selectedCount = selected_run_ids.length;
  const totalCount = total_runs ?? runs.length;
  const noneSelected = selectedCount === 0;

  // Bucket loaded rows by group_id for accordion render.
  const runsByGroup = useMemo(() => {
    const map = new Map<string, RunSelectorRunOption[]>();
    for (const r of runs) {
      const gid = r.group_id ?? "__ungrouped__";
      const list = map.get(gid) ?? [];
      list.push(r);
      map.set(gid, list);
    }
    return map;
  }, [runs]);

  const expandedSet = useMemo(
    () => new Set(pagination?.expanded ?? []),
    [pagination?.expanded],
  );

  const toggleGroup = useCallback(
    (gid: string) => {
      if (!pagination) return;
      const next = expandedSet.has(gid)
        ? (pagination.expanded ?? []).filter((x) => x !== gid)
        : [...(pagination.expanded ?? []), gid];
      pagination.on_expanded_change(next);
    },
    [pagination, expandedSet],
  );

  const toggle = (id: string) => {
    if (!on_select_runs) return;
    on_select_runs(
      selectedSet.has(id)
        ? selected_run_ids.filter((x) => x !== id)
        : [...selected_run_ids, id],
    );
  };

  const clearAll = () => on_select_runs?.([]);

  const runDisabled =
    disabled || !is_connected || !has_selection || is_starting;

  const groupsPage = pagination?.groups_page ?? 1;
  const groupsPageSize = pagination?.groups_page_size ?? 10;
  const groupsTotalBound = pagination?.groups_total_bound ?? groups.length;
  const canPrev = groupsPage > 1;
  // Next is enabled if the server suggested there might be more (bound
  // exceeds what we'd have on a fully-consumed page).
  const canNext = groupsPage * groupsPageSize < groupsTotalBound;

  const expandedPageSize = pagination?.expanded_page_size ?? 20;

  return (
    <div className="flex items-end gap-2 px-4 py-2 border-t bg-card">
      {/* Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-[44px] gap-2"
            disabled={disabled || groups.length === 0}
          >
            <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">
              {groups.length === 0
                ? "No configs"
                : noneSelected
                  ? "Select runs"
                  : `${selectedCount} selected`}
            </span>
            {selectedCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {selectedCount}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          className="w-[420px] p-0 flex flex-col max-h-[520px] overflow-hidden"
        >
          {/* Sticky header */}
          <div className="flex items-center justify-between border-b px-3 py-2 flex-shrink-0">
            <span className="text-xs font-medium">
              {selectedCount} selected
              {totalCount > 0 ? ` · ${totalCount} runs` : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={clearAll}
              disabled={noneSelected}
            >
              Clear
            </Button>
          </div>

          {/* Body — flex-1 + min-h-0 + plain overflow div for reliable scroll. */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-1">
              {groups.length === 0 ? (
                <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                  No groups on this page.
                </div>
              ) : (
                groups.map((section) => {
                  const expanded = expandedSet.has(section.group_id);
                  const items = runsByGroup.get(section.group_id) ?? [];
                  const sectionSelected = items.filter((r) =>
                    selectedSet.has(r.id),
                  ).length;
                  const totalInGroup =
                    per_group_total[section.group_id] ?? section.run_count;
                  const lastRun = formatLastRun(section.last_run_at);
                  const showMoreVisible =
                    expanded && items.length < totalInGroup;
                  return (
                    <div key={section.group_id} className="mb-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleGroup(section.group_id)}
                          className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted text-left min-w-0"
                        >
                          {expanded ? (
                            <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {section.name ||
                                `Group ${section.group_id.slice(0, 8)}`}
                            </div>
                            {lastRun && (
                              <div className="text-[10px] text-muted-foreground truncate">
                                Last run · {lastRun}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {sectionSelected > 0
                              ? `${sectionSelected}/${totalInGroup}`
                              : `${totalInGroup}`}
                          </span>
                        </button>
                        {/* Per-section bulk toggle — only meaningful for
                            already-loaded rows. */}
                        {expanded && items.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!on_select_runs) return;
                              const sectionIds = items.map((r) => r.id);
                              const allInSection = sectionIds.every((id) =>
                                selectedSet.has(id),
                              );
                              if (allInSection) {
                                on_select_runs(
                                  selected_run_ids.filter(
                                    (id) => !sectionIds.includes(id),
                                  ),
                                );
                              } else {
                                on_select_runs(
                                  Array.from(
                                    new Set([
                                      ...selected_run_ids,
                                      ...sectionIds,
                                    ]),
                                  ),
                                );
                              }
                            }}
                            className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm flex-shrink-0"
                            title="Toggle all loaded rows in section"
                          >
                            {items.every((r) => selectedSet.has(r.id))
                              ? "−"
                              : "+"}
                          </button>
                        )}
                      </div>
                      {expanded && (
                        <div className="pl-4">
                          {items.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                              Loading…
                            </div>
                          ) : (
                            items.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => toggle(r.id)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted text-left"
                              >
                                <Checkbox
                                  checked={selectedSet.has(r.id)}
                                  onCheckedChange={() => toggle(r.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="flex-1 text-sm truncate">
                                  {r.label}
                                </span>
                                {statusDot(r.status)}
                              </button>
                            ))
                          )}
                          {showMoreVisible && pagination && (
                            <button
                              type="button"
                              onClick={() =>
                                pagination.on_expanded_page_size_change(
                                  expandedPageSize + 20,
                                )
                              }
                              className="w-full text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 text-left"
                            >
                              Show more ({totalInGroup - items.length} remaining)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Outer (groups) pagination footer */}
          {pagination && (canPrev || canNext) && (
            <div className="flex items-center justify-between border-t px-3 py-2 flex-shrink-0">
              <span className="text-xs text-muted-foreground">
                Groups · page {groupsPage}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() =>
                    pagination.on_groups_page_change(groupsPage - 1)
                  }
                  disabled={!canPrev}
                >
                  Prev
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() =>
                    pagination.on_groups_page_change(groupsPage + 1)
                  }
                  disabled={!canNext}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Middle: optional extra instructions */}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          has_selection
            ? "Optional extra instructions for this round… (Cmd/Ctrl+Enter to run)"
            : "Select run configs from the picker to queue."
        }
        disabled={disabled || !has_selection}
        className="min-h-[44px] max-h-[140px] text-sm resize-none flex-1"
      />

      {/* Right: Run button */}
      <Button
        onClick={handleRun}
        size="sm"
        disabled={runDisabled}
        className="h-[44px]"
      >
        {is_starting ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Play className="h-3 w-3 mr-1" />
            Run
          </>
        )}
      </Button>
    </div>
  );
}
