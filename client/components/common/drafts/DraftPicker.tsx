/**
 * DraftPicker.tsx
 * Dropdown component for selecting drafts filtered by resource type
 * Positioned for top-right corner (similar to SimulationControls)
 */

"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useProfile } from "@/contexts/profile-context";

export interface DraftItem {
  id: string;
  resource_type: string;
  payload: Record<string, unknown>;
  version: number;
  updated_at: string;
}

export interface DraftPickerProps {
  resourceType: string;
  onCreateDraft?: () => void;
}

export function DraftPicker({
  resourceType,
  onCreateDraft,
}: DraftPickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { drafts, selectedDraftId, setSelectedDraftId } = useProfile();

  // Filter drafts by resource type
  const filteredDrafts = drafts.filter(
    (draft) => draft.resource_type === resourceType
  );

  // Get draft name from payload (resource-specific)
  const getDraftName = useCallback((draft: DraftItem): string => {
    const payload = draft.payload;
    // Try common name fields
    if (typeof payload.name === "string" && payload.name.trim()) {
      return payload.name;
    }
    if (typeof payload.title === "string" && payload.title.trim()) {
      return payload.title;
    }
    // Fallback to timestamp
    return new Date(draft.updated_at).toLocaleDateString();
  }, []);

  const handleSelectDraft = useCallback(
    (draftId: string) => {
      setSelectedDraftId(draftId);
      const params = new URLSearchParams(searchParams.toString());
      params.set("draftId", draftId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, setSelectedDraftId]
  );

  const handleCreateNew = useCallback(() => {
    setSelectedDraftId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("draftId");
    router.replace(`?${params.toString()}`, { scroll: false });
    onCreateDraft?.();
  }, [router, searchParams, setSelectedDraftId, onCreateDraft]);

  const selectedDraft = filteredDrafts.find(
    (d) => d.id === selectedDraftId
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <FileText className="h-4 w-4 mr-2" />
          {selectedDraft
            ? getDraftName(selectedDraft)
            : filteredDrafts.length > 0
              ? "Select Draft"
              : "Drafts"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Drafts</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {filteredDrafts.length === 0 ? (
          <DropdownMenuItem disabled>No drafts available</DropdownMenuItem>
        ) : (
          filteredDrafts.map((draft) => (
            <DropdownMenuItem
              key={draft.id}
              onClick={() => handleSelectDraft(draft.id)}
              className={selectedDraftId === draft.id ? "bg-accent" : ""}
            >
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <span className="font-medium truncate">
                  {getDraftName(draft)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(draft.updated_at).toLocaleString()}
                </span>
              </div>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Create new draft
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

