/**
 * useGenerationDraft — generic hook for syncing draft state from AI generation.
 *
 * Listens for `{artifact}.draft.completed` and `{artifact}.draft.failed`
 * WebSocket events emitted during AI generation tool calls.
 *
 * Keeps the client's draftId in sync with the server's append-only draft
 * entries. Each AI draft call creates a new entry — this hook picks up
 * the new draft_id and surfaces it via callback.
 *
 * Works for any artifact type (persona, scenario, document, etc.).
 */
"use client";

import { useEffect, useRef } from "react";
import { useSocket } from "@/contexts/socket-context";

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
  const { socket, isConnected } = useSocket();

  // Stable refs to avoid re-registering listeners on callback changes
  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  const onCompletedRef = useRef(onDraftCompleted);
  onCompletedRef.current = onDraftCompleted;

  const onFailedRef = useRef(onDraftFailed);
  onFailedRef.current = onDraftFailed;

  useEffect(() => {
    if (!socket || !isConnected) return;

    const s = socket as unknown as {
      on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
      off: (event: string, handler: (data: Record<string, unknown>) => void) => void;
    };

    const completedEvent = `${artifactType}.draft.completed`;
    const failedEvent = `${artifactType}.draft.failed`;

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

    s.on(completedEvent, handleCompleted);
    s.on(failedEvent, handleFailed);

    return () => {
      s.off(completedEvent, handleCompleted);
      s.off(failedEvent, handleFailed);
    };
  }, [socket, isConnected, artifactType]);
}
