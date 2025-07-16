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
import { Edit, Maximize2, X } from "lucide-react";
import { useState } from "react";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import ChatStarterPrompts from "./ChatStarterPrompts";
import GlowHeader from "./GlowHeader";

export default function ChatWidget({ up }: { up: boolean }) {
  const {
    uiState,
    expand,
    close,
    currentChatId,
    chats,
    isLoadingChats,
    selectChat,
    setCurrentChatId,
  } = useAssistant();
  const { effectiveRole } = useRole();
  const [promptToSet, setPromptToSet] = useState<string>("");
  const [showPrompts, setShowPrompts] = useState(true);

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
    <Card
      className={`fixed bottom-2 right-2 w-96 h-[550px] shadow-xl border-2 z-40 flex flex-col bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 p-0 rounded-2xl gap-0 ${up ? "top-2 right-2" : "bottom-2 right-2"}`}
    >
      <CardHeader className="border-b flex flex-row items-center justify-between space-y-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-2xl rounded-b-none h-15 p-5 gap-5">
        <div className="flex items-center gap-2 flex-1 min-w-0 relative z-10">
          <div className="w-full">
            <Select
              value={currentChatId || "new"}
              onValueChange={handleChatSelect}
              disabled={isLoadingChats}
            >
              <SelectTrigger className="w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-none p-2 h-auto focus:ring-0 bg-white dark:bg-gray-900">
                <SelectValue>
                  <div className="flex items-center">
                    <span className="text-sm font-medium truncate">
                      {getCurrentChatTitle()}
                    </span>
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
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {currentChatId && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentChatId(null)}
                    className="h-7 w-7 hover:bg-white/50 dark:hover:bg-gray-800/50 relative z-10"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>New Chat</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={expand}
                  className="h-7 w-7 hover:bg-white/50 dark:hover:bg-gray-800/50 relative z-10"
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Expand</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={close}
                  className="h-7 w-7 hover:bg-white/50 dark:hover:bg-gray-800/50 relative z-10"
                >
                  <X className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Close</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 flex flex-col min-h-0 rounded-2xl">
        <div className="flex-1 min-h-0 overflow-hidden shadow-inner p-2">
          {currentChatId ? (
            <ChatMessages
              onPromptClick={handlePromptClick}
              variant="minimized"
            />
          ) : (
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center space-y-8 max-w-5xl w-full">
                <GlowHeader />
                <div
                  className={`transition-opacity duration-300 ease-in-out ${
                    showPrompts ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <ChatStarterPrompts
                    onPromptClick={handlePromptClick}
                    variant="minimized"
                  />
                </div>
              </div>
            </div>
          )}
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
      </CardContent>
    </Card>
  );
}
