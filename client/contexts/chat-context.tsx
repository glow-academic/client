/**
 * Chat Context for managing assistant chat functionality
 * This provides a centralized way to manage chat UI states and message handling
 */
"use client";
import { createAssistantChat } from "@/utils/mutations/assistant_chats/create-assistant-chat";
import { createAssistantMessage } from "@/utils/mutations/assistant_messages/create-assistant-message";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

  // Chat Operations
  createNewChat: () => Promise<void>;
  selectChat: (chatId: string) => void;
  sendMessage: (content: string) => Promise<void>;

  // Loading States
  isCreatingChat: boolean;
  isSelectingChat: boolean;
  isSendingMessage: boolean;
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

  const selectChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      setCurrentChatId(chatId);
    },
  });

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      await sendMessageMutation.mutateAsync(content);
    },
    [sendMessageMutation]
  );

  const value: ChatContextType = {
    // UI State
    uiState,
    openWidget,
    expand,
    close,

    // Chat Management
    currentChatId,

    // Chat Operations
    createNewChat,
    selectChat,
    sendMessage,

    // Loading States
    isCreatingChat: createChatMutation.isPending,
    isSelectingChat: selectChatMutation.isPending,
    isSendingMessage: sendMessageMutation.isPending,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}