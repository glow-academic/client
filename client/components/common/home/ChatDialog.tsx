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
  DialogDescription,
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
import { useAssistantChat } from "@/lib/api/hooks/assistant_chats";
import { Edit, Minimize2, X } from "lucide-react";
import { useState } from "react";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";

export default function ChatDialog({ chatId: _chatId }: { chatId?: string }) {
  const {
    uiState,
    close,
    openWidget,
    currentChatId,
    chats,
    isLoadingChats,
    selectChat,
    setCurrentChatId,
  } = useAssistant();
  const [promptToSet, setPromptToSet] = useState<string>("");
  const [showPrompts, setShowPrompts] = useState(true);

  const { data: chat } = useAssistantChat(currentChatId!, currentChatId !== undefined);

  if (uiState !== "expanded") {
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

  const handlePromptSet = () => {
    setPromptToSet("");
  };

  const handlePromptClick = (prompt: string) => {
    setPromptToSet(prompt);
  };

  return (
    <Dialog open={true} onOpenChange={() => close()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 [&>button]:hidden gap-0 rounded-t-2xl">
        <DialogDescription hidden>
          This dialog shows the chat history and allows you to add new messages.
        </DialogDescription>
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-2xl">
          <div className="flex items-center gap-3 flex-1 min-w-0 relative z-10">
            <Select
              value={currentChatId || "new"}
              onValueChange={handleChatSelect}
              disabled={isLoadingChats}
            >
              <SelectTrigger className="w-[250px] border border-gray-300 dark:border-gray-700 rounded-md shadow-none p-2 h-auto focus:ring-0 bg-white dark:bg-gray-900">
                <SelectValue>
                  <div className="flex items-center">
                    <DialogTitle className="text-lg font-semibold truncate">
                      {getCurrentChatTitle()}
                    </DialogTitle>
                  </div>
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
              {currentChatId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentChatId(undefined)}
                      className="h-8 w-8 relative z-10"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>New Chat</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={openWidget}
                    className="h-8 w-8 relative z-10"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Minimize to Widget</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={close}
                    className="h-8 w-8 relative z-10"
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
          <div className="flex-1 min-h-0 p-2 shadow-inner">
            <ChatMessages
              onPromptClick={handlePromptClick}
              showPrompts={showPrompts}
            />
          </div>
          <div className="border-t">
            <ChatInput
              promptToSet={promptToSet}
              onPromptSet={handlePromptSet}
              togglePrompt={(value: boolean) => {
                setShowPrompts(value);
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
