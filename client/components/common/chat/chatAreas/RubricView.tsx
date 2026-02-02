/**
 * RubricView.tsx
 * Rubric/grading display - thin passthrough to TableRubric
 * Uses OpenAPI types directly - no manual type definitions.
 */
"use client";

import TableRubric from "@/components/common/rubric/TableRubric";
import type { components } from "@/lib/api/schema";

// ---- OpenAPI types (single source of truth) ----
type RubricStructureData = components["schemas"]["RubricStructureData"];
type GradingStateData = components["schemas"]["GradingStateData"];

// Props interface using OpenAPI types
export interface RubricViewProps {
  rubric_structure: RubricStructureData;
  grading_state?: GradingStateData;
  disabled?: boolean;
}

export function RubricView({
  rubric_structure,
  grading_state,
}: RubricViewProps) {
  const standardGroups = rubric_structure?.standard_groups || {};
  const standardGroupsMapping = rubric_structure?.standard_groups_mapping || {};
  const standardsMapping = rubric_structure?.standards_mapping || {};

  return (
    <div className="space-y-4 py-2">
      {/* @ts-expect-error - OpenAPI types don't exactly match TableRubric props */}
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
            achievedStandards: grading_state.achieved_standards,
            passedStandards: grading_state.passed_standards,
            gradeDescription: grading_state.grade_description,
            feedbackByStandardId: grading_state.feedback_by_standard_id,
          },
        })}
      />
    </div>
  );
}
