/**
 * usePersonaGeneration — persona-specific hook for streaming field updates
 * during AI generation.
 *
 * Listens for `persona.draft.started` events to provide live field updates
 * as the AI generates them (streaming feel), and `persona.draft.completed`
 * for confirmed state.
 *
 * The "started" event carries the raw field values being saved — the client
 * can optimistically apply these to the form before the full save roundtrip.
 * The "completed" event confirms what was actually persisted.
 */
"use client";

import { useEffect, useRef } from "react";
import { useSocket } from "@/contexts/socket-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fields that can stream in from persona.draft.started */
export interface PersonaStreamingFields {
  name?: string;
  name_id?: string;
  description?: string;
  description_id?: string;
  color?: string;
  color_id?: string;
  icon?: string;
  icon_id?: string;
  instructions?: string;
  instructions_id?: string;
  active_flag?: string;
  active_flag_id?: string;
  departments?: string;
  department_ids?: string;
  examples?: string;
  example_ids?: string;
  voices?: string;
  voice_ids?: string;
  parameter_fields?: string;
  parameter_field_ids?: string;
}

/** Confirmed form state from persona.draft.completed */
export interface PersonaDraftFormState {
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
  form_state: PersonaDraftFormState;
}

interface UsePersonaGenerationConfig {
  /** Group ID to filter events */
  groupId: string | null;
  /**
   * Called when a draft starts saving — carries the raw field values.
   * Use this to optimistically update form fields (streaming feel).
   */
  onFieldsStreaming?: (fields: Partial<PersonaStreamingFields>) => void;
  /**
   * Called when a draft is confirmed saved — carries the resolved form state.
   * Use this to set the confirmed state and trigger refetch.
   */
  onDraftSaved?: (draftId: string, formState: PersonaDraftFormState) => void;
}

// ---------------------------------------------------------------------------
// Field extraction
// ---------------------------------------------------------------------------

/** Keys we care about from the started event (filter out metadata) */
const PERSONA_FIELD_KEYS = new Set([
  "name", "name_id",
  "description", "description_id",
  "color", "color_id",
  "icon", "icon_id",
  "instructions", "instructions_id",
  "active_flag", "active_flag_id",
  "departments", "department_ids",
  "examples", "example_ids",
  "voices", "voice_ids",
  "parameter_fields", "parameter_field_ids",
]);

function extractStreamingFields(
  data: Record<string, unknown>,
): Partial<PersonaStreamingFields> | null {
  const fields: Record<string, unknown> = {};
  let hasFields = false;

  for (const [key, value] of Object.entries(data)) {
    if (PERSONA_FIELD_KEYS.has(key) && value != null && value !== "") {
      fields[key] = value;
      hasFields = true;
    }
  }

  return hasFields ? (fields as Partial<PersonaStreamingFields>) : null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePersonaGeneration({
  groupId,
  onFieldsStreaming,
  onDraftSaved,
}: UsePersonaGenerationConfig): void {
  const { socket, isConnected } = useSocket();

  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  const onStreamingRef = useRef(onFieldsStreaming);
  onStreamingRef.current = onFieldsStreaming;

  const onSavedRef = useRef(onDraftSaved);
  onSavedRef.current = onDraftSaved;

  useEffect(() => {
    if (!socket || !isConnected) return;

    const s = socket as unknown as {
      on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
      off: (event: string, handler: (data: Record<string, unknown>) => void) => void;
    };

    const matchesGroup = (data: Record<string, unknown>): boolean => {
      if (!groupIdRef.current) return false;
      return data.group_id === groupIdRef.current;
    };

    const handleStarted = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      const fields = extractStreamingFields(data);
      if (fields) {
        onStreamingRef.current?.(fields);
      }
    };

    const handleCompleted = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      const event = data as unknown as DraftCompletedEvent;
      if (event.success && event.draft_id && event.form_state) {
        onSavedRef.current?.(event.draft_id, event.form_state);
      }
    };

    s.on("persona.draft.started", handleStarted);
    s.on("persona.draft.completed", handleCompleted);

    return () => {
      s.off("persona.draft.started", handleStarted);
      s.off("persona.draft.completed", handleCompleted);
    };
  }, [socket, isConnected]);
}
