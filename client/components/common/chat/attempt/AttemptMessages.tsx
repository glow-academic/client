/**
 * AttemptMessages.tsx
 * Used to display the attempt messages. This will show the messages from the assistant, and the user. It will properly handle loading states, and will call as needed the above functions for context. It will eventually be able to play audio for each message and provide more custom streaming logic.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import {
  AlertCircle,
  ArrowDown,
  Lightbulb,
  MessageSquare,
  RotateCcw,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// UI Components
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { createFeedback } from "@/app/(main)/layout-server";
import HintDisplay from "@/components/common/chat/HintDisplay";
import Markdown from "@/components/common/chat/markdown/Markdown";
import ReportProblem from "@/components/common/layout/ReportProblem";
import { LoadingDots } from "@/components/ui/loading-dots";
import { useProfile } from "@/contexts/profile-context";
import { getPersonaIconComponent } from "@/utils/persona-icons";
import { useRouter } from "next/navigation";

export interface AttemptMessagesProps {
  chatId?: string;
  isAttemptOwner?: boolean;
  messages: Array<{
    id: string;
    type: string;
    content: string;
    createdAt: string;
    completed?: boolean;
    personaId?: string;
  }>;
  currentChat: { id: string; completed?: boolean } | null;
  sendMessage: (message: string, isRetry?: boolean) => void;
  isSendingMessage: boolean;
  isActive: boolean;
  simulation: {
    timeLimit?: number | null;
    practiceSimulation?: boolean;
  } | null;
  currentChatHints?: Array<{
    messageId: string;
    hints: Array<{
      simulationMessageId: string;
      hint: string;
      idx: number;
      createdAt: string;
    }>;
  }>;
  personas?: Array<{
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  }>;
  scenario?: {
    personaName?: string | null;
    personaIcon?: string | null;
    personaColor?: string | null;
  } | null;
  backgroundImage?: string | null;
}

// Utility function to generate gradient from hex color (same as PersonaPicker)
const generateGradientFromHex = (hexColor: string): string => {
  // Remove # if present
  const cleanHex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);

  // Create a lighter variant for the gradient (brighter like simulation cards)
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);

  // Convert back to hex
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;

  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

// Utility function to normalize message content for comparison (trim + lowercase)
const normalizeMessageContent = (content: string): string => {
  return content.trim().toLowerCase();
};

export default function AttemptMessages({
  chatId,
  isAttemptOwner = true,
  messages: propMessages,
  currentChat,
  sendMessage,
  isSendingMessage,
  isActive,
  simulation,
  currentChatHints = [],
  personas,
  scenario: _scenario,
  backgroundImage,
}: AttemptMessagesProps) {
  const { socket } = useProfile();
  const router = useRouter();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevChatIdRef = useRef<string | null>(null);
  // Track item_id -> optimistic_message_id mapping for voice mode
  const itemIdToOptimisticIdRef = useRef<Map<string, string>>(new Map());
  // Track transcript deltas accumulation per item_id (using ref to avoid state sync issues)
  const transcriptDeltasRef = useRef<Map<string, string>>(new Map());
  const targetChatId = chatId || currentChat?.id;

  // Create persona lookup map for efficient persona lookup by ID
  const personaMap = useMemo(() => {
    if (!personas)
      return new Map<
        string,
        { id: string; name: string; icon: string | null; color: string | null }
      >();
    return new Map(personas.map((p) => [p.id, p]));
  }, [personas]);

  // State for hints modal
  const [selectedHintMessageId, setSelectedHintMessageId] = useState<
    string | null
  >(null);
  const [messagesWithNewHints, setMessagesWithNewHints] = useState<Set<string>>(
    new Set()
  );

  // State to track if report dialog is open
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  // State to track streaming content for messages (messageId -> accumulatedContent)
  const [streamingContent, setStreamingContent] = useState<Map<string, string>>(
    new Map()
  );

  // State to track optimistic messages from WebSocket events
  const [optimisticMessages, setOptimisticMessages] = useState<
    Map<
      string,
      {
        id: string;
        type: string; // "query" | "response"
        content: string;
        createdAt: string;
        completed: boolean;
        personaId?: string;
      }
    >
  >(new Map());

  // Get messages from props
  // Merge with optimistic messages and streaming content for real-time updates
  // This ensures messages persist even when propMessages is temporarily empty during router.refresh()
  const messages = useMemo(() => {
    // If propMessages is null/undefined, return only optimistic messages
    if (!propMessages) return Array.from(optimisticMessages.values());

    // Start with propMessages (may be empty array during refresh transition)
    const messageMap = new Map<string, (typeof propMessages)[number]>();
    propMessages.forEach((msg) => messageMap.set(msg.id, msg));

    // Add optimistic messages not yet in propMessages
    // This preserves messages during refresh transitions when propMessages is temporarily empty
    optimisticMessages.forEach((optMsg, id) => {
      if (!messageMap.has(id)) {
        messageMap.set(id, optMsg);
      }
    });

    // Apply streaming content to all messages
    const messagesWithStreaming = Array.from(messageMap.values()).map((msg) => {
      const streaming = streamingContent.get(msg.id);
      if (
        streaming !== undefined &&
        (!msg.completed || streaming.length > msg.content.length)
      ) {
        return { ...msg, content: streaming };
      }
      return msg;
    });

    // Deduplicate user messages by content (not just ID)
    // This fixes the issue where temp optimistic messages aren't replaced when content matching fails
    const deduplicatedMessages: typeof messagesWithStreaming = [];
    const seenContent = new Map<string, string>(); // normalizedContent -> messageId

    for (const msg of messagesWithStreaming) {
      // Only deduplicate user messages (type === "query")
      if (msg.type === "query") {
        const normalizedContent = normalizeMessageContent(msg.content);
        const existingMessageId = seenContent.get(normalizedContent);

        if (existingMessageId) {
          // Duplicate content found - prefer the message with real ID (not optimistic temp ID)
          const isCurrentOptimistic = msg.id.startsWith("optimistic-user-");
          const isExistingOptimistic =
            existingMessageId.startsWith("optimistic-user-");

          if (isCurrentOptimistic && !isExistingOptimistic) {
            // Current is optimistic, existing is real - skip current
            continue;
          } else if (!isCurrentOptimistic && isExistingOptimistic) {
            // Current is real, existing is optimistic - replace existing
            const existingIndex = deduplicatedMessages.findIndex(
              (m) => m.id === existingMessageId
            );
            if (existingIndex !== -1) {
              deduplicatedMessages[existingIndex] = msg;
              seenContent.set(normalizedContent, msg.id);
            }
            continue;
          } else {
            // Both are same type - prefer the one from propMessages (server data)
            const currentIsFromProps = propMessages.some(
              (m) => m.id === msg.id
            );
            const existingIsFromProps = propMessages.some(
              (m) => m.id === existingMessageId
            );

            if (currentIsFromProps && !existingIsFromProps) {
              // Current is from props, existing is not - replace existing
              const existingIndex = deduplicatedMessages.findIndex(
                (m) => m.id === existingMessageId
              );
              if (existingIndex !== -1) {
                deduplicatedMessages[existingIndex] = msg;
                seenContent.set(normalizedContent, msg.id);
              }
              continue;
            } else {
              // Skip duplicate - keep existing
              continue;
            }
          }
        } else {
          // No duplicate found - add message
          seenContent.set(normalizedContent, msg.id);
          deduplicatedMessages.push(msg);
        }
      } else {
        // Not a user message - add without deduplication
        deduplicatedMessages.push(msg);
      }
    }

    return deduplicatedMessages;
  }, [propMessages, optimisticMessages, streamingContent]);

  // Sort messages chronologically (no grouping)
  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messages]);

  const starterPrompts = useMemo(() => {
    const basePrompts = [
      "Hi, how are you?",
      "What can I help you with?",
      "I'm ready to assist you today",
    ];
    return basePrompts.slice(0, 3);
  }, []);

  const handleStarterPromptClick = (prompt: string) => {
    // Create optimistic user message immediately for instant feedback
    const tempId = `optimistic-user-${Date.now()}-${Math.random()}`;
    setOptimisticMessages((prev) => {
      const newMap = new Map(prev);
      newMap.set(tempId, {
        id: tempId,
        type: "query",
        content: prompt,
        createdAt: new Date().toISOString(),
        completed: true,
      });
      return newMap;
    });
    sendMessage(prompt);
  };

  const handleRetry = (errorMessageIndex: number) => {
    // Find the previous user message to retry with
    const sortedMessages = messages.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Find the previous user message (query type) that came before this error
    const previousUserMessage = sortedMessages
      .slice(0, errorMessageIndex)
      .reverse()
      .find((msg) => msg.type === "query");

    if (previousUserMessage) {
      // Retry with the previous user message content
      sendMessage(previousUserMessage.content, true);
    }
  };

  const scrollToBottom = () => {
    const scrollArea = scrollAreaRef.current;
    if (scrollArea) {
      const viewport = scrollArea.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement;
      if (viewport)
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      setTimeout(() => setShowScrollButton(false), 300);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
    return () => {};
  }, [messages.length, messages]);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    const viewport = scrollArea.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement;
    if (!viewport) return;
    const handleScrollEvent = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      const hasScrollableContent = scrollHeight > clientHeight + 10;
      setShowScrollButton(hasScrollableContent && !isNearBottom);
    };
    handleScrollEvent();
    viewport.addEventListener("scroll", handleScrollEvent);
    return () => viewport.removeEventListener("scroll", handleScrollEvent);
  }, [messages.length, messages]);

  // Clear streaming content and optimistic messages when chat changes
  // BUT preserve messages if we're just refreshing the same chat (targetChatId hasn't actually changed)
  useEffect(() => {
    // Only clear if targetChatId actually changed (not just a re-render)
    // This prevents clearing messages during router.refresh() when staying on the same chat
    const currentChatId = targetChatId ?? null;
    if (
      prevChatIdRef.current !== null &&
      prevChatIdRef.current !== currentChatId
    ) {
      // Chat actually changed, clear optimistic state
      setStreamingContent(new Map());
      setOptimisticMessages(new Map());
      transcriptDeltasRef.current.clear(); // Clear transcript deltas
      itemIdToOptimisticIdRef.current = new Map(); // Reset item_id mapping
    }
    prevChatIdRef.current = currentChatId;
  }, [targetChatId]);

  // Clear streaming content for completed messages when SSR data refreshes
  // Also clear optimistic messages that are now in SSR data
  // Add grace period to prevent premature clearing of messages that are still being updated
  useEffect(() => {
    // Don't clear if propMessages is undefined or empty - might be during refresh transition
    // This preserves optimistic messages and streaming content during router.refresh() gaps
    if (!propMessages || propMessages.length === 0) return;

    // Add grace period before clearing optimistic messages (500ms)
    // This prevents clearing messages that are still being updated with deltas
    const gracePeriodTimeout = setTimeout(() => {
      // Clear streaming content for messages that are completed in SSR data
      setStreamingContent((prev) => {
        const newMap = new Map(prev);
        let changed = false;
        propMessages.forEach((msg) => {
          if (msg.completed && newMap.has(msg.id)) {
            // Only clear if SSR content matches or is longer (SSR has final content)
            const streaming = newMap.get(msg.id);
            if (streaming && msg.content.length >= streaming.length) {
              newMap.delete(msg.id);
              changed = true;
            }
          }
        });
        return changed ? newMap : prev;
      });

      // Clear optimistic messages that are now in SSR data
      // BUT: Don't clear if they're still accumulating deltas (voice messages being updated)
      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        let changed = false;
        const propMessageIds = new Set(propMessages.map((msg) => msg.id));
        newMap.forEach((_msg, id) => {
          // Check if this optimistic message is still accumulating deltas
          let hasActiveDeltas = false;
          for (const [
            itemId,
            optId,
          ] of itemIdToOptimisticIdRef.current.entries()) {
            if (optId === id && transcriptDeltasRef.current.has(itemId)) {
              hasActiveDeltas = true;
              break;
            }
          }

          // Only clear if message is in SSR data AND not accumulating deltas
          if (propMessageIds.has(id) && !hasActiveDeltas) {
            newMap.delete(id);
            changed = true;
          }
        });
        return changed ? newMap : prev;
      });
    }, 500); // 500ms grace period

    return () => clearTimeout(gracePeriodTimeout);
  }, [targetChatId, propMessages]);

  // Listen for streaming token events to update message content in real-time
  useEffect(() => {
    if (!socket) return;

    const handleSimulationMessageToken = (data: {
      message_id: string;
      chat_id: string;
      token: string;
      accumulated_content: string;
    }) => {
      // Only update if this token is for the current chat
      if (
        data.chat_id === targetChatId &&
        data.accumulated_content !== undefined
      ) {
        setStreamingContent((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.message_id, data.accumulated_content);
          return newMap;
        });
      }
    };

    // Listen for message completion - keep streaming content until SSR refresh completes
    // The streaming content will be cleared when SSR data is refreshed and has the final content
    const handleSimulationMessageComplete = (data: {
      message_id: string;
      chat_id: string;
      final_content: string;
    }) => {
      if (data.chat_id === targetChatId && data.final_content !== undefined) {
        // Update streaming content with final content to prevent flicker
        // This will be cleared when SSR data refreshes
        setStreamingContent((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.message_id, data.final_content);
          return newMap;
        });
      }
    };

    const handleSimulationNewMessage = (data: {
      message_id: string;
      chat_id: string;
      role: string;
      content: string;
      completed: boolean;
      created_at: string;
      persona_id?: string;
    }) => {
      if (data.chat_id === targetChatId) {
        // Convert role to type (user -> query, assistant -> response)
        const type = data.role === "user" ? "query" : "response";
        setOptimisticMessages((prev) => {
          const newMap = new Map(prev);

          // For user messages, check if there's a matching optimistic message to replace
          if (type === "query") {
            const normalizedContent = normalizeMessageContent(data.content);
            let foundMatch = false;

            // First, try to find matching optimistic message by content
            // Match both regular optimistic messages and voice optimistic messages
            // Use fuzzy matching to handle slight differences between deltas and final transcript
            let matchedOptimisticId: string | null = null;
            for (const [tempId, optMsg] of newMap.entries()) {
              if (
                optMsg.type === "query" &&
                (tempId.startsWith("optimistic-user-") ||
                  tempId.startsWith("optimistic-user-voice-"))
              ) {
                const optNormalized = normalizeMessageContent(optMsg.content);
                // Exact match
                if (optNormalized === normalizedContent) {
                  matchedOptimisticId = tempId;
                  newMap.delete(tempId);
                  foundMatch = true;
                  break;
                }
                // Fuzzy match: check if one contains the other (handles delta vs final transcript differences)
                // Only match if content is substantial (more than 5 chars) to avoid false matches
                if (
                  optNormalized.length > 5 &&
                  normalizedContent.length > 5 &&
                  (optNormalized.includes(normalizedContent) ||
                    normalizedContent.includes(optNormalized))
                ) {
                  // Prefer voice optimistic messages for fuzzy matching
                  if (
                    !matchedOptimisticId ||
                    tempId.startsWith("optimistic-user-voice-")
                  ) {
                    matchedOptimisticId = tempId;
                  }
                }
              }
            }
            // If we found a fuzzy match, use it
            if (matchedOptimisticId && !foundMatch) {
              newMap.delete(matchedOptimisticId);
              foundMatch = true;
            }

            // Clean up item_id mapping and delta state if we found a match
            if (foundMatch && matchedOptimisticId) {
              // Find and remove the item_id mapping for this optimistic message
              let matchedItemId: string | null = null;
              for (const [
                itemId,
                optId,
              ] of itemIdToOptimisticIdRef.current.entries()) {
                if (optId === matchedOptimisticId) {
                  matchedItemId = itemId;
                  itemIdToOptimisticIdRef.current.delete(itemId);
                  break;
                }
              }
              // Clear delta state for the matched item_id
              if (matchedItemId) {
                transcriptDeltasRef.current.delete(matchedItemId);
              }
            }

            // If no content match found, check for voice optimistic messages that might not have content yet
            // This handles race conditions where simulation_new_message arrives before voice_transcript_ready
            if (!foundMatch) {
              // Look for any voice optimistic message that hasn't been replaced
              // Prefer ones with empty content (speech started but transcript not ready yet)
              // or ones with matching content (transcript ready but content normalization failed)
              for (const [tempId, optMsg] of newMap.entries()) {
                if (
                  optMsg.type === "query" &&
                  tempId.startsWith("optimistic-user-voice-")
                ) {
                  const optContent = normalizeMessageContent(optMsg.content);
                  // Match if content is empty (speech started) or matches (transcript ready)
                  if (optContent === "" || optContent === normalizedContent) {
                    matchedOptimisticId = tempId;
                    newMap.delete(tempId);
                    foundMatch = true;
                    // eslint-disable-next-line no-console
                    console.log(
                      "[Voice] Replaced optimistic message by fallback matching:",
                      {
                        optimistic_id: tempId,
                        real_id: data.message_id,
                        optimistic_content: optMsg.content.substring(0, 50),
                        real_content: data.content.substring(0, 50),
                      }
                    );
                    break;
                  }
                }
              }

              // Clean up item_id mapping and delta state if we found a fallback match
              if (foundMatch && matchedOptimisticId) {
                let matchedItemId: string | null = null;
                for (const [
                  itemId,
                  optId,
                ] of itemIdToOptimisticIdRef.current.entries()) {
                  if (optId === matchedOptimisticId) {
                    matchedItemId = itemId;
                    itemIdToOptimisticIdRef.current.delete(itemId);
                    break;
                  }
                }
                // Clear delta state for the matched item_id
                if (matchedItemId) {
                  transcriptDeltasRef.current.delete(matchedItemId);
                }
              }
            }

            // If still no match, try to find any optimistic user message as last resort
            // This handles edge cases where content might have slight differences
            if (!foundMatch) {
              for (const [tempId, optMsg] of newMap.entries()) {
                if (
                  optMsg.type === "query" &&
                  tempId.startsWith("optimistic-user-voice-")
                ) {
                  // Replace the most recent voice optimistic message if no better match found
                  matchedOptimisticId = tempId;
                  newMap.delete(tempId);
                  foundMatch = true;
                  // eslint-disable-next-line no-console
                  console.log(
                    "[Voice] Replaced optimistic message as fallback (no content match):",
                    {
                      optimistic_id: tempId,
                      real_id: data.message_id,
                    }
                  );
                  break;
                }
              }

              // Clean up item_id mapping and delta state for last resort match
              if (foundMatch && matchedOptimisticId) {
                let matchedItemId: string | null = null;
                for (const [
                  itemId,
                  optId,
                ] of itemIdToOptimisticIdRef.current.entries()) {
                  if (optId === matchedOptimisticId) {
                    matchedItemId = itemId;
                    itemIdToOptimisticIdRef.current.delete(itemId);
                    break;
                  }
                }
                // Clear delta state for the matched item_id
                if (matchedItemId) {
                  transcriptDeltasRef.current.delete(matchedItemId);
                }
              }
            }
          }

          // Add the real message (or new message if no match found)
          const optimisticMessage: {
            id: string;
            type: string;
            content: string;
            createdAt: string;
            completed: boolean;
            personaId?: string;
          } = {
            id: data.message_id,
            type,
            content: data.content,
            createdAt: data.created_at,
            completed: data.completed,
          };
          if (data.persona_id) {
            optimisticMessage.personaId = data.persona_id;
          }
          newMap.set(data.message_id, optimisticMessage);
          return newMap;
        });
      }
    };

    // Listen for voice mode events
    const handleVoiceSpeechStarted = (data: {
      chat_id: string;
      item_id: string;
    }) => {
      if (data.chat_id === targetChatId) {
        // Generate optimistic message ID locally
        const optimisticMessageId = `optimistic-user-voice-${Date.now()}-${Math.random()}`;

        // Clear old incomplete optimistic voice messages before creating new one
        // This prevents multiple loading states from appearing and messages getting stuck
        setOptimisticMessages((prev) => {
          const newMap = new Map(prev);
          // Remove all incomplete optimistic voice messages
          for (const [id, msg] of newMap.entries()) {
            if (
              id.startsWith("optimistic-user-voice-") &&
              (msg.content === "" || !msg.completed)
            ) {
              newMap.delete(id);
              // Clean up stale item_id mappings
              for (const [
                itemId,
                optId,
              ] of itemIdToOptimisticIdRef.current.entries()) {
                if (optId === id) {
                  itemIdToOptimisticIdRef.current.delete(itemId);
                }
              }
            }
          }
          return newMap;
        });

        // Store mapping from item_id to optimistic_message_id
        itemIdToOptimisticIdRef.current.set(data.item_id, optimisticMessageId);

        // Create optimistic user message with empty content (will show LoadingDots)
        setOptimisticMessages((prev) => {
          const newMap = new Map(prev);
          newMap.set(optimisticMessageId, {
            id: optimisticMessageId,
            type: "query",
            content: "", // Empty content will trigger LoadingDots display
            createdAt: new Date().toISOString(),
            completed: false,
          });
          return newMap;
        });
        // eslint-disable-next-line no-console
        console.log("[Voice] Created optimistic message for speech started:", {
          optimistic_message_id: optimisticMessageId,
          item_id: data.item_id,
        });
      }
    };

    const handleVoiceTranscriptDelta = (data: {
      chat_id: string;
      item_id: string;
      delta: string;
      content_index: number;
    }) => {
      if (data.chat_id === targetChatId) {
        // Look up optimistic message ID by item_id
        const optimisticMessageId = itemIdToOptimisticIdRef.current.get(
          data.item_id
        );

        if (optimisticMessageId) {
          // Accumulate delta text in ref
          const currentAccumulated =
            transcriptDeltasRef.current.get(data.item_id) || "";
          const newAccumulated = currentAccumulated + data.delta;
          transcriptDeltasRef.current.set(data.item_id, newAccumulated);

          // Update optimistic message with accumulated deltas
          setOptimisticMessages((prev) => {
            const newMap = new Map(prev);
            const existingMessage = newMap.get(optimisticMessageId);
            if (existingMessage) {
              newMap.set(optimisticMessageId, {
                ...existingMessage,
                content: newAccumulated,
              });
            }
            return newMap;
          });
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            "[Voice] No optimistic message found for item_id in delta:",
            data.item_id
          );
        }
      }
    };

    const handleVoiceTranscriptReady = (data: {
      chat_id: string;
      item_id: string;
      transcript: string;
    }) => {
      if (data.chat_id === targetChatId) {
        // Clear delta state for this item_id (final transcript overrides accumulated deltas)
        transcriptDeltasRef.current.delete(data.item_id);

        // Look up optimistic message ID by item_id
        const optimisticMessageId = itemIdToOptimisticIdRef.current.get(
          data.item_id
        );

        if (optimisticMessageId) {
          // Update optimistic message with final transcript (overrides accumulated deltas)
          setOptimisticMessages((prev) => {
            const newMap = new Map(prev);
            const existingMessage = newMap.get(optimisticMessageId);
            if (existingMessage) {
              newMap.set(optimisticMessageId, {
                ...existingMessage,
                content: data.transcript,
                completed: true,
              });
              // eslint-disable-next-line no-console
              console.log(
                "[Voice] Updated optimistic message with final transcript:",
                {
                  optimistic_message_id: optimisticMessageId,
                  item_id: data.item_id,
                  transcript: data.transcript.substring(0, 100),
                }
              );
            }
            return newMap;
          });

          // Keep the mapping until the real message arrives (for better matching)
          // The mapping will be cleaned up when simulation_new_message replaces the optimistic message
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            "[Voice] No optimistic message found for item_id:",
            data.item_id
          );
        }
      }
    };

    socket.on("simulation_message_token", handleSimulationMessageToken);
    socket.on("simulation_message_complete", handleSimulationMessageComplete);
    socket.on("simulation_new_message", handleSimulationNewMessage);
    socket.on("voice_speech_started", handleVoiceSpeechStarted);
    socket.on("voice_transcript_delta", handleVoiceTranscriptDelta);
    socket.on("voice_transcript_ready", handleVoiceTranscriptReady);

    return () => {
      socket.off("simulation_message_token", handleSimulationMessageToken);
      socket.off(
        "simulation_message_complete",
        handleSimulationMessageComplete
      );
      socket.off("simulation_new_message", handleSimulationNewMessage);
      socket.off("voice_speech_started", handleVoiceSpeechStarted);
      socket.off("voice_transcript_delta", handleVoiceTranscriptDelta);
      socket.off("voice_transcript_ready", handleVoiceTranscriptReady);
    };
  }, [socket, targetChatId]);

  // Listen for hint generation progress via WebSocket events
  useEffect(() => {
    if (!socket || !simulation?.practiceSimulation) {
      return;
    }

    const handleHintGenerationProgress = (data: {
      type: string;
      message: string;
      chat_id: string;
      message_id: string;
      hint_ids?: string[];
      hints_count?: number;
      hints?: Array<{ idx: number; hint: string }>;
      error?: string;
    }) => {
      // Only handle hints for the current chat
      if (data.chat_id === targetChatId && data.type === "complete") {
        // Add message_id to set of messages with new hints (for red dot indicator)
        setMessagesWithNewHints((prev) => {
          const newSet = new Set(prev);
          newSet.add(data.message_id);
          return newSet;
        });
        // Note: router.refresh() is handled in AttemptChat.tsx after a short delay
        // to allow database transaction to commit. The optimistic hints will show
        // immediately, and server hints will replace them once available.
        // Delay refresh slightly to ensure database transaction has committed
        setTimeout(() => {
          router.refresh();
        }, 500);
      }
    };

    socket.on("hint_generation_progress", handleHintGenerationProgress);

    return () => {
      socket.off("hint_generation_progress", handleHintGenerationProgress);
    };
  }, [socket, simulation?.practiceSimulation, targetChatId, router]);

  // Determine background image style dynamically
  const backgroundStyle = backgroundImage
    ? {
        "--bg-image-url": `url('${backgroundImage}')`,
        backgroundSize: "cover" as const,
        backgroundPosition: "center" as const,
        backgroundRepeat: "no-repeat" as const,
      }
    : undefined;

  return (
    <div
      className={`flex-1 flex flex-col p-0 min-h-0 relative ${backgroundImage ? "attempt-messages-background" : ""}`}
      data-testid="attempt-messages-container"
      style={backgroundStyle}
    >
      <TooltipProvider>
        <>
          <ScrollArea className="flex-1 px-2 min-h-0" ref={scrollAreaRef}>
            <div className="space-y-4 py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-6">
                  <>
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Choose a prompt below or type your own message
                      </p>
                    </div>
                    <div
                      className="flex flex-col gap-3 w-full max-w-md"
                      data-testid="starter-prompts"
                    >
                      {starterPrompts.map((prompt, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          className="h-auto p-4 text-left justify-start whitespace-normal"
                          onClick={() => handleStarterPromptClick(prompt)}
                          disabled={
                            currentChat?.completed ||
                            isSendingMessage ||
                            !isAttemptOwner
                          }
                        >
                          <span className="text-sm">{prompt}</span>
                        </Button>
                      ))}
                    </div>
                  </>
                </div>
              ) : (
                sortedMessages.map((message) => {
                  // Render user messages (query type)
                  if (message.type === "query") {
                    // Check if this is an optimistic voice message with empty content (show LoadingDots)
                    const isOptimisticVoiceMessage =
                      message.id.startsWith("optimistic-user-voice-") &&
                      message.content === "";

                    return (
                      <div key={message.id} className="flex justify-end mb-3">
                        <div className="max-w-[80%] flex items-stretch gap-2">
                          <div
                            className={`bg-primary text-primary-foreground rounded-lg p-3 flex-1 ${
                              isOptimisticVoiceMessage
                                ? "flex items-center justify-center"
                                : ""
                            }`}
                            data-testid={`message-${message.id}`}
                            data-message-id={message.id}
                            data-message-type="user"
                          >
                            {isOptimisticVoiceMessage ? (
                              // Show LoadingDots for optimistic voice messages (same as assistant)
                              <LoadingDots />
                            ) : (
                              <Markdown>{message.content}</Markdown>
                            )}
                          </div>
                          {/* Right-aligned controls */}
                          <div className="flex flex-col gap-1 w-9 h-[52px] min-h-[52px] max-h-[52px] overflow-hidden">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="default"
                                  size="sm"
                                  aria-label="You"
                                  className="flex-1 p-0 rounded-md"
                                  tabIndex={-1}
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>You</p>
                              </TooltipContent>
                            </Tooltip>
                            <div className="flex-1" />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Render assistant messages (response type)
                  if (message.type === "response") {
                    const hintsForMessage =
                      currentChatHints.find((h) => h.messageId === message.id)
                        ?.hints || [];
                    const shouldShowHintsButton =
                      simulation?.practiceSimulation &&
                      hintsForMessage.length > 0;
                    const containerHeightClass = shouldShowHintsButton
                      ? "h-[52px] min-h-[52px] max-h-[52px]"
                      : "h-[26px] min-h-[26px] max-h-[26px]";
                    const hasNewHints = messagesWithNewHints.has(message.id);
                    const isSelected = selectedHintMessageId === message.id;

                    // Get persona data from message's personaId, fallback to default
                    const messagePersona = message.personaId
                      ? personaMap.get(message.personaId)
                      : null;
                    const personaName = messagePersona?.name || "Assistant";
                    const personaIcon = messagePersona?.icon;
                    const personaColor = messagePersona?.color;

                    // Get icon component
                    const IconComponent = personaIcon
                      ? getPersonaIconComponent(personaIcon) || MessageSquare
                      : MessageSquare;

                    // Generate gradient style if persona color is available
                    const buttonStyle = personaColor
                      ? {
                          background: generateGradientFromHex(personaColor),
                        }
                      : undefined;

                    return (
                      <div key={message.id} className="flex justify-start mb-3">
                        <div className="max-w-[80%] flex items-stretch gap-2">
                          {/* Left-aligned stacked controls (assistant + optional hints) */}
                          <div
                            className={`flex flex-col gap-1 w-9 ${containerHeightClass} overflow-visible`}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  aria-label={personaName}
                                  className="flex-1 p-0 rounded-md"
                                  style={buttonStyle}
                                  tabIndex={-1}
                                >
                                  <IconComponent className="h-4 w-4 text-white" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{personaName}</p>
                              </TooltipContent>
                            </Tooltip>
                            {shouldShowHintsButton ? (
                              <Popover
                                open={isSelected}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setSelectedHintMessageId(message.id);
                                    if (hasNewHints) {
                                      setMessagesWithNewHints((prev) => {
                                        const newSet = new Set(prev);
                                        newSet.delete(message.id);
                                        return newSet;
                                      });
                                    }
                                  } else {
                                    setSelectedHintMessageId(null);
                                  }
                                }}
                                modal={false}
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant={
                                          isSelected ? "default" : "outline"
                                        }
                                        size="sm"
                                        aria-label="Show hints"
                                        className="flex-1 p-0 rounded-md relative overflow-visible"
                                      >
                                        <Lightbulb className="h-4 w-4" />
                                        {hasNewHints && (
                                          <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3 border-2 border-white shadow-sm z-10" />
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Show hints</p>
                                  </TooltipContent>
                                </Tooltip>
                                <PopoverContent
                                  className="w-96 p-4"
                                  align="start"
                                  side="top"
                                  sideOffset={35}
                                >
                                  <HintDisplay
                                    hints={hintsForMessage}
                                    onClose={() =>
                                      setSelectedHintMessageId(null)
                                    }
                                  />
                                </PopoverContent>
                              </Popover>
                            ) : null}
                          </div>
                          <div className="relative group p-2 -m-2 flex-1">
                            {/* Show loading state for empty/incomplete messages, otherwise show content */}
                            {!message.completed && message.content === "" ? (
                              <div
                                className="bg-muted rounded-lg p-3 flex items-center justify-center"
                                data-testid={`message-${message.id}`}
                                data-message-id={message.id}
                                data-message-type="assistant"
                              >
                                <LoadingDots />
                              </div>
                            ) : message.completed && message.content === "" ? (
                              // Show "No response" for completed messages with empty content
                              <div
                                className="bg-muted rounded-lg p-3"
                                data-testid={`message-${message.id}`}
                                data-message-id={message.id}
                                data-message-type="assistant"
                              >
                                <span className="text-gray-500 italic">
                                  No response
                                </span>
                              </div>
                            ) : message.completed &&
                              message.content.startsWith("Error:") ? (
                              // Show error messages in red with retry button
                              <div
                                className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 relative"
                                data-testid={`message-${message.id}`}
                                data-message-id={message.id}
                                data-message-type="assistant"
                              >
                                <div className="text-destructive pr-12">
                                  <Markdown>{message.content}</Markdown>
                                </div>
                                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                                  {/* Report Error Button */}
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <ReportProblem
                                        createFeedback={createFeedback}
                                        initialType="bug"
                                        initialMessage={`Error in simulation chat: ${message.content}\n\nChat ID: ${targetChatId}\nMessage ID: ${message.id}`}
                                        onDialogStateChange={
                                          setIsReportDialogOpen
                                        }
                                      >
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 w-8 p-0"
                                        >
                                          <AlertCircle className="h-4 w-4" />
                                        </Button>
                                      </ReportProblem>
                                    </TooltipTrigger>
                                    {!isReportDialogOpen && (
                                      <TooltipContent>
                                        <p>Report this error</p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>

                                  {/* Retry Button */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleRetry(
                                            sortedMessages.indexOf(message)
                                          )
                                        }
                                        className="h-8 w-8 p-0"
                                        disabled={
                                          currentChat?.completed ||
                                          isSendingMessage ||
                                          (simulation?.timeLimit
                                            ? !isActive
                                            : false)
                                        }
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Retry this message</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="bg-muted rounded-lg p-3 relative"
                                data-testid={`message-${message.id}`}
                                data-message-id={message.id}
                                data-message-type="assistant"
                              >
                                <Markdown>{message.content}</Markdown>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div
            className={`absolute bottom-2 left-1/2 transform -translate-x-1/2 z-20 transition-all duration-300 ease-in-out ${
              showScrollButton
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-2 pointer-events-none"
            }`}
          >
            <Button
              variant="default"
              size="sm"
              onClick={scrollToBottom}
              className="rounded-full h-10 w-10 p-0 shadow-lg bg-primary hover:bg-primary/90 border-2 border-background"
              data-testid="scroll-to-bottom-button"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </>
      </TooltipProvider>
    </div>
  );
}
