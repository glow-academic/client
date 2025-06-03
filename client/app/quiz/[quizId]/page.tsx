/**
 * app/quiz/[id]/page.tsx
 * Quiz interface for GTAs to complete assigned quizzes
 * Based on chat page interface but handles multiple chats linked to a quiz
 */
"use client";

import React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// UI Components
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

// Icons
import { 
  Send, 
  ChevronDown, 
  ArrowLeft, 
  Clock,
  Users,
  CheckCircle
} from "lucide-react";

import DocumentViewer from "@/components/DocumentViewer";
import Markdown from "@/components/Markdown";
import { getQuiz } from "@/utils/queries/get-quiz";
import { getQuizChats } from "@/utils/queries/get-quiz-chats";
import { getMessages } from "@/utils/queries/get-messages";
import { getRubric } from "@/utils/queries/get-rubric";
import { getDocuments } from "@/utils/queries/get-documents";
import { getClasses } from "@/utils/queries/get-classes";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { UnifiedSidebar } from "@/components/unified-sidebar";
import { Separator } from "@/components/ui/separator";

interface QuizMessage {
  id: string;
  query: string;
  response: string;
  createdAt: string;
  chatId: string;
  completed: boolean;
}

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const quizId = params.id as string;

  const [currentChatIndex, setCurrentChatIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState("quiz");
  
  // Chat state for current chat
  const [newMessage, setNewMessage] = useState("");
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [endChatLoading, setEndChatLoading] = useState(false);
  const [showQuizResults, setShowQuizResults] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch quiz data
  const { data: quizData, isLoading: quizLoading, error: quizError } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => getQuiz(quizId),
    enabled: !!quizId,
  });

  // Fetch chats linked to this quiz
  const { data: quizChats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ["quiz-chats", quizId],
    queryFn: () => getQuizChats(quizId),
    enabled: !!quizId,
  });

  // Fetch messages for current chat
  const currentChat = quizChats[currentChatIndex];
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", currentChat?.id],
    queryFn: () => getMessages(currentChat.id),
    enabled: !!currentChat?.id,
  });

  // Fetch rubric for current chat
  const { data: currentRubric, isLoading: rubricLoading } = useQuery({
    queryKey: ["rubric", currentChat?.id],
    queryFn: () => getRubric(currentChat.id),
    enabled: !!currentChat?.id && currentChat.completed,
  });

  // Fetch all rubrics for completed chats (for final results)
  const completedChatIds = quizChats.filter(chat => chat.completed).map(chat => chat.id);
  const { data: allRubrics = [] } = useQuery({
    queryKey: ["all-rubrics", completedChatIds],
    queryFn: async () => {
      const rubrics = await Promise.all(
        completedChatIds.map(chatId => getRubric(chatId))
      );
      return rubrics.filter(Boolean);
    },
    enabled: completedChatIds.length > 0,
  });

  // Fetch documents for the quiz class
  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getDocuments(),
    enabled: !!quizData?.classId,
  });

  // Fetch classes to get class info
  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });

  // Filter documents for the current quiz's class
  const classDocuments = useMemo(() => {
    if (!quizData?.classId || !documents) return [];
    return documents.filter(doc => doc.classId === quizData.classId);
  }, [documents, quizData?.classId]);

  // Initialize quiz timer
  useEffect(() => {
    if (quizData && !quizStartTime) {
      setQuizStartTime(new Date());
      setTimeRemaining(quizData.timeLimit * 60); // Convert to seconds
    }
  }, [quizData, quizStartTime]);

  // Timer countdown
  useEffect(() => {
    if (!isActive || timeRemaining <= 0 || showQuizResults) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsActive(false);
          handleQuizComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeRemaining, showQuizResults]);

  // Reset chat state when moving to next chat
  useEffect(() => {
    setNewMessage("");
    setIsFirstMessage(messages.length === 0);
    setShowScrollButton(false);
  }, [currentChatIndex, messages.length]);

  // Check if current chat is completed and move to next or show results
  useEffect(() => {
    if (currentChat?.completed && !showQuizResults) {
      if (currentChatIndex < quizChats.length - 1) {
        // Move to next chat after a short delay
        const timer = setTimeout(() => {
          setCurrentChatIndex(prev => prev + 1);
          toast.success(`Moving to chat ${currentChatIndex + 2} of ${quizChats.length}`);
        }, 2000);
        return () => clearTimeout(timer);
      } else {
        // All chats completed, show results
        setShowQuizResults(true);
        setIsActive(false);
      }
    }
  }, [currentChat?.completed, currentChatIndex, quizChats.length, showQuizResults]);

  const handleQuizComplete = async () => {
    setShowQuizResults(true);
    setIsActive(false);
    toast.success("Quiz completed!");
  };

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = async (
    e: React.FormEvent<HTMLFormElement> | null,
    initialMessage?: string,
  ) => {
    if (e) e.preventDefault();

    const messageToSend = initialMessage || newMessage;
    if (!messageToSend.trim() || !currentChat) return;

    setIsFirstMessage(false);

    /* ---------------- optimistic user bubble ---------------- */
    const userMsg: QuizMessage = {
      id: `temp-${Date.now()}`,
      query: messageToSend,
      response: "",
      createdAt: new Date().toISOString(),
      chatId: currentChat.id,
      completed: false,
    };

    const aiMsg: QuizMessage = {
      id: `temp-ai-${Date.now()}`,
      query: "",
      response: "",
      createdAt: new Date().toISOString(),
      chatId: currentChat.id,
      completed: false,
    };

    queryClient.setQueryData(
      ["messages", currentChat.id],
      (old: QuizMessage[] = []) => [...old, userMsg, aiMsg],
    );

    setNewMessage("");
    let accumulated = "";
    const ctrl = new AbortController();

    try {
      const formData = new FormData();
      formData.append("chat_id", currentChat.id);
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

        const parts = buffer.split("\n\n");
        buffer = parts.pop()!;

        for (const part of parts) {
          if (!part.startsWith("data:")) continue;

          const data = JSON.parse(part.slice(5));

          if (data.text) {
            accumulated += data.text;
            queryClient.setQueryData(
              ["messages", currentChat.id],
              (old: QuizMessage[] = []) =>
                old.map((m) =>
                  m.id === aiMsg.id ? { ...m, response: accumulated } : m,
                ),
            );
          }

          if (data.done || data.error) {
            await queryClient.invalidateQueries({
              queryKey: ["messages", currentChat.id],
            });
            break;
          }
        }
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      queryClient.setQueryData(
        ["messages", currentChat.id],
        (old: QuizMessage[] = []) =>
          old.map((m) =>
            m.id === aiMsg.id
              ? { ...m, response: "⚠️ Error - please try again." }
              : m,
          ),
      );
    } finally {
      ctrl.abort();
    }
  };

  const handleEndChat = async () => {
    if (!currentChat) return;
    
    setEndChatLoading(true);
    try {
      const formData = new FormData();
      formData.append("chat_id", currentChat.id);
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
      
      // Invalidate queries to refresh chat status
      queryClient.invalidateQueries({ queryKey: ["quiz-chats", quizId] });
      queryClient.invalidateQueries({ queryKey: ["rubric", currentChat.id] });
      
    } catch (error) {
      console.error(error);
      toast.error("Failed to end chat session");
    } finally {
      setEndChatLoading(false);
    }
  };

  // Handler for initial message button clicks
  const handleInitialMessageClick = (message: string) => {
    handleSendMessage(null, message);
  };

  // Scroll functions
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.target as HTMLDivElement;
    const atBottom = Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 2;
    setShowScrollButton(!atBottom);
  };

  useEffect(() => {
    const scrollArea = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (scrollArea) {
      const isAtBottom = scrollArea.scrollTop >= scrollArea.scrollHeight - scrollArea.clientHeight - 100;
      if (messages.length > 0 && isAtBottom) {
        scrollToBottom();
      } else if (messages.length > 0) {
        setShowScrollButton(scrollArea.scrollHeight > scrollArea.clientHeight);
      }
    }
  }, [messages]);

  // Loading dots component
  const LoadingDots = () => (
    <div className="flex items-center space-x-1">
      <span className="animate-pulse">.</span>
      <span className="animate-pulse delay-200">.</span>
      <span className="animate-pulse delay-400">.</span>
    </div>
  );

  const handleBack = () => {
    router.push("/home");
  };

  // Calculate aggregated quiz results
  const aggregatedResults = useMemo(() => {
    if (allRubrics.length === 0) return null;

    const totalScore = allRubrics.reduce((sum, rubric) => sum + rubric.score, 0);
    const avgScore = Math.round(totalScore / allRubrics.length);
    const totalTime = allRubrics.reduce((sum, rubric) => sum + rubric.timeTaken, 0);
    const passed = allRubrics.every(rubric => rubric.passed);

    const avgListening = Math.round(allRubrics.reduce((sum, r) => sum + r.listening, 0) / allRubrics.length);
    const avgObjectives = Math.round(allRubrics.reduce((sum, r) => sum + r.objectives, 0) / allRubrics.length);
    const avgTimeManagement = Math.round(allRubrics.reduce((sum, r) => sum + r.timeManagement, 0) / allRubrics.length);
    const avgAdaptability = Math.round(allRubrics.reduce((sum, r) => sum + r.adaptability, 0) / allRubrics.length);

    return {
      totalChats: allRubrics.length,
      avgScore,
      totalTime,
      passed,
      avgListening,
      avgObjectives,
      avgTimeManagement,
      avgAdaptability,
    };
  }, [allRubrics]);

  if (quizLoading || chatsLoading) {
    return (
      <SidebarProvider>
        <UnifiedSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex flex-1 items-center justify-between">
              <Skeleton className="h-6 w-48" />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <Skeleton className="h-full w-full" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (quizError || !quizData || quizChats.length === 0) {
    return (
      <SidebarProvider>
        <UnifiedSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex flex-1 items-center justify-between">
              <h1 className="text-xl font-semibold">Quiz Not Found</h1>
            </div>
          </header>
          <div className="flex flex-1 items-center justify-center p-4">
            <Card>
              <CardContent className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-2">Quiz Not Found</h2>
                <p className="text-muted-foreground mb-4">
                  The quiz you're looking for doesn't exist or has no chats configured.
                </p>
                <Button onClick={() => router.push("/home")}>Return Home</Button>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  // Show quiz results
  if (showQuizResults) {
    return (
      <SidebarProvider>
        <UnifiedSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <SidebarInset>
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
                <div>
                  <h1 className="text-xl font-semibold">{quizData.title} - Results</h1>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>Quiz Completed</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="max-w-4xl mx-auto space-y-6" data-testid="quiz-results">
              {/* Aggregated Results */}
              {aggregatedResults && (
                <Card className={`border-0 ${aggregatedResults.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold mb-2">
                        {aggregatedResults.passed ? "PASSED" : "FAILED"}
                      </div>
                      <div className="text-lg mb-4" data-testid="overall-score">
                        Overall Score: {aggregatedResults.avgScore}/20
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="font-medium">Chats Completed</div>
                          <div>{aggregatedResults.totalChats}</div>
                        </div>
                        <div>
                          <div className="font-medium">Total Time</div>
                          <div>{Math.floor(aggregatedResults.totalTime / 60)}:{(aggregatedResults.totalTime % 60).toString().padStart(2, '0')}</div>
                        </div>
                        <div>
                          <div className="font-medium">Avg Listening</div>
                          <div>{aggregatedResults.avgListening}/5</div>
                        </div>
                        <div>
                          <div className="font-medium">Avg Adaptability</div>
                          <div>{aggregatedResults.avgAdaptability}/5</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Individual Chat Results */}
              <div className="grid gap-4">
                <h2 className="text-xl font-semibold">Individual Chat Results</h2>
                {allRubrics.map((rubric, index) => {
                  const chat = quizChats.find(c => c.id === rubric.chatId);
                  return (
                    <Card key={rubric.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">Chat {index + 1}: {chat?.title}</CardTitle>
                            <p className="text-sm text-muted-foreground">Scenario ID: {chat?.scenarioId}</p>
                          </div>
                          <Badge variant={rubric.passed ? "default" : "destructive"}>
                            {rubric.score}/20
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="font-medium">Listening</div>
                          <div>{rubric.listening}/5</div>
                        </div>
                        <div>
                          <div className="font-medium">Objectives</div>
                          <div>{rubric.objectives}/5</div>
                        </div>
                        <div>
                          <div className="font-medium">Time Management</div>
                          <div>{rubric.timeManagement}/5</div>
                        </div>
                        <div>
                          <div className="font-medium">Adaptability</div>
                          <div>{rubric.adaptability}/5</div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="text-center">
                <Button data-testid="return-home-button" onClick={() => router.push("/home")} size="lg">
                  Return to Dashboard
                </Button>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <UnifiedSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger data-testid="sidebar-trigger" className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                data-testid="back-button"
                variant="ghost"
                onClick={handleBack}
                className="p-1 h-auto hover:bg-accent"
                size="sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold">{quizData.title}</h1>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span data-testid="chat-counter">Chat {currentChatIndex + 1} of {quizChats.length}</span>
                  {currentChat && (
                    <span>• {currentChat.title}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-full" data-testid="timer">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">{formatTime(timeRemaining)}</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-4 p-4 min-h-0">
          {currentChat && (
            <Card className="mb-4 shadow-sm border bg-card">
              <CardContent className="px-4">
                <p className="text-sm text-card-foreground">
                  Scenario ID: {currentChat.scenarioId}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-1 min-h-0 gap-4">
            {/* CHAT column */}
            <div className="flex flex-col w-full min-h-0">
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
                        </>
                      ) : (
                        messages.map((message) => (
                          <div key={message.id} className="space-y-4">
                            {message.query && (
                              <div className="flex items-start gap-3 text-sm justify-end">
                                <div className="grid gap-1 text-right">
                                  <p className="font-medium">You</p>
                                  <div data-testid="user-message" className="rounded-lg bg-muted p-3">
                                    <Markdown>{message.query}</Markdown>
                                  </div>
                                </div>
                                <Avatar>
                                  <AvatarFallback>U</AvatarFallback>
                                </Avatar>
                              </div>
                            )}
                            {message.response !== undefined && message.query !== "" && (
                              <div className="flex items-start gap-3 text-sm">
                                <Avatar>
                                  <AvatarFallback>AI</AvatarFallback>
                                </Avatar>
                                <div className="grid gap-1">
                                  <p className="font-medium">Student</p>
                                  <div data-testid="ai-message" className="rounded-lg bg-primary/10 p-3">
                                    {message.response === "" ? (
                                      <div className="flex items-center">
                                        <span className="text-gray-500">Responding</span>
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

                  {/* Show initial messages in the center */}
                  {!currentChat?.completed && isFirstMessage && !messagesLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full max-w-4xl p-6 flex flex-col gap-4">
                        <p className="text-sm text-center text-muted-foreground">
                          Choose an opening message:
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <Card
                            data-testid="initial-message-card"
                            className="flex-1 border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                            onClick={() => handleInitialMessageClick("Hi, how are you?")}
                          >
                            <CardContent className="p-5 text-center flex items-center justify-center h-full">
                              <p className="text-base font-medium">Hi, how are you?</p>
                            </CardContent>
                          </Card>
                          <Card
                            data-testid="initial-message-card"
                            className="flex-1 border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                            onClick={() => handleInitialMessageClick("Hi, what can I help you with?")}
                          >
                            <CardContent className="p-5 text-center flex items-center justify-center h-full">
                              <p className="text-base font-medium">Hi, what can I help you with?</p>
                            </CardContent>
                          </Card>
                          <Card
                            data-testid="initial-message-card"
                            className="flex-1 border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                            onClick={() => {
                              const currentClass = classes?.find(c => c.id === quizData.classId);
                              handleInitialMessageClick(`Hi, are you here for ${currentClass?.classCode}?`);
                            }}
                          >
                            <CardContent className="p-5 text-center flex items-center justify-center h-full">
                              <p className="text-base font-medium">
                                Hi, are you here for {classes?.find(c => c.id === quizData.classId)?.classCode}?
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>

                {!currentChat?.completed && !isFirstMessage && (
                  <CardFooter className="p-3 border-t">
                    <form onSubmit={handleSendMessage} className="flex w-full gap-3">
                      <div className="relative flex-1">
                        <Input
                          data-testid="message-input"
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type your response..."
                          className="pr-10 py-2 text-sm"
                          autoFocus
                        />
                        <Button
                          data-testid="send-button"
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
                        data-testid="end-chat-button"
                        onClick={handleEndChat}
                        variant="destructive"
                        disabled={endChatLoading}
                        className="whitespace-nowrap"
                      >
                        {endChatLoading ? "Ending..." : "End Chat"}
                      </Button>
                    </form>
                  </CardFooter>
                )}
              </Card>
            </div>

            {/* Document Viewer */}
            {classDocuments.length > 0 && (
              <div className="hidden lg:block w-1/3 shrink-0 min-h-0">
                <DocumentViewer classId={quizData.classId} />
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
