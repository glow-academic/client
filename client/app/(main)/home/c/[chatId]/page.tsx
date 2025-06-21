/**
 * app/home/c/[chatId]/page.tsx
 * Chat page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";
import ChatDialog from "@/components/common/home/ChatDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChatProvider, useChat } from "@/contexts/chat-context";
import { useRole } from "@/contexts/role-context";
import { getCurrentProfileId } from "@/utils/chat-utils";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Metadata, ResolvingMetadata } from "next";
import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

export async function generateMetadata(
  { params }: { params: Promise<{ chatId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { chatId } = await params;

  // For now, we'll use a generic title since we're handling chat data in the client
  return {
    title: `Assistant Chat ${chatId.substring(0, 8)}...`,
    description: `Assistant Chat conversation in GLOW (Graduate Learning Orientation Workshop) at Purdue University.`,
  };
}

// Inner component that uses the chat context
function ChatPageContent({ chatId }: { chatId: string }) {
  const { selectChat, expand, chats, currentChatId } = useChat();
  const { effectiveRole } = useRole();
  const router = useRouter();

  // Only show for instructor, instructional, or admin roles
  const shouldShow = ["instructor", "instructional", "admin"].includes(
    effectiveRole
  );

  // Select the chat from URL parameter if it exists
  useEffect(() => {
    if (chatId && chats.length > 0) {
      const targetChat = chats.find((chat) => chat.id === chatId);
      if (targetChat) {
        selectChat(chatId);
        expand(); // Automatically expand when accessing via URL
      }
    }
  }, [chatId, chats, selectChat, expand]);

  if (!shouldShow) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">
              Chat Access Restricted
            </h2>
            <p className="text-muted-foreground mb-4">
              Assistant chat is only available for instructors, instructional
              staff, and administrators.
            </p>
            <Button onClick={() => router.push("/home")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if the requested chat exists
  const targetChat = chats.find((chat) => chat.id === chatId);
  const isValidChat = targetChat || currentChatId === chatId;

  if (chats.length > 0 && !isValidChat) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Chat Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The chat you're looking for doesn't exist or you don't have access
              to it.
            </p>
            <Button onClick={() => router.push("/home")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={() => router.push("/home")} variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {targetChat?.title || `Chat ${chatId.substring(0, 8)}...`}
          </h1>
          <p className="text-muted-foreground">Assistant conversation</p>
        </div>
      </div>

      {/* The ChatDialog will handle the full-screen display */}
      <ChatDialog chatId={chatId} />

      {/* Fallback UI if dialog is not expanded */}
      <Card className="w-full">
        <CardContent className="p-8 text-center">
          <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Chat Interface</h3>
          <p className="text-muted-foreground">
            The chat interface should appear in an expanded dialog. If you don't
            see it, try refreshing the page or check your permissions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);

  // Get profile info for the ChatProvider
  const profileId = getCurrentProfileId();

  return (
    <ChatProvider profileId={profileId}>
      <ChatPageContent chatId={chatId} />
    </ChatProvider>
  );
}
