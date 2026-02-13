"use client";

import type { DraftsResponse } from "@/app/(main)/layout-server";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

export type DraftItem = NonNullable<DraftsResponse["drafts"]>[number];

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface DraftContextType {
  drafts: DraftItem[];
  selectedDraftId: string | null;
  setSelectedDraftId: (id: string | null) => void;
  isAutosaveEnabled: boolean;
  isAutosaveLoaded: boolean;
  setAutosaveEnabled: (enabled: boolean) => void;
  saveStatus: SaveStatus;
  hasUnsavedChanges: boolean;
  triggerSave: () => void;
}

const DraftContext = createContext<DraftContextType | null>(null);

const AUTOSAVE_COOKIE = "glow_autosave";

export function useDrafts(): DraftContextType {
  const context = useContext(DraftContext);
  if (!context) {
    throw new Error("useDrafts must be used within a DraftProviderClient");
  }
  return context;
}

export function DraftProviderClient({
  children,
  drafts,
  initialAutosave,
}: {
  children: React.ReactNode;
  drafts: DraftItem[];
  initialAutosave?: boolean;
}) {
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  // Autosave state — initialized from SSR cookie prop, falling back to true
  const [isAutosaveEnabled, setIsAutosaveEnabledState] = useState(
    initialAutosave ?? true
  );
  const [isAutosaveLoaded, setIsAutosaveLoaded] = useState(
    initialAutosave !== undefined
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // For first-time visitors (no cookie), set the default cookie and mark as loaded
  useEffect(() => {
    if (initialAutosave === undefined) {
      document.cookie = `${AUTOSAVE_COOKIE}=true; path=/; max-age=31536000; SameSite=Lax`;
      setIsAutosaveLoaded(true);
    }
  }, [initialAutosave]);

  // Persist autosave preference to cookie
  const setAutosaveEnabled = useCallback((enabled: boolean) => {
    setIsAutosaveEnabledState(enabled);
    document.cookie = `${AUTOSAVE_COOKIE}=${enabled}; path=/; max-age=31536000; SameSite=Lax`;
    toast.info(enabled ? "Autosave enabled" : "Autosave disabled");
  }, []);

  // Dispatch event to trigger save in page components
  const triggerSave = useCallback(() => {
    window.dispatchEvent(new CustomEvent("trigger-save"));
  }, []);

  // Listen for save status updates from page components
  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const detail = (e as CustomEvent<{ status: SaveStatus }>).detail;
      setSaveStatus(detail.status);
    };

    const handleUnsavedChanges = (e: Event) => {
      const detail = (e as CustomEvent<{ hasChanges: boolean }>).detail;
      setHasUnsavedChanges(detail.hasChanges);
    };

    window.addEventListener("save-status-change", handleStatusChange);
    window.addEventListener("unsaved-changes", handleUnsavedChanges);

    return () => {
      window.removeEventListener("save-status-change", handleStatusChange);
      window.removeEventListener("unsaved-changes", handleUnsavedChanges);
    };
  }, []);

  const value = useMemo<DraftContextType>(
    () => ({
      drafts,
      selectedDraftId,
      setSelectedDraftId,
      isAutosaveEnabled,
      isAutosaveLoaded,
      setAutosaveEnabled,
      saveStatus,
      hasUnsavedChanges,
      triggerSave,
    }),
    [
      drafts,
      selectedDraftId,
      isAutosaveEnabled,
      isAutosaveLoaded,
      setAutosaveEnabled,
      saveStatus,
      hasUnsavedChanges,
      triggerSave,
    ]
  );

  return (
    <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
  );
}
