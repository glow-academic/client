/**
 * ModelRubricView.tsx
 * Per-run grading summary for the selected model. Renders score, pass/fail,
 * and feedback text pulled from /test/get's entries.grades + entries.feedback.
 *
 * v1 keeps this lightweight (score + feedback) — full rubric-matrix breakdown
 * arrives once the test/get response surfaces RubricStructureData per run,
 * matching what AttemptChat's RubricView consumes.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { OutputOf } from "@/lib/api/types";
import { CheckCircle2, XCircle } from "lucide-react";
import { useMemo } from "react";

type TestArtifactOut = OutputOf<"/test/get", "post">;
type RunItem = NonNullable<TestArtifactOut["runs"]>[number];
type GradeItem = NonNullable<
  NonNullable<TestArtifactOut["entries"]>["grades"]
>[number];
type FeedbackItem = NonNullable<
  NonNullable<TestArtifactOut["entries"]>["feedback"]
>[number];

export interface ModelRubricViewProps {
  runs: RunItem[];
  grades: GradeItem[];
  feedback: FeedbackItem[];
}

export function ModelRubricView({
  runs,
  grades,
  feedback,
}: ModelRubricViewProps) {
  const gradesByInvocation = useMemo<Record<string, GradeItem[]>>(() => {
    const out: Record<string, GradeItem[]> = {};
    for (const g of grades) {
      if (!out[g.invocation_id]) out[g.invocation_id] = [];
      out[g.invocation_id]!.push(g);
    }
    return out;
  }, [grades]);

  const feedbackByGrade = useMemo<Record<string, FeedbackItem[]>>(() => {
    const out: Record<string, FeedbackItem[]> = {};
    for (const f of feedback) {
      if (!out[f.grade_id]) out[f.grade_id] = [];
      out[f.grade_id]!.push(f);
    }
    return out;
  }, [feedback]);

  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        <p className="text-sm">No runs to grade for this model.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      {runs.map((run) => {
        const invocationGrades = run.invocation_id
          ? gradesByInvocation[run.invocation_id] ?? []
          : [];
        const latestGrade = invocationGrades.sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        )[0];
        const fallbackScore = run.grade_score;
        const fallbackPassed = run.grade_passed;
        const score = latestGrade?.score ?? fallbackScore ?? null;
        const passed = latestGrade?.passed ?? fallbackPassed ?? null;
        const hasGrade = score !== null && score !== undefined;
        const fbItems = latestGrade
          ? feedbackByGrade[latestGrade.id] ?? []
          : [];

        return (
          <Card
            key={run.run_id ?? run.chat_id ?? Math.random().toString()}
            className="border"
          >
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {passed === true ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : passed === false ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : null}
                  <span className="text-sm font-medium truncate">
                    {run.agent_name || "Agent"}
                  </span>
                  {run.run_id && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {run.run_id.substring(0, 8)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {hasGrade ? (
                    <Badge
                      variant={passed ? "default" : "destructive"}
                      className={passed ? "bg-green-500" : ""}
                    >
                      {score}
                      {passed ? " Pass" : " Fail"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Not graded
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            {(fbItems.length > 0 || (latestGrade && latestGrade.time_taken)) && (
              <CardContent className="pt-0 pb-3 px-4">
                <div className="border-t pt-3 space-y-2 text-xs">
                  {latestGrade?.time_taken != null && (
                    <div className="text-muted-foreground">
                      Graded in{" "}
                      {(latestGrade.time_taken / 1000).toFixed(1)}s
                    </div>
                  )}
                  {fbItems.map((f) => (
                    <div
                      key={f.feedback_id}
                      className="border-l-2 border-muted pl-2"
                    >
                      <div className="text-muted-foreground">
                        {f.total} / {f.total_points} pts · pass at{" "}
                        {f.pass_points}
                      </div>
                      <div className="text-foreground whitespace-pre-wrap">
                        {f.feedback}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
