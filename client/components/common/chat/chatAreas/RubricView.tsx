/**
 * RubricView.tsx
 * Rubric/grading display
 * Explicit, self-contained types (like resource components)
 */
"use client";

import TableRubric from "@/components/common/rubric/TableRubric";

// Explicit, self-contained prop interface (like resource components)
export interface RubricViewProps {
  rubric_data: {
    standard_groups: Array<{
      standard_group_id: string | null;
      standard_ids: Array<string> | null;
    }>;
    standard_groups_mapping: Array<{
      standard_group_id: string | null;
      name: string | null;
      description: string | null;
      points: number | null;
      pass_points: number | null;
    }>;
    standards_mapping: Array<{
      standard_id: string | null;
      name: string | null;
      description: string | null;
      points: number | null;
    }>;
  };
  grading_state?: {
    achieved_standards: Array<{
      standard_id: string | null;
      achieved: boolean | null;
    }> | null;
    passed_standards: Array<{
      standard_id: string | null;
      passed: boolean | null;
    }> | null;
    grade_description: string | null;
    feedback_by_standard_id: Array<{
      standard_id: string | null;
      feedback: string | null;
    }> | null;
  };
  disabled?: boolean;
}

export function RubricView({
  rubric_data,
  grading_state,
  disabled = false,
}: RubricViewProps) {
  // Convert arrays to Records for TableRubric
  const standardGroups: Record<string, string[]> = {};
  rubric_data.standard_groups.forEach((group) => {
    if (group.standard_group_id && group.standard_ids) {
      standardGroups[group.standard_group_id] = group.standard_ids;
    }
  });

  const standardGroupsMapping: Record<
    string,
    { name: string; description: string; points: number; passPoints: number }
  > = {};
  rubric_data.standard_groups_mapping.forEach((group) => {
    if (group.standard_group_id) {
      standardGroupsMapping[group.standard_group_id] = {
        name: group.name || "",
        description: group.description || "",
        points: group.points || 0,
        passPoints: group.pass_points || 0,
      };
    }
  });

  const standardsMapping: Record<
    string,
    { name: string; description: string; points: number }
  > = {};
  rubric_data.standards_mapping.forEach((standard) => {
    if (standard.standard_id) {
      standardsMapping[standard.standard_id] = {
        name: standard.name || "",
        description: standard.description || "",
        points: standard.points || 0,
      };
    }
  });

  // Convert grading state arrays to Records
  const achievedMap: Record<string, boolean> = {};
  const passedMap: Record<string, boolean> = {};
  const feedbackMap: Record<string, string> = {};

  if (grading_state) {
    (grading_state.achieved_standards || []).forEach((s) => {
      if (s.standard_id) achievedMap[s.standard_id] = s.achieved ?? false;
    });
    (grading_state.passed_standards || []).forEach((s) => {
      if (s.standard_id) passedMap[s.standard_id] = s.passed ?? false;
    });
    (grading_state.feedback_by_standard_id || []).forEach((s) => {
      if (s.standard_id && s.feedback) feedbackMap[s.standard_id] = s.feedback;
    });
  }

  return (
    <div className="space-y-4 py-2">
      <TableRubric
        standardGroups={standardGroups}
        standardGroupsMapping={standardGroupsMapping}
        standardsMapping={standardsMapping}
        {...(grading_state && {
          gradingState: {
            achievedStandards: achievedMap,
            passedStandards: passedMap,
            gradeDescription: grading_state.grade_description ?? undefined,
            feedbackByStandardId:
              Object.keys(feedbackMap).length > 0 ? feedbackMap : undefined,
          },
        })}
      />
    </div>
  );
}
