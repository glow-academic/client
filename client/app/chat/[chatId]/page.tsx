/** 
 * app/[chatId]/page.tsx
 * This page is to show each of the individual chats.
 * @AshokSaravanan222 & @siladiea
 * 2025-05-13
 */
"use client";

import { backgroundColors } from '@/utils/profiles';
import { borderColors } from '@/utils/profiles';
import { endChat } from '@/utils/mutations/end-chat';
import { getChat } from '@/utils/queries/get-chat';
import { getMessages } from '@/utils/queries/get-messages';
import { getRubric } from '@/utils/queries/get-rubric';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import React, { useState, useRef, use } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export default function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
    const { chatId } = use(params);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [loading, setLoading] = useState(false);
    const queryClient = useQueryClient();

    const router = useRouter();

    const { data: chat } = useQuery({
        queryKey: ["chat", chatId],
        queryFn: () => getChat(chatId),
    });

    const { data: rubric } = useQuery({
        queryKey: ["rubric", chatId],
        queryFn: () => getRubric(chatId),
    });

    // Fetch messages
    const { data: messages = [] } = useQuery({
        queryKey: ["messages", chatId],
        queryFn: () => getMessages(chatId),
    });

    const renderScoreIcon = (score: number) => {
        if (score >= 3) {
            return <span className="text-green-500 text-xl">✓</span>;
        } else {
            return <span className="text-red-500 text-xl">✗</span>;
        }
    };

    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
        try {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            formData.append("message", newMessage);
            formData.append("chat_id", chatId);
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/message`, {
                method: "POST",
                body: formData,
            });
            const data = await response.json();
            console.log(data);
        } catch (error) {
            console.error(error);
        } finally {
            queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
            queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
            setNewMessage("");
        }
    };

    const handleEndSession = async () => {
        setLoading(true);
        try {
            // TODO: will need to call the API in practice, making the rubric pass/fail
            const { success, error } = await endChat(chatId);
            if (success) {
                router.push('/home');
            } else {
                throw new Error(error);
            }
        } catch (error) {
            console.error(error);
        } finally {
            queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="bg-primary text-primary-foreground p-4">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push('/home')}
                            className="p-1 rounded-full bg-secondary/20 hover:bg-secondary/40"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-semibold">Conversation Practice</h1>
                    </div>

                    {chat?.completed && (
                        <div className={`px-4 py-1 rounded-full ${rubric?.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {rubric?.passed ? 'PASSED' : 'FAILED'}
                        </div>
                    )}
                </div>
            </header>

            <div className="container mx-auto flex-1 p-4 flex flex-col">
                <div className={`mb-6 p-4 rounded-lg ${backgroundColors[chat?.profile || 'aggressive']} ${borderColors[chat?.profile || 'aggressive']} border`}>
                    <p className="text-base">{chat?.scenarioDescription}</p>
                </div>

                <div className="flex flex-1 gap-4">
                    {/* Chat area - takes full width or 2/3 width depending on rubric display */}
                    <div className={`${chat?.completed ? 'w-2/3' : 'w-full'} flex flex-col`}>
                        <Card className="flex-1 mb-4">
                            <CardContent className="p-0 h-full">
                                <ScrollArea className="h-[calc(100vh-280px)]">
                                    <div className="space-y-4 p-4">
                                        {messages.map((message) => (
                                            <div key={message.id} className="space-y-4">
                                                {message.query && (
                                                    <div className="flex items-start gap-3 text-sm justify-end">
                                                        <div className="grid gap-1 text-right">
                                                            <p className="font-medium">You</p>
                                                            <div className="rounded-lg bg-muted p-3">
                                                                {message.query}
                                                            </div>
                                                        </div>
                                                        <Avatar>
                                                            <AvatarFallback>U</AvatarFallback>
                                                            <AvatarImage src="/user-avatar.png" />
                                                        </Avatar>
                                                    </div>
                                                )}
                                                {message.response && (
                                                    <div className="flex items-start gap-3 text-sm">
                                                        <Avatar>
                                                            <AvatarFallback>AI</AvatarFallback>
                                                            <AvatarImage src="/ai-avatar.png" />
                                                        </Avatar>
                                                        <div className="grid gap-1">
                                                            <p className="font-medium">AI Assistant</p>
                                                            <div className="rounded-lg bg-primary/10 p-3">
                                                                {message.response}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>
                                </ScrollArea>
                            </CardContent>

                            {/* Only show input area if rubric is not shown */}
                            {!chat?.completed && (
                                <CardFooter className="p-3">
                                    <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                                        <Input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder="Type your response..."
                                            className="flex-1"
                                        />
                                        <Button type="submit" disabled={!newMessage.trim()} size="icon">
                                            <Send className="h-4 w-4" />
                                            <span className="sr-only">Send</span>
                                        </Button>
                                        <Button
                                            onClick={handleEndSession}
                                            variant="destructive"
                                            disabled={loading}
                                        >
                                            {loading ? 'Ending...' : 'End Session'}
                                        </Button>
                                    </form>
                                </CardFooter>
                            )}
                        </Card>
                    </div>

                    {/* Rubric area - shown only for pass/fail students */}
                    {chat?.completed && (
                        <Card className="w-1/3">
                            <CardHeader>
                                <CardTitle className="text-center">Assessment Rubric</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="border-b pb-2">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Active Listening</span>
                                            <span className="flex items-center gap-1">
                                                {renderScoreIcon(rubric?.activeListening || 0)}
                                                <span className="ml-1">{rubric?.activeListening}/4</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="border-b pb-2">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Empathy</span>
                                            <span className="flex items-center gap-1">
                                                {renderScoreIcon(rubric?.empathy || 0)}
                                                <span className="ml-1">{rubric?.empathy}/4</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="border-b pb-2">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Problem Solving</span>
                                            <span className="flex items-center gap-1">
                                                {renderScoreIcon(rubric?.problemSolving || 0)}
                                                <span className="ml-1">{rubric?.problemSolving}/4</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="border-b pb-2">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Communication</span>
                                            <span className="flex items-center gap-1">
                                                {renderScoreIcon(rubric?.communication || 0)}
                                                <span className="ml-1">{rubric?.communication}/4</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="border-b pb-2">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Resource Utilization</span>
                                            <span className="flex items-center gap-1">
                                                {renderScoreIcon(rubric?.resourceUtilization || 0)}
                                                <span className="ml-1">{rubric?.resourceUtilization}/4</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="border-b pb-2">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Time Management</span>
                                            <span className="flex items-center gap-1">
                                                {renderScoreIcon(rubric?.timeManagement || 0)}
                                                <span className="ml-1">{rubric?.timeManagement}/4</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="border-b pb-2">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Adaptability</span>
                                            <span className="flex items-center gap-1">
                                                {renderScoreIcon(rubric?.adaptability || 0)}
                                                <span className="ml-1">{rubric?.adaptability}/4</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <div className={`p-3 rounded-lg text-center font-semibold ${rubric?.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        <div className="text-xl mb-1">{rubric?.passed ? 'PASSED' : 'FAILED'}</div>
                                        <div className="text-sm">
                                            Total Score: {rubric?.score}/28
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => router.push('/home')}
                                        className="mt-4 w-full"
                                    >
                                        Return to Dashboard
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
