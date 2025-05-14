/** 
 * app/[chatId]/page.tsx
 * This page is to show each of the individual chats.
 * @AshokSaravanan222
 * 2025-05-13
 */
"use client";

import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getMessages } from "@/utils/queries/get-messages";
import { getChat } from "@/utils/queries/get-chat";

export default function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
    const { chatId } = use(params);
    const [input, setInput] = useState("");
    const queryClient = useQueryClient();

    // testing page url: http://localhost:3000/chat/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa

    const { data: chat } = useQuery({
        queryKey: ["chat", chatId],
        queryFn: () => getChat(chatId),
    });

    // Fetch messages
    const { data: messages = [] } = useQuery({
        queryKey: ["messages", chatId],
        queryFn: () => getMessages(chatId),
        enabled: !!chatId,
    });

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        try {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            formData.append("message", input);
            formData.append("chat_id", chatId);
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
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
            setInput("");
        }
    }

    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <Card className="w-full max-w-3xl mx-auto h-[80vh] flex flex-col">
                <CardHeader>
                    <CardTitle>{chat?.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full pr-4">
                        <div className="space-y-4">
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
                        </div>
                    </ScrollArea>
                </CardContent>
                <CardFooter>
                    <form onSubmit={handleSubmit} className="flex w-full gap-2">
                        <Input
                            placeholder="Type your message..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="flex-1"
                        />
                        <Button type="submit" size="icon">
                            <Send className="h-4 w-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </form>
                </CardFooter>
            </Card>
        </div>
    );
}
