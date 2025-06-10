/**
 * app/c/page.tsx
 * Chat page. Redirects to new chat page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

export default function ChatPage() {
  return redirect("/home");
}