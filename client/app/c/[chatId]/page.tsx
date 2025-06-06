/**
 * app/chat/[chatId]/page.tsx
 * This page shows individual chat results and history
 * For completed chats, it shows the rubric and performance metrics
 * For active chats, it shows the current state but redirects to attempt page for interaction
 * @AshokSaravanan222 & @siladiea
 * 2025-05-13
 */
"use client";

import { getChat } from "@/utils/queries/get-chat";
import { getMessages } from "@/utils/queries/get-messages";
import { getRubric } from "@/utils/queries/get-rubric";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React, { useState, useRef, use, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ExternalLink, Activity, Users } from "lucide-react";
import Markdown from "@/components/Markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { getAttempt } from "@/utils/queries/get-attempt";
import { getScenario } from "@/utils/queries/get-scenario";
import { getInteraction } from "@/utils/queries/get-interaction";
import { interactions as Interaction } from "@/drizzle/schema";

type WindowWithChatData = Window & typeof globalThis & {
  chatData: {
    elapsedTime: string;
    completed: boolean;
    passed: boolean;
  };
};

export default function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>("00:00");

  const router = useRouter();

  const { data: chat, isLoading: chatLoading } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => getChat(chatId),
  });

  const {data: attempt, isLoading: attemptLoading} = useQuery({
    queryKey: ["attempt", chat?.attemptId],
    queryFn: () => getAttempt(chat!.attemptId),
    enabled: !!chat
  })

  const { data: scenario, isLoading: scenarioLoading } = useQuery({
    queryKey: ["scenario", chat?.scenarioId],
    queryFn: () => getScenario(chat!.scenarioId),
    enabled: !!chat?.scenarioId,
  });

  const { data: interaction, isLoading: interactionLoading } = useQuery({
    queryKey: ["interaction", chat?.interactionId],
    queryFn: () => getInteraction(chat!.interactionId),
    enabled: !!chat?.interactionId,
  });

  const { data: rubric } = useQuery({
    queryKey: ["rubric", chatId],
    queryFn: () => getRubric(chatId),
    enabled: !!chat?.completed,
  });

  // Fetch messages for display only
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => getMessages(chatId),
  });

  // Timer logic based on chat creation time (for display only)
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

  // Expose chat data to layout
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as WindowWithChatData).chatData = {
        elapsedTime,
        completed: chat?.completed || false,
        passed: rubric?.passed || false
      };
    }
  }, [elapsedTime, chat?.completed, rubric?.passed]);

    // Helper function to format interaction attributes
  const formatInteractionInfo = (interaction: typeof Interaction.$inferSelect) => {
    const crowdednessText = interaction.crowdedness === 1 ? "Low crowdedness" : 
                           interaction.crowdedness === 2 ? "Moderate crowdedness" :
                           interaction.crowdedness === 3 ? "High crowdedness" :
                           interaction.crowdedness === 4 ? "Very high crowdedness" :
                           interaction.crowdedness === 5 ? "Extremely crowded" :
                           `Crowdedness: ${interaction.crowdedness}`;
    
    const intensityText = interaction.intensity === 1 ? "Low intensity" :
                         interaction.intensity === 2 ? "Moderate intensity" :
                         interaction.intensity === 3 ? "High intensity" :
                         interaction.intensity === 4 ? "Very high intensity" :
                         interaction.intensity === 5 ? "Extremely intense" :
                         `Intensity: ${interaction.intensity}`;
    
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

  const handleBack = () => {
    router.push("/dashboard/chats");
  };

  const handleGoToAttempt = () => {
    if (attempt?.id) {
      router.push(`/a/${attempt.id}`);
    }
  };

  if (chatLoading || attemptLoading || scenarioLoading || interactionLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Chat Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The chat you're looking for doesn't exist.
            </p>
            <Button onClick={handleBack}>Return Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* If chat is not completed, show redirect to attempt */}
      {!chat.completed && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">Chat In Progress</h3>
            <p className="text-muted-foreground mb-4">
              This chat is currently active. To continue the conversation, go to the attempt page.
            </p>
            <Button onClick={handleGoToAttempt} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Continue in Attempt
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rubric Results Section - Only show for completed chats */}
      {chat?.completed && rubric && (
        <Card className={`border-0 ${rubric.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {rubric.passed ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              Performance Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold">{rubric.score}/20</div>
                <div className="font-medium">Overall Score</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{rubric.listening}/5</div>
                <div className="font-medium">Listening</div>
                {rubric.listeningFeedback && (
                  <div className="text-xs mt-1 opacity-80">{rubric.listeningFeedback}</div>
                )}
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{rubric.objectives}/5</div>
                <div className="font-medium">Objectives</div>
                {rubric.objectivesFeedback && (
                  <div className="text-xs mt-1 opacity-80">{rubric.objectivesFeedback}</div>
                )}
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{rubric.timeManagement}/5</div>
                <div className="font-medium">Time Mgmt</div>
                {rubric.timeManagementFeedback && (
                  <div className="text-xs mt-1 opacity-80">{rubric.timeManagementFeedback}</div>
                )}
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{rubric.adaptability}/5</div>
                <div className="font-medium">Adaptability</div>
                {rubric.adaptabilityFeedback && (
                  <div className="text-xs mt-1 opacity-80">{rubric.adaptabilityFeedback}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat History */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <span>{scenario?.description || chat.title}</span>
              <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                {formatInteractionInfo(interaction!)}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-4 p-4">
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
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No messages in this chat yet.</p>
                </div>
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
                    {message.response && (
                      <div className="flex items-start gap-3 text-sm">
                        <Avatar>
                          <AvatarFallback>AI</AvatarFallback>
                        </Avatar>
                        <div className="grid gap-1">
                          <p className="font-medium">Student</p>
                          <div className="rounded-lg bg-primary/10 p-3">
                            <Markdown>{message.response}</Markdown>
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
        </CardContent>
      </Card>
    </div>
  );
}
