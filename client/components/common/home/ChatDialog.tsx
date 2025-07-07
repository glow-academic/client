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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAssistant } from "@/contexts/assistant-context";
import { useRole } from "@/contexts/role-context";
import { getAssistantChat } from "@/utils/queries/assistant_chats/get-assistant-chat";
import { useQuery } from "@tanstack/react-query";
import { Edit, Minimize2, X } from "lucide-react";
import { useState } from "react";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";

export default function ChatDialog({ chatId: _chatId }: { chatId?: string }) {
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
    <Dialog open={true} onOpenChange={() => close()}>
      <DialogContent className="max-w-6xl w-[90vw] h-[85vh] flex flex-col p-0 [&>button]:hidden">
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Select
              value={currentChatId || "new"}
              onValueChange={handleChatSelect}
              disabled={isLoadingChats}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue>
                  <DialogTitle className="text-lg font-semibold truncate">
                    {getCurrentChatTitle()}
                  </DialogTitle>
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
          <div className="flex items-center gap-2 shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startBlankChat}
                    className="h-8"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>New Chat</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={expand}
                    className="h-8"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Minimize</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={close}
                    className="h-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Close</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </DialogHeader>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            <ChatMessages onPromptClick={handlePromptClick} />
          </div>
          <div className="border-t">
            <ChatInput
              promptToSet={promptToSet}
              onPromptSet={handlePromptSet}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
