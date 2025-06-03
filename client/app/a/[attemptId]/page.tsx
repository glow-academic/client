/**
 * app/a/[attemptId]/page.tsx
 * Attempt interface for users to interact with attempts
 * Handles both single chat attempts (like individual chats) and multiple chat attempts (like quizzes)
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
  Clock,
  Users,
  CheckCircle,
  Activity,
  AlertCircle,
} from "lucide-react";

import DocumentViewer from "@/components/DocumentViewer";
import Markdown from "@/components/Markdown";
import { getAttempt } from "@/utils/queries/get-attempt";
import { getAttemptChats } from "@/utils/queries/get-attempt-chats";
import { getMessages } from "@/utils/queries/get-messages";
import { getRubric } from "@/utils/queries/get-rubric";
import { getDocuments } from "@/utils/queries/get-documents";
import { getTemplate } from "@/utils/queries/get-template";
import { getClass } from "@/utils/queries/get-class";
import { getScenario } from "@/utils/queries/get-scenario";
import { getChatTemplate } from "@/utils/queries/get-chat-template";
import Link from "next/link";

interface TemplateMessage {
  id: string;
  query: string;
  response: string;
  createdAt: string;
  chatId: string;
  completed: boolean;
}

export default function AttemptPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const attemptId = params.attemptId as string;

  const [currentChatIndex, setCurrentChatIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [freshlyCompletedChats, setFreshlyCompletedChats] = useState<Set<string>>(new Set());

  // Chat state for current chat
  const [newMessage, setNewMessage] = useState("");
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [endChatLoading, setEndChatLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch attempt data
  const { data: attempt, isLoading: attemptLoading, error: attemptError } = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => getAttempt(attemptId),
    enabled: !!attemptId,
  });

  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ["class", attempt?.classId],
    queryFn: () => getClass(attempt!.classId),
  });

  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ["template", attempt?.templateId],
    queryFn: () => getTemplate(attempt!.templateId),
  });

  // Fetch chats linked to this attempt
  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ["chats", attemptId],
    queryFn: () => getAttemptChats([attemptId]),
  });

  // Determine current chat based on chat template ID position in template
  const currentChat = React.useMemo(() => {
    if (!chats.length || !template?.chatTemplateIds) return chats[0];

    // Find the chat that matches the current chat template ID
    const currentChatTemplateId = template.chatTemplateIds[currentChatIndex];
    const chat = chats.find(chat => chat.chatTemplateId === currentChatTemplateId);
    return chat || chats[0];
  }, [chats, template?.chatTemplateIds, currentChatIndex]);

  // Fetch messages for current chat
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

  // Fetch scenario for current chat
  const { data: scenario, isLoading: scenarioLoading } = useQuery({
    queryKey: ["scenario", currentChat?.scenarioId],
    queryFn: () => getScenario(currentChat.scenarioId),
    enabled: !!currentChat?.scenarioId,
  });

  // Fetch chat template for current chat
  const { data: chatTemplate, isLoading: chatTemplateLoading } = useQuery({
    queryKey: ["chatTemplate", currentChat?.chatTemplateId],
    queryFn: () => getChatTemplate(currentChat.chatTemplateId),
    enabled: !!currentChat?.chatTemplateId,
  });

  // Fetch all rubrics for completed chats (for final results)
  const completedChatIds = chats.filter((chat: any) => chat.completed).map((chat: any) => chat.id);
  const { data: allRubrics = [] } = useQuery({
    queryKey: ["all-rubrics", completedChatIds],
    queryFn: async () => {
      const rubrics = await Promise.all(
        completedChatIds.map((chatId: string) => getRubric(chatId))
      );
      return rubrics.filter(Boolean);
    },
    enabled: completedChatIds.length > 0,
  });

  // Fetch documents for the attempt class
  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getDocuments(),
    enabled: !!attempt?.classId,
  });

  // Filter documents for the current attempt's class
  const classDocuments = useMemo(() => {
    if (!attempt?.classId || !documents) return [];
    return documents.filter((doc: any) => doc.classId === attempt.classId);
  }, [documents, attempt?.classId]);

  // Determine if this is a single chat attempt (acts like individual chat) or multiple chats
  const isSingleChatAttempt = template?.chatTemplateIds?.length === 1;

  // Initialize session timer
  useEffect(() => {
    if (template && !sessionStartTime) {
      setSessionStartTime(new Date());
      setTimeRemaining(template.timeLimit * 60); // Convert to seconds
    }
  }, [template, sessionStartTime]);

  // Timer countdown
  useEffect(() => {
    if (!isActive || timeRemaining <= 0 || showResults) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsActive(false);
          handleSessionComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeRemaining, showResults]);

  // Reset chat state when moving to next chat
  useEffect(() => {
    setNewMessage("");
    setIsFirstMessage(messages.length === 0);
    setShowScrollButton(false);
  }, [currentChatIndex, messages.length]);

  // Initialize to first incomplete chat when data loads
  useEffect(() => {
    if (chats.length > 0 && template?.chatTemplateIds && currentChatIndex === 0) {
      // Find the first incomplete chat
      const firstIncompleteIndex = template.chatTemplateIds.findIndex((templateId: string) => {
        const chat = chats.find((c: any) => c.chatTemplateId === templateId);
        return chat && !chat.completed;
      });
      
      // If we found an incomplete chat, set the index to it
      if (firstIncompleteIndex !== -1 && firstIncompleteIndex !== currentChatIndex) {
        setCurrentChatIndex(firstIncompleteIndex);
      }
    }
  }, [chats, template?.chatTemplateIds, currentChatIndex]);

  // Check if current chat is completed and move to next or show results
  useEffect(() => {
    if (currentChat?.completed && !showResults) {
      // Only auto-advance if this chat was freshly completed in this session
      const isFreshlyCompleted = freshlyCompletedChats.has(currentChat.id);
      
      if (isFreshlyCompleted) {
        if (!isSingleChatAttempt && currentChatIndex < (template?.chatTemplateIds?.length || 0) - 1) {
          // Move to next chat after a short delay (only for multi-chat attempts)
          const timer = setTimeout(() => {
            setCurrentChatIndex(prev => {
              const nextIndex = prev + 1;
              toast.success(`Moving to chat ${nextIndex + 1} of ${template?.chatTemplateIds?.length || 0}`);
              return nextIndex;
            });
          }, 2000);
          return () => clearTimeout(timer);
        } else {
          // All chats completed or single chat completed, show results
          setShowResults(true);
          setIsActive(false);
        }
      }
    }
  }, [currentChat?.completed, currentChat?.id, currentChatIndex, template?.chatTemplateIds?.length, showResults, isSingleChatAttempt, freshlyCompletedChats]);

  // Check if all chats are completed and show results (regardless of freshly completed status)
  useEffect(() => {
    if (chats.length > 0 && template?.chatTemplateIds && !showResults) {
      const totalExpectedChats = template.chatTemplateIds.length;
      const completedChats = chats.filter((chat: any) => chat.completed).length;
      
      if (completedChats === totalExpectedChats) {
        setShowResults(true);
        setIsActive(false);
      }
    }
  }, [chats, template?.chatTemplateIds, showResults]);

  const handleSessionComplete = async () => {
    setShowResults(true);
    setIsActive(false);
    toast.success(isSingleChatAttempt ? "Session completed!" : "Attempt completed!");
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Helper function to format chat template attributes
  const formatChatTemplateInfo = (template: any) => {
    if (!template) return null;

    const crowdednessText = template.crowdedness === 1 ? "Low crowdedness" :
      template.crowdedness === 2 ? "Moderate crowdedness" :
        template.crowdedness === 3 ? "High crowdedness" :
          template.crowdedness === 4 ? "Very high crowdedness" :
            template.crowdedness === 5 ? "Extremely crowded" :
              `Crowdedness: ${template.crowdedness}`;

    const intensityText = template.intensity === 1 ? "Low intensity" :
      template.intensity === 2 ? "Moderate intensity" :
        template.intensity === 3 ? "High intensity" :
          template.intensity === 4 ? "Very high intensity" :
            template.intensity === 5 ? "Extremely intense" :
              `Intensity: ${template.intensity}`;

    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span>{crowdednessText}</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          <span>{intensityText}</span>
        </div>
      </div>
    );
  };

  // Updated streaming message handler from chat page
  const handleSendMessage = async (
    e: React.FormEvent<HTMLFormElement> | null,
    initialMessage?: string,
  ) => {
    if (e) e.preventDefault();

    const messageToSend = initialMessage || newMessage.trim();
    if (!messageToSend || !currentChat) return;

    setNewMessage("");
    setIsFirstMessage(false);

    /* ---------------- optimistic user bubble ---------------- */
    const userMsg: TemplateMessage = {
      id: `temp-${Date.now()}`,
      query: messageToSend,
      response: "",
      createdAt: new Date().toISOString(),
      chatId: currentChat.id,
      completed: false,
    };

    const aiMsg: TemplateMessage = {
      id: `temp-ai-${Date.now()}`,
      query: "",
      response: "",
      createdAt: new Date().toISOString(),
      chatId: currentChat.id,
      completed: false,
    };

    queryClient.setQueryData(
      ["messages", currentChat.id],
      (old: TemplateMessage[] = []) => [...old, userMsg, aiMsg],
    );

    let accumulated = ""; // running buffer
    let streaming = true; // gate for re-entry
    const ctrl = new AbortController();

    try {
      /* --------------- kick off POST + SSE ------------------ */
      const formData = new FormData();
      formData.append("chat_id", currentChat.id);
      formData.append("message", userMsg.query);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/attempt/message`,
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
              ["messages", currentChat.id],
              (old: TemplateMessage[] = []) =>
                old.map((m) =>
                  m.id === aiMsg.id ? { ...m, response: accumulated } : m,
                ),
            );
          }

          if (data.done || data.error) {
            streaming = false;
            await queryClient.invalidateQueries({
              queryKey: ["messages", currentChat.id],
            });
          }
        }
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      queryClient.setQueryData(
        ["messages", currentChat.id],
        (old: TemplateMessage[] = []) =>
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

  const handleEndChat = async () => {
    if (!currentChat) return;

    setEndChatLoading(true);

    try {
      const formData = new FormData();
      formData.append("chat_id", currentChat.id);
      formData.append("attempt_id", attemptId);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attempt/continue`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to end chat");
      }

      const result = await response.json();

      if (result.success) {
        // Mark this chat as freshly completed
        setFreshlyCompletedChats(prev => new Set(prev).add(currentChat.id));
        
        queryClient.invalidateQueries({ queryKey: ["chats", attemptId] });
        queryClient.invalidateQueries({ queryKey: ["rubric", currentChat.id] });
        toast.success("Chat ended successfully");
      } else {
        throw new Error(result.error || "Failed to end chat");
      }
    } catch (error) {
      console.error("Error ending chat:", error);
      toast.error(error instanceof Error ? error.message : "Failed to end chat");
    } finally {
      setEndChatLoading(false);
    }
  };

  const handleInitialMessageClick = (message: string) => {
    handleSendMessage(null, message);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom && messages.length > 0);
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  // Calculate aggregated results for final display
  const aggregatedResults = useMemo(() => {
    if (allRubrics.length === 0) return null;

    const totalScore = allRubrics.reduce((sum: number, rubric: any) => sum + rubric.score, 0);
    const averageScore = totalScore / allRubrics.length;
    const passedChats = allRubrics.filter((rubric: any) => rubric.passed).length;
    const totalTime = allRubrics.reduce((sum: number, rubric: any) => sum + rubric.timeTaken, 0);

    return {
      totalChats: allRubrics.length,
      passedChats,
      averageScore: Math.round(averageScore * 10) / 10,
      totalTime: Math.round(totalTime / 60), // Convert to minutes
      overallPassed: passedChats === allRubrics.length,
    };
  }, [allRubrics]);

  const LoadingDots = () => (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );

  // Expose timer data to parent layout via context or custom hook
  useEffect(() => {
    // Store timer data in a way that the layout can access it
    if (typeof window !== 'undefined') {
      (window as any).attemptTimer = {
        timeRemaining,
        formatTime: formatTime,
        isActive,
        showResults
      };
    }
  }, [timeRemaining, isActive, showResults]);

  if (attemptLoading || templateLoading || scenarioLoading || chatTemplateLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (attemptError || !attempt || template?.chatTemplateIds?.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Attempt Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The attempt you're looking for doesn't exist or has no chats configured.
            </p>
            <Button onClick={() => router.push("/dashboard/templates")}>Return To Templates</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show results screen
  if (showResults) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="max-w-4xl mx-auto space-y-6" data-testid="attempt-results">
          {/* Aggregated Results */}
          {aggregatedResults && (
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Overall Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium">{isSingleChatAttempt ? "Session" : "Chats"} Completed</div>
                    <div>{aggregatedResults.totalChats}</div>
                  </div>
                  <div>
                    <div className="font-medium">Average Score</div>
                    <div>{aggregatedResults.averageScore}/20</div>
                  </div>
                  <div>
                    <div className="font-medium">Total Time</div>
                    <div>{aggregatedResults.totalTime} min</div>
                  </div>
                  <div>
                    <div className="font-medium">Status</div>
                    <Badge variant={aggregatedResults.overallPassed ? "default" : "destructive"}>
                      {aggregatedResults.overallPassed ? "Passed" : "Failed"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Individual Chat Results - only show for multi-chat attempts */}
          {!isSingleChatAttempt && (
            <div className="grid gap-4">
              <h2 className="text-xl font-semibold">Individual Chat Results</h2>
              {allRubrics.map((rubric: any, index: number) => {
                const chat = chats.find((c: any) => c.id === rubric.chatId);
                return (
                  <Link href={`/c/${rubric.chatId}`} key={rubric.id}>
                    <Card key={rubric.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>Chat {index + 1}: {chat?.title}</span>
                          <Badge variant={rubric.passed ? "default" : "destructive"}>
                            {rubric.passed ? "Passed" : "Failed"}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="font-medium">Score</div>
                            <div>{rubric.score}/20</div>
                          </div>
                          <div>
                            <div className="font-medium">Time Taken</div>
                            <div>{Math.round(rubric.timeTaken / 60)} min</div>
                          </div>
                          <div>
                            <div className="font-medium">Adaptability</div>
                            <div>{rubric.adaptability}/5</div>
                          </div>
                          <div>
                            <div className="font-medium">Listening</div>
                            <div>{rubric.listening}/5</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Single Chat Detailed Results */}
          {isSingleChatAttempt && currentRubric && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{currentRubric.score}/20</div>
                    <div className="text-sm text-muted-foreground">Overall Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{Math.round(currentRubric.timeTaken / 60)}</div>
                    <div className="text-sm text-muted-foreground">Minutes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{currentRubric.adaptability}/5</div>
                    <div className="text-sm text-muted-foreground">Adaptability</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{currentRubric.listening}/5</div>
                    <div className="text-sm text-muted-foreground">Listening</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium">Adaptability Feedback</h4>
                    <p className="text-sm text-muted-foreground">{currentRubric.adaptabilityFeedback}</p>
                  </div>
                  <div>
                    <h4 className="font-medium">Listening Feedback</h4>
                    <p className="text-sm text-muted-foreground">{currentRubric.listeningFeedback}</p>
                  </div>
                  <div>
                    <h4 className="font-medium">Objectives Feedback</h4>
                    <p className="text-sm text-muted-foreground">{currentRubric.objectivesFeedback}</p>
                  </div>
                  <div>
                    <h4 className="font-medium">Time Management Feedback</h4>
                    <p className="text-sm text-muted-foreground">{currentRubric.timeManagementFeedback}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 gap-4">
      {/* Main Chat Area */}
      <div className="flex-1">
        <Card className="h-full flex flex-col">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="flex items-center justify-between">
              <div>
                <span>{scenario?.description || currentChat?.title}</span>
                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  {isSingleChatAttempt ? (
                    formatChatTemplateInfo(chatTemplate)
                  ) : (
                    <>
                      <Users className="h-4 w-4" />
                      <span data-testid="chat-counter">Chat {currentChatIndex + 1} of {template?.chatTemplateIds?.length || 0}</span>
                      {chatTemplate && (
                        <>
                          <span>•</span>
                          {formatChatTemplateInfo(chatTemplate)}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              {currentChat?.completed && (
                <Badge variant="default">Completed</Badge>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea
              className="flex-1 px-4"
              ref={scrollAreaRef}
              onScrollCapture={handleScroll}
            >
              <div className="space-y-4 py-4">
                {messagesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Start the conversation by sending a message below.
                    </p>
                    {/* Initial message suggestions */}
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        onClick={() => handleInitialMessageClick("Hi, how are you?")}
                        className="block mx-auto"
                      >
                        "Hi, how are you?"
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleInitialMessageClick("Hi, what can I help you with?")}
                        className="block mx-auto"
                      >
                        "Hi, what can I help you with?"
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleInitialMessageClick(`Hi, are you here for ${classData?.classCode}?`)}
                        className="block mx-auto"
                      >
                        "Hi, are you here for {classData?.classCode}?"
                      </Button>
                    </div>
                  </div>
                ) : (
                  messages.map((message: TemplateMessage) => (
                    <div key={message.id} className="space-y-4">
                      {/* User Message */}
                      {message.query && (
                        <div className="flex justify-end">
                          <div className="max-w-[80%] bg-primary text-primary-foreground rounded-lg p-3">
                            <Markdown>{message.query}</Markdown>
                          </div>
                        </div>
                      )}

                      {/* Assistant Response */}
                      {message.response !== undefined && message.query !== "" && (
                        <div className="flex justify-start">
                          <div className="flex gap-3 max-w-[80%]">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback>AI</AvatarFallback>
                            </Avatar>
                            <div className="bg-muted rounded-lg p-3 flex-1">
                              {message.response === "" ? (
                                <div className="flex items-center">
                                  <span className="text-gray-500 mr-2">Analyzing</span>
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
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Scroll to bottom button */}
            {showScrollButton && (
              <div className="absolute bottom-20 right-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scrollToBottom}
                  className="rounded-full h-10 w-10 p-0"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex-shrink-0 p-4 border-t">
            {currentChat?.completed ? (
              <div className="w-full text-center py-4">
                <p className="text-muted-foreground mb-2">This chat has been completed.</p>
                {currentRubric && (
                  <div className="text-sm">
                    <Badge variant={currentRubric.passed ? "default" : "destructive"}>
                      Score: {currentRubric.score}/20 - {currentRubric.passed ? "Passed" : "Failed"}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full space-y-2">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={!isActive}
                    className="flex-1"
                    data-testid="message-input"
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || !isActive}
                    data-testid="send-button"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleEndChat}
                    disabled={endChatLoading || !isActive}
                    className="whitespace-nowrap"
                  >
                    {endChatLoading ? "Ending..." : isSingleChatAttempt ? "End Session" : "End Chat"}
                  </Button>
                </form>
                {!isActive && (
                  <p className="text-sm text-muted-foreground text-center">
                    Time's up! The session has ended.
                  </p>
                )}
              </div>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Right Panel - Documents */}
      {classDocuments.length > 0 && (
        <div className="w-80 flex-shrink-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Documents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-12rem)]">
                <div className="p-4 space-y-4">
                  {classDocuments.map((doc: any) => (
                    <DocumentViewer key={doc.id} document={doc} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
