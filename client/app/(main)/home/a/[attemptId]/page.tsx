/**
 * app/home/a/[attemptId]/page.tsx
 * Attempt page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Attempt from "@/components/common/chat/Attempt";
import { use } from "react";

export default function AttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = use(params);
  return (
    <div className="space-y-6">
      <Attempt attemptId={attemptId} />
    </div>
  );
}
