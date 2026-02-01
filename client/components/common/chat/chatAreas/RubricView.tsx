/**
 * RubricView.tsx
 * Rubric/grading display - thin passthrough to TableRubric
 * Server sends data in exact format TableRubric needs
 */
"use client";

import TableRubric from "@/components/common/rubric/TableRubric";

// Props match exactly what TableRubric expects (Record format from server)
export interface RubricViewProps {
  // Rubric structure (Record format)
  standard_groups: Record<string, string[]>; // group_id -> [standard_ids]
  standard_groups_mapping: Record<
    string,
    { name: string; description: string; points: number; pass_points: number }
  >;
  standards_mapping: Record<
    string,
    { name: string; description: string; points: number }
  >;
  // Grading state (Record format, optional)
  grading_state?: {
    achieved_standards: Record<string, boolean>;
    passed_standards: Record<string, boolean>;
    grade_description?: string;
    feedback_by_standard_id?: Record<string, string>;
  };
  disabled?: boolean;
}

export function RubricView({
  standard_groups,
  standard_groups_mapping,
  standards_mapping,
  grading_state,
}: RubricViewProps) {
  return (
    <div className="space-y-4 py-2">
      <TableRubric
        standardGroups={standard_groups}
        standardGroupsMapping={Object.fromEntries(
          Object.entries(standard_groups_mapping).map(([k, v]) => [
            k,
            { ...v, passPoints: v.pass_points },
          ])
        )}
        standardsMapping={standards_mapping}
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
