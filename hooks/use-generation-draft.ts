/**
 * useGenerationDraft — generic hook for syncing draft state from AI generation.
 *
 * Listens for `{artifact}.draft.completed` and `{artifact}.draft.failed`
 * events via the Transport abstraction (WebSocket or SSE).
 *
 * Keeps the client's draftId in sync with the server's append-only draft
 * entries. Each AI draft call creates a new entry — this hook picks up
 * the new draft_id and surfaces it via callback.
 *
 * Works for any artifact type (persona, scenario, document, etc.).
 */
"use client";

import { useEffect, useRef } from "react";
import { useTransport } from "@/lib/transport";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftFormState {
  name_id?: string | null;
  name?: string | null;
  description_id?: string | null;
  description?: string | null;
  instructions_id?: string | null;
  instructions?: string | null;
  color_id?: string | null;
  color?: string | null;
  icon_id?: string | null;
  icon?: string | null;
  active_flag_id?: string | null;
  department_ids?: string[];
  example_ids?: string[];
  parameter_field_ids?: string[];
  voice_ids?: string[];
}

interface DraftCompletedEvent {
  success: boolean;
  draft_id: string;
  message: string;
  form_state: DraftFormState;
  call_id?: string;
  group_id?: string;
}

interface DraftFailedEvent {
  message: string;
  error_type?: string;
  call_id?: string;
}

interface UseGenerationDraftConfig {
  /** Artifact type to listen for (e.g. "persona", "scenario") */
  artifactType: string;
  /** Group ID to filter events (only process events for this group) */
  groupId: string | null;
  /** Called when a draft is saved successfully */
  onDraftCompleted?: (draftId: string, formState: DraftFormState) => void;
  /** Called when a draft save fails */
  onDraftFailed?: (message: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGenerationDraft({
  artifactType,
  groupId,
  onDraftCompleted,
  onDraftFailed,
}: UseGenerationDraftConfig): void {
  const transport = useTransport();

  // Stable refs to avoid re-registering listeners on callback changes
  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  const onCompletedRef = useRef(onDraftCompleted);
  onCompletedRef.current = onDraftCompleted;

  const onFailedRef = useRef(onDraftFailed);
  onFailedRef.current = onDraftFailed;

  useEffect(() => {
    const matchesGroup = (data: Record<string, unknown>): boolean => {
      if (!groupIdRef.current) return false;
      return data.group_id === groupIdRef.current;
    };

    const handleCompleted = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      const event = data as unknown as DraftCompletedEvent;
      if (!event.success || !event.draft_id) return;
      onCompletedRef.current?.(event.draft_id, event.form_state);
    };

    const handleFailed = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      const event = data as unknown as DraftFailedEvent;
      onFailedRef.current?.(event.message || "Draft save failed");
    };

    const unsubs = [
      transport.on(`${artifactType}.draft.completed`, handleCompleted),
      transport.on(`${artifactType}.draft.failed`, handleFailed),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [transport, artifactType]);
}
