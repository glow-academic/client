/**
 * ChatFab.tsx
 * Chat floating action button component for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import { useChat } from "@/contexts/chat-context";
import { useRole } from "@/contexts/role-context";
import { MessageCircle } from "lucide-react";

export default function ChatFab() {
  const { openWidget, uiState } = useChat();
  const { effectiveRole } = useRole();

  // Only show for instructor, instructional, or admin roles
  const shouldShow = ["instructor", "instructional", "admin"].includes(
    effectiveRole
  );

  if (!shouldShow || uiState !== "closed") {
    return null;
  }

  return (
    <Button
      onClick={openWidget}
      className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-50"
      size="lg"
    >
      <MessageCircle className="h-6 w-6" />
    </Button>
  );
}
