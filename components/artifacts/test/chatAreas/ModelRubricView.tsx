/**
 * ModelRubricView.tsx
 *
 * Graded view for a benchmark invocation × run. Thin passthrough to
 * TableRubric — same shape AttemptChat's RubricView uses, just sourced
 * from /test/get's ``invocation_details[]`` instead of attempt's
 * ``rubric_structure`` + ``ChatData.grading_state``.
 *
 * Selection axis:
 *   • Outer (invocation) — caller picks an entry from invocation_details.
 *   • Inner (run) — caller picks one of invocation.runs.
 * Both are passed in by id; this component just renders the rubric for
 * the resolved (invocation, run) pair. When no run is selected we fall
 * back to the invocation's ``primary_run_id`` so the view never lands
 * on an empty state when grades exist.
 */
"use client";

import TableRubric from "@/components/artifacts/rubric/TableRubric";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { components } from "@/lib/api/schema";
import type { OutputOf } from "@/lib/api/types";

type TestArtifactOut = OutputOf<"/test/get", "post">;
type InvocationDetail = components["schemas"]["InvocationDetail"];
type InvocationRunDetail = components["schemas"]["InvocationRunDetail"];

export interface ModelRubricViewProps {
  /** Per-invocation graded payloads from /test/get. */
  invocation_details: InvocationDetail[];
  /** Selected invocation id (global switcher). When null/missing,
   *  defaults to ``test.current_invocation_id`` upstream — this
   *  component just renders what's resolved. */
  selected_invocation_id?: string | null;
  /** Selected run id within the invocation (local switcher). When
   *  null, falls back to ``invocation.primary_run_id``. */
  selected_run_id?: string | null;
  /** Test-level data for analyses-enabled gating and IDs used by the
   *  TableRubric PDF download button (when wired). */
  test?: TestArtifactOut["test"];
}

export function ModelRubricView({
  invocation_details,
  selected_invocation_id,
  selected_run_id,
  test: _test,
}: ModelRubricViewProps) {
  // ── Resolve invocation + run ──────────────────────────────────────
  // Both selections are optional. We default to the first invocation
  // and to that invocation's ``primary_run_id`` (then first run) so
  // the view always lands on a populated state when data exists.
  const invocation =
    invocation_details.find((d) => d.invocation_id === selected_invocation_id) ??
    invocation_details[0] ??
    null;

  const run: InvocationRunDetail | null = invocation
    ? invocation.runs?.find((r) => r.run_id === selected_run_id) ??
      invocation.runs?.find((r) => r.run_id === invocation.primary_run_id) ??
      invocation.runs?.[0] ??
      null
    : null;

  // ── Empty / partial states ────────────────────────────────────────
  if (!invocation) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        <p className="text-sm">No invocations to grade.</p>
      </div>
    );
  }

  if (!invocation.rubric_structure) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        <p className="text-sm">
          No rubric is configured for this invocation.
        </p>
      </div>
    );
  }

  const rubricStructure = invocation.rubric_structure;
  const standardGroups = rubricStructure.standard_groups ?? {};
  const standardGroupsMapping = rubricStructure.standard_groups_mapping ?? {};
  const standardsMapping = rubricStructure.standards_mapping ?? {};
  const gradingState = run?.grading_state ?? null;
  const analyses = run?.analyses ?? null;

  return (
    // flex-1 min-h-0 mirrors AttemptChat's RubricView — the ScrollArea
    // fills the parent and clips at that height so the table scrolls
    // internally instead of pushing the chat area.
    <ScrollArea className="flex-1 min-h-0 w-full">
      <div className="space-y-4 py-2 px-1 md:px-2">
        {/* OpenAPI schema types carry nullable fields TableRubric's
            local types don't; runtime shape matches so we cast at the
            boundary rather than duplicate the types. */}
        {(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const Untyped = TableRubric as any;
          return (
            <Untyped
              standardGroups={standardGroups}
              standardGroupsMapping={Object.fromEntries(
                Object.entries(standardGroupsMapping).map(([k, v]) => [
                  k,
                  { ...v, passPoints: v?.pass_points },
                ]),
              )}
              standardsMapping={standardsMapping}
              {...(gradingState && {
                gradingState: {
                  achievedStandards: gradingState.achieved_standards ?? {},
                  passedStandards: gradingState.passed_standards ?? {},
                  feedbackByStandardId: gradingState.feedback_by_standard_id,
                },
              })}
              analyses={analyses}
              rubricId={invocation.rubric_id ?? null}
              chatId={run?.run_id ?? null}
            />
          );
        })()}
      </div>
    </ScrollArea>
  );
}
