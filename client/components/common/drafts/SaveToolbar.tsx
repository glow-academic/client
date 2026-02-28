/**
 * SaveToolbar.tsx
 * Single unified button: shows "Save Draft" when unsaved changes exist,
 * otherwise shows "Drafts" dropdown for browsing/switching drafts.
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
import { Switch } from "@/components/ui/switch";
import { useDrafts } from "@/contexts/draft-context";
import { FileText, Loader2, Plus, RefreshCw, Save } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

interface SaveToolbarProps {
  artifactType: string;
}

export function SaveToolbar({ artifactType }: SaveToolbarProps) {
  const {
    isAutosaveEnabled,
    isAutosaveLoaded,
    setAutosaveEnabled,
    saveStatus,
    hasUnsavedChanges,
    triggerSave,
    drafts,
    selectedDraftId,
    setSelectedDraftId,
  } = useDrafts();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter drafts by artifact type
  const filteredDrafts = useMemo(
    () => drafts.filter((d) => d.artifact_type === artifactType),
    [drafts, artifactType]
  );

  // Get draft name for display
  const getDraftName = useCallback((draft: (typeof drafts)[0]): string => {
    const payload = draft.payload as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object") {
      return draft.updated_at
        ? new Date(draft.updated_at).toLocaleDateString()
        : "Draft";
    }
    if (
      typeof payload["name"] === "string" &&
      (payload["name"] as string).trim()
    ) {
      return payload["name"] as string;
    }
    if (
      typeof payload["title"] === "string" &&
      (payload["title"] as string).trim()
    ) {
      return payload["title"] as string;
    }
    return draft.updated_at
      ? new Date(draft.updated_at).toLocaleDateString()
      : "Draft";
  }, []);

  // Handle Save button click
  const handleSaveClick = useCallback(() => {
    if (hasUnsavedChanges) {
      triggerSave();
    }
  }, [hasUnsavedChanges, triggerSave]);

  // Switch to an existing draft
  const handleDraftSwitch = useCallback(
    (draftId: string) => {
      setSelectedDraftId(draftId);
      const params = new URLSearchParams(searchParams.toString());
      params.set("draftId", draftId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, setSelectedDraftId]
  );

  // Create a new draft
  const handleCreateNew = useCallback(() => {
    setSelectedDraftId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("draftId");
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams, setSelectedDraftId]);

  const isSaving = saveStatus === "saving";
  const showSaveButton = isAutosaveLoaded && (hasUnsavedChanges || isSaving);

  // When there are unsaved changes, show a save button instead of the drafts dropdown
  if (showSaveButton) {
    return (
      <div className="pr-0">
        <Button
          variant="default"
          size="sm"
          onClick={handleSaveClick}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Draft
            </>
          )}
        </Button>
      </div>
    );
  }

  // No unsaved changes — show the drafts dropdown
  return (
    <div className="pr-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="sm">
            <FileText className="h-4 w-4" />
            Drafts
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* Autosave toggle */}
          {isAutosaveLoaded && (
            <>
              <DropdownMenuLabel className="flex items-center justify-between font-normal">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-3 w-3" />
                  <span>Autosave</span>
                </div>
                <Switch
                  checked={isAutosaveEnabled}
                  onCheckedChange={setAutosaveEnabled}
                />
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          {filteredDrafts.length === 0 ? (
            <DropdownMenuItem disabled>No drafts available</DropdownMenuItem>
          ) : (
            filteredDrafts
              .filter((draft) => draft.id !== null)
              .map((draft) => (
                <DropdownMenuItem
                  key={draft.id}
                  onClick={() => handleDraftSwitch(draft.id!)}
                  className={selectedDraftId === draft.id ? "bg-accent" : ""}
                >
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="font-medium truncate">
                      {getDraftName(draft)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {draft.updated_at
                        ? new Date(draft.updated_at).toLocaleString()
                        : ""}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))
          )}
          {/* Only show "Create new draft" if we're currently editing an existing draft */}
          {searchParams.get("draftId") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create new draft
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
