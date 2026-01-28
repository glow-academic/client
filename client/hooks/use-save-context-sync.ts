/**
 * Hook to sync draft autosave status with the global save context.
 * This allows the layout header to display the save status from page components.
 */

import { useSaveContext } from "@/contexts/save-context";
import { useEffect } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseSaveContextSyncOptions {
  saveStatus: SaveStatus;
  saveNow: () => Promise<void>;
  hasUnsavedChanges?: boolean;
}

export function useSaveContextSync({
  saveStatus,
  saveNow,
  hasUnsavedChanges = false,
}: UseSaveContextSyncOptions) {
  const {
    setSaveStatus,
    setHasUnsavedChanges,
    registerSaveHandler,
    unregisterSaveHandler,
  } = useSaveContext();

  // Sync save status to context
  useEffect(() => {
    setSaveStatus(saveStatus);
  }, [saveStatus, setSaveStatus]);

  // Sync unsaved changes flag
  useEffect(() => {
    setHasUnsavedChanges(hasUnsavedChanges);
  }, [hasUnsavedChanges, setHasUnsavedChanges]);

  // Register save handler
  useEffect(() => {
    registerSaveHandler(saveNow);
    return () => unregisterSaveHandler();
  }, [saveNow, registerSaveHandler, unregisterSaveHandler]);
}
