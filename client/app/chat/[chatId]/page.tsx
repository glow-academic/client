/** 
 * app/[chatId]/page.tsx
 * This page is to show each of the individual chats.
 * @AshokSaravanan222 & @siladiea
 * 2025-05-13
 */
"use client";

import { backgroundColors } from '@/utils/profiles';
import { borderColors } from '@/utils/profiles';
import { getChat } from '@/utils/queries/get-chat';
import { getMessages } from '@/utils/queries/get-messages';
import { getRubric } from '@/utils/queries/get-rubric';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import React, { useState, useRef, use, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import Markdown from '@/components/Markdown';
import DocumentViewer from '@/components/DocumentViewer';

export default function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
    const { chatId } = use(params);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [loading, setLoading] = useState(false);
    const [isFirstMessage, setIsFirstMessage] = useState(true);
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

    // Check if there are already messages to determine if it's the first interaction
    useEffect(() => {
        if (messages.length > 0) {
            setIsFirstMessage(false);
        }
    }, [messages]);

    const renderScoreIcon = (score: number) => {
        if (score >= 3) {
            return <span className="text-green-500 text-xl">✓</span>;
        } else {
            return <span className="text-red-500 text-xl">✗</span>;
        }
    };

    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement> | null, initialMessage?: string) => {
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

        queryClient.setQueryData(["messages", chatId], (old: (typeof messages)[0][] = []) => [
            ...old,
            userMsg,
            aiMsg,
        ]);

        setNewMessage("");                                    // clear input
        let accumulated = "";                                 // running buffer
        let streaming = true;                                 // gate for re-entry
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
                buffer = parts.pop()!;                    // keep partial chunk

                for (const part of parts) {
                    if (!part.startsWith("data:")) continue;

                    const data = JSON.parse(part.slice(5)); // strip "data: "

                    if (data.text) {
                        accumulated += data.text;

                        /* immutable cache update */
                        queryClient.setQueryData(["messages", chatId], (old: (typeof messages)[0][] = []) =>
                            old.map((m) =>
                                m.id === aiMsg.id ? { ...m, response: accumulated } : m,
                            ),
                        );
                    }

                    if (data.done || data.error) {
                        streaming = false;
                        await queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
                    }
                }
            }
        } catch (err) {
            console.error("sendMessage error:", err);
            queryClient.setQueryData(["messages", chatId], (old: (typeof messages)[0][] = []) =>
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
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("chat_id", chatId);
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/end`, {
                method: "POST",
                body: formData,
            });
            if (!response.ok) {
                throw new Error(response.statusText);
            }
        } catch (error) {
            console.error(error);
        } finally {
            queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
            queryClient.invalidateQueries({ queryKey: ["rubric", chatId] });
            setLoading(false);
        }
    };

    // Handler for initial message button clicks
    const handleInitialMessageClick = (message: string) => {
        handleSendMessage(null, message);
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="bg-primary text-primary-foreground p-4">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
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
                    {/* Document viewer - shown on left when chat is completed */}
                    {chat?.completed ? (
                        <div className="w-1/3">
                            <DocumentViewer profile={chat?.profile || 'aggressive'} />
                        </div>
                    ) : null}

                    {/* Chat area */}
                    <div className={`${chat?.completed ? 'w-1/2' : 'w-2/3'} flex flex-col`}>
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
                                                            <p className="font-medium">AI Assistant</p>
                                                            <div className="rounded-lg bg-primary/10 p-3">
                                                                <Markdown>{message.response}</Markdown>
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
                                    {isFirstMessage ? (
                                        <div className="w-full flex flex-row gap-3">
                                            <Button 
                                                onClick={() => handleInitialMessageClick("Hi, how are you?")}
                                                variant="outline"
                                                className="flex-1 h-auto py-3 text-center"
                                            >
                                                Hi, how are you?
                                            </Button>
                                            <Button 
                                                onClick={() => handleInitialMessageClick("Hi, what can I help you with?")}
                                                variant="outline"
                                                className="flex-1 h-auto py-3 text-center"
                                            >
                                                Hi, what can I help you with?
                                            </Button>
                                            <Button 
                                                onClick={() => handleInitialMessageClick("Hi, are you here for CS 253?")}
                                                variant="outline"
                                                className="flex-1 h-auto py-3 text-center"
                                            >
                                                Hi, are you here for CS 253?
                                            </Button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                                            <Input
                                                type="text"
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                placeholder="Type your response..."
                                                className="flex-1"
                                                autoFocus
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
                                    )}
                                </CardFooter>
                            )}
                        </Card>
                    </div>

                    {/* Rubric area when completed, otherwise document viewer */}
                    {chat?.completed ? (
                        <Card className="w-1/6">
                            <CardHeader>
                                <CardTitle className="text-center text-sm">Assessment</CardTitle>
                            </CardHeader>
                            <CardContent className="p-2 text-sm">
                                <div className="space-y-2">
                                    <div className="border-b pb-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Active Listening</span>
                                            <span>{rubric?.activeListening}/4</span>
                                        </div>
                                    </div>

                                    <div className="border-b pb-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Empathy</span>
                                            <span>{rubric?.empathy}/4</span>
                                        </div>
                                    </div>

                                    <div className="border-b pb-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Problem Solving</span>
                                            <span>{rubric?.problemSolving}/4</span>
                                        </div>
                                    </div>

                                    <div className="border-b pb-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Communication</span>
                                            <span>{rubric?.communication}/4</span>
                                        </div>
                                    </div>

                                    <div className="border-b pb-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Resource Use</span>
                                            <span>{rubric?.resourceUtilization}/4</span>
                                        </div>
                                    </div>

                                    <div className="border-b pb-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Time Management</span>
                                            <span>{rubric?.timeManagement}/4</span>
                                        </div>
                                    </div>

                                    <div className="border-b pb-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Adaptability</span>
                                            <span>{rubric?.adaptability}/4</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <div className={`p-2 rounded-lg text-center font-semibold ${rubric?.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        <div className="text-lg">{rubric?.passed ? 'PASSED' : 'FAILED'}</div>
                                        <div className="text-xs">
                                            Score: {rubric?.score}/28
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => router.push('/home')}
                                        className="mt-4 w-full text-xs py-1 h-auto"
                                    >
                                        Return to Dashboard
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        // Document viewer - shown on right when chat is active
                        <div className="w-1/3">
                            <DocumentViewer profile={chat?.profile || 'aggressive'} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
