/**
 * Chat Context for managing assistant chat functionality
 * This provides a centralized way to manage chat UI states and message handling
 */
"use client";
import { AssistantChat, AssistantMessage, AssistantToolCall } from "@/types";
import { createAssistantChat } from "@/utils/mutations/assistant_chats/create-assistant-chat";
import { createAssistantMessage } from "@/utils/mutations/assistant_messages/create-assistant-message";
import { getAssistantChatsByProfile } from "@/utils/queries/assistant_chats/get-assistant-chats-by-profile";
import { getAssistantMessagesByChat } from "@/utils/queries/assistant_messages/get-assistant-messages-by-chat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useState } from "react";
import { toast } from "sonner";

type ChatUIState = "closed" | "widget" | "expanded";

interface ChatContextType {
  // UI State
  uiState: ChatUIState;
  openWidget: () => void;
  expand: () => void;
  close: () => void;

  // Chat Management
  currentChatId: string | null;
  chats: AssistantChat[];
  messages: AssistantMessage[];
  toolCalls: AssistantToolCall[];

  // Chat Operations
  createNewChat: () => Promise<void>;
  selectChat: (chatId: string) => void;
  sendMessage: (content: string) => Promise<void>;

  // Loading States
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;

  // Debug
  debug: {
    currentChatId: string | null;
    uiState: ChatUIState;
    messagesCount: number;
  };
}

const ChatContext = createContext<ChatContextType | null>(null);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
};

interface ChatProviderProps {
  children: React.ReactNode;
  profileId?: string;
}

export function ChatProvider({ children, profileId }: ChatProviderProps) {
  const [uiState, setUiState] = useState<ChatUIState>("closed");
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch user's chats
  const { data: chats = [], isLoading: isLoadingChats } = useQuery({
    queryKey: ["assistantChats", profileId],
    queryFn: () =>
      profileId ? getAssistantChatsByProfile(profileId) : Promise.resolve([]),
    enabled: !!profileId,
  });

  // Fetch messages for current chat
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ["assistantMessages", currentChatId],
    queryFn: () =>
      currentChatId
        ? getAssistantMessagesByChat(currentChatId)
        : Promise.resolve([]),
    enabled: !!currentChatId,
  });

  // For now, tool calls will be empty - we'll implement this later
  const toolCalls: AssistantToolCall[] = [];

  // UI State Management
  const openWidget = useCallback(() => {
    setUiState("widget");
  }, []);

  const expand = useCallback(() => {
    setUiState("expanded");
  }, []);

  const close = useCallback(() => {
    setUiState("closed");
  }, []);

  // Create new chat mutation
  const createChatMutation = useMutation({
    mutationFn: async () => {
      if (!profileId) throw new Error("Profile ID required");

      const newChat = await createAssistantChat({
        title: `Chat ${new Date().toLocaleString()}`,
        profileId,
      });
      return newChat;
    },
    onSuccess: (newChat) => {
      if (newChat) {
        queryClient.invalidateQueries({
          queryKey: ["assistantChats", profileId],
        });
        setCurrentChatId(newChat.id);
        toast.success("New chat created");
      }
    },
    onError: (error) => {
      toast.error(`Failed to create chat: ${error}`);
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentChatId) throw new Error("No active chat");

      // Create user message
      const userMessage = await createAssistantMessage({
        chatId: currentChatId,
        role: "user" as const,
        content,
        completed: true,
      });

      // Here we would normally call the API to get the assistant response
      // For now, we'll create a placeholder assistant message
      const assistantMessage = await createAssistantMessage({
        chatId: currentChatId,
        role: "assistant" as const,
        content: "I'm processing your message...", // This will be replaced by actual API response
        completed: false,
      });

      return { userMessage, assistantMessage };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["assistantMessages", currentChatId],
      });
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error}`);
    },
  });

  // Chat Operations
  const createNewChat = useCallback(async () => {
    await createChatMutation.mutateAsync();
  }, [createChatMutation]);

  const selectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      await sendMessageMutation.mutateAsync(content);
    },
    [sendMessageMutation]
  );

  // Auto-select first chat if none selected
  React.useEffect(() => {
    if (chats.length > 0 && !currentChatId && chats[0]) {
      setCurrentChatId(chats[0].id);
    }
  }, [chats, currentChatId]);

  // Debug information
  const debug = React.useMemo(
    () => ({
      currentChatId,
      uiState,
      messagesCount: messages.length,
    }),
    [currentChatId, uiState, messages.length]
  );

  const value: ChatContextType = {
    // UI State
    uiState,
    openWidget,
    expand,
    close,

    // Chat Management
    currentChatId,
    chats,
    messages,
    toolCalls,

    // Chat Operations
    createNewChat,
    selectChat,
    sendMessage,

    // Loading States
    isLoadingChats,
    isLoadingMessages,
    isSendingMessage: sendMessageMutation.isPending,

    // Debug
    debug,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// Debug hook for development
export const useChatDebug = () => {
  const { debug } = useChat();

  React.useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("Chat Debug:", debug);
    }
  }, [debug]);

  return debug;
};
