"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Users, Search, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";

type EvalNewIn = InputOf<"/api/v3/evals/new", "post">;
type EvalNewOut = OutputOf<"/api/v3/evals/new", "post">;
type EvalDetailIn = InputOf<"/api/v3/evals/detail", "post">;
type EvalDetailOut = OutputOf<"/api/v3/evals/detail", "post">;

export interface GroupCardGridProps {
  profileId: string;
  selectedGroupIds: string[];
  onSelect: (ids: string[]) => void;
  readonly?: boolean;
  evalId?: string; // Optional - if provided, use /evals/detail, otherwise use /evals/new
}

export function GroupCardGrid({
  profileId,
  selectedGroupIds,
  onSelect,
  readonly = false,
  evalId,
}: GroupCardGridProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [groups, setGroups] = React.useState<
    Array<{
      group_id: string;
      name: string;
      description?: string;
      created_at: string;
      member_count?: number;
    }>
  >([]);
  const [loading, setLoading] = React.useState(false);

  // TODO: Fetch groups when API endpoint is available
  // For now, this is a placeholder component
  React.useEffect(() => {
    // Placeholder - groups API not yet implemented
    setGroups([]);
    setLoading(false);
  }, [profileId, searchTerm, evalId]);

  // Apply search filter and sort selected first
  const filteredGroups = React.useMemo(() => {
    return groups
      .filter((group) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
          group.name.toLowerCase().includes(searchLower) ||
          group.description?.toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => {
        const aSelected = selectedGroupIds.includes(a.group_id);
        const bSelected = selectedGroupIds.includes(b.group_id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
  }, [groups, selectedGroupIds, searchTerm]);

  const handleSelect = (groupId: string) => {
    if (readonly) return;
    const isSelected = selectedGroupIds.includes(groupId);
    const newIds = isSelected
      ? selectedGroupIds.filter((id) => id !== groupId)
      : [...selectedGroupIds, groupId];
    onSelect(newIds);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search groups..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={readonly}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            {/* Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
              {filteredGroups.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No groups found. Groups API not yet implemented.
                </div>
              ) : (
                filteredGroups.map((group) => {
                  const isSelected = selectedGroupIds.includes(group.group_id);

                  return (
                    <Tooltip key={group.group_id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleSelect(group.group_id)}
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
                            <Users className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-1 mb-2">
                                {group.member_count !== undefined && (
                                  <Badge variant="outline" className="text-xs">
                                    {group.member_count} members
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(group.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </button>
                      </TooltipTrigger>
                    </Tooltip>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

