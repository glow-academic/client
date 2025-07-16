/**
 * Chat Context for managing assistant chat state and WebSocket interactions
 * Provides functionality for creating chats, sending messages, and real-time updates
 */
"use client";
import { AssistantChat } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { createAssistantChat } from "@/utils/mutations/assistant_chats/create-assistant-chat";
import { getAssistantChatsByProfile } from "@/utils/queries/assistant_chats/get-assistant-chats-by-profile";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
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

interface AssistantContextType {
  // UI State
  uiState: ChatUIState;
  setUiState: (state: ChatUIState) => void;
  openWidget: () => void;
  expand: () => void;
  close: () => void;

  // Chat Management
  currentChatId: string | null;
  setCurrentChatId: (chatId: string | null) => void;
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
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
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

  const userId = useSession().data?.user?.id;

  // Get user profiles
  const { data: profiles } = useQuery({
    queryKey: ["profiles", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const profile = profiles?.[0];

  // Get assistant chats for the profile
  const { data: chats = [], isLoading: isLoadingChats } = useQuery({
    queryKey: ["assistantChats", profile?.id],
    queryFn: () => getAssistantChatsByProfile(profile!.id),
    enabled: !!profile?.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Create new chat mutation
  const createChatMutation = useMutation({
    mutationFn: (profileId: string) =>
      createAssistantChat({
        profileId,
        title: "New Chat",
      }),
    onSuccess: (newChat) => {
      // Update the chats cache immediately
      if (newChat) {
        queryClient.setQueryData(
          ["assistantChats", profile?.id],
          (old: AssistantChat[] = []) => [newChat, ...old]
        );
      }
    },
    onError: (error) => {
      logError("Failed to create chat:", error);
      toast.error("Failed to create new chat");
    },
  });

  // Set up assistant-specific event listeners
  useEffect(() => {
    if (!isConnected) return;

    // Listen for assistant message completion to reset loading state
    const handleAssistantMessageComplete = () => {
      logInfo("Assistant message completed, resetting sending state");
      setIsSendingMessage(false);
    };

    const handleAssistantMessageCancelled = () => {
      logInfo("Assistant message cancelled, resetting sending state");
      setIsSendingMessage(false);
    };

    const handleAssistantError = () => {
      logInfo("Assistant error occurred, resetting sending state");
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

      logInfo(`Joined assistant chat room: ${currentChatId}`);
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
    if (!profile?.id) {
      toast.error("Profile not found");
      return;
    }

    try {
      const newChat = await createChatMutation.mutateAsync(profile.id);
      if (newChat?.id) {
        setCurrentChatId(newChat.id);
      }
    } catch (error) {
      logError("Failed to create chat:", error);
    }
  }, [profile?.id, createChatMutation]);

  const createNewChat = useCallback(async (): Promise<string | null> => {
    if (!profile?.id) {
      toast.error("Profile not found");
      return null;
    }

    try {
      const newChat = await createChatMutation.mutateAsync(profile.id);
      return newChat?.id || null;
    } catch (error) {
      logError("Failed to create chat:", error);
      return null;
    }
  }, [profile?.id, createChatMutation]);

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
          if (!profile?.id) {
            toast.error("Profile not found");
            setIsSendingMessage(false);
            return;
          }

          logInfo("No chat selected, creating new chat for message");
          const newChat = await createChatMutation.mutateAsync(profile.id);
          if (!newChat?.id) {
            toast.error("Failed to create new chat");
            setIsSendingMessage(false);
            return;
          }

          chatId = newChat.id;
          setCurrentChatId(chatId);
          logInfo("Created new chat for message", { chatId });
        }

        // Check if this is the first message in the chat
        // If we just created a new chat or if the existing chat has title "New Chat"
        const isNewlyCreatedChat = !currentChatId; // We just created this chat
        const existingChat = chats.find((chat) => chat.id === chatId);
        const isFirstMessage =
          isNewlyCreatedChat || existingChat?.title === "New Chat";

        if (isFirstMessage) {
          // 1️⃣ Tell the server to create/initialise this assistant chat and process the initial message
          logInfo("Sending first message via emitStartAssistant", {
            chatId,
            messageLength: message.length,
          });
          emitStartAssistant({ chat_id: chatId, initial_message: message });
        }
        // 2️⃣ For subsequent messages, deliver the text via the best transport:

        logInfo("Sending subsequent message via WebSocket", {
          chatId,
          messageLength: message.length,
        });
        emitSendAssistantMessage({ chat_id: chatId, message }); // fallback

        logInfo("Message sent via WebSocket", {
          chatId,
          isFirstMessage,
          messageLength: message.length,
        });
      } catch (error) {
        logError("Error sending message:", error);
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
      profile?.id,
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

      logInfo("Stop message sent via WebSocket", {
        chatId: currentChatId,
      });
    } catch (error) {
      logError("Error stopping message:", error);
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
