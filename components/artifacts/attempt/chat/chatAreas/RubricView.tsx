/**
 * RubricView.tsx
 * Rubric/grading display - thin passthrough to TableRubric
 * Uses OpenAPI types directly - no manual type definitions.
 */
"use client";

import TableRubric from "@/components/artifacts/rubric/TableRubric";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { components } from "@/lib/api/schema";

// ---- OpenAPI types (single source of truth) ----
type RubricStructureData = components["schemas"]["RubricStructureData"];
type GradingStateData = components["schemas"]["GradingStateData"];
type AnalysisEntry = components["schemas"]["AnalysisEntry"];

// Props interface using OpenAPI types
export interface RubricViewProps {
  rubric_structure: RubricStructureData;
  grading_state?: GradingStateData;
  analyses?: AnalysisEntry[] | null;
  group_id?: string | null;
  // Identifiers forwarded to TableRubric for the mobile PDF download.
  // Both are required by the button — when absent it stays hidden.
  rubric_id?: string | null;
  chat_id?: string | null;
  // Capability gate. When explicitly false, the analyses block is
  // hidden regardless of whether analyses content exists — covers
  // stale grades rendered after the flag flipped off. Undefined or
  // true preserves today's behavior of rendering whatever's present.
  analyses_enabled?: boolean | null;
  disabled?: boolean;
}

export function RubricView({
  rubric_structure,
  grading_state,
  analyses,
  group_id: _group_id,
  rubric_id,
  chat_id,
  analyses_enabled,
}: RubricViewProps) {
  const standardGroups = rubric_structure?.standard_groups || {};
  const standardGroupsMapping = rubric_structure?.standard_groups_mapping || {};
  const standardsMapping = rubric_structure?.standards_mapping || {};

  return (
    // flex-1 min-h-0 lets the ScrollArea fill the parent (which is
    // `flex-1 min-h-0 flex flex-col` in GenericChatInterface) and then
    // clip at that height so the rubric table scrolls internally
    // instead of overflowing the chat area. Matches how MessagesView
    // owns its own scroller.
    <ScrollArea className="flex-1 min-h-0 w-full">
      <div className="space-y-4 py-2 px-1 md:px-2">
      {/* OpenAPI schema types carry nullable fields that TableRubric's
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
              ])
            )}
            standardsMapping={standardsMapping}
            {...(grading_state && {
              gradingState: {
                achievedStandards: grading_state.achieved_standards ?? {},
                passedStandards: grading_state.passed_standards ?? {},
                feedbackByStandardId: grading_state.feedback_by_standard_id,
              },
            })}
            analyses={analyses_enabled === false ? null : analyses}
            rubricId={rubric_id ?? null}
            chatId={chat_id ?? null}
          />
        );
      })()}
      </div>
    </ScrollArea>
  );
}
