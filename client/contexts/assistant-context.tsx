/**
 * Chat Context for managing assistant chat state and WebSocket interactions
 * Provides functionality for creating chats, sending messages, and real-time updates
 */
"use client";
import { useProfile } from "@/contexts/profile-context";
import { useAssistantChatsByProfileId } from "@/lib/api/hooks/assistant_chats";
import { AssistantChat } from "@/types";
import { log } from "@/utils/logger";
import { createAssistantChat } from "@/utils/mutations/assistant_chats/create-assistant-chat";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useWebSocket } from "./websocket-context";

type ChatUIState = "closed" | "open" | "minimized" | "widget" | "expanded";

export interface AssistantContextType {
  // UI State
  uiState: ChatUIState;
  setUiState: (state: ChatUIState) => void;
  openWidget: () => void;
  expand: () => void;
  close: () => void;

  // Chat Management
  currentChatId: string | undefined;
  setCurrentChatId: (chatId: string | undefined) => void;
  chats: AssistantChat[];
  pastChats: AssistantChat[];
  isLoadingChats: boolean;
  selectChat: (chatId: string) => void;
  startBlankChat: () => void;

  // Connection State
  isConnected: boolean;

  // Chat Operations
  createNewChat: () => Promise<string | null>;
  sendMessage: (message: string) => void;
  stopMessage: () => void;

  // UI State
  isSendingMessage: boolean;
  isStoppingMessage: boolean;
}

const AssistantContext = createContext<AssistantContextType | null>(null);

export const useAssistant = () => {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error("useAssistant must be used within AssistantProvider");
  }
  return context;
};

interface AssistantProviderProps {
  children: React.ReactNode;
}

export function AssistantProvider({ children }: AssistantProviderProps) {
  const [uiState, setUiState] = useState<ChatUIState>("closed");
  const [currentChatId, setCurrentChatId] = useState<string>();
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isStoppingMessage, setIsStoppingMessage] = useState(false);
  const queryClient = useQueryClient();
  const currentRoomRef = useRef<string | null>(null);

  // Use the global WebSocket context
  const {
    isConnected,
    joinRoom,
    leaveRoom,
    emitStartAssistant,
    emitSendAssistantMessage,
    emitStopAssistant,
  } = useWebSocket();

  const { activeProfile } = useProfile();

  const { data: chats = [], isLoading: isLoadingChats } =
    useAssistantChatsByProfileId(activeProfile?.id || "");

  // Create new chat mutation
  const createChatMutation = useMutation({
    mutationFn: (profileId: string) => {
      // Don't allow creating chats for guest profiles with invalid UUIDs
      if (profileId === "guest-profile-id") {
        throw new Error("Cannot create chats for guest profiles");
      }
      return createAssistantChat({
        profileId,
        title: "New Chat",
      });
    },
    onSuccess: (newChat) => {
      // Update the chats cache immediately
      if (newChat) {
        queryClient.setQueryData(
          ["assistantChats", activeProfile?.id],
          (old: AssistantChat[] = []) => [newChat, ...old]
        );
      }
    },
    onError: (error) => {
      log.error("assistant.chat.create.failed", {
        message: "Failed to create chat",
        context: {
          component: "AssistantContext",
          function: "createChatMutation.onError",
        },
        error,
      });
      toast.error("Failed to create new chat");
    },
  });

  // Set up assistant-specific event listeners
  useEffect(() => {
    if (!isConnected) return;

    // Listen for assistant message completion to reset loading state
    const handleAssistantMessageComplete = () => {
      log.debug("assistant.message.complete", {
        message: "Assistant message completed, resetting sending state",
        context: {
          component: "AssistantContext",
          function: "handleAssistantMessageComplete",
        },
      });
      setIsSendingMessage(false);
    };

    const handleAssistantMessageCancelled = () => {
      log.debug("assistant.message.cancelled", {
        message: "Assistant message cancelled, resetting sending state",
        context: {
          component: "AssistantContext",
          function: "handleAssistantMessageCancelled",
        },
      });
      setIsSendingMessage(false);
    };

    const handleAssistantError = () => {
      log.debug("assistant.message.error", {
        message: "Assistant error occurred, resetting sending state",
        context: {
          component: "AssistantContext",
          function: "handleAssistantError",
        },
      });
      setIsSendingMessage(false);
    };

    // Add event listeners
    window.addEventListener(
      "assistant_message_complete",
      handleAssistantMessageComplete
    );
    window.addEventListener(
      "assistant_message_cancelled",
      handleAssistantMessageCancelled
    );
    window.addEventListener("assistant_error", handleAssistantError);

    return () => {
      // Remove event listeners
      window.removeEventListener(
        "assistant_message_complete",
        handleAssistantMessageComplete
      );
      window.removeEventListener(
        "assistant_message_cancelled",
        handleAssistantMessageCancelled
      );
      window.removeEventListener("assistant_error", handleAssistantError);
    };
  }, [isConnected, currentChatId, queryClient]);

  // Join/leave chat rooms when currentChatId changes - with connection check
  useEffect(() => {
    if (!isConnected) return;

    if (currentChatId) {
      // Leave previous room if any
      if (currentRoomRef.current && currentRoomRef.current !== currentChatId) {
        leaveRoom(currentRoomRef.current, "assistant");
      }

      // Join new room
      joinRoom(currentChatId, "assistant");
      currentRoomRef.current = currentChatId;
      log.info("assistant.room.joined", {
        message: `Joined assistant chat room: ${currentChatId}`,
        subject: { entityType: "assistant_chat", entityId: currentChatId },
        context: {
          component: "AssistantContext",
          function: "useEffect(joinRoom)",
        },
      });
    } else if (currentRoomRef.current) {
      // Leave current room when no chat is selected
      leaveRoom(currentRoomRef.current, "assistant");
      currentRoomRef.current = null;
    }

    return () => {
      // Cleanup handled by main useEffect
    };
  }, [currentChatId, isConnected, joinRoom, leaveRoom]);

  // UI state management methods
  const openWidget = useCallback(() => {
    setUiState("widget");
  }, []);

  const expand = useCallback(() => {
    setUiState("expanded");
  }, []);

  const close = useCallback(() => {
    setUiState("closed");
  }, []);

  // Chat management methods
  const selectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
  }, []);

  const startBlankChat = useCallback(async () => {
    if (!activeProfile?.id) {
      toast.error("Profile not found");
      return;
    }

    try {
      const newChat = await createChatMutation.mutateAsync(activeProfile.id);
      if (newChat?.id) {
        setCurrentChatId(newChat.id);
      }
    } catch (error) {
      log.error("assistant.chat.create.failed", {
        message: "Failed to create chat",
        context: { component: "AssistantContext", function: "startBlankChat" },
        error,
      });
    }
  }, [activeProfile?.id, createChatMutation]);

  const createNewChat = useCallback(async (): Promise<string | null> => {
    if (!activeProfile?.id) {
      toast.error("Profile not found");
      return null;
    }

    try {
      const newChat = await createChatMutation.mutateAsync(activeProfile.id);
      return newChat?.id || null;
    } catch (error) {
      log.error("assistant.chat.create.failed", {
        message: "Failed to create chat",
        context: { component: "AssistantContext", function: "createNewChat" },
        error,
      });
      return null;
    }
  }, [activeProfile?.id, createChatMutation]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!isConnected) {
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      if (isSendingMessage) {
        toast.error("Already sending a message. Please wait.");
        return;
      }

      setIsSendingMessage(true);

      try {
        let chatId = currentChatId;

        // If no chat is selected, create a new one
        if (!chatId) {
          if (!activeProfile?.id) {
            toast.error("Profile not found");
            setIsSendingMessage(false);
            return;
          }

          log.debug("assistant.message.no_chat", {
            message: "No chat selected, creating new chat for message",
            context: { component: "AssistantContext", function: "sendMessage" },
          });
          const newChat = await createChatMutation.mutateAsync(
            activeProfile.id
          );
          if (!newChat?.id) {
            toast.error("Failed to create new chat");
            setIsSendingMessage(false);
            return;
          }

          chatId = newChat.id;
          setCurrentChatId(chatId);
          log.info("assistant.chat.created", {
            message: "Created new chat for message",
            subject: { entityType: "assistant_chat", entityId: chatId },
            context: { component: "AssistantContext", function: "sendMessage" },
          });
        }

        // Check if this is the first message in the chat
        // If we just created a new chat or if the existing chat has title "New Chat"
        const isNewlyCreatedChat = !currentChatId; // We just created this chat
        const existingChat = chats.find((chat) => chat.id === chatId);
        const isFirstMessage =
          isNewlyCreatedChat || existingChat?.title === "New Chat";

        if (isFirstMessage) {
          // 1️⃣ Tell the server to create/initialise this assistant chat and process the initial message
          log.info("assistant.message.first.start", {
            message: "Sending first message via emitStartAssistant",
            subject: { entityType: "assistant_chat", entityId: chatId },
            context: {
              component: "AssistantContext",
              function: "sendMessage",
              messageLength: message.length,
            },
          });
          emitStartAssistant({ chat_id: chatId, initial_message: message });
        }
        // 2️⃣ For subsequent messages, deliver the text via the best transport:

        log.debug("assistant.message.subsequent.start", {
          message: "Sending subsequent message via WebSocket",
          subject: { entityType: "assistant_chat", entityId: chatId },
          context: {
            component: "AssistantContext",
            function: "sendMessage",
            messageLength: message.length,
          },
        });
        emitSendAssistantMessage({ chat_id: chatId, message }); // fallback

        log.info("assistant.message.sent", {
          message: "Message sent via WebSocket",
          subject: { entityType: "assistant_chat", entityId: chatId },
          context: {
            component: "AssistantContext",
            function: "sendMessage",
            isFirstMessage,
            messageLength: message.length,
          },
        });
      } catch (error) {
        log.error("assistant.message.send.failed", {
          message: "Error sending message",
          context: { component: "AssistantContext", function: "sendMessage" },
          error,
        });
        toast.error("Failed to send message");
        setIsSendingMessage(false);
      }

      // Note: setIsSendingMessage(false) is called in the WebSocket event handlers
      // when the message is complete or cancelled
    },
    [
      currentChatId,
      isConnected,
      isSendingMessage,
      chats,
      activeProfile?.id,
      createChatMutation,
      emitStartAssistant,
      emitSendAssistantMessage,
    ]
  );

  const stopMessage = useCallback(() => {
    if (!currentChatId) {
      toast.error("No active chat to stop");
      return;
    }

    if (!isConnected) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    setIsStoppingMessage(true);

    try {
      emitStopAssistant({ chat_id: currentChatId });

      log.info("assistant.message.stop.sent", {
        message: "Stop message sent via WebSocket",
        subject: { entityType: "assistant_chat", entityId: currentChatId },
        context: { component: "AssistantContext", function: "stopMessage" },
      });
    } catch (error) {
      log.error("assistant.message.stop.failed", {
        message: "Error stopping message",
        subject: { entityType: "assistant_chat", entityId: currentChatId },
        context: { component: "AssistantContext", function: "stopMessage" },
        error,
      });
      toast.error("Failed to stop message");
      setIsStoppingMessage(false);
    }
  }, [currentChatId, isConnected, emitStopAssistant]);

  const value: AssistantContextType = {
    uiState,
    setUiState,
    openWidget,
    expand,
    close,
    currentChatId,
    setCurrentChatId,
    chats,
    pastChats: chats, // Use the same chats array for pastChats
    isLoadingChats,
    selectChat,
    startBlankChat,
    isConnected,
    createNewChat,
    sendMessage,
    stopMessage,
    isSendingMessage,
    isStoppingMessage,
  };

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}
