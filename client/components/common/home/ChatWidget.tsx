/**
 * ChatWidget.tsx
 * Chat widget component for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssistant } from "@/contexts/assistant-context";
import { useRole } from "@/contexts/role-context";
import { getAssistantChat } from "@/utils/queries/assistant_chats/get-assistant-chat";
import { useQuery } from "@tanstack/react-query";
import { Edit, Maximize2, X } from "lucide-react";
import { useState } from "react";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";

export default function ChatWidget() {
  const {
    uiState,
    expand,
    close,
    currentChatId,
    chats,
    isLoadingChats,
    selectChat,
    startBlankChat,
  } = useAssistant();
  const { effectiveRole } = useRole();
  const [promptToSet, setPromptToSet] = useState<string>("");

  // Only show for instructor, instructional, or admin roles
  const shouldShow = ["instructor", "instructional", "admin"].includes(
    effectiveRole
  );

  const { data: chat } = useQuery({
    queryKey: ["assistantChat", currentChatId],
    queryFn: () => getAssistantChat(currentChatId!),
    enabled: !!currentChatId,
  });

  if (!shouldShow || uiState !== "widget") {
    return null;
  }

  const handleChatSelect = (value: string) => {
    if (value !== "new") {
      selectChat(value);
    }
  };

  const getCurrentChatTitle = () => {
    if (!currentChatId) return "New Chat";
    return chat?.title || "GLOW Assistant";
  };

  const handlePromptClick = (prompt: string) => {
    setPromptToSet(prompt);
  };

  const handlePromptSet = () => {
    setPromptToSet("");
  };

  return (
    <Card className="fixed bottom-4 right-4 w-96 h-[500px] shadow-xl border-2 z-40 flex flex-col">
      <CardHeader className="p-3 border-b flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Select
            value={currentChatId || "new"}
            onValueChange={handleChatSelect}
            disabled={isLoadingChats}
          >
            <SelectTrigger className="w-full border-none shadow-none p-0 h-auto focus:ring-0">
              <SelectValue>
                <span className="text-sm font-medium truncate">
                  {getCurrentChatTitle()}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {chats && chats.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Past Chats
                  </div>
                  {chats
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .map((pastChat) => (
                      <SelectItem key={pastChat.id} value={pastChat.id}>
                        <span className="truncate">{pastChat.title}</span>
                      </SelectItem>
                    ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={startBlankChat}
            className="h-6 w-6 p-0"
          >
            <Edit className="h-3 w-3" />
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
          <ChatMessages onPromptClick={handlePromptClick} />
        </div>
        <div className="border-t">
          <ChatInput promptToSet={promptToSet} onPromptSet={handlePromptSet} />
        </div>
      </CardContent>
    </Card>
  );
}
