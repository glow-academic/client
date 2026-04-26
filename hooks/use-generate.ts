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

export interface GenerateMessage {
  role: "user" | "assistant";
  text: string;
  type?: "text" | "tool";
  toolName?: string;
  toolStatus?: "success" | "error";
}

interface UseGenerateConfig {
  /** Artifact type for this generation context */
  artifactType: string;
  /** Operations the AI can perform (e.g. ["draft", "get", "docs"]) */
  operations: string[];
  /** Group correlation ID */
  groupId: string | null;
}

interface GenerateOptions {
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
  artifactType,
  operations,
  groupId,
}: UseGenerateConfig): UseGenerateReturn {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<GenerateMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Stable ref for groupId to avoid re-registering listeners
  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  const operationsRef = useRef(operations);
  operationsRef.current = operations;

  // --- Emit ---

  const generate = useCallback(
    (instructions: string, options?: {
      artifactId?: string;
      params?: Record<string, string>;
    }) => {
      if (!socket || !isConnected || !groupIdRef.current) return;

      // User message will arrive via generate_text_complete event from server
      setIsGenerating(true);

      // Merge artifactId into params so the server's prepare pipeline can read
      // it via payload_params.get("artifact_id"). Without this the LLM is
      // never told about an existing artifact and treats every generation as
      // a fresh-create flow.
      const mergedParams: Record<string, string> = {
        ...(options?.params ?? {}),
        ...(options?.artifactId ? { artifact_id: options.artifactId } : {}),
      };

      socket.emit("generate", {
        artifact: artifactType,
        instructions: [instructions],
        operations: operationsRef.current,
        group_id: groupIdRef.current,
        modality: "call",
        ...(Object.keys(mergedParams).length > 0 && { params: mergedParams }),
      });
    },
    [socket, isConnected, artifactType],
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

    // Canonical artifact-scoped event names: {artifact}.generate.{sub}.{phase}
    const ev = (sub: string, phase: string) =>
      `${artifactType}.generate.${sub}.${phase}`;
    s.on(ev("call", "start"), handleCallStart);
    s.on(ev("call", "complete"), handleCallComplete);
    s.on(ev("call", "progress"), handleCallProgress);
    s.on(ev("call", "error"), handleCallError);
    s.on(ev("text", "start"), handleTextStart);
    s.on(ev("text", "progress"), handleTextProgress);
    s.on(ev("text", "complete"), handleTextComplete);
    s.on(`${artifactType}.generate.completed`, handleRunComplete);

    return () => {
      s.off(ev("call", "start"), handleCallStart);
      s.off(ev("call", "complete"), handleCallComplete);
      s.off(ev("call", "progress"), handleCallProgress);
      s.off(ev("call", "error"), handleCallError);
      s.off(ev("text", "start"), handleTextStart);
      s.off(ev("text", "progress"), handleTextProgress);
      s.off(ev("text", "complete"), handleTextComplete);
      s.off(`${artifactType}.generate.completed`, handleRunComplete);
    };
  }, [socket, isConnected, artifactType]);

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
