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
 ArrowLeft, 
 Clock,
 Users,
 CheckCircle
} from "lucide-react";

import DocumentViewer from "@/components/DocumentViewer";
import Markdown from "@/components/Markdown";
import { getAttempt } from "@/utils/queries/get-attempt";
import { getAttemptChats } from "@/utils/queries/get-attempt-chats";
import { getMessages } from "@/utils/queries/get-messages";
import { getRubric } from "@/utils/queries/get-rubric";
import { getDocuments } from "@/utils/queries/get-documents";
import { getClasses } from "@/utils/queries/get-classes";
import { getTemplates } from "@/utils/queries/get-templates";
import {
 SidebarProvider,
 SidebarInset,
 SidebarTrigger,
} from "@/components/ui/sidebar";
import { UnifiedSidebar } from "@/components/unified-sidebar";
import { Separator } from "@/components/ui/separator";

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
 const [activeSection, setActiveSection] = useState("templates");
 
 // Chat state for current chat
 const [newMessage, setNewMessage] = useState("");
 const [isFirstMessage, setIsFirstMessage] = useState(true);
 const [showScrollButton, setShowScrollButton] = useState(false);
 const [endChatLoading, setEndChatLoading] = useState(false);
 const [showResults, setShowResults] = useState(false);
 
 const messagesEndRef = useRef<HTMLDivElement | null>(null);
 const scrollAreaRef = useRef<HTMLDivElement>(null);

 // Fetch attempt data
 const { data: attemptData, isLoading: attemptLoading, error: attemptError } = useQuery({
   queryKey: ["attempt", attemptId],
   queryFn: () => getAttempt(attemptId),
   enabled: !!attemptId,
 });

 // Get the first attempt (since getAttempt returns an array)
 const attempt = attemptData;

 // Fetch template data based on attempt's templateId
 const { data: templatesData, isLoading: templateLoading } = useQuery({
   queryKey: ["templates"],
   queryFn: () => getTemplates(),
   enabled: !!attempt?.templateId,
 });

 // Get the template for this attempt
 const templateData = templatesData?.find((t: any) => t.id === attempt?.templateId);

 // Fetch chats linked to this attempt
 const { data: attemptChats = [], isLoading: chatsLoading } = useQuery({
   queryKey: ["attempt-chats", attemptId],
   queryFn: () => getAttemptChats([attemptId]),
   enabled: !!attemptId,
 });

 // Fetch messages for current chat
 const currentChat = attemptChats[currentChatIndex];
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
 const completedChatIds = attemptChats.filter((chat: any) => chat.completed).map((chat: any) => chat.id);
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

 // Fetch classes to get class info
 const { data: classes } = useQuery({
   queryKey: ["classes"],
   queryFn: () => getClasses(),
 });

 // Filter documents for the current attempt's class
 const classDocuments = useMemo(() => {
   if (!attempt?.classId || !documents) return [];
   return documents.filter((doc: any) => doc.classId === attempt.classId);
 }, [documents, attempt?.classId]);

 // Determine if this is a single chat attempt (acts like individual chat) or multiple chats
 const isSingleChatAttempt = attemptChats.length === 1;

 // Initialize session timer
 useEffect(() => {
   if (templateData && !sessionStartTime) {
     setSessionStartTime(new Date());
     setTimeRemaining(templateData.timeLimit * 60); // Convert to seconds
   }
 }, [templateData, sessionStartTime]);

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

 // Check if current chat is completed and move to next or show results
 useEffect(() => {
   if (currentChat?.completed && !showResults) {
     if (!isSingleChatAttempt && currentChatIndex < attemptChats.length - 1) {
       // Move to next chat after a short delay (only for multi-chat attempts)
       const timer = setTimeout(() => {
         setCurrentChatIndex(prev => prev + 1);
         toast.success(`Moving to chat ${currentChatIndex + 2} of ${attemptChats.length}`);
       }, 2000);
       return () => clearTimeout(timer);
     } else {
       // All chats completed or single chat completed, show results
       setShowResults(true);
       setIsActive(false);
     }
   }
 }, [currentChat?.completed, currentChatIndex, attemptChats.length, showResults, isSingleChatAttempt]);

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

 const handleSendMessage = async (
   e: React.FormEvent<HTMLFormElement> | null,
   initialMessage?: string,
 ) => {
   e?.preventDefault();
   
   const messageToSend = initialMessage || newMessage.trim();
   if (!messageToSend || !currentChat) return;

   setNewMessage("");
   setIsFirstMessage(false);

   try {
     const response = await fetch("/api/chat", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         chatId: currentChat.id,
         query: messageToSend,
       }),
     });

     if (!response.ok) {
       throw new Error("Failed to send message");
     }

     const result = await response.json();
     
     if (result.success) {
       // Invalidate and refetch messages
       queryClient.invalidateQueries({ queryKey: ["messages", currentChat.id] });
       
       // Invalidate queries to refresh chat status
       queryClient.invalidateQueries({ queryKey: ["attempt-chats", attemptId] });
       queryClient.invalidateQueries({ queryKey: ["rubric", currentChat.id] });
       
       toast.success("Message sent successfully");
     } else {
       throw new Error(result.error || "Failed to send message");
     }
   } catch (error) {
     console.error("Error sending message:", error);
     toast.error(error instanceof Error ? error.message : "Failed to send message");
   }
 };

 const handleEndChat = async () => {
   if (!currentChat) return;
   
   setEndChatLoading(true);
   
   try {
     const response = await fetch("/api/chat/end", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ chatId: currentChat.id }),
     });

     if (!response.ok) {
       throw new Error("Failed to end chat");
     }

     const result = await response.json();
     
     if (result.success) {
       queryClient.invalidateQueries({ queryKey: ["attempt-chats", attemptId] });
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

 const handleBack = () => {
   router.push("/home");
 };

 if (attemptLoading || templateLoading) {
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
         <div className="flex flex-1 items-center justify-center p-4">
           <div className="text-center space-y-4">
             <Skeleton className="h-8 w-64 mx-auto" />
             <Skeleton className="h-4 w-48 mx-auto" />
           </div>
         </div>
       </SidebarInset>
     </SidebarProvider>
   );
 }

 if (attemptError || !attempt || attemptChats.length === 0) {
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
             <h1 className="text-xl font-semibold">Attempt Not Found</h1>
           </div>
         </header>
         <div className="flex flex-1 items-center justify-center p-4">
           <Card>
             <CardContent className="p-8 text-center">
               <h2 className="text-xl font-semibold mb-2">Attempt Not Found</h2>
               <p className="text-muted-foreground mb-4">
                 The attempt you're looking for doesn't exist or has no chats configured.
               </p>
               <Button onClick={() => router.push("/home")}>Return Home</Button>
             </CardContent>
           </Card>
         </div>
       </SidebarInset>
     </SidebarProvider>
   );
 }

 // Show results screen
 if (showResults) {
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
             <div className="flex items-center gap-2">
               <Button variant="ghost" size="sm" onClick={handleBack}>
                 <ArrowLeft className="h-4 w-4" />
               </Button>
               <h1 className="text-xl font-semibold">{templateData?.title || 'Attempt Results'}</h1>
             </div>
             <div className="flex items-center gap-2">
               <div className="text-sm text-muted-foreground flex items-center gap-2">
                 <CheckCircle className="h-4 w-4" />
                 <span>{isSingleChatAttempt ? "Session" : "Attempt"} Completed</span>
               </div>
             </div>
           </div>
         </header>

         <div className="flex flex-1 flex-col gap-4 p-4">
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
                   const chat = attemptChats.find((c: any) => c.id === rubric.chatId);
                   return (
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

             <div className="flex justify-center">
               <Button onClick={handleBack} size="lg">
                 Return to Home
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
       <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
         <SidebarTrigger className="-ml-1" />
         <Separator orientation="vertical" className="mr-2 h-4" />
         <div className="flex flex-1 items-center justify-between">
           <div className="flex items-center gap-2">
             <Button variant="ghost" size="sm" onClick={handleBack}>
               <ArrowLeft className="h-4 w-4" />
             </Button>
             <div>
               <h1 className="text-xl font-semibold">{templateData?.title || 'Attempt'}</h1>
               <div className="text-sm text-muted-foreground flex items-center gap-2">
                 {isSingleChatAttempt ? (
                   <>
                     <Users className="h-4 w-4" />
                     <span>Interactive Session</span>
                   </>
                 ) : (
                   <>
                     <Users className="h-4 w-4" />
                     <span data-testid="chat-counter">Chat {currentChatIndex + 1} of {attemptChats.length}</span>
                   </>
                 )}
               </div>
             </div>
           </div>
           <div className="flex items-center gap-2">
             <div className="text-sm text-muted-foreground flex items-center gap-2">
               <Clock className="h-4 w-4" />
               <span data-testid="timer">{formatTime(timeRemaining)}</span>
             </div>
           </div>
         </div>
       </header>

       <div className="flex flex-1 gap-4 p-4">
         {/* Left Panel - Documents */}
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

         {/* Main Chat Area */}
         <div className="flex-1">
           <Card className="h-full flex flex-col">
             <CardHeader className="flex-shrink-0">
               <CardTitle className="flex items-center justify-between">
                 <span>{currentChat?.title}</span>
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
                           onClick={() => handleInitialMessageClick("Hello, I need help with this problem.")}
                           className="block mx-auto"
                         >
                           "Hello, I need help with this problem."
                         </Button>
                         <Button 
                           variant="outline" 
                           onClick={() => handleInitialMessageClick("I'm having trouble understanding this concept.")}
                           className="block mx-auto"
                         >
                           "I'm having trouble understanding this concept."
                         </Button>
                         <Button 
                           variant="outline" 
                           onClick={() => handleInitialMessageClick("Can you help me debug this code?")}
                           className="block mx-auto"
                         >
                           "Can you help me debug this code?"
                         </Button>
                       </div>
                     </div>
                   ) : (
                     messages.map((message: TemplateMessage) => (
                       <div key={message.id} className="space-y-4">
                         {/* User Message */}
                         <div className="flex justify-end">
                           <div className="max-w-[80%] bg-primary text-primary-foreground rounded-lg p-3">
                             <Markdown>{message.query}</Markdown>
                           </div>
                         </div>
                         
                         {/* Assistant Response */}
                         <div className="flex justify-start">
                           <div className="flex gap-3 max-w-[80%]">
                             <Avatar className="h-8 w-8 flex-shrink-0">
                               <AvatarFallback>TA</AvatarFallback>
                             </Avatar>
                             <div className="bg-muted rounded-lg p-3 flex-1">
                               {message.completed ? (
                                 <Markdown>{message.response}</Markdown>
                               ) : (
                                 <LoadingDots />
                               )}
                             </div>
                           </div>
                         </div>
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
       </div>
     </SidebarInset>
   </SidebarProvider>
 );
}
