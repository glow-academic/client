/**
 * RubricView.tsx
 * Rubric/grading display - thin passthrough to TableRubric
 * Uses OpenAPI types directly - no manual type definitions.
 */
"use client";

import TableRubric from "@/components/artifacts/rubric/TableRubric";
import { useEntryAi } from "@/hooks/use-entry-ai";
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
  disabled?: boolean;
}

export function RubricView({
  rubric_structure,
  grading_state,
  analyses,
  group_id,
}: RubricViewProps) {
  // ---- Entry-level AI subscriptions ----
  const { events: feedbacksEvents } = useEntryAi({ entryType: "feedbacks", groupId: group_id });
  const { events: analysesEvents } = useEntryAi({ entryType: "analyses", groupId: group_id });

  const standardGroups = rubric_structure?.standard_groups || {};
  const standardGroupsMapping = rubric_structure?.standard_groups_mapping || {};
  const standardsMapping = rubric_structure?.standards_mapping || {};

  return (
    <div className="space-y-4 py-2">
      {/* @ts-ignore - OpenAPI types don't exactly match TableRubric props */}
      <TableRubric
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
        analyses={analyses}
      />
    </div>
  );
}
