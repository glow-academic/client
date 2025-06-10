/**
 * app/(main)/management/agents/a/page.tsx
 * Agent page for the agents section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

export default function AgentPage() {
  return redirect("/management/agents/new");
}
