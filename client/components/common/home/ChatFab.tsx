/**
 * ChatFab.tsx
 * Chat floating action button component for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import { useAssistant } from "@/contexts/assistant-context";
import { useRole } from "@/contexts/role-context";
import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";

interface ChatFabProps {
  up: boolean;
}

export default function ChatFab({ up = false }: ChatFabProps) {
  const { openWidget, uiState } = useAssistant();
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

  // show normal fixed button if up is true
  if (up) {
    return (
      <Button
        onClick={handleClick}
        className="shadow-lg hover:shadow-xl transition-all duration-300 z-50 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0 group"
        size="sm"
      >
        <MessageCircle className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
        Need Help?
      </Button>
    );
  }

  return (
    <Button
      onClick={handleClick}
      className="fixed bottom-2 right-2 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0 group"
      size="lg"
    >
      <MessageCircle className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
    </Button>
  );
}
