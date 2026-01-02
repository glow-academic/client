/**
 * use-draft-autosave.ts
 * Hook for debounced autosave of draft state with optimistic concurrency
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseDraftAutosaveOptions<T extends Record<string, unknown>> {
  draftId: string | null;
  draftState: T;
  patchDraftAction: (input: {
    body: {
      draft_id?: string | null;
      patch: Partial<T>;
      expected_version: number;
    };
  }) => Promise<{
    draftId: string;
    newVersion: number;
    draftExists: boolean;
  }>;
  debounceMs?: number;
  onDraftCreated?: (draftId: string) => void;
}

interface UseDraftAutosaveReturn {
  saveStatus: SaveStatus;
  saveNow: () => Promise<void>;
  lastSavedVersion: number;
}

export function useDraftAutosave<T extends Record<string, unknown>>({
  draftId,
  draftState,
  patchDraftAction,
  debounceMs = 1000,
  onDraftCreated,
}: UseDraftAutosaveOptions<T>): UseDraftAutosaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedStateRef = useRef<T | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef(true);
  const currentDraftIdRef = useRef<string | null>(draftId);

  // Update draft ID ref when it changes
  useEffect(() => {
    currentDraftIdRef.current = draftId;
  }, [draftId]);

  // Compute patch (diff)
  const computePatch = useCallback(
    (current: T, lastSaved: T | null): Partial<T> | null => {
      if (!lastSaved) {
        // First save - return all fields
        return current;
      }

      const patch: Partial<T> = {};
      let hasChanges = false;

      Object.keys(current).forEach((key) => {
        const k = key as keyof T;
        const currentVal = current[k];
        const lastSavedVal = lastSaved[k];

        // Deep comparison for arrays and objects
        if (
          JSON.stringify(currentVal) !== JSON.stringify(lastSavedVal)
        ) {
          patch[k] = currentVal;
          hasChanges = true;
        }
      });

      return hasChanges ? patch : null;
    },
    []
  );

  // Save function
  const saveDraft = useCallback(
    async (patch: Partial<T>, isManual = false) => {
      const currentDraftId = currentDraftIdRef.current;
      
      // Skip if no patch
      if (!patch || Object.keys(patch).length === 0) {
        return;
      }

      setSaveStatus("saving");
      try {
        const result = await patchDraftAction({
          body: {
            draft_id: currentDraftId || null,
            patch,
            expected_version: lastSavedVersion,
          },
        });

        // Update last saved state and version
        lastSavedStateRef.current = { ...draftState };
        setLastSavedVersion(result.newVersion);
        setSaveStatus("saved");

        // If draft was just created, notify parent
        if (!result.draftExists && result.draftId && onDraftCreated) {
          onDraftCreated(result.draftId);
        }

        // Reset to idle after 2 seconds
        setTimeout(() => {
          setSaveStatus((prev) => (prev === "saved" ? "idle" : prev));
        }, 2000);
      } catch (error) {
        setSaveStatus("error");
        if (isManual) {
          toast.error(
            `Failed to save draft: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }
    },
    [draftState, patchDraftAction, lastSavedVersion, onDraftCreated]
  );

  // Debounced autosave
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedStateRef.current = draftState;
      return;
    }

    const patch = computePatch(draftState, lastSavedStateRef.current);
    if (!patch) return; // No changes

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      saveDraft(patch, false);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [draftState, debounceMs, computePatch, saveDraft]);

  // Manual save
  const saveNow = useCallback(async () => {
    const patch = computePatch(draftState, lastSavedStateRef.current);
    if (!patch) {
      toast.info("No changes to save");
      return;
    }

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    await saveDraft(patch, true);
  }, [draftState, computePatch, saveDraft]);

  return {
    saveStatus,
    saveNow,
    lastSavedVersion,
  };
}

