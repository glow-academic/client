/**
 * app/c/page.tsx
 * Chat page. Redirects to new chat page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat",
  description: "Chat in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function ChatPage() {
  return redirect("/home");
}
