/**
 * components/common/chat/Evaluation.tsx
 * Evaluation component for viewing evaluation runs and AI vs AI conversations.
 * This component is simplified - evaluations should be run from the EvaluationRun page.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Evaluation() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card>
        <CardHeader>
          <CardTitle>Evaluation</CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground mb-4">
            Evaluations are now run from the individual evaluation run pages.
          </p>
          <p className="text-sm text-muted-foreground">
            Navigate to Management → Evaluations to view and run your
            evaluations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
