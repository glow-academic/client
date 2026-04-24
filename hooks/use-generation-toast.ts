/**
 * useGenerationToast — toast lifecycle bound to a generation run.
 *
 * One of three generation primitives (see use-generation-events.ts).
 *
 * Usage: give it a runId (from useGenerationEmit's emit()) plus a label,
 * and the hook shows a loading toast that updates to success/error when
 * the matching complete/error event arrives. Multiple concurrent runs are
 * supported — each is keyed independently by its runId.
 *
 * Consumers call `showLoading(runId, label)` after emit, then
 * `markComplete(runId, { message?, success? })` / `markError(runId, message)`
 * from the event-listener side. Cleans up automatically on unmount.
 *
 * Zero transport awareness — this is purely a toast-state machine keyed
 * by runId. Compose with useGenerationEvents to wire the event → toast
 * transitions per artifact.
 */
"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

type ToastId = string | number;

export interface ShowLoadingOptions {
  /** Label shown in the loading toast. */
  label: string;
}

export interface MarkCompleteOptions {
  /** Message on the success toast. Default: "Generation complete". */
  message?: string;
  /** If false, resolves the toast to error instead. Default: true. */
  success?: boolean;
}

export interface UseGenerationToastReturn {
  /** Show a loading toast for this runId. Idempotent per runId. */
  showLoading: (runId: string, options: ShowLoadingOptions) => void;
  /** Update the loading toast with new progress text. No-op if no toast. */
  updateProgress: (runId: string, message: string) => void;
  /** Resolve the toast to success (or error, if `success: false`). */
  markComplete: (runId: string, options?: MarkCompleteOptions) => void;
  /** Resolve the toast to error. */
  markError: (runId: string, message?: string) => void;
  /** Clear a toast without resolving it (e.g., when navigating away). */
  clear: (runId: string) => void;
}

export function useGenerationToast(): UseGenerationToastReturn {
  const toastsRef = useRef<Map<string, ToastId>>(new Map());

  // Dismiss any outstanding toasts on unmount to avoid stuck spinners.
  useEffect(() => {
    const toasts = toastsRef.current;
    return () => {
      for (const id of toasts.values()) {
        toast.dismiss(id);
      }
      toasts.clear();
    };
  }, []);

  const showLoading = useCallback(
    (runId: string, { label }: ShowLoadingOptions) => {
      const existing = toastsRef.current.get(runId);
      if (existing !== undefined) {
        toast.loading(label, { id: existing });
        return;
      }
      const id = toast.loading(label);
      toastsRef.current.set(runId, id);
    },
    [],
  );

  const updateProgress = useCallback((runId: string, message: string) => {
    const id = toastsRef.current.get(runId);
    if (id === undefined) return;
    toast.loading(message, { id });
  }, []);

  const markComplete = useCallback(
    (runId: string, options: MarkCompleteOptions = {}) => {
      const id = toastsRef.current.get(runId);
      if (id === undefined) return;
      const success = options.success !== false;
      if (success) {
        toast.success(options.message ?? "Generation complete", { id });
      } else {
        toast.error(options.message ?? "Generation failed", { id });
      }
      toastsRef.current.delete(runId);
    },
    [],
  );

  const markError = useCallback((runId: string, message?: string) => {
    const id = toastsRef.current.get(runId);
    if (id === undefined) {
      // No bound toast — show a standalone error so failures aren't silent.
      toast.error(message ?? "Generation failed");
      return;
    }
    toast.error(message ?? "Generation failed", { id });
    toastsRef.current.delete(runId);
  }, []);

  const clear = useCallback((runId: string) => {
    const id = toastsRef.current.get(runId);
    if (id === undefined) return;
    toast.dismiss(id);
    toastsRef.current.delete(runId);
  }, []);

  return { showLoading, updateProgress, markComplete, markError, clear };
}
