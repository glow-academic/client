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
  /** Whether the autosave preference has been loaded from localStorage */
  isAutosaveLoaded: boolean;
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

const AUTOSAVE_COOKIE = "glow_autosave";

interface SaveProviderProps {
  children: React.ReactNode;
  /** Initial autosave value from SSR (read from cookie) */
  initialAutosave?: boolean;
}

export function SaveProvider({ children, initialAutosave }: SaveProviderProps) {
  // Initialize from SSR prop (cookie), falling back to true
  const [isAutosaveEnabled, setIsAutosaveEnabledState] = useState(
    initialAutosave ?? true
  );
  // If we have SSR value, we're already "loaded"; otherwise wait for useEffect
  const [isAutosaveLoaded, setIsAutosaveLoaded] = useState(
    initialAutosave !== undefined
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // For first-time visitors (no cookie), set the default cookie and mark as loaded
  useEffect(() => {
    if (initialAutosave === undefined) {
      // First visit - set default cookie (true) for future SSR
      document.cookie = `${AUTOSAVE_COOKIE}=true; path=/; max-age=31536000; SameSite=Lax`;
      setIsAutosaveLoaded(true);
    }
  }, [initialAutosave]);

  // Persist autosave preference to cookie
  const setAutosaveEnabled = useCallback((enabled: boolean) => {
    setIsAutosaveEnabledState(enabled);
    // Set cookie for SSR access (1 year expiry)
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

  return (
    <SaveContext.Provider
      value={{
        isAutosaveEnabled,
        isAutosaveLoaded,
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
