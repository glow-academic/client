/**
 * app/[chatId]/page.tsx
 * This page is to show each of the individual chats.
 * @AshokSaravanan222 & @siladiea
 * 2025-05-13
 */
"use client";

import { getChat } from "@/utils/queries/get-chat";
import { getMessages } from "@/utils/queries/get-messages";
import { getRubric } from "@/utils/queries/get-rubric";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React, { useState, useRef, use, useEffect } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, ChevronDown, ArrowLeft, Clock } from "lucide-react";
import Markdown from "@/components/Markdown";
import DocumentViewer from "@/components/DocumentViewer";
import { getDocuments } from "@/utils/queries/get-documents";
import { Skeleton } from "@/components/ui/skeleton";
import { getClasses } from "@/utils/queries/get-classes";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { UnifiedSidebar } from "@/components/unified-sidebar";
import { Separator } from "@/components/ui/separator";

const hoverStyles = `
.hover\\:scale-102:hover {
  transform: scale(1.02);
}
`;

export default function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [endSessionLoading, setEndSessionLoading] = useState(false);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [elapsedTime, setElapsedTime] = useState<string>("00:00");
  const [activeSection, setActiveSection] = useState("chat");

  const router = useRouter();

  const { data: chat, isLoading: chatLoading } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => getChat(chatId),
  });

  const { data: rubric, isLoading: rubricLoading } = useQuery({
    queryKey: ["rubric", chatId],
    queryFn: () => getRubric(chatId),
  });

  // Fetch messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => getMessages(chatId),
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getDocuments(),
  });

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });

  // Check if there are already messages to determine if it's the first interaction
  useEffect(() => {
    if (messages.length > 0) {
      setIsFirstMessage(false);
    }
  }, [messages]);

  // Helper function to format message display
  const getMessageSpacing = (index: number, totalMessages: number) => {
    // If it's the last message, add less bottom margin
    if (index === totalMessages - 1) return "mb-4";
    // Otherwise add more space between message groups
    return "mb-8";
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false); // guarantee it disappears
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.target as HTMLDivElement; // this is now the viewport
    const atBottom =
      Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 2; // 2-px tolerance
    setShowScrollButton(!atBottom);
  };
  // Scroll to bottom when new messages arrive - removing auto-scroll behavior
  useEffect(() => {
    // Only scroll to bottom for new messages if user is already at the bottom
    const scrollArea = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (scrollArea) {
      const isAtBottom =
        scrollArea.scrollTop >=
        scrollArea.scrollHeight - scrollArea.clientHeight - 100;
      if (messages.length > 0 && isAtBottom) {
        scrollToBottom();
      } else if (messages.length > 0) {
        // Show scroll button when new messages arrive and we're not at bottom
        // Only show if there's actually more content to scroll to
        setShowScrollButton(scrollArea.scrollHeight > scrollArea.clientHeight);
      }
    }
  }, [messages]);

  // Timer logic based on chat creation time
  useEffect(() => {
    if (!chat || !chat.createdAt) return;

    const calculateElapsedTime = () => {
      // If the chat is completed and rubric has timeTaken, show that instead
      if (chat.completed && rubric?.timeTaken) {
        setElapsedTime(formatTime(rubric.timeTaken));
        return;
      }

      const startTime = new Date(chat.createdAt).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startTime) / 1000); // in seconds

      const minutes = Math.floor(elapsed / 60)
        .toString()
        .padStart(2, "0");
      const seconds = (elapsed % 60).toString().padStart(2, "0");

      setElapsedTime(`${minutes}:${seconds}`);
    };

    // Helper function to format time in seconds to MM:SS
    const formatTime = (timeInSeconds: number) => {
      const minutes = Math.floor(timeInSeconds / 60)
        .toString()
        .padStart(2, "0");
      const seconds = (timeInSeconds % 60).toString().padStart(2, "0");
      return `${minutes}:${seconds}`;
    };

    calculateElapsedTime(); // Initial calculation

    // Only set up timer if chat is not completed
    let timer: NodeJS.Timeout | null = null;
    if (!chat.completed) {
      timer = setInterval(calculateElapsedTime, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [chat, rubric]);

  const handleSendMessage = async (
    e: React.FormEvent<HTMLFormElement> | null,
    initialMessage?: string,
  ) => {
    if (e) e.preventDefault();

    const messageToSend = initialMessage || newMessage;
    if (!messageToSend.trim()) return;

    // Set first message flag to false when a message is sent
    setIsFirstMessage(false);

    /* ---------------- optimistic user bubble ---------------- */
    const userMsg: (typeof messages)[0] = {
      id: `temp-${Date.now()}`,
      query: messageToSend,
      response: "",
      createdAt: new Date().toISOString(),
      chatId: chatId,
      completed: false,
    };

    const aiMsg: (typeof messages)[0] = {
      id: `temp-ai-${Date.now()}`,
      query: "",
      response: "",
      createdAt: new Date().toISOString(),
      chatId: chatId,
      completed: false,
    };

    queryClient.setQueryData(
      ["messages", chatId],
      (old: (typeof messages)[0][] = []) => [...old, userMsg, aiMsg],
    );

    setNewMessage(""); // clear input
    let accumulated = ""; // running buffer
    let streaming = true; // gate for re-entry
    const ctrl = new AbortController();

    try {
      /* --------------- kick off POST + SSE ------------------ */
      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append("message", userMsg.query);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chat/message`,
        {
          method: "POST",
          headers: { Accept: "text/event-stream" },
          cache: "no-cache",
          body: formData,
          signal: ctrl.signal,
        },
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        /* consume complete SSE frames */
        const parts = buffer.split("\n\n");
        buffer = parts.pop()!; // keep partial chunk

        for (const part of parts) {
          if (!part.startsWith("data:")) continue;

          const data = JSON.parse(part.slice(5)); // strip "data: "

          if (data.text) {
            accumulated += data.text;

            /* immutable cache update */
            queryClient.setQueryData(
              ["messages", chatId],
              (old: (typeof messages)[0][] = []) =>
                old.map((m) =>
                  m.id === aiMsg.id ? { ...m, response: accumulated } : m,
                ),
            );
          }

          if (data.done || data.error) {
            streaming = false;
            await queryClient.invalidateQueries({
              queryKey: ["messages", chatId],
            });
          }
        }
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      queryClient.setQueryData(
        ["messages", chatId],
        (old: (typeof messages)[0][] = []) =>
          old.map((m) =>
            m.id === aiMsg.id
              ? {
                  ...m,
                  response: "⚠️ Error - please try again.",
                }
              : m,
          ),
      );
    } finally {
      if (streaming) ctrl.abort(); // ensure closure if unmount during stream
    }
  };

  const handleEndSession = async () => {
    setEndSessionLoading(true);
    try {
      const formData = new FormData();
      formData.append("chat_id", chatId);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chat/end`,
        {
          method: "POST",
          body: formData,
        },
      );
      if (!response.ok) {
        throw new Error(response.statusText);
      }
    } catch (error) {
      console.error(error);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["rubric", chatId] });
      setEndSessionLoading(false);
    }
  };

  // Handler for initial message button clicks
  const handleInitialMessageClick = (message: string) => {
    handleSendMessage(null, message);
  };

  // Add this new component for the loading animation
  const LoadingDots = () => {
    return (
      <div className="flex items-center space-x-1">
        <span className="animate-pulse">.</span>
        <span className="animate-pulse delay-200">.</span>
        <span className="animate-pulse delay-400">.</span>
      </div>
    );
  };

  const handleBack = () => {
    queryClient.invalidateQueries({ queryKey: ["chats"] });
    router.push("/home");
  };

  return (
    <SidebarProvider>
      <UnifiedSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <SidebarInset>
        <style jsx global>
          {hoverStyles}
        </style>
        
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={handleBack}
                className="p-1 h-auto hover:bg-accent"
                size="sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl font-semibold">{chat?.title || "Chat"}</h1>
            </div>
            <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-full">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">{elapsedTime}</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-4 p-4 min-h-0">
          {chatLoading ? (
            <Skeleton className="mb-4 p-3 h-16 rounded-lg w-full" />
          ) : (
            <Card className="mb-4 shadow-sm border bg-card">
              <CardContent className="px-4">
                <p className="text-sm text-card-foreground">
                  Scenario ID: {chat?.scenarioId}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-1 min-h-0 gap-4">
            {/* CHAT column - taking exactly 2/3 width */}
            <div className={`flex flex-col w-full min-h-0`}>
              <Card className="flex flex-col flex-1 min-h-0">
                <CardContent className="flex-1 p-0 relative min-h-0">
                  <ScrollArea
                    className="flex-1 h-[calc(100vh-280px)] pb-0"
                    ref={scrollAreaRef}
                    onScrollCapture={handleScroll}
                  >
                    <div className="space-y-4 p-4 pb-0">
                      {messagesLoading ? (
                        <>
                          <div className="flex items-start gap-3 text-sm">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="grid gap-1 w-full max-w-[80%]">
                              <Skeleton className="h-4 w-20" />
                              <Skeleton className="h-20 w-full rounded-lg" />
                            </div>
                          </div>
                          <div className="flex items-start gap-3 text-sm justify-end">
                            <div className="grid gap-1 text-right w-full max-w-[80%]">
                              <Skeleton className="h-4 w-20 ml-auto" />
                              <Skeleton className="h-20 w-full rounded-lg" />
                            </div>
                            <Skeleton className="h-10 w-10 rounded-full" />
                          </div>
                        </>
                      ) : (
                        messages.map((message) => (
                          <div key={message.id} className="space-y-4">
                            {message.query && (
                              <div className="flex items-start gap-3 text-sm justify-end">
                                <div className="grid gap-1 text-right">
                                  <p className="font-medium">You</p>
                                  <div className="rounded-lg bg-muted p-3">
                                    <Markdown>{message.query}</Markdown>
                                  </div>
                                </div>
                                <Avatar>
                                  <AvatarFallback>U</AvatarFallback>
                                </Avatar>
                              </div>
                            )}
                            {message.response !== undefined &&
                              message.query !== "" && (
                                <div className="flex items-start gap-3 text-sm">
                                  <Avatar>
                                    <AvatarFallback>AI</AvatarFallback>
                                  </Avatar>
                                  <div className="grid gap-1">
                                    <p className="font-medium">Student</p>
                                    <div className="rounded-lg bg-primary/10 p-3">
                                      {message.response === "" ? (
                                        <div className="flex items-center">
                                          <span className="text-gray-500">
                                            Analyzing
                                          </span>
                                          <LoadingDots />
                                        </div>
                                      ) : (
                                        <Markdown>{message.response}</Markdown>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} className="h-2" />
                    </div>
                  </ScrollArea>

                  {showScrollButton && (
                    <Button
                      className="absolute left-1/2 bottom-4 -translate-x-1/2 rounded-full w-10 h-10 p-0 shadow-md z-10"
                      onClick={scrollToBottom}
                      size="icon"
                      variant="secondary"
                    >
                      <ChevronDown className="h-5 w-5" />
                      <span className="sr-only">Scroll to bottom</span>
                    </Button>
                  )}

                  {/* Show initial messages in the center of the chat area when in first message mode */}
                  {!chat?.completed && isFirstMessage && !chatLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full max-w-4xl p-6 flex flex-col gap-4">
                        <p className="text-sm text-center text-muted-foreground">
                          Choose an opening message:
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <Card
                            className="flex-1 border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer hover:scale-102 focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={() =>
                              handleInitialMessageClick("Hi, how are you?")
                            }
                            tabIndex={0}
                            onKeyDown={(e) =>
                              e.key === "Enter" &&
                              handleInitialMessageClick("Hi, how are you?")
                            }
                          >
                            <CardContent className="p-5 text-center flex items-center justify-center h-full">
                              <p className="text-base font-medium">
                                Hi, how are you?
                              </p>
                            </CardContent>
                          </Card>
                          <Card
                            className="flex-1 border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer hover:scale-102 focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={() =>
                              handleInitialMessageClick(
                                "Hi, what can I help you with?",
                              )
                            }
                            tabIndex={0}
                            onKeyDown={(e) =>
                              e.key === "Enter" &&
                              handleInitialMessageClick(
                                "Hi, what can I help you with?",
                              )
                            }
                          >
                            <CardContent className="p-5 text-center flex items-center justify-center h-full">
                              <p className="text-base font-medium">
                                Hi, what can I help you with?
                              </p>
                            </CardContent>
                          </Card>
                          <Card
                            className="flex-1 border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer hover:scale-102 focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={() =>
                              handleInitialMessageClick(
                                `Hi, are you here for ${classes?.find((c) => c.id === chat?.classId)?.classCode}?`,
                              )
                            }
                            tabIndex={0}
                            onKeyDown={(e) =>
                              e.key === "Enter" &&
                              handleInitialMessageClick(
                                `Hi, are you here for ${classes?.find((c) => c.id === chat?.classId)?.classCode}?`,
                              )
                            }
                          >
                            <CardContent className="p-5 text-center flex items-center justify-center h-full">
                              <p className="text-base font-medium">
                                Hi, are you here for{" "}
                                {
                                  classes?.find((c) => c.id === chat?.classId)
                                    ?.classCode
                                }
                                ?
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>

                {/* Only show input area if rubric is not shown and not in first message mode */}
                {!chat?.completed && !isFirstMessage && (
                  <CardFooter className="p-3 border-t">
                    {chatLoading ? (
                      <Skeleton className="w-full h-12 rounded-md" />
                    ) : (
                      <form
                        onSubmit={handleSendMessage}
                        className="flex w-full gap-3"
                      >
                        <div className="relative flex-1">
                          <Input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your response..."
                            className="pr-10 py-2 text-sm"
                            autoFocus
                          />
                          <Button
                            type="submit"
                            disabled={!newMessage.trim()}
                            size="icon"
                            variant="ghost"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                          >
                            <Send className="h-4 w-4 text-foreground" />
                            <span className="sr-only">Send</span>
                          </Button>
                        </div>
                        <Button
                          onClick={handleEndSession}
                          variant="destructive"
                          disabled={endSessionLoading}
                          className="whitespace-nowrap"
                        >
                          {endSessionLoading ? "Ending..." : "End Session"}
                        </Button>
                      </form>
                    )}
                  </CardFooter>
                )}
              </Card>
            </div>

            {/* RIGHT column - taking exactly 1/3 width */}
            {chat?.completed ? (
              <Card className="hidden lg:flex w-1/3 shrink-0 flex-col min-h-0">
                <CardContent className="flex-1 p-2 text-sm overflow-hidden">
                  <ScrollArea>
                    {rubricLoading ? (
                      <div className="space-y-4">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="border-b pb-2">
                            <div className="flex justify-between items-center">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-4 w-8" />
                            </div>
                            <Skeleton className="h-12 w-full mt-1" />
                          </div>
                        ))}
                        <Skeleton className="h-20 w-full mt-6 rounded-lg" />
                        <Skeleton className="h-10 w-full mt-6 rounded-md" />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div className="border-b pb-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Active Listening</span>
                            <span>{rubric?.listening}/5</span>
                          </div>
                          <p className="text-xs mt-1 text-gray-600">
                            {rubric?.listeningFeedback || "No feedback provided"}
                          </p>
                        </div>

                        <div className="border-b pb-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Objectives</span>
                            <span>{rubric?.objectives}/5</span>
                          </div>
                          <p className="text-xs mt-1 text-gray-600">
                            {rubric?.objectivesFeedback || "No feedback provided"}
                          </p>
                        </div>

                        <div className="border-b pb-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Time Management</span>
                            <span>{rubric?.timeManagement}/5</span>
                          </div>
                          <p className="text-xs mt-1 text-gray-600">
                            {rubric?.timeManagementFeedback ||
                              "No feedback provided"}
                          </p>
                        </div>

                        <div className="border-b pb-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Adaptability</span>
                            <span>{rubric?.adaptability}/5</span>
                          </div>
                          <p className="text-xs mt-1 text-gray-600">
                            {rubric?.adaptabilityFeedback ||
                              "No feedback provided"}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-6">
                      {rubricLoading ? (
                        <>
                          <Skeleton className="h-16 w-full rounded-lg" />
                          <Skeleton className="h-10 w-full mt-6 rounded-md" />
                        </>
                      ) : (
                        <>
                          <Card
                            className={`border-0 ${rubric?.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                          >
                            <CardContent className="rounded-lg text-center font-semibold">
                              <div className="text-xl">
                                {rubric?.passed ? "PASSED" : "FAILED"}
                              </div>
                              <div className="text-sm mt-1">
                                Score: {rubric?.score}/20
                              </div>
                            </CardContent>
                          </Card>

                          <Button
                            onClick={() => router.push("/home")}
                            className="mt-6 w-full text-sm py-2 h-auto font-medium"
                            size="lg"
                          >
                            Return to Dashboard
                          </Button>
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <>
                {(documents.length > 0 || documentsLoading) && (
                  <div className="hidden lg:block w-1/3 shrink-0 min-h-0">
                    {documentsLoading ? (
                      <Card className="w-full flex flex-col min-h-0">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-center text-sm">
                            Documents
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0">
                          <Skeleton className="h-full w-full rounded-md" />
                        </CardContent>
                      </Card>
                    ) : (
                      <DocumentViewer
                        classId={chat?.classId}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
