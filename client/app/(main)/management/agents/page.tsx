/**
 * app/(main)/management/agents/page.tsx
 * Agents page. Redirects to agents page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";

import { redirect } from "next/navigation";

export default function AgentsPage() {
  return redirect("/management/agents/new");
}