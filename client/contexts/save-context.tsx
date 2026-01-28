/**
 * save-context.tsx
 * Context for managing save state across layout and page components
 * Handles autosave toggle, save status, and unsaved changes tracking
 */

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveContextType {
  /** Whether autosave is enabled (persisted in localStorage) */
  isAutosaveEnabled: boolean;
  /** Toggle autosave on/off */
  setAutosaveEnabled: (enabled: boolean) => void;
  /** Current save status for UI indicator */
  saveStatus: SaveStatus;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Trigger save from layout (dispatches window event) */
  triggerSave: () => void;
}

const SaveContext = createContext<SaveContextType | undefined>(undefined);

const AUTOSAVE_KEY = "glow_autosave_enabled";

export function SaveProvider({ children }: { children: React.ReactNode }) {
  // Initialize from localStorage (default: true for backwards compatibility)
  const [isAutosaveEnabled, setIsAutosaveEnabledState] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(AUTOSAVE_KEY);
    if (stored !== null) {
      setIsAutosaveEnabledState(stored === "true");
    }
  }, []);

  // Persist autosave preference
  const setAutosaveEnabled = useCallback((enabled: boolean) => {
    setIsAutosaveEnabledState(enabled);
    localStorage.setItem(AUTOSAVE_KEY, String(enabled));
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

  return (
    <SaveContext.Provider
      value={{
        isAutosaveEnabled,
        setAutosaveEnabled,
        saveStatus,
        hasUnsavedChanges,
        triggerSave,
      }}
    >
      {children}
    </SaveContext.Provider>
  );
}

export function useSaveContext() {
  const context = useContext(SaveContext);
  if (!context) {
    throw new Error("useSaveContext must be used within a SaveProvider");
  }
  return context;
}
