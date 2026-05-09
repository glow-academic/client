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
  /** Trigger a fetch via ``searchDraftsAction``. Pass ``{search}`` (or
   *  any other body params) to override the default empty query. The
   *  initial open call (no args) caches; calls with a non-empty body
   *  always re-fetch so the dropdown stays responsive to typing. */
  loadDrafts: (opts?: DraftsLoadOptions) => void;
  /** Immutable label of the draft currently being edited, sourced from
   *  the page's SSR ``/<art>/get`` call (``draft_name`` field) and
   *  passed in via the provider. ``null`` when no draft is active. The
   *  SaveToolbar uses this to render the dropdown trigger label
   *  ("Jordan Lee") instead of the generic "Drafts". */
  currentDraftName: string | null;
}

export interface DraftsLoadOptions {
  /** Name search (ILIKE substring on the draft's stored ``name``). */
  search?: string | null;
  /** Pagination — page_limit defaults to 50 server-side. */
  page_limit?: number;
  page_offset?: number;
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
  currentDraftName: initialCurrentDraftName = null,
}: {
  children: React.ReactNode;
  /** Eagerly-fetched draft list (legacy SSR pattern). When omitted,
   *  the provider starts empty and lazy-fetches via
   *  ``searchDraftsAction`` on the first ``loadDrafts()`` call. */
  drafts?: DraftItem[];
  initialAutosave?: boolean;
  /** Server action to fetch drafts on demand. Pages should pass this
   *  instead of ``drafts`` to avoid the page-load network call (and
   *  the corresponding audit-bubble noise). Body fields (``search``,
   *  ``page_limit``, etc.) flow into the per-artifact ``GetXDraftsApiRequest``.
   *  Loose shape matches the precedent set by eager ``drafts`` consumers
   *  (which cast at the SSR boundary because OpenAPI's per-artifact
   *  draft shape doesn't satisfy ``DraftItem``'s ``UUID``-typed fields). */
  searchDraftsAction?: (
    input?: {
      body?: {
        search?: string | null;
        page_limit?: number;
        page_offset?: number;
      };
    },
  ) => Promise<{ entries?: unknown[] | null }>;
  /** Immutable draft label sourced from the page's SSR ``/<art>/get``
   *  response's ``draft_name`` field. Pass ``null`` (or omit) when no
   *  draft is active — the trigger then shows "New draft". */
  currentDraftName?: string | null;
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

  // Drafts loader — fired by ``SaveToolbar`` on dropdown open AND on
  // every keystroke in the search input (debounced upstream). Stable
  // identity (only ``searchDraftsAction`` in deps) so the upstream
  // effect doesn't re-run on every loading-state toggle and trigger a
  // refetch loop. In-flight tracking uses a ref instead of state for
  // the same reason.
  const isDraftsLoadingRef = React.useRef(false);
  const loadDrafts = useCallback(
    (opts?: DraftsLoadOptions) => {
      if (!searchDraftsAction) return;
      const hasQuery = !!(
        opts?.search ||
        opts?.page_limit !== undefined ||
        opts?.page_offset !== undefined
      );
      // Cache only the no-args open. Search-driven calls always go.
      if (!hasQuery && draftsLoadedRef.current) return;
      if (isDraftsLoadingRef.current) return;
      isDraftsLoadingRef.current = true;
      setIsDraftsLoading(true);
      // ``exactOptionalPropertyTypes`` forbids ``page_limit: undefined``,
      // so only set keys when the caller actually provided a value.
      const body: { search?: string | null; page_limit?: number; page_offset?: number } = {
        search: opts?.search ?? null,
      };
      if (opts?.page_limit !== undefined) body.page_limit = opts.page_limit;
      if (opts?.page_offset !== undefined) body.page_offset = opts.page_offset;
      void searchDraftsAction({ body })
        .then((res) => {
          setDrafts((res.entries ?? []) as DraftItem[]);
          if (!hasQuery) draftsLoadedRef.current = true;
        })
        .catch(() => {
          // Swallow — picker shows "No drafts available". A retry happens
          // on next open because draftsLoadedRef stays false.
        })
        .finally(() => {
          isDraftsLoadingRef.current = false;
          setIsDraftsLoading(false);
        });
    },
    [searchDraftsAction],
  );

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
      currentDraftName: initialCurrentDraftName,
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
      initialCurrentDraftName,
    ]
  );

  return (
    <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
  );
}
