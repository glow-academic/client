// "use client";

// import { useState, useEffect, useRef } from "react";
// import { useQuery, useQueryClient } from "@tanstack/react-query";
// import { toast } from "sonner";

// // UI Components
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Badge } from "@/components/ui/badge";
// import { Separator } from "@/components/ui/separator";

// // Icons
// import { Send, User, Bot, CheckCircle, Clock } from "lucide-react";

// interface Message {
//   id: string;
//   content: string;
//   isUser: boolean;
//   timestamp: string;
// }

// interface ChatInterfaceProps {
//   studentType: 'aggressive' | 'happy' | 'confused';
//   studentId: string;
//   crowdedness: number;
//   intensity: number;
//   documentId?: string;
//   onComplete: () => void;
//   isCompleted: boolean;
// }

// export default function ChatInterface({
//   studentType,
//   studentId,
//   crowdedness,
//   intensity,
//   documentId,
//   onComplete,
//   isCompleted
// }: ChatInterfaceProps) {
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [currentMessage, setCurrentMessage] = useState("");
//   const [isLoading, setIsLoading] = useState(false);
//   const [chatStarted, setChatStarted] = useState(false);
//   const messagesEndRef = useRef<HTMLDivElement>(null);
//   const queryClient = useQueryClient();

//   // Auto-scroll to bottom when new messages arrive
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   // Initialize chat when component mounts
//   useEffect(() => {
//     if (!chatStarted && !isCompleted) {
//       initializeChat();
//     }
//   }, [chatStarted, isCompleted]);

//   const initializeChat = async () => {
//     try {
//       setIsLoading(true);
      
//       // Start a new chat session for this student
//       const response = await fetch(
//         `${process.env.NEXT_PUBLIC_API_URL}/quiz/chat/start`,
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             studentId,
//             studentType,
//             crowdedness,
//             intensity,
//             documentId,
//           }),
//           credentials: "include",
//         }
//       );

//       if (!response.ok) {
//         throw new Error("Failed to start chat");
//       }

//       const data = await response.json();
      
//       // Add initial student message
//       const initialMessage: Message = {
//         id: `initial-${Date.now()}`,
//         content: data.initialMessage || getInitialMessage(studentType),
//         isUser: false,
//         timestamp: new Date().toISOString(),
//       };

//       setMessages([initialMessage]);
//       setChatStarted(true);
//     } catch (error) {
//       console.error("Error starting chat:", error);
//       toast.error("Failed to start conversation with student");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const getInitialMessage = (type: string): string => {
//     const messages = {
//       aggressive: "Look, I've ben waiting here for 10 minutes and I still don't understand this concept. Can you actually help me or not?",
//       happy: "Hi! I'm so excited to learn about this topic! Could you help me understand it better? I'd really appreciate it!",
//       confused: "Um, excuse me? I'm really struggling with this material and I'm not sure where to start. Could you maybe explain it to me?"
//     };
//     return messages[type as keyof typeof messages] || "Hello, I need help with this topic.";
//   };

//   const sendMessage = async () => {
//     if (!currentMessage.trim() || isLoading || isCompleted) return;

//     const userMessage: Message = {
//       id: `user-${Date.now()}`,
//       content: currentMessage,
//       isUser: true,
//       timestamp: new Date().toISOString(),
//     };

//     setMessages(prev => [...prev, userMessage]);
//     setCurrentMessage("");
//     setIsLoading(true);

//     try {
//       const response = await fetch(
//         `${process.env.NEXT_PUBLIC_API_URL}/quiz/chat/message`,
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             studentId,
//             message: currentMessage,
//             chatHistory: messages,
//           }),
//           credentials: "include",
//         }
//       );

//       if (!response.ok) {
//         throw new Error("Failed to send message");
//       }

//       const data = await response.json();
      
//       const botMessage: Message = {
//         id: `bot-${Date.now()}`,
//         content: data.response,
//         isUser: false,
//         timestamp: new Date().toISOString(),
//       };

//       setMessages(prev => [...prev, botMessage]);

//       // Check if conversation should end
//       if (data.shouldComplete || messages.length >= 10) {
//         setTimeout(() => {
//           onComplete();
//           toast.success("Conversation completed successfully!");
//         }, 1000);
//       }

//     } catch (error) {
//       console.error("Error sending message:", error);
//       toast.error("Failed to send message");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleKeyPress = (e: React.KeyboardEvent) => {
//     if (e.key === "Enter" && !e.shiftKey) {
//       e.preventDefault();
//       sendMessage();
//     }
//   };

//   if (isCompleted) {
//     return (
//       <div className="h-full flex items-center justify-center">
//         <div className="text-center">
//           <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
//           <h3 className="text-lg font-semibold mb-2">Conversation Completed</h3>
//           <p className="text-muted-foreground">
//             You have successfully helped this student!
//           </p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="h-full flex flex-col">
//       {/* Messages Area */}
//       <div className="flex-1 min-h-0">
//         <ScrollArea className="h-full p-4">
//           <div className="space-y-4">
//             {messages.map((message) => (
//               <div
//                 key={message.id}
//                 className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
//               >
//                 <div
//                   className={`max-w-[80%] rounded-lg p-3 ${
//                     message.isUser
//                       ? "bg-primary text-primary-foreground"
//                       : "bg-muted"
//                   }`}
//                 >
//                   <div className="flex items-start gap-2">
//                     {message.isUser ? (
//                       <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
//                     ) : (
//                       <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
//                     )}
//                     <div className="flex-1">
//                       <p className="text-sm">{message.content}</p>
//                       <span className="text-xs opacity-70 mt-1 block">
//                         {new Date(message.timestamp).toLocaleTimeString()}
//                       </span>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             ))}
            
//             {isLoading && (
//               <div className="flex justify-start">
//                 <div className="bg-muted rounded-lg p-3">
//                   <div className="flex items-center gap-2">
//                     <Bot className="h-4 w-4" />
//                     <div className="flex space-x-1">
//                       <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
//                       <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
//                       <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             )}
            
//             <div ref={messagesEndRef} />
//           </div>
//         </ScrollArea>
//       </div>

//       {/* Input Area */}
//       <div className="border-t p-4">
//         <div className="flex gap-2">
//           <Input
//             value={currentMessage}
//             onChange={(e) => setCurrentMessage(e.target.value)}
//             onKeyPress={handleKeyPress}
//             placeholder="Type your response..."
//             disabled={isLoading || !chatStarted}
//             className="flex-1"
//           />
//           <Button
//             onClick={sendMessage}
//             disabled={!currentMessage.trim() || isLoading || !chatStarted}
//             size="icon"
//           >
//             <Send className="h-4 w-4" />
//           </Button>
//         </div>
//         <div className="mt-2 text-xs text-muted-foreground">
//           Press Enter to send • {messages.length}/10 messages
//         </div>
//       </div>
//     </div>
//   );
// }
