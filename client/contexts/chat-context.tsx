/**
 * Chat Context for managing assistant chat functionality
 * This provides a centralized way to manage chat UI states and message handling
 */
"use client";
import { AssistantMessage } from "@/types";
import { createAssistantMessage } from "@/utils/mutations/assistant_messages/create-assistant-message";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
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
  selectChat: (chatId: string) => void;
  sendMessage: (content: string) => Promise<void>;

  // Loading States
  isCreatingChat: boolean;
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
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [uiState, setUiState] = useState<ChatUIState>("closed");
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const userId = useSession().data?.user?.id;

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
  });

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

  // Select existing chat
  const selectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
  }, []);

  // Start new chat mutation
  const startChatMutation = useMutation({
    mutationFn: async (initialMessage: string) => {
      if (!profile?.id) {
        throw new Error("Profile ID is required");
      }

      const formData = new FormData();
      formData.append("initial_message", initialMessage);
      formData.append("profile_id", profile.id);

      const response = await fetch(
        `${process.env["NEXT_PUBLIC_API_URL"]}/assistants/start`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.chat_id;
    },
    onSuccess: (chatId) => {
      setCurrentChatId(chatId);
      // Invalidate queries to refresh chat data
      queryClient.invalidateQueries({ queryKey: ["assistantChats"] });
      queryClient.invalidateQueries({
        queryKey: ["assistantMessages", chatId],
      });
      toast.success("Chat started successfully");
    },
    onError: (error) => {
      toast.error(`Failed to start chat: ${error}`);
    },
  });

  // Send message with streaming response
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      chatId,
      content,
    }: {
      chatId: string;
      content: string;
    }) => {
      // Create optimistic user message first
      await createAssistantMessage({
        chatId,
        role: "user" as const,
        content,
        completed: true,
      });

      // Create placeholder assistant message
      const assistantMessage = await createAssistantMessage({
        chatId,
        role: "assistant" as const,
        content: "",
        completed: false,
      });

      // Invalidate to show user message immediately
      queryClient.invalidateQueries({
        queryKey: ["assistantMessages", chatId],
      });

      // Start streaming response
      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append("message", content);

      const response = await fetch(
        `${process.env["NEXT_PUBLIC_API_URL"]}/assistants/message`,
        {
          method: "POST",
          headers: { Accept: "text/event-stream" },
          cache: "no-cache",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE frames
        const parts = buffer.split("\n\n");
        buffer = parts.pop()!; // Keep partial chunk

        for (const part of parts) {
          if (!part.startsWith("data:")) continue;

          const data = JSON.parse(part.slice(5)); // strip "data: "

          if (data.text) {
            accumulated += data.text;

            // Update assistant message with accumulated content
            queryClient.setQueryData(
              ["assistantMessages", chatId],
              (old: AssistantMessage[] = []) =>
                old.map((m) =>
                  m.id === assistantMessage?.id
                    ? { ...m, content: accumulated }
                    : m
                )
            );
          }

          if (data.done || data.error) {
            // Mark message as completed
            queryClient.setQueryData(
              ["assistantMessages", chatId],
              (old: AssistantMessage[] = []) =>
                old.map((m) =>
                  m.id === assistantMessage?.id
                    ? { ...m, content: accumulated, completed: true }
                    : m
                )
            );
            break;
          }
        }
      }

      return { chatId, content: accumulated };
    },
    onSuccess: ({ chatId }) => {
      queryClient.invalidateQueries({
        queryKey: ["assistantMessages", chatId],
      });
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error}`);
    },
  });

  // Main send message function
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      if (!currentChatId) {
        // Start new chat with first message
        await startChatMutation.mutateAsync(content);
      } else {
        // Send message to existing chat
        await sendMessageMutation.mutateAsync({
          chatId: currentChatId,
          content,
        });
      }
    },
    [currentChatId, startChatMutation, sendMessageMutation]
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
    selectChat,
    sendMessage,

    // Loading States
    isCreatingChat: startChatMutation.isPending,
    isSendingMessage:
      sendMessageMutation.isPending || startChatMutation.isPending,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
