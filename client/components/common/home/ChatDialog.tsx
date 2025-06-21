/**
 * ChatDialog.tsx
 * Chat dialog component for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChat } from "@/contexts/chat-context";
import { useRole } from "@/contexts/role-context";
import { Minimize2, Plus, X } from "lucide-react";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import { getAssistantChat } from "@/utils/queries/assistant_chats/get-assistant-chat";
import { useQuery } from "@tanstack/react-query";

export default function ChatDialog({ chatId: _chatId }: { chatId?: string }) {
  const {
    uiState,
    openWidget,
    close,
    currentChatId,
    createNewChat,
    selectChat,
  } = useChat();
  const { effectiveRole } = useRole();

  const { data: chat } = useQuery({
    queryKey: ["assistantChat", currentChatId],
    queryFn: () => getAssistantChat(currentChatId!),
    enabled: !!currentChatId,
  });

  // Only show for instructor, instructional, or admin roles
  const shouldShow = ["instructor", "instructional", "admin"].includes(
    effectiveRole
  );

  if (!shouldShow || uiState !== "expanded") {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={() => close()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <DialogTitle className="text-lg font-semibold">
              Assistant Chat
            </DialogTitle>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {chat && (
                <select
                  value={currentChatId || ""}
                  onChange={(e) => selectChat(e.target.value)}
                  className="text-sm bg-transparent border border-border rounded px-2 py-1 cursor-pointer flex-1 min-w-0 max-w-xs"
                >
                  <option key={chat.id} value={chat.id}>
                    {chat.title}
                  </option>
                </select>
              )}
              {chat && (
                <span className="text-sm text-muted-foreground truncate">
                  {chat.title}
                </span>
              )}
              <Badge variant="secondary" className="text-xs shrink-0">
                {chat ? "1" : "0"} {chat ? "chat" : "chats"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={createNewChat}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Chat
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openWidget}
              className="h-8"
            >
              <Minimize2 className="h-4 w-4 mr-1" />
              Minimize
            </Button>
            <Button variant="outline" size="sm" onClick={close} className="h-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            <ChatMessages />
          </div>
          <div className="border-t">
            <ChatInput />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
