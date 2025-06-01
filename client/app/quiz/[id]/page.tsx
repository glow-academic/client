/**
 * app/quiz/[id]/page.tsx
 * Quiz interface for GTAs to complete assigned quizzes
 */
"use client";

import React from "react";
import { useState, useEffect, useRef } from "react";
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

// Icons
import { 
  Timer, 
  Send, 
  ChevronDown, 
  ArrowLeft, 
  Clock,
  Zap,
  SmilePlus,
  HelpCircle
} from "lucide-react";

import DocumentViewer from "@/components/DocumentViewer";
import Markdown from "@/components/Markdown";
import { getQuiz } from "@/utils/queries/get-quiz";

interface Student {
  id: string;
  type: 'aggressive' | 'happy' | 'confused';
  crowdedness: number;
  intensity: number;
  index: number;
}

interface QuizMessage {
  id: string;
  query: string;
  response: string;
  createdAt: string;
  completed: boolean;
}

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const quizId = params.id as string;

  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Chat state for current student
  const [messages, setMessages] = useState<QuizMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [endChatLoading, setEndChatLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch quiz data
  const { data: quizData, isLoading, error } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => getQuiz(quizId),
    enabled: !!quizId,
  });

  // Create students array from quiz data
  useEffect(() => {
    if (quizData) {
      const studentList: Student[] = [];
      let index = 0;

      // Add aggressive students
      quizData.studentInteractions.aggressive?.forEach((config) => {
        studentList.push({
          id: `aggressive-${index}`,
          type: 'aggressive',
          crowdedness: config.crowdedness,
          intensity: config.intensity,
          index: index++
        });
      });

      // Add happy students
      quizData.studentInteractions.happy?.forEach((config) => {
        studentList.push({
          id: `happy-${index}`,
          type: 'happy',
          crowdedness: config.crowdedness,
          intensity: config.intensity,
          index: index++
        });
      });

      // Add confused students
      quizData.studentInteractions.confused?.forEach((config) => {
        studentList.push({
          id: `confused-${index}`,
          type: 'confused',
          crowdedness: config.crowdedness,
          intensity: config.intensity,
          index: index++
        });
      });

      setStudents(studentList);
      setTimeRemaining(quizData.timeLimit * 60); // Convert to seconds
    }
  }, [quizData]);

  // Timer countdown
  useEffect(() => {
    if (!isActive || timeRemaining <= 0) return;

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
  }, [isActive, timeRemaining]);

  // Reset chat state when moving to next student
  useEffect(() => {
    setMessages([]);
    setNewMessage("");
    setIsFirstMessage(true);
    setShowScrollButton(false);
  }, [currentStudentIndex]);

  const handleQuizComplete = async () => {
    toast.success("Quiz completed!");
    router.push("/home");
  };

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get student type config
  const getStudentTypeConfig = (type: string) => {
    switch (type) {
      case 'aggressive':
        return {
          icon: <Zap className="h-4 w-4 text-red-500" />,
          color: "text-red-500",
          label: "Aggressive Student",
          systemPrompt: "You are an aggressive student who is frustrated and impatient. You push back on explanations and challenge the GTA's teaching methods."
        };
      case 'happy':
        return {
          icon: <SmilePlus className="h-4 w-4 text-green-500" />,
          color: "text-green-500", 
          label: "Happy Student",
          systemPrompt: "You are a happy, enthusiastic student who is eager to learn and responds positively to explanations."
        };
      case 'confused':
        return {
          icon: <HelpCircle className="h-4 w-4 text-yellow-500" />,
          color: "text-yellow-500",
          label: "Confused Student", 
          systemPrompt: "You are a confused student who asks many clarifying questions and needs detailed explanations to understand."
        };
      default:
        return {
          icon: <HelpCircle className="h-4 w-4" />,
          color: "text-gray-500",
          label: "Student",
          systemPrompt: "You are a student seeking help."
        };
    }
  };

  const handleSendMessage = async (
    e: React.FormEvent<HTMLFormElement> | null,
    initialMessage?: string,
  ) => {
    if (e) e.preventDefault();

    const messageToSend = initialMessage || newMessage;
    if (!messageToSend.trim()) return;

    setIsFirstMessage(false);

    const currentStudent = students[currentStudentIndex];
    if (!currentStudent) return;

    /* ---------------- optimistic user bubble ---------------- */
    const userMsg: QuizMessage = {
      id: `temp-${Date.now()}`,
      query: messageToSend,
      response: "",
      createdAt: new Date().toISOString(),
      completed: false,
    };

    const aiMsg: QuizMessage = {
      id: `temp-ai-${Date.now()}`,
      query: "",
      response: "",
      createdAt: new Date().toISOString(),
      completed: false,
    };

    setMessages(prev => [...prev, userMsg, aiMsg]);
    setNewMessage("");

    let accumulated = "";
    const ctrl = new AbortController();

    try {
      const formData = new FormData();
      formData.append("profile", currentStudent.type);
      formData.append("message", userMsg.query);
      formData.append("quiz_mode", "true");
      formData.append("crowdedness", currentStudent.crowdedness.toString());
      formData.append("intensity", currentStudent.intensity.toString());

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/quiz/message`,
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
            setMessages(prev =>
              prev.map((m) =>
                m.id === aiMsg.id ? { ...m, response: accumulated } : m,
              ),
            );
          }

          if (data.done || data.error) {
            break;
          }
        }
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      setMessages(prev =>
        prev.map((m) =>
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
    setEndChatLoading(true);
    
    // Move to next student or complete quiz
    if (currentStudentIndex < students.length - 1) {
      setCurrentStudentIndex(prev => prev + 1);
      toast.success(`Moving to student ${currentStudentIndex + 2} of ${students.length}`);
    } else {
      handleQuizComplete();
    }
    
    setEndChatLoading(false);
  };

  // Handle initial message button clicks
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

  // Loading skeleton
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-primary text-primary-foreground p-4">
          <div className="container mx-auto">
            <Skeleton className="h-6 w-48" />
          </div>
        </header>
        <div className="container mx-auto flex-1 p-4">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (error || !quizData || students.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Quiz Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The quiz you're looking for doesn't exist or has no students configured.
            </p>
            <Button onClick={() => router.push("/home")}>Return Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStudent = students[currentStudentIndex];
  const studentConfig = getStudentTypeConfig(currentStudent.type);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="p-1 h-auto text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{quizData.title}</h1>
              <div className="text-sm opacity-80 flex items-center gap-2">
                {studentConfig.icon}
                <span>{studentConfig.label} ({currentStudentIndex + 1}/{students.length})</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-primary-foreground/10 px-3 py-1 rounded-full">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">{formatTime(timeRemaining)}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto flex-1 p-4 flex flex-col min-h-0">
        <Card className="mb-4 shadow-sm border bg-card">
          <CardContent className="px-4">
            <p className="text-sm text-card-foreground">
              You are interacting with a {currentStudent.type} student (crowdedness: {currentStudent.crowdedness}/5, intensity: {currentStudent.intensity}/5). 
              Help them with their questions and provide appropriate guidance.
            </p>
          </CardContent>
        </Card>

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
                    {messages.map((message) => (
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
                        {message.response !== undefined && message.query !== "" && (
                          <div className="flex items-start gap-3 text-sm">
                            <Avatar>
                              <AvatarFallback>
                                {currentStudent.type === 'aggressive' ? 'A' : 
                                 currentStudent.type === 'happy' ? 'H' : 'C'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="grid gap-1">
                              <p className="font-medium">Student</p>
                              <div className="rounded-lg bg-primary/10 p-3">
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
                    ))}
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
                {isFirstMessage && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full max-w-4xl p-6 flex flex-col gap-4">
                      <p className="text-sm text-center text-muted-foreground">
                        Choose an opening message for this {currentStudent.type} student:
                      </p>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <Card
                          className="flex-1 border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                          onClick={() => handleInitialMessageClick("Hi, how are you?")}
                        >
                          <CardContent className="p-5 text-center flex items-center justify-center h-full">
                            <p className="text-base font-medium">Hi, how are you?</p>
                          </CardContent>
                        </Card>
                        <Card
                          className="flex-1 border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                          onClick={() => handleInitialMessageClick("Hi, what can I help you with?")}
                        >
                          <CardContent className="p-5 text-center flex items-center justify-center h-full">
                            <p className="text-base font-medium">Hi, what can I help you with?</p>
                          </CardContent>
                        </Card>
                        <Card
                          className="flex-1 border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                          onClick={() => handleInitialMessageClick(`Hi, are you here for ${quizData.classCode}?`)}
                        >
                          <CardContent className="p-5 text-center flex items-center justify-center h-full">
                            <p className="text-base font-medium">Hi, are you here for {quizData.classCode}?</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>

              {!isFirstMessage && (
                <CardFooter className="p-3 border-t">
                  <form onSubmit={handleSendMessage} className="flex w-full gap-3">
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
                      onClick={handleEndChat}
                      variant="destructive"
                      disabled={endChatLoading}
                      className="whitespace-nowrap"
                    >
                      {endChatLoading ? "Ending..." : 
                       currentStudentIndex < students.length - 1 ? "Next Student" : "Complete Quiz"}
                    </Button>
                  </form>
                </CardFooter>
              )}
            </Card>
          </div>

          {/* Document Viewer */}
          {quizData.document && (
            <div className="hidden lg:block w-1/3 shrink-0 min-h-0">
              <DocumentViewer document={quizData.document} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
