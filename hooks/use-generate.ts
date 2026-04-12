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

      // User message will arrive via generate_text_complete event from server
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

    // --- Tool call events ---

    const handleCallStart = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      const toolName = (data.tool_name as string) || (data.resource_type as string) || "tool";
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

    const handleCallProgress = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      // Tool call arg streaming — not rendered
    };

    const handleCallComplete = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      const success = data.success !== false;

      // Match by tool name on the last pending tool pill
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].type === "tool" && !updated[i].toolStatus) {
            updated[i] = { ...updated[i], toolStatus: success ? "success" : "error" };
            break;
          }
        }
        return updated;
      });
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

    // --- Text streaming events ---

    const handleTextStart = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      // Add a streaming placeholder that will accumulate deltas
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "", type: "text" },
      ]);
    };

    const handleTextProgress = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      const delta = (data.delta as string) || "";
      if (!delta) return;

      // Append delta to the last streaming text message
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === "assistant" && updated[i].type === "text") {
            updated[i] = { ...updated[i], text: updated[i].text + delta };
            break;
          }
        }
        return updated;
      });
    };

    const handleTextComplete = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      const text = (data.text as string) || "";
      const role = (data.role as "user" | "assistant") || "assistant";

      if (role === "user") {
        // User message event from server — add as user bubble
        setMessages((prev) => [...prev, { role: "user", text }]);
        return;
      }

      // Finalize the streaming assistant message with the complete text
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === "assistant" && updated[i].type === "text") {
            updated[i] = { ...updated[i], text, type: undefined };
            break;
          }
        }
        return updated;
      });
    };

    // --- Run complete ---

    const handleRunComplete = (data: Record<string, unknown>) => {
      if (!matchesGroup(data)) return;
      setIsGenerating(false);
    };

    s.on("generate_call_start", handleCallStart);
    s.on("generate_call_complete", handleCallComplete);
    s.on("generate_call_progress", handleCallProgress);
    s.on("generate_call_error", handleCallError);
    s.on("generate_text_start", handleTextStart);
    s.on("generate_text_progress", handleTextProgress);
    s.on("generate_text_complete", handleTextComplete);
    s.on("generate_run_complete", handleRunComplete);

    return () => {
      s.off("generate_call_start", handleCallStart);
      s.off("generate_call_complete", handleCallComplete);
      s.off("generate_call_progress", handleCallProgress);
      s.off("generate_call_error", handleCallError);
      s.off("generate_text_start", handleTextStart);
      s.off("generate_text_progress", handleTextProgress);
      s.off("generate_text_complete", handleTextComplete);
      s.off("generate_run_complete", handleRunComplete);
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
