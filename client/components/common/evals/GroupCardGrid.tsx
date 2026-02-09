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

type EvalGetIn = InputOf<"/api/v4/artifacts/evals/get", "post">;
type EvalGetOut = OutputOf<"/api/v4/artifacts/evals/get", "post">;

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
    EvalGetOut["available_groups"]
  >([]);
  const [loading, setLoading] = React.useState(false);

  // Fetch groups when filters change
  React.useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true);
      try {
        // Use /evals/detail if evalId provided, otherwise /evals/new
        if (evalId) {
          const requestBody: EvalGetIn["body"] = {
            eval_id: evalId,
            group_search: searchTerm || null,
            available_model_runs_page: 1,
            available_model_runs_page_size: 50,
          };
          const response = await api.post("/artifacts/evals/get", {
            body: requestBody,
          });
          const typedResponse = response as EvalGetOut;
          setGroups(typedResponse.available_groups || []);
        } else {
          const requestBody: EvalGetIn["body"] = {
            group_search: searchTerm || null,
            available_model_runs_page: 1,
            available_model_runs_page_size: 50,
          };
          const response = await api.post("/artifacts/evals/get", {
            body: requestBody,
          });
          const typedResponse = response as EvalGetOut;
          setGroups(typedResponse.available_groups || []);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch groups:", error);
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [profileId, searchTerm, evalId]);

  // Apply search filter and sort selected first
  const filteredGroups = React.useMemo(() => {
    if (!groups) return [];
    return groups
      .filter((group) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
          group.name?.toLowerCase().includes(searchLower) ||
          group.description?.toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => {
        const aId = a.group_id || "";
        const bId = b.group_id || "";
        const aSelected = selectedGroupIds.includes(aId);
        const bSelected = selectedGroupIds.includes(bId);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        const aCreated = a.created_at || "";
        const bCreated = b.created_at || "";
        return (
          new Date(bCreated).getTime() - new Date(aCreated).getTime()
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
                  No groups found. Try adjusting your search.
                </div>
              ) : (
                filteredGroups.map((group) => {
                  const groupId = group.group_id || "";
                  const isSelected = selectedGroupIds.includes(groupId);

                  return (
                    <Tooltip key={groupId}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleSelect(groupId)}
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
                              <h3 className="font-medium text-sm mb-1 truncate">
                                {group.name || "Unnamed Group"}
                              </h3>
                              {group.description && (
                                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                  {group.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-1 mb-2">
                                {group.member_count !== undefined && group.member_count !== null && (
                                  <Badge variant="outline" className="text-xs">
                                    {group.member_count} {group.member_count === 1 ? "member" : "members"}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {group.created_at ? new Date(group.created_at).toLocaleDateString() : ""}
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

