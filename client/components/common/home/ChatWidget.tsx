/**
 * ChatWidget.tsx
 * Chat widget component for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useChat } from "@/contexts/chat-context";
import { useRole } from "@/contexts/role-context";
import { Maximize2, Plus, X } from "lucide-react";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";

export default function ChatWidget() {
  const {
    uiState,
    expand,
    close,
    chats,
    currentChatId,
    createNewChat,
    selectChat,
  } = useChat();
  const { effectiveRole } = useRole();

  // Only show for instructor, instructional, or admin roles
  const shouldShow = ["instructor", "instructional", "admin"].includes(
    effectiveRole
  );

  if (!shouldShow || uiState !== "widget") {
    return null;
  }

  const currentChat = chats.find((chat) => chat.id === currentChatId);

  return (
    <Card className="fixed bottom-4 right-4 w-96 h-[500px] shadow-xl border-2 z-40 flex flex-col">
      <CardHeader className="p-3 border-b flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {chats.length > 1 && (
              <select
                value={currentChatId || ""}
                onChange={(e) => selectChat(e.target.value)}
                className="text-sm bg-transparent border-none outline-none cursor-pointer flex-1 min-w-0 truncate"
              >
                {chats.map((chat) => (
                  <option key={chat.id} value={chat.id}>
                    {chat.title}
                  </option>
                ))}
              </select>
            )}
            {chats.length <= 1 && (
              <span className="text-sm font-medium truncate">
                {currentChat?.title || "Assistant Chat"}
              </span>
            )}
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {chats.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={createNewChat}
            className="h-6 w-6 p-0"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={expand}
            className="h-6 w-6 p-0"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={close}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 flex flex-col min-h-0">
        <div className="flex-1 min-h-0">
          <ChatMessages />
        </div>
        <div className="border-t">
          <ChatInput />
        </div>
      </CardContent>
    </Card>
  );
}
