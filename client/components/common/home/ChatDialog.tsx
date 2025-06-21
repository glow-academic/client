/**
 * ChatDialog.tsx
 * Chat dialog component for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChat } from "@/contexts/chat-context";
import { useRole } from "@/contexts/role-context";
import { getAssistantChat } from "@/utils/queries/assistant_chats/get-assistant-chat";
import { useQuery } from "@tanstack/react-query";
import { Minimize2, X } from "lucide-react";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";

export default function ChatDialog({ chatId: _chatId }: { chatId?: string }) {
  const { uiState, openWidget, close, currentChatId } = useChat();
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
              {chat?.title || "GLOW Assistant"}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
