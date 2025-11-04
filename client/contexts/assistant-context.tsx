/**
 * Chat Context for managing assistant chat state and WebSocket interactions
 * Provides functionality for creating chats, sending messages, and real-time updates
 */
"use client";
import { useProfile } from "@/contexts/profile-context";
import {
    useAssistantChatFull,
    type AssistantChatFullResponse,
} from "@/lib/api/v2/hooks/assistant";
import { useQueryClient } from "@tanstack/react-query";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
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
  chats: NonNullable<AssistantChatFullResponse["chat"]>[];
  pastChats: NonNullable<AssistantChatFullResponse["chat"]>[];
  isLoadingChats: boolean;
  selectChat: (chatId: string) => void;
  startBlankChat: () => void;

  // Chat Data (from v2 hook)
  chat: AssistantChatFullResponse["chat"];
  messages: AssistantChatFullResponse["messages"];
  toolCalls: AssistantChatFullResponse["toolCalls"];

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
  const { departmentIds } = useProfile();
  const [currentChatId, setCurrentChatId] = useState<string>();
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isStoppingMessage, setIsStoppingMessage] = useState(false);
  const [hasEverOpened, setHasEverOpened] = useState(false);
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

  // V2: Single hook to fetch all assistant chat data
  // Only fetch when user has interacted with chat (lazy loading)
  const { data: assistantData, isLoading: isLoadingChats } =
    useAssistantChatFull(
      currentChatId,
      activeProfile?.id === "guest-profile-id" ? "" : activeProfile?.id || "",
      hasEverOpened &&
        activeProfile?.id !== "guest-profile-id" &&
        !!activeProfile?.id
    );

  // Extract data from v2 response
  const chats = useMemo(
    () =>
      (assistantData?.allChats || []) as NonNullable<
        AssistantChatFullResponse["chat"]
      >[],
    [assistantData]
  );
  const chat = useMemo(
    () =>
      (assistantData?.chat || null) as NonNullable<
        AssistantChatFullResponse["chat"]
      > | null,
    [assistantData]
  );
  const messages = useMemo(
    () =>
      (assistantData?.messages || []) as NonNullable<
        AssistantChatFullResponse["messages"]
      >,
    [assistantData]
  );
  const toolCalls = useMemo(
    () =>
      (assistantData?.toolCalls || []) as NonNullable<
        AssistantChatFullResponse["toolCalls"]
      >,
    [assistantData]
  );

  // Set up assistant-specific event listeners
  useEffect(() => {
    if (!isConnected) return;

    // Listen for assistant started event (when server creates new chat)
    const handleAssistantStarted = (event: Event) => {
      const data = (event as CustomEvent).detail as { chat_id?: string };
      if (data.chat_id) {
        setCurrentChatId(data.chat_id);
        // Invalidate queries to refetch chat list with new chat
        queryClient.invalidateQueries({ queryKey: ["assistant"] });
      }
    };

    // Listen for assistant message completion to reset loading state
    const handleAssistantMessageComplete = () => {
      setIsSendingMessage(false);
    };

    const handleAssistantMessageCancelled = () => {
      setIsSendingMessage(false);
    };

    const handleAssistantError = () => {
      setIsSendingMessage(false);
    };

    // Add event listeners
    window.addEventListener("assistant_started", handleAssistantStarted);
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
      window.removeEventListener("assistant_started", handleAssistantStarted);
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
  }, [isConnected, queryClient]);

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
    setHasEverOpened(true); // Enable data fetching on first interaction
  }, []);

  const expand = useCallback(() => {
    setUiState("expanded");
    setHasEverOpened(true); // Enable data fetching on first interaction
  }, []);

  const close = useCallback(() => {
    setUiState("closed");
  }, []);

  // Chat management methods
  const selectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
  }, []);

  // Removed startBlankChat and createNewChat - all chat creation now happens
  // server-side when user sends their first message via emitStartAssistant
  const startBlankChat = useCallback(() => {
    // Clear current chat to prepare for new chat (will be created on first message)
    setCurrentChatId(undefined);
  }, []);

  const createNewChat = useCallback(async (): Promise<string | null> => {
    // Clear current chat to prepare for new chat (will be created on first message)
    setCurrentChatId(undefined);
    return null;
  }, []);

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
        const chatId = currentChatId;

        // Validate profile is available
        if (!activeProfile?.id) {
          toast.error("Profile not found");
          setIsSendingMessage(false);
          return;
        }

        // Don't allow creating chats for guest profiles with invalid UUIDs
        if (activeProfile.id === "guest-profile-id") {
          toast.error("Cannot create chats for guest profiles");
          setIsSendingMessage(false);
          return;
        }

        // Validate department_id is available
        if (departmentIds.length === 0 || !departmentIds[0]) {
          toast.error("No department found. Please contact support.");
          setIsSendingMessage(false);
          return;
        }

        // Check if this is the first message in a new chat (no chat selected)
        // or if the existing chat has title "New Chat"
        const existingChat = chatId
          ? chats.find((chat) => chat.id === chatId)
          : null;
        const isFirstMessage = !chatId || existingChat?.title === "New Chat";

        if (isFirstMessage) {
          // Server will create the chat and process the initial message
          emitStartAssistant({
            profile_id: activeProfile.id,
            initial_message: message,
            department_id: departmentIds[0],
          });
        } else {
          // For subsequent messages, send via WebSocket
          emitSendAssistantMessage({ chat_id: chatId, message });
        }

        if (chatId) {
        } else {
        }
      } catch (error) {
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
      emitStartAssistant,
      emitSendAssistantMessage,
      departmentIds,
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
    } catch (error) {
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
    chats: chats,
    pastChats: chats, // Use the same chats array for pastChats
    isLoadingChats,
    selectChat,
    startBlankChat,
    chat: chat,
    messages: messages,
    toolCalls: toolCalls,
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
