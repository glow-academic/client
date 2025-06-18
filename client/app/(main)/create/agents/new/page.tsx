/**
 * app/(main)/management/agents/new/page.tsx
 * New agent page for the agents section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import NewAgent from "@/components/create/agents/NewAgent";

export default function NewAgentPage() {
  return (
    <div className="space-y-6">
      <NewAgent />
    </div>
  );
}
