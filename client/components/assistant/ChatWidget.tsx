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
import { Edit, Maximize2, X } from "lucide-react";
import { useState } from "react";
import type { AssistantChatFullResponse, ChatUIState } from "./AssistantChat";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import ChatStarterPrompts from "./ChatStarterPrompts";
import GlowHeader from "./GlowHeader";

export interface ChatWidgetProps {
  up: boolean;
  uiState: ChatUIState;
  currentChatId: string | undefined;
  chats: NonNullable<AssistantChatFullResponse["chat"]>[];
  isLoadingChats: boolean;
  chat: AssistantChatFullResponse["chat"];
  messages: AssistantChatFullResponse["messages"];
  toolCalls: AssistantChatFullResponse["toolCalls"];
  isSendingMessage: boolean;
  isStoppingMessage: boolean;
  isConnected: boolean;
  onSelectChat: (chatId: string) => void;
  onSetCurrentChatId: (chatId: string | undefined) => void;
  onExpand: () => void;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  onStopMessage: () => void;
}

export default function ChatWidget({
  up,
  uiState,
  currentChatId,
  chats,
  isLoadingChats,
  chat,
  messages,
  toolCalls,
  isSendingMessage,
  isStoppingMessage,
  isConnected,
  onSelectChat,
  onSetCurrentChatId,
  onExpand,
  onClose,
  onSendMessage,
  onStopMessage,
}: ChatWidgetProps) {
  const [promptToSet, setPromptToSet] = useState<string>("");
  const [showPrompts, setShowPrompts] = useState(true);

  if (uiState !== "widget") {
    return null;
  }

  const handleChatSelect = (value: string) => {
    if (value !== "new") {
      onSelectChat(value);
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
      data-testid="assistant-chat-widget"
    >
      <CardHeader
        className="border-b flex flex-row items-center justify-between space-y-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-2xl rounded-b-none h-15 p-5 gap-5"
        data-testid="assistant-chat-header"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0 relative z-10">
          <div className="w-full">
            <Select
              value={currentChatId || "new"}
              onValueChange={handleChatSelect}
              disabled={isLoadingChats}
              data-testid="assistant-chat-selector"
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
                        <SelectItem
                          key={pastChat.id}
                          value={pastChat.id}
                          data-testid={`assistant-chat-item-${pastChat.id}`}
                        >
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
                    onClick={() => onSetCurrentChatId(undefined)}
                    className="h-7 w-7 hover:bg-white/50 dark:hover:bg-gray-800/50 relative z-10"
                    data-testid="assistant-new-chat-button"
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
                  onClick={onExpand}
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
                  onClick={onClose}
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
              messages={messages}
              toolCalls={toolCalls}
              currentChatId={currentChatId}
              isLoadingChats={isLoadingChats}
              onPromptClick={handlePromptClick}
              variant="minimized"
            />
          ) : (
            <div className="flex items-center justify-center h-full p-6">
              <div className="flex flex-col justify-center items-center gap-8 max-w-5xl w-full h-full">
                <GlowHeader />
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    showPrompts ? "opacity-100 max-h-96" : "opacity-0 max-h-0"
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
            currentChatId={currentChatId}
            isSendingMessage={isSendingMessage}
            isStoppingMessage={isStoppingMessage}
            isConnected={isConnected}
            onSendMessage={onSendMessage}
            onStopMessage={onStopMessage}
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
