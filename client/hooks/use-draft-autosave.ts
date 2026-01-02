/**
 * use-draft-autosave.ts
 * Hook for debounced autosave of draft state with optimistic concurrency
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const currentDraftStateRef = useRef<T>(draftState);
  const patchDraftActionRef = useRef(patchDraftAction);
  const onDraftCreatedRef = useRef(onDraftCreated);

  // Update refs when props change (without causing re-renders)
  useEffect(() => {
    currentDraftIdRef.current = draftId;
    currentDraftStateRef.current = draftState;
    patchDraftActionRef.current = patchDraftAction;
    onDraftCreatedRef.current = onDraftCreated;
  }, [draftId, draftState, patchDraftAction, onDraftCreated]);

  // Compute patch (diff) - stable callback (no dependencies)
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
        const currentStr = JSON.stringify(currentVal);
        const lastSavedStr = JSON.stringify(lastSavedVal);
        if (currentStr !== lastSavedStr) {
          patch[k] = currentVal;
          hasChanges = true;
        }
      });

      return hasChanges ? patch : null;
    },
    [] // Stable - no dependencies
  );

  // Save function - use refs to avoid dependency on draftState
  const saveDraft = useCallback(
    async (patch: Partial<T>, isManual = false) => {
      const currentDraftId = currentDraftIdRef.current;
      const currentDraftState = currentDraftStateRef.current;
      const currentPatchDraftAction = patchDraftActionRef.current;
      const currentOnDraftCreated = onDraftCreatedRef.current;

      // Skip if no patch
      if (!patch || Object.keys(patch).length === 0) {
        return;
      }

      setSaveStatus("saving");
      try {
        const result = await currentPatchDraftAction({
          body: {
            draft_id: currentDraftId || null,
            patch,
            expected_version: lastSavedVersion,
          },
        });

        // Update last saved state and version (use ref for current state)
        lastSavedStateRef.current = { ...currentDraftState };
        setLastSavedVersion(result.newVersion);
        setSaveStatus("saved");

        // If draft was just created, notify parent
        if (!result.draftExists && result.draftId && currentOnDraftCreated) {
          currentOnDraftCreated(result.draftId);
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
    [lastSavedVersion] // Only depend on lastSavedVersion, not draftState or callbacks
  );

  // Track stable callback refs to prevent effect re-runs
  const computePatchRef = useRef(computePatch);
  const saveDraftRef = useRef(saveDraft);

  useEffect(() => {
    computePatchRef.current = computePatch;
    saveDraftRef.current = saveDraft;
  }, [computePatch, saveDraft]);

  // Compute content hash - only changes when content actually changes, not reference
  const draftStateContentHash = useMemo(() => {
    return JSON.stringify(draftState);
  }, [draftState]);

  // Track previous content hash to detect actual content changes
  const prevContentHashRef = useRef<string>(draftStateContentHash);

  // Debounced autosave - use content hash in dependency array instead of draftState object
  // This prevents effect from running when only object reference changes
  useEffect(() => {
    // Update refs immediately
    currentDraftStateRef.current = draftState;

    // Skip if content hash hasn't changed (content is the same, only reference changed)
    if (draftStateContentHash === prevContentHashRef.current) {
      // Skip on initial mount only if hash hasn't changed
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
        lastSavedStateRef.current = draftState;
      }
      return;
    }

    // Update previous hash
    prevContentHashRef.current = draftStateContentHash;

    // If this is the initial mount but hash changed, mark as no longer initial mount
    // and proceed with patch computation (user made a change)
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      // Don't update lastSavedStateRef here - let it be updated after successful save
    }

    // Use stable computePatch from ref
    const patch = computePatchRef.current(
      draftState,
      lastSavedStateRef.current
    );
    
    if (!patch) return; // No changes

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer - use stable saveDraft from ref
    debounceTimerRef.current = setTimeout(() => {
      saveDraftRef.current(patch, false);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftStateContentHash,
    debounceMs,
    // Removed draftId, draftState, computePatch, saveDraft from dependencies
    // - draftId and draftState are accessed via refs (currentDraftIdRef, currentDraftStateRef)
    // - computePatch and saveDraft are accessed via refs (computePatchRef, saveDraftRef)
    // Only content hash changes should trigger autosave, not reference changes
    // This prevents infinite loops when these props change reference but content stays the same
  ]); // Use content hash instead of draftState object

  // Manual save
  const saveNow = useCallback(async () => {
    const patch = computePatch(
      currentDraftStateRef.current,
      lastSavedStateRef.current
    );
    if (!patch) {
      toast.info("No changes to save");
      return;
    }

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    await saveDraft(patch, true);
  }, [computePatch, saveDraft]); // Use ref for draftState, not direct dependency

  return {
    saveStatus,
    saveNow,
    lastSavedVersion,
  };
}
