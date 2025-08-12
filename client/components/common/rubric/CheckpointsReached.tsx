"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useMemo } from "react";

export interface CheckpointsReachedProps {
  simulationChatId: string;
  checkpointsReached: boolean[];
  labels?: string[];
}

/**
 * Displays scenario checkpoints with a checkmark when reached, blank circle otherwise.
 * Assumes the order and length of `checkpointsReached` matches the scenario's `checkpoints`.
 */
export default function CheckpointsReached({
  checkpointsReached,
  labels,
}: CheckpointsReachedProps) {
  // We need the scenario description + checkpoints. The parent already has scenarioId in TableRubric scope via rubricId-only; fetch via the chat id isn't available here.
  // Instead, TableRubric passes simulationChatId; we will fetch chat -> scenario id if needed later.
  // For simplicity and to avoid a new query, expect parent to render this component only within AttemptChat/TableRubric where scenario is already fetched.

  // Small adapter: AttemptChat renders TableRubric inside a panel where it has the selected chat's scenario loaded.
  // To make this component self-sufficient, we accept that scenario is fetched outside and provide a fallback minimal UI when checkpoints labels are unknown.

  // We cannot load scenario id directly from here without an extra query to fetch chat, so we rely on an optional scenario prop in future if needed.

  // Render aligned rows with generic labels when we cannot resolve scenario checkpoints.
  // A superior integration wires scenario.checkpoints from parent. For now, try best-effort: AttemptChat already fetches selectedScenario and can pass labels later.
  const resolvedLabels = useMemo(() => {
    if (labels && labels.length === checkpointsReached.length) return labels;
    // If no labels known or length mismatch, create numbered placeholders to avoid empty UI.
    return checkpointsReached.map((_, idx) => `Checkpoint ${idx + 1}`);
  }, [labels, checkpointsReached]);

  if (checkpointsReached.length === 0) return null;

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {checkpointsReached.map((reached, idx) => (
          <li key={idx} className="flex items-start gap-2">
            {reached ? (
              <CheckCircle2
                className="h-5 w-5 text-green-600"
                aria-label="Reached"
              />
            ) : (
              <Circle
                className="h-5 w-5 text-muted-foreground"
                aria-label="Not reached"
              />
            )}
            <span className="text-sm leading-tight">{resolvedLabels[idx]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
