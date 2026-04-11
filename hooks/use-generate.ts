/**
 * useGenerate — canonical hook for the AI generation panel.
 *
 * Emits `generate` with permissions + resources, listens for
 * generate_call_* events to track tool calls and responses.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/contexts/socket-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Permission {
  artifact: string;
  operation: string;
}

export interface GenerateMessage {
  role: "user" | "assistant";
  text: string;
  type?: "text" | "tool";
  toolName?: string;
  toolStatus?: "success" | "error";
}

interface UseGenerateConfig {
  /** Which tools the AI can use */
  permissions: Permission[];
  /** Field-level filter within artifact tools (empty = all) */
  resources?: string[];
  /** Group correlation ID */
  groupId: string | null;
}

interface GenerateOptions {
  /** Override resources filter for this call */
  resources?: string[];
  /** Target artifact ID (for existing artifacts) */
  artifactId?: string;
  /** Contextual parameters the model can pass to tools (draft_id, etc.) */
  params?: Record<string, string>;
}

interface UseGenerateReturn {
  /** Send a generation request */
  generate: (instructions: string, options?: GenerateOptions) => void;
  /** Chat messages (user + assistant + tool calls) */
  messages: GenerateMessage[];
  /** Whether a generation is in progress */
  isGenerating: boolean;
  /** Clear messages */
  clearMessages: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGenerate({
  permissions,
  resources,
  groupId,
}: UseGenerateConfig): UseGenerateReturn {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<GenerateMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Stable ref for groupId to avoid re-registering listeners
  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  const permissionsRef = useRef(permissions);
  permissionsRef.current = permissions;

  const resourcesRef = useRef(resources);
  resourcesRef.current = resources;

  // --- Emit ---

  const generate = useCallback(
    (instructions: string, options?: {
      resources?: string[];
      artifactId?: string;
      params?: Record<string, string>;
    }) => {
      if (!socket || !isConnected || !groupIdRef.current) return;

      // Add user message immediately
      setMessages((prev) => [
        ...prev,
        { role: "user", text: instructions },
      ]);
      setIsGenerating(true);

      const resolvedResources = options?.resources ?? resourcesRef.current ?? [];

      socket.emit("generate", {
        permissions: permissionsRef.current,
        resources: resolvedResources,
        group_id: groupIdRef.current,
        user_instructions: [instructions],
        modality: "call",
        ...(options?.artifactId && { artifact_id: options.artifactId }),
        ...(options?.params && { params: options.params }),
      });
    },
    [socket, isConnected],
  );

  // --- Listen ---

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Cast for dynamic event names
    const s = socket as unknown as {
      on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
      off: (event: string, handler: (data: Record<string, unknown>) => void) => void;
    };

    const matchesGroup = (data: Record<string, unknown>): boolean => {
      if (!groupIdRef.current) return false;
      return data.group_id === groupIdRef.current;
    };

    const handleCallStart = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      const toolName = (data.tool_name as string) || (data.resource_type as string) || "unknown";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: toolName,
          type: "tool",
          toolName,
          toolStatus: undefined,
        },
      ]);
    };

    const handleCallComplete = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      const toolName = (data.tool_name as string) || "";
      const success = data.success !== false;

      // Update the last tool message with status
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].type === "tool" && updated[i].toolName === toolName && !updated[i].toolStatus) {
            updated[i] = { ...updated[i], toolStatus: success ? "success" : "error" };
            break;
          }
        }
        return updated;
      });
    };

    const handleCallProgress = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      // Progress updates — could add streaming text here later
    };

    const handleCallError = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      const message = (data.error_message as string) || (data.message as string) || "Generation failed";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: message },
      ]);
      setIsGenerating(false);
    };

    // Listen for generation lifecycle events (per-artifact-type)
    const handleGenerationComplete = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      const message = (data.message as string) || "Generation complete";
      const success = data.success !== false;
      if (success) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: message },
        ]);
      }
      setIsGenerating(false);
    };

    s.on("generate_call_start", handleCallStart);
    s.on("generate_call_complete", handleCallComplete);
    s.on("generate_call_progress", handleCallProgress);
    s.on("generate_call_error", handleCallError);

    // Also listen for the per-artifact completion events
    // These use the pattern: {artifact_type}_generation_complete
    // We listen broadly and filter by group_id
    const artifactTypes = permissionsRef.current.map((p) => p.artifact);
    const uniqueArtifacts = [...new Set(artifactTypes)];
    const completeHandlers: [string, (data: Record<string, unknown>) => void][] = [];

    for (const artifact of uniqueArtifacts) {
      const event = `${artifact}_generation_complete`;
      s.on(event, handleGenerationComplete);
      completeHandlers.push([event, handleGenerationComplete]);
    }

    return () => {
      s.off("generate_call_start", handleCallStart);
      s.off("generate_call_complete", handleCallComplete);
      s.off("generate_call_progress", handleCallProgress);
      s.off("generate_call_error", handleCallError);
      for (const [event, handler] of completeHandlers) {
        s.off(event, handler);
      }
    };
  }, [socket, isConnected]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setIsGenerating(false);
  }, []);

  return {
    generate,
    messages,
    isGenerating,
    clearMessages,
  };
}
