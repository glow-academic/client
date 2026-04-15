/**
 * useArtifactGeneration — general-purpose generation event listener.
 *
 * Subscribes via the Transport abstraction (WebSocket or SSE depending on mode).
 * Returns a GenerationListener interface for the GenerationPanel.
 *
 * Events (parameterized by artifactType):
 *   {type}.generate.started       → generation started
 *   {type}.generate.completed     → generation done
 *   {type}.generate.failed        → generation error
 *   {type}.generate.text.progress → streaming text delta
 *   {type}.generate.text.complete → text done
 *   {type}.generate.call.start    → tool call started (spinner)
 *   {type}.generate.call.complete → tool call done (check/X)
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTransport } from "@/lib/transport";

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

export function useArtifactGeneration(
  artifactType: string | null,
  groupId: string | null,
): GenerationListener {
  const transport = useTransport();
  const [messages, setMessages] = useState<GenerationMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  const clearMessages = useCallback(() => setMessages([]), []);

  useEffect(() => {
    if (!artifactType) return;

    const prefix = `${artifactType}.generate`;

    const handleStarted = () => setIsGenerating(true);
    const handleCompleted = () => setIsGenerating(false);

    const handleFailed = (data: Record<string, unknown>) => {
      setIsGenerating(false);
      const message = (data.message as string) || "Generation failed";
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: message, type: "text" },
      ]);
    };

    const handleTextProgress = (data: Record<string, unknown>) => {
      const delta = data.delta as string;
      if (!delta) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.type === "text" && last.role === "assistant") {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, text: last.text + delta };
          return updated;
        }
        return [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", text: delta, type: "text" },
        ];
      });
    };

    const handleTextComplete = (data: Record<string, unknown>) => {
      const role = (data.role as string) || "assistant";
      const text = data.text as string;
      if (!text) return;
      if (role === "system" || role === "developer") return;
      if (role === "user") {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", text, type: "text" },
        ]);
        return;
      }
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

    // Subscribe via transport — works for both WebSocket and SSE
    const unsubs = [
      transport.on(`${prefix}.started`, handleStarted),
      transport.on(`${prefix}.completed`, handleCompleted),
      transport.on(`${prefix}.failed`, handleFailed),
      transport.on(`${prefix}.text.progress`, handleTextProgress),
      transport.on(`${prefix}.text.complete`, handleTextComplete),
      transport.on(`${prefix}.call.start`, handleCallStart),
      transport.on(`${prefix}.call.complete`, handleCallComplete),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [artifactType, transport]);

  return { messages, isGenerating, clearMessages, setGenerating: setIsGenerating };
}
