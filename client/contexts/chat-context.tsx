/**
 * Chat Context for managing assistant chat functionality with WebSocket streaming
 * This provides a centralized way to manage chat UI states and real-time message handling
 */
"use client";
import { AssistantChat, AssistantMessage } from "@/types";
import { logInfo } from "@/utils/logger";
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
import { io, Socket } from "socket.io-client";
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
  pastChats: AssistantChat[] | undefined;
  isLoadingChats: boolean;

  // Chat Operations
  selectChat: (chatId: string | null) => void;
  startBlankChat: () => void;
  sendMessage: (content: string) => Promise<void>;

  // Loading States
  isCreatingChat: boolean;
  isSendingMessage: boolean;

  // WebSocket Connection
  isConnected: boolean;
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
  const [isConnected, setIsConnected] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  const userId = useSession().data?.user?.id;

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
  });

  // Fetch past chats for the current profile
  const { data: pastChats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["assistantChats", profile?.id],
    queryFn: () => getAssistantChatsByProfile(profile!.id),
    enabled: !!profile?.id,
  });

  // Initialize WebSocket connection
  useEffect(() => {
    if (!profile?.id) return;

    const socket = io(
      process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:8000",
      {
        transports: ["websocket", "polling"],
        autoConnect: true,
        forceNew: true,
        timeout: 5000,
      }
    );

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      logInfo("WebSocket connected");
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      logInfo(`WebSocket disconnected: ${reason}`);
    });

    socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      setIsConnected(false);
    });

    socket.on(
      "new_message",
      (data: {
        message_id: string;
        chat_id: string;
        role: string;
        content: string;
        completed: boolean;
        created_at: string;
      }) => {
        // Update the messages cache with new message
        queryClient.setQueryData(
          ["assistantMessages", data.chat_id],
          (old: AssistantMessage[] = []) => {
            const exists = old.find((msg) => msg.id === data.message_id);
            if (exists) return old;

            const newMessage: AssistantMessage = {
              id: data.message_id,
              chatId: data.chat_id,
              role: data.role as "user" | "assistant",
              content: data.content,
              completed: data.completed,
              createdAt: data.created_at,
              updatedAt: data.created_at,
            };

            return [...old, newMessage].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            );
          }
        );
      }
    );

    socket.on(
      "message_token",
      (data: {
        message_id: string;
        chat_id: string;
        token: string;
        accumulated_content: string;
      }) => {
        // Update the specific message with streaming content
        queryClient.setQueryData(
          ["assistantMessages", data.chat_id],
          (old: AssistantMessage[] = []) => {
            return old.map((msg) =>
              msg.id === data.message_id
                ? { ...msg, content: data.accumulated_content }
                : msg
            );
          }
        );
      }
    );

    socket.on(
      "message_complete",
      (data: {
        message_id: string;
        chat_id: string;
        final_content: string;
      }) => {
        // Mark message as completed and update final content
        queryClient.setQueryData(
          ["assistantMessages", data.chat_id],
          (old: AssistantMessage[] = []) => {
            return old.map((msg) =>
              msg.id === data.message_id
                ? { ...msg, content: data.final_content, completed: true }
                : msg
            );
          }
        );

        setIsSendingMessage(false);

        // Refresh chat list to update with new messages
        queryClient.invalidateQueries({ queryKey: ["assistantChats"] });
      }
    );

    socket.on("message_error", (data: { chat_id: string; error: string }) => {
      toast.error(`Chat error: ${data.error}`);
      setIsSendingMessage(false);
    });

    socket.on("joined_chat", (data: { chat_id: string }) => {
      console.log(`Joined chat: ${data.chat_id}`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [profile?.id, queryClient]);

  // Join/leave chat rooms when currentChatId changes
  useEffect(() => {
    if (!socketRef.current || !isConnected) return;

    if (currentChatId) {
      socketRef.current.emit("join_chat", { chat_id: currentChatId });
    }

    return () => {
      if (currentChatId && socketRef.current) {
        socketRef.current.emit("leave_chat", { chat_id: currentChatId });
      }
    };
  }, [currentChatId, isConnected]);

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

  // Select existing chat or null for blank chat
  const selectChat = useCallback((chatId: string | null) => {
    setCurrentChatId(chatId);
  }, []);

  // Start a blank chat (sets currentChatId to null)
  const startBlankChat = useCallback(() => {
    setCurrentChatId(null);
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
        queryKey: ["assistantChats", profile?.id],
      });
    },
    onError: (error) => {
      toast.error(`Failed to start chat: ${error}`);
      setIsSendingMessage(false);
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      chatId,
      content,
    }: {
      chatId: string;
      content: string;
    }) => {
      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append("message", content);

      const response = await fetch(
        `${process.env["NEXT_PUBLIC_API_URL"]}/assistants/message`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error}`);
      setIsSendingMessage(false);
    },
  });

  // Main send message function
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      setIsSendingMessage(true);

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
    pastChats,
    isLoadingChats,

    // Chat Operations
    selectChat,
    startBlankChat,
    sendMessage,

    // Loading States
    isCreatingChat: startChatMutation.isPending,
    isSendingMessage,

    // WebSocket Connection
    isConnected,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
