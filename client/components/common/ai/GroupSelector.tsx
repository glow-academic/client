"use client";

import { useCallback, useEffect, useState } from "react";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import type {
  SearchGroupsIn,
  SearchGroupsOut,
} from "@/app/(main)/layout-server";

interface GroupItem {
  group_id?: string | null;
  trace_id?: string | null;
  group_name?: string | null;
  group_created_at?: string | null;
}

interface GroupSelectorProps {
  selectedGroupId: string | null;
  onSelect: (groupId: string | null) => void;
  searchGroupsAction: (input: SearchGroupsIn) => Promise<SearchGroupsOut>;
}

export function GroupSelector({
  selectedGroupId,
  onSelect,
  searchGroupsAction,
}: GroupSelectorProps) {
  const [items, setItems] = useState<GroupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchGroups = useCallback(
    async (search?: string) => {
      setIsLoading(true);
      try {
        const res = await searchGroupsAction({
          body: {
            search: search || null,
            limit_count: 20,
            offset_count: 0,
          },
        });
        setItems((res.items as GroupItem[]) ?? []);
      } catch {
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    },
    [searchGroupsAction],
  );

  // Initial load
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return (
    <GenericPicker<GroupItem>
      items={items}
      selectedIds={selectedGroupId ? [selectedGroupId] : []}
      onSelect={(ids) => onSelect(ids[0] ?? null)}
      multiSelect={false}
      getId={(g) => g.group_id ?? ""}
      getLabel={(g) => g.group_name ?? g.trace_id ?? "Untitled"}
      onSearchChange={(term) => fetchGroups(term || undefined)}
      debounceMs={300}
      placeholder={isLoading ? "Loading..." : "Select group"}
      searchPlaceholder="Search groups..."
      emptyMessage="No groups found"
    />
  );
}
