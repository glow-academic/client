import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

interface PatchResult {
  draft_id?: string | null;
  new_version?: number | null;
}

/**
 * Manages the complete draft autosave lifecycle:
 * - draftId tracking from GenericForm URL state
 * - Version tracking for optimistic concurrency
 * - Deduplication via draftPatchKey
 * - Debounced autosave effect (1s)
 * - beforeunload warning for unsaved changes
 * - unsaved-changes event emission
 * - flushAllAndSave for manual save via Save toolbar
 * - trigger-save listener from layout
 */
export function useDraftLifecycle(config: {
  /** JSON.stringify of form state (WITHOUT draftId) — changes trigger autosave */
  formStateKey: string;
  /** Ref to the server action for patching drafts */
  patchActionRef: MutableRefObject<
    ((payload: Record<string, unknown>) => Promise<PatchResult>) | undefined
  >;
  isAutosaveEnabled: boolean;
  /** Build the full patch payload given draftId, expectedVersion, and optional flush results */
  buildPatchPayload: (
    draftId: string | null,
    expectedVersion: number,
    flushResults?: Record<string, unknown>
  ) => Record<string, unknown>;
  setSelectedDraftId: (id: string | null) => void;
  /** draft_version from server data (null for new entities) */
  serverDraftVersion: number | null;
  /** Whether the form has any resource IDs at all (gate for patching) */
  hasResourceIds: boolean;
  flushRegistryRef: MutableRefObject<
    Map<string, () => Promise<Record<string, unknown> | void>>
  >;
  formStateRef: MutableRefObject<Record<string, unknown>>;
}) {
  const {
    formStateKey,
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    serverDraftVersion,
    hasResourceIds,
    flushRegistryRef,
    formStateRef,
  } = config;

  // --- draftId from GenericForm URL state ---
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);
  const formDataRef = useRef<Record<string, unknown>>({});

  // Track last synced draftId to prevent redundant profile context updates
  const lastSyncedDraftIdRef = useRef<string | null>(null);

  // Server sync flag: when true, the next draftPatchKey change resets baseline instead of saving
  const serverSyncPendingRef = useRef(false);

  const onFormDataChange = useCallback(
    (fd: Record<string, unknown>) => {
      formDataRef.current = fd;
      const nextDraftId = (fd["draftId"] as string | undefined) ?? null;
      setDraftId((prev) => {
        if (prev === null && nextDraftId !== null) {
          serverSyncPendingRef.current = true;
        }
        return prev === nextDraftId ? prev : nextDraftId;
      });

      if (nextDraftId !== lastSyncedDraftIdRef.current) {
        lastSyncedDraftIdRef.current = nextDraftId;
        setSelectedDraftId(nextDraftId);
      }
    },
    [setSelectedDraftId]
  );

  // --- Version tracking ---
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = useRef(0);
  useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);

  const versionSyncedRef = useRef(false);
  useEffect(() => {
    if (
      typeof serverDraftVersion === "number" &&
      serverDraftVersion !== lastSavedVersionRef.current
    ) {
      setLastSavedVersion(serverDraftVersion);
      lastSavedVersionRef.current = serverDraftVersion;
    }
    versionSyncedRef.current = true;
  }, [serverDraftVersion]);

  // --- draftPatchKey dedup ---
  // Prepend draftId to the caller-provided formStateKey to get the full dedup key
  const draftPatchKey = `{"draftId":${JSON.stringify(draftId ?? null)},${formStateKey.slice(1)}`;

  const lastPatchedKeyRef = useRef<string | null>(null);
  const isFirstPatchRef = useRef(true);
  const hasPendingChangesRef = useRef(false);

  // --- Debounced autosave effect ---
  useEffect(() => {
    if (!hasResourceIds || !patchActionRef.current) {
      return;
    }

    if (
      typeof serverDraftVersion === "number" &&
      !versionSyncedRef.current
    ) {
      return;
    }

    if (isFirstPatchRef.current) {
      isFirstPatchRef.current = false;
      lastPatchedKeyRef.current = draftPatchKey;
      return;
    }

    if (serverSyncPendingRef.current) {
      serverSyncPendingRef.current = false;
      lastPatchedKeyRef.current = draftPatchKey;
      return;
    }

    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    hasPendingChangesRef.current = true;

    if (!isAutosaveEnabled) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("save-status-change", { detail: { status: "saving" } })
    );

    const timer = setTimeout(async () => {
      try {
        if (!patchActionRef.current) return;

        const payload = buildPatchPayload(
          draftId,
          lastSavedVersionRef.current
        );
        const result = await patchActionRef.current(payload);

        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          toast.success("Draft created", {
            description: "Your changes are being auto-saved",
          });
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        } else if (result.draft_id && result.draft_id !== draftId) {
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }

        hasPendingChangesRef.current = false;

        window.dispatchEvent(
          new CustomEvent("save-status-change", {
            detail: { status: "idle" },
          })
        );
        window.dispatchEvent(
          new CustomEvent("unsaved-changes", {
            detail: { hasChanges: false },
          })
        );
      } catch {
        toast.error("Failed to save draft", {
          description:
            "Your changes may not have been saved. Please try again.",
        });
        window.dispatchEvent(
          new CustomEvent("save-status-change", {
            detail: { status: "error" },
          })
        );
      }
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPatchKey, isAutosaveEnabled]);

  // --- beforeunload warning ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChangesRef.current) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // --- unsaved-changes event ---
  useEffect(() => {
    if (serverSyncPendingRef.current) {
      window.dispatchEvent(
        new CustomEvent("unsaved-changes", { detail: { hasChanges: false } })
      );
      return;
    }
    const hasChanges =
      lastPatchedKeyRef.current !== null &&
      lastPatchedKeyRef.current !== draftPatchKey;
    window.dispatchEvent(
      new CustomEvent("unsaved-changes", { detail: { hasChanges } })
    );
  }, [draftPatchKey]);

  // --- flushAllAndSave (manual save) ---
  const flushAllAndSave = useCallback(
    async (): Promise<string | null> => {
      const startTime = Date.now();
      const MIN_SAVING_DURATION = 1000;

      window.dispatchEvent(
        new CustomEvent("save-status-change", {
          detail: { status: "saving" },
        })
      );

      let resolvedDraftId: string | null = draftId || null;

      try {
        // 1. Flush all creatable resources
        const flushPromises = Array.from(
          flushRegistryRef.current.values()
        ).map((flush) => flush());
        const flushResults = await Promise.all(flushPromises);

        const mergedFlushResults = flushResults.reduce<
          Record<string, unknown>
        >((acc, result) => (result ? { ...acc, ...result } : acc), {});

        // 2. Patch draft
        let isNewDraft = false;
        if (patchActionRef.current) {
          const payload = buildPatchPayload(
            draftId,
            lastSavedVersionRef.current,
            mergedFlushResults
          );
          const result = await patchActionRef.current(payload);

          lastPatchedKeyRef.current = draftPatchKey;
          if (
            result.new_version !== undefined &&
            result.new_version !== null
          ) {
            lastSavedVersionRef.current = result.new_version;
            setLastSavedVersion(result.new_version);
          }

          if (!draftId && result.draft_id) {
            setUrlFormDataRef.current?.({ draftId: result.draft_id });
            isNewDraft = true;
          }
          resolvedDraftId = result.draft_id || draftId || null;
        }

        // 3. Ensure minimum display duration
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_SAVING_DURATION) {
          await new Promise((resolve) =>
            setTimeout(resolve, MIN_SAVING_DURATION - elapsed)
          );
        }

        window.dispatchEvent(
          new CustomEvent("save-status-change", {
            detail: { status: "idle" },
          })
        );
        window.dispatchEvent(
          new CustomEvent("unsaved-changes", {
            detail: { hasChanges: false },
          })
        );

        hasPendingChangesRef.current = false;
        toast.success(isNewDraft ? "Draft created" : "Draft saved");
        return resolvedDraftId;
      } catch {
        window.dispatchEvent(
          new CustomEvent("save-status-change", {
            detail: { status: "error" },
          })
        );
        toast.error("Failed to save draft");
        return resolvedDraftId;
      }
    },
    [draftId, draftPatchKey, buildPatchPayload, flushRegistryRef, patchActionRef]
  );

  // --- trigger-save listener ---
  useEffect(() => {
    const handleTriggerSave = () => {
      flushAllAndSave();
    };
    window.addEventListener("trigger-save", handleTriggerSave);
    return () =>
      window.removeEventListener("trigger-save", handleTriggerSave);
  }, [flushAllAndSave]);

  return {
    draftId,
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    serverSyncPendingRef,
    formDataRef,
  };
}
