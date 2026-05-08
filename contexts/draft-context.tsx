"use client";

import type { UUID } from "crypto";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

export type DraftItem = {
  id: UUID;
  version: number;
  created_at: string;
  group_id: UUID;
  name_ids?: UUID[];
  [key: string]: unknown;
};

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
  /** True while a lazy ``searchDraftsAction`` fetch is in flight. */
  isDraftsLoading: boolean;
  /** Trigger a lazy fetch via ``searchDraftsAction``. No-op when the
   *  page passed ``drafts`` eagerly (no action wired) or after the
   *  first successful load. Callers (e.g. ``SaveToolbar``'s dropdown
   *  ``onOpenChange``) can fire this on every open — internal guards
   *  collapse to a single fetch. */
  loadDrafts: () => void;
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
  drafts: initialDrafts,
  initialAutosave,
  searchDraftsAction,
}: {
  children: React.ReactNode;
  /** Eagerly-fetched draft list (legacy SSR pattern). When omitted,
   *  the provider starts empty and lazy-fetches via
   *  ``searchDraftsAction`` on the first ``loadDrafts()`` call. */
  drafts?: DraftItem[];
  initialAutosave?: boolean;
  /** Server action to fetch drafts on demand. Pages should pass this
   *  instead of ``drafts`` to avoid the page-load network call (and
   *  the corresponding audit-bubble noise). Loose shape matches the
   *  precedent set by eager ``drafts`` consumers (which cast at the
   *  SSR boundary because OpenAPI's per-artifact draft shape doesn't
   *  satisfy ``DraftItem``'s ``UUID``-typed fields). */
  searchDraftsAction?: () => Promise<{ entries?: unknown[] | null }>;
}) {
  const [drafts, setDrafts] = useState<DraftItem[]>(initialDrafts ?? []);
  const [isDraftsLoading, setIsDraftsLoading] = useState(false);
  // ``true`` after the first successful lazy fetch OR when the page
  // passed eager ``initialDrafts``. Suppresses redundant refetch on
  // repeated dropdown opens.
  const draftsLoadedRef = React.useRef(initialDrafts !== undefined);
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

  // Lazy drafts loader — called by ``SaveToolbar`` on dropdown open.
  // Idempotent: skips if already loaded or already in flight.
  const loadDrafts = useCallback(() => {
    if (!searchDraftsAction) return;
    if (draftsLoadedRef.current) return;
    if (isDraftsLoading) return;
    setIsDraftsLoading(true);
    void searchDraftsAction()
      .then((res) => {
        setDrafts((res.entries ?? []) as DraftItem[]);
        draftsLoadedRef.current = true;
      })
      .catch(() => {
        // Swallow — picker shows "No drafts available". A retry happens
        // on next open because draftsLoadedRef stays false.
      })
      .finally(() => {
        setIsDraftsLoading(false);
      });
  }, [searchDraftsAction, isDraftsLoading]);

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
      isDraftsLoading,
      loadDrafts,
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
      isDraftsLoading,
      loadDrafts,
    ]
  );

  return (
    <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
  );
}
