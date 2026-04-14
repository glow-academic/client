/**
 * usePersonaGeneration — persona-specific generation listener.
 *
 * Listens for namespaced persona.generate.* events and returns the
 * primitive GenerationListener interface for the GenerationPanel.
 *
 * Events:
 *   persona.generate.started       → generation started
 *   persona.generate.completed     → generation done
 *   persona.generate.failed        → generation error
 *   persona.generate.text.progress → streaming text delta
 *   persona.generate.text.complete → text done
 *   persona.generate.call.start    → tool call started (spinner)
 *   persona.generate.call.complete → tool call done (check/X)
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/contexts/socket-context";

// ---------------------------------------------------------------------------
// Primitive interface — any artifact generation hook implements this
// ---------------------------------------------------------------------------

export interface GenerationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  type: "text" | "tool";
  toolName?: string;
  toolStatus?: "pending" | "success" | "error";
}

export interface GenerationListener {
  messages: GenerationMessage[];
  isGenerating: boolean;
  clearMessages: () => void;
  setGenerating: (value: boolean) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePersonaGeneration(groupId: string | null): GenerationListener {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<GenerationMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  const clearMessages = useCallback(() => setMessages([]), []);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const s = socket as unknown as {
      on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
      off: (event: string, handler: (data: Record<string, unknown>) => void) => void;
    };

    // --- Generation lifecycle ---

    const handleStarted = (_data: Record<string, unknown>) => {
      setIsGenerating(true);
    };

    const handleCompleted = (_data: Record<string, unknown>) => {
      setIsGenerating(false);
    };

    const handleFailed = (data: Record<string, unknown>) => {
      setIsGenerating(false);
      const message = (data.message as string) || "Generation failed";
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: message,
          type: "text",
        },
      ]);
    };

    // --- Text modality ---

    const handleTextProgress = (data: Record<string, unknown>) => {
      const delta = data.delta as string;
      if (!delta) return;

      setMessages((prev) => {
        // Append to existing streaming text message, or create new one
        const last = prev[prev.length - 1];
        if (last && last.type === "text" && last.role === "assistant") {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, text: last.text + delta };
          return updated;
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: delta,
            type: "text",
          },
        ];
      });
    };

    const handleTextComplete = (data: Record<string, unknown>) => {
      const role = (data.role as string) || "assistant";
      const text = data.text as string;
      if (!text) return;

      // Skip system/developer messages — they're prompt context
      if (role === "system" || role === "developer") return;

      // If this is a user message (from prepare), add it directly
      if (role === "user") {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", text, type: "text" },
        ]);
        return;
      }

      // For assistant text.complete, replace the last streaming message
      // (accumulated from text.progress deltas) with the final text
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.type === "text" && last.role === "assistant") {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, text };
          return updated;
        }
        return [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", text, type: "text" },
        ];
      });
    };

    // --- Call modality (tool calls) ---

    const handleCallStart = (data: Record<string, unknown>) => {
      const toolCallId = data.tool_call_id as string;
      const toolName = data.tool_name as string;
      if (!toolCallId) return;

      setMessages((prev) => [
        ...prev,
        {
          id: toolCallId,
          role: "assistant",
          text: "",
          type: "tool",
          toolName: toolName || "tool_call",
          toolStatus: "pending",
        },
      ]);
    };

    const handleCallComplete = (data: Record<string, unknown>) => {
      const toolCallId = data.tool_call_id as string;
      const success = data.success as boolean;
      if (!toolCallId) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === toolCallId
            ? { ...msg, toolStatus: success ? "success" : "error" }
            : msg,
        ),
      );
    };

    // Subscribe
    s.on("persona.generate.started", handleStarted);
    s.on("persona.generate.completed", handleCompleted);
    s.on("persona.generate.failed", handleFailed);
    s.on("persona.generate.text.progress", handleTextProgress);
    s.on("persona.generate.text.complete", handleTextComplete);
    s.on("persona.generate.call.start", handleCallStart);
    s.on("persona.generate.call.complete", handleCallComplete);

    return () => {
      s.off("persona.generate.started", handleStarted);
      s.off("persona.generate.completed", handleCompleted);
      s.off("persona.generate.failed", handleFailed);
      s.off("persona.generate.text.progress", handleTextProgress);
      s.off("persona.generate.text.complete", handleTextComplete);
      s.off("persona.generate.call.start", handleCallStart);
      s.off("persona.generate.call.complete", handleCallComplete);
    };
  }, [socket, isConnected]);

  return { messages, isGenerating, clearMessages, setGenerating: setIsGenerating };
}
