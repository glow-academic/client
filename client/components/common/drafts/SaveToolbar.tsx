/**
 * SaveToolbar.tsx
 * Toolbar component with Save button, Draft picker icon, and save status indicator
 * Replaces DraftPicker in layout header for create/edit pages
 */

"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSaveContext } from "@/contexts/save-context";
import { useProfile } from "@/contexts/profile-context";
import { Check, FileText, Loader2, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

interface SaveToolbarProps {
  artifactType: string;
}

export function SaveToolbar({ artifactType }: SaveToolbarProps) {
  const {
    isAutosaveEnabled,
    setAutosaveEnabled,
    saveStatus,
    hasUnsavedChanges,
    triggerSave,
  } = useSaveContext();

  const { drafts, selectedDraftId, setSelectedDraftId } = useProfile();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Confirmation dialog state
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "switch" | "create" | null
  >(null);

  // Filter drafts by artifact type
  const filteredDrafts = useMemo(
    () => drafts.filter((d) => d.artifact_type === artifactType),
    [drafts, artifactType]
  );

  // Get draft name for display
  const getDraftName = useCallback(
    (draft: (typeof drafts)[0]): string => {
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
    },
    []
  );

  // Handle Save button click
  const handleSaveClick = useCallback(() => {
    if (hasUnsavedChanges) {
      triggerSave();
    } else {
      // No changes → toggle autosave
      setAutosaveEnabled(!isAutosaveEnabled);
    }
  }, [hasUnsavedChanges, triggerSave, isAutosaveEnabled, setAutosaveEnabled]);

  // Actually switch draft
  const performDraftSwitch = useCallback(
    (draftId: string) => {
      setSelectedDraftId(draftId);
      const params = new URLSearchParams(searchParams.toString());
      params.set("draftId", draftId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, setSelectedDraftId]
  );

  // Actually create new draft
  const performCreateNew = useCallback(() => {
    setSelectedDraftId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("draftId");
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams, setSelectedDraftId]);

  // Attempt to switch draft (may show confirmation)
  const attemptDraftSwitch = useCallback(
    (draftId: string) => {
      if (hasUnsavedChanges) {
        setPendingDraftId(draftId);
        setPendingAction("switch");
        setShowDiscardDialog(true);
      } else {
        performDraftSwitch(draftId);
      }
    },
    [hasUnsavedChanges, performDraftSwitch]
  );

  // Attempt to create new draft (may show confirmation)
  const attemptCreateNew = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingDraftId(null);
      setPendingAction("create");
      setShowDiscardDialog(true);
    } else {
      performCreateNew();
    }
  }, [hasUnsavedChanges, performCreateNew]);

  // Handle discard confirmation
  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardDialog(false);

    if (pendingAction === "switch" && pendingDraftId) {
      performDraftSwitch(pendingDraftId);
    } else if (pendingAction === "create") {
      performCreateNew();
    }

    setPendingDraftId(null);
    setPendingAction(null);
  }, [pendingAction, pendingDraftId, performDraftSwitch, performCreateNew]);

  // Handle dialog cancel
  const handleDialogCancel = useCallback(() => {
    setShowDiscardDialog(false);
    setPendingDraftId(null);
    setPendingAction(null);
  }, []);

  return (
    <>
      <div className="flex items-center gap-2 pr-4">
        {/* Save Button - consolidated with status indicator */}
        <Button
          variant="default"
          size="sm"
          className="h-8"
          onClick={handleSaveClick}
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saving" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : saveStatus === "saved" ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Saved
            </>
          ) : (
            "Save"
          )}
        </Button>

        {/* Draft Picker Icon Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <FileText className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Drafts</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {filteredDrafts.length === 0 ? (
              <DropdownMenuItem disabled>No drafts available</DropdownMenuItem>
            ) : (
              filteredDrafts
                .filter((draft) => draft.id !== null)
                .map((draft) => (
                  <DropdownMenuItem
                    key={draft.id}
                    onClick={() => attemptDraftSwitch(draft.id!)}
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

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={attemptCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create new draft
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>

      {/* Discard Changes Confirmation Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you continue, your changes will be
              lost. Would you like to save first?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDialogCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDiscardConfirm}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
