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
import { usePathname } from "next/navigation";

export default function ChatFab() {
  const { openWidget, uiState } = useChat();
  const { effectiveRole } = useRole();

  // Only show for instructor, instructional, or admin roles
  const shouldShow = ["instructor", "instructional", "admin"].includes(
    effectiveRole
  );

  // or if the currrent route is home/a/...
  const pathname = usePathname() || "/";
  const isHomeAssistant = pathname.startsWith("/home/a/");

  if (!shouldShow || uiState !== "closed" || isHomeAssistant) {
    return null;
  }

  const handleClick = () => {
    openWidget();
  };

  return (
    <Button
      onClick={handleClick}
      className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-50"
      size="lg"
    >
      <MessageCircle className="h-6 w-6" />
    </Button>
  );
}
