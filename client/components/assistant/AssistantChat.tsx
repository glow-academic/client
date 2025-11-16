/**
 * AssistantChat.tsx
 * Main component for managing assistant chat state and WebSocket interactions
 * Similar to AttemptChat, this component manages all assistant-related state
 * and passes props down to child components
 */
"use client";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import ChatDialog from "./ChatDialog";
import ChatFab from "./ChatFab";
import ChatWidget from "./ChatWidget";

/** ---- Server Actions Types ---- */
type AssistantChatListOut = OutputOf<"/api/v3/assistant/chats/list", "post">;
type AssistantChatFullOut = OutputOf<"/api/v3/assistant/chats/full", "post">;

export type ChatUIState =
  | "closed"
  | "open"
  | "minimized"
  | "widget"
  | "expanded";

// Type matching the API response structure
export type AssistantChatFullResponse = {
  chat: {
    id: string;
    createdAt: string;
    updatedAt: string;
    profileId: string;
    title: string;
    traceId: string | null;
  } | null;
  messages: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    chatId: string;
    role: "user" | "assistant";
    content: string;
    completed: boolean;
  }>;
  toolCalls: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    chatId: string;
    toolName: string;
    toolType: "create" | "read" | "update" | "delete";
    toolArguments: unknown;
    toolResult: unknown;
    completed: boolean;
  }>;
  allChats: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    profileId: string;
    title: string;
    traceId: string | null;
  }>;
};

interface AssistantChatProps {
  getAssistantChatList: (
    input: InputOf<"/api/v3/assistant/chats/list", "post">
  ) => Promise<OutputOf<"/api/v3/assistant/chats/list", "post">>;
  getAssistantChatFull: (
    input: InputOf<"/api/v3/assistant/chats/full", "post">
  ) => Promise<OutputOf<"/api/v3/assistant/chats/full", "post">>;
}

export default function AssistantChat({
  getAssistantChatList,
  getAssistantChatFull,
}: AssistantChatProps) {
  const [uiState, setUiState] = useState<ChatUIState>("closed");
  const {
    departmentIds,
    activeProfile,
    effectiveProfile,
    isConnected,
    socket,
    joinRoom,
    leaveRoom,
    emitStartAssistant,
    emitSendAssistantMessage,
    emitStopAssistant,
  } = useProfile();

  // Check if user has permission to see chat components (instructional, admin, superadmin only)
  const canShowChatComponents = useMemo(() => {
    const allowedRoles = ["instructional", "admin", "superadmin"];
    return (
      effectiveProfile?.role && allowedRoles.includes(effectiveProfile.role)
    );
  }, [effectiveProfile?.role]);
  const [currentChatId, setCurrentChatId] = useState<string>();
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isStoppingMessage, setIsStoppingMessage] = useState(false);
  const [hasEverOpened, setHasEverOpened] = useState(false);
  const currentRoomRef = useRef<string | null>(null);

  // Local state for assistant data (replaces React Query)
  const [assistantData, setAssistantData] = useState<
    AssistantChatFullOut | AssistantChatListOut | null
  >(null);
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  // V3 API: Fetch assistant chat data
  // Only fetch when user has interacted with chat (lazy loading)
  const profileId =
    activeProfile?.id === "guest-profile-id" ? "" : activeProfile?.id || "";

  // Direct fetch function (no useEffect dependency chains)
  const fetchAssistantData = useCallback(async () => {
    if (!profileId || profileId === "") return;

    setIsLoadingChats(true);
    try {
      const data = currentChatId
        ? await getAssistantChatFull({
            body: { chatId: currentChatId, profileId },
          })
        : await getAssistantChatList({ body: { profileId } });
      setAssistantData(data);
    } catch (error) {
      toast.error("Failed to load chat data");
      // eslint-disable-next-line no-console
      console.error("Assistant chat fetch error:", error);
    } finally {
      setIsLoadingChats(false);
    }
  }, [profileId, currentChatId, getAssistantChatFull, getAssistantChatList]);

  // Extract data from API response
  const chats = useMemo(() => {
    if (!assistantData) return [];
    if ("allChats" in assistantData) {
      return assistantData.allChats as NonNullable<
        AssistantChatFullResponse["chat"]
      >[];
    }
    return [];
  }, [assistantData]);

  const chat = useMemo(() => {
    if (!assistantData) return null;
    if ("chat" in assistantData && assistantData.chat) {
      return assistantData.chat as NonNullable<
        AssistantChatFullResponse["chat"]
      >;
    }
    return null;
  }, [assistantData]);

  const messages = useMemo(() => {
    if (!assistantData) return [];
    if ("messages" in assistantData) {
      return assistantData.messages as AssistantChatFullResponse["messages"];
    }
    return [];
  }, [assistantData]);

  const toolCalls = useMemo(() => {
    if (!assistantData) return [];
    if ("toolCalls" in assistantData) {
      return assistantData.toolCalls as AssistantChatFullResponse["toolCalls"];
    }
    return [];
  }, [assistantData]);

  // Set up WebSocket error event handlers and live message updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleStartAssistantError = (data: {
      success: boolean;
      message: string;
      chat_id?: string;
      error?: string;
    }) => {
      setIsSendingMessage(false);
      toast.error(data.error || data.message || "Failed to start assistant");
      
      // Refetch chat data if chat_id is available to get error message from database
      if (data.chat_id && data.chat_id === currentChatId && profileId && profileId !== "") {
        fetchAssistantData();
      }
      
      // Also dispatch DOM event for backward compatibility
      window.dispatchEvent(
        new CustomEvent("assistant_error", {
          detail: { message: data.message, error: data.error, chat_id: data.chat_id },
        })
      );
    };

    const handleSendAssistantMessageError = (data: {
      success?: boolean;
      message?: string;
      chat_id?: string;
      error?: string;
    }) => {
      setIsSendingMessage(false);
      toast.error(data.error || data.message || "Failed to send message");
      
      // Refetch chat data if chat_id is available to get error message from database
      if (data.chat_id && data.chat_id === currentChatId && profileId && profileId !== "") {
        fetchAssistantData();
      }
      
      // Also dispatch DOM event for backward compatibility
      window.dispatchEvent(
        new CustomEvent("assistant_error", {
          detail: { message: data.message, error: data.error, chat_id: data.chat_id },
        })
      );
    };

    const handleAssistantNewMessage = (data: {
      message_id: string;
      chat_id: string;
      role: string;
      content: string;
      completed: boolean;
      created_at: string;
    }) => {
      // Only handle messages for the current chat
      if (data.chat_id !== currentChatId) return;

      // Update local state optimistically for new messages (including error messages)
      setAssistantData((prev) => {
        if (!prev || !("messages" in prev)) return prev;
        
        // Check if message already exists
        const messageIndex = prev.messages.findIndex(
          (msg) => msg["id"] === data.message_id
        );
        
        if (messageIndex >= 0) {
          // Update existing message
          return {
            ...prev,
            messages: prev.messages.map((msg) =>
              msg["id"] === data.message_id
                ? {
                    ...msg,
                    content: data.content,
                    completed: data.completed,
                    updatedAt: data.created_at,
                  }
                : msg
            ),
          };
        } else {
          // Create new message if it doesn't exist
          const newMessage: AssistantChatFullResponse["messages"][number] = {
            id: data.message_id,
            createdAt: data.created_at,
            updatedAt: data.created_at,
            completedAt: data.completed ? data.created_at : null,
            chatId: data.chat_id,
            role: data.role as "user" | "assistant",
            content: data.content,
            completed: data.completed,
          };
          return {
            ...prev,
            messages: [...prev.messages, newMessage],
          };
        }
      });

      // Dispatch DOM event for backward compatibility
      window.dispatchEvent(
        new CustomEvent("assistant_new_message", {
          detail: {
            messageId: data.message_id,
            chatId: data.chat_id,
            role: data.role,
            content: data.content,
            completed: data.completed,
          },
        })
      );
    };

    socket.on("start_assistant_error", handleStartAssistantError);
    socket.on("send_assistant_message_error", handleSendAssistantMessageError);
    socket.on("assistant_new_message", handleAssistantNewMessage);

    return () => {
      socket.off("start_assistant_error", handleStartAssistantError);
      socket.off("send_assistant_message_error", handleSendAssistantMessageError);
      socket.off("assistant_new_message", handleAssistantNewMessage);
    };
  }, [socket, isConnected, currentChatId, profileId, fetchAssistantData]);

  // Set up assistant-specific event listeners
  useEffect(() => {
    if (!isConnected) return;

    // Listen for assistant started event (when server creates new chat)
    const handleAssistantStarted = async (event: Event) => {
      const data = (event as CustomEvent).detail as { chat_id?: string };
      if (data.chat_id) {
        setCurrentChatId(data.chat_id);
        // Fetch full chat data directly when chat is created
        if (profileId && profileId !== "") {
          setIsLoadingChats(true);
          try {
            const chatData = await getAssistantChatFull({
              body: { chatId: data.chat_id, profileId },
            });
            setAssistantData(chatData);
          } catch (error) {
            toast.error("Failed to load new chat");
            // eslint-disable-next-line no-console
            console.error("Assistant chat fetch error:", error);
          } finally {
            setIsLoadingChats(false);
          }
        }
      }
    };

    // Listen for assistant message completion to reset loading state and refresh
    const handleAssistantMessageComplete = () => {
      setIsSendingMessage(false);
      // Refetch to get updated messages
      fetchAssistantData();
    };

    const handleAssistantMessageCancelled = () => {
      setIsSendingMessage(false);
      // Refetch to get updated state
      fetchAssistantData();
    };

    const handleAssistantError = async (event?: Event) => {
      setIsSendingMessage(false);
      // Show toast with error message if available
      if (event) {
        const data = (event as CustomEvent).detail as {
          message?: string;
          error?: string;
          chat_id?: string;
        };
        const errorMessage = data.error || data.message || "An error occurred";
        toast.error(errorMessage);
        
        // Refetch chat data to get error message from database if chat_id is available
        if (data.chat_id && data.chat_id === currentChatId && profileId && profileId !== "") {
          await fetchAssistantData();
        }
      }
    };

    // Listen for title updates
    const handleTitleUpdated = async (event: Event) => {
      const data = (event as CustomEvent).detail as {
        chat_id?: string;
        title?: string;
      };
      if (data.chat_id && data.title) {
        // Update local state optimistically
        setAssistantData((prev) => {
          if (!prev) return prev;
          if ("chat" in prev && prev.chat?.["id"] === data.chat_id) {
            return {
              ...prev,
              chat: prev.chat ? { ...prev.chat, title: data.title! } : null,
            };
          }
          // Update in allChats array
          if ("allChats" in prev) {
            return {
              ...prev,
              allChats: prev.allChats.map((chat) =>
                chat["id"] === data.chat_id
                  ? { ...chat, title: data.title! }
                  : chat
              ),
            };
          }
          return prev;
        });
        // Refetch to ensure consistency
        await fetchAssistantData();
      }
    };

    // Listen for tool call events
    const handleToolCallCreated = async () => {
      // Refetch to get updated tool calls
      await fetchAssistantData();
    };

    const handleToolCallCompleted = async () => {
      // Refetch to get updated tool calls
      await fetchAssistantData();
    };

    // Listen for message token events (streaming)
    const handleAssistantMessageToken = (event: Event) => {
      const data = (event as CustomEvent).detail as {
        messageId?: string;
        chatId?: string;
        accumulatedContent?: string;
      };
      if (data.messageId && data.chatId && data.accumulatedContent) {
        // Update local state optimistically for streaming
        setAssistantData((prev) => {
          if (!prev || !("messages" in prev)) return prev;
          const messageIndex = prev.messages.findIndex(
            (msg) => msg["id"] === data.messageId
          );
          if (messageIndex >= 0) {
            // Update existing message
            return {
              ...prev,
              messages: prev.messages.map((msg) =>
                msg["id"] === data.messageId
                  ? { ...msg, content: data.accumulatedContent! }
                  : msg
              ),
            };
          } else {
            // Create new message if it doesn't exist
            const newMessage: AssistantChatFullResponse["messages"][number] = {
              id: data.messageId!,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: null,
              chatId: data.chatId!,
              role: "assistant",
              content: data.accumulatedContent!,
              completed: false,
            };
            return {
              ...prev,
              messages: [...prev.messages, newMessage],
            };
          }
        });
      }
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
    window.addEventListener("title_updated", handleTitleUpdated);
    window.addEventListener("tool_call_created", handleToolCallCreated);
    window.addEventListener("tool_call_completed", handleToolCallCompleted);
    window.addEventListener(
      "assistant_message_token",
      handleAssistantMessageToken
    );

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
      window.removeEventListener("title_updated", handleTitleUpdated);
      window.removeEventListener("tool_call_created", handleToolCallCreated);
      window.removeEventListener(
        "tool_call_completed",
        handleToolCallCompleted
      );
      window.removeEventListener(
        "assistant_message_token",
        handleAssistantMessageToken
      );
    };
  }, [
    isConnected,
    fetchAssistantData,
    profileId,
    getAssistantChatFull,
    getAssistantChatList,
  ]);

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
  const openWidget = useCallback(async () => {
    setUiState("widget");
    if (!hasEverOpened) {
      setHasEverOpened(true);
      // Fetch data directly when opening for first time
      await fetchAssistantData();
    }
  }, [hasEverOpened, fetchAssistantData]);

  const expand = useCallback(async () => {
    setUiState("expanded");
    if (!hasEverOpened) {
      setHasEverOpened(true);
      // Fetch data directly when expanding for first time
      await fetchAssistantData();
    }
  }, [hasEverOpened, fetchAssistantData]);

  const close = useCallback(() => {
    setUiState("closed");
  }, []);

  // Chat management methods
  const selectChat = useCallback(
    async (chatId: string) => {
      setCurrentChatId(chatId);
      // Fetch full chat data directly when selecting
      if (profileId && profileId !== "") {
        setIsLoadingChats(true);
        try {
          const data = await getAssistantChatFull({
            body: { chatId, profileId },
          });
          setAssistantData(data);
        } catch (error) {
          toast.error("Failed to load chat");
          // eslint-disable-next-line no-console
          console.error("Assistant chat fetch error:", error);
        } finally {
          setIsLoadingChats(false);
        }
      }
    },
    [profileId, getAssistantChatFull]
  );

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
      } catch {
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
    } catch {
      toast.error("Failed to stop message");
      setIsStoppingMessage(false);
    }
  }, [currentChatId, isConnected, emitStopAssistant]);

  // Only render chat components if user has permission
  if (!canShowChatComponents) {
    return null;
  }

  return (
    <>
      <ChatFab up={false} onOpenWidget={openWidget} uiState={uiState} />
      <ChatWidget
        up={false}
        uiState={uiState}
        currentChatId={currentChatId}
        chats={chats}
        isLoadingChats={isLoadingChats}
        chat={chat}
        messages={messages}
        toolCalls={toolCalls}
        isSendingMessage={isSendingMessage}
        isStoppingMessage={isStoppingMessage}
        isConnected={isConnected}
        onSelectChat={selectChat}
        onSetCurrentChatId={setCurrentChatId}
        onExpand={expand}
        onClose={close}
        onSendMessage={sendMessage}
        onStopMessage={stopMessage}
      />
      <ChatDialog
        uiState={uiState}
        currentChatId={currentChatId}
        chats={chats}
        isLoadingChats={isLoadingChats}
        chat={chat}
        messages={messages}
        toolCalls={toolCalls}
        isSendingMessage={isSendingMessage}
        isStoppingMessage={isStoppingMessage}
        isConnected={isConnected}
        onSelectChat={selectChat}
        onSetCurrentChatId={setCurrentChatId}
        onOpenWidget={openWidget}
        onClose={close}
        onSendMessage={sendMessage}
        onStopMessage={stopMessage}
      />
    </>
  );
}
