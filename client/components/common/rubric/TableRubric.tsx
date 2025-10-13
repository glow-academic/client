/**
 * TableRubric.tsx
 * Used to display a rubric in a table format
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import * as React from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSimulationChatFeedbacksBySimulationChatGradeIdBatch } from "@/lib/api/v1/hooks/simulation_chat_feedbacks";
import { useSimulationChatGradesBySimulationChatId } from "@/lib/api/v1/hooks/simulation_chat_grades";
import { useStandardGroupsByRubricId } from "@/lib/api/v1/hooks/standard_groups";
import { useStandardsByStandardGroupIdBatch } from "@/lib/api/v1/hooks/standards";
import { Standard, StandardGroup } from "@/types";

export interface TableRubricProps {
  rubricId: string;
  simulationChatId?: string;
}

export default function TableRubric({
  rubricId,
  simulationChatId,
}: TableRubricProps) {
  const [flippedCells, setFlippedCells] = React.useState<Set<string>>(
    () => new Set<string>()
  );

  const { data: standardGroups, isLoading: loadingStandardGroups } =
    useStandardGroupsByRubricId(rubricId || "");

  const { data: standards, isLoading: loadingStandards } =
    useStandardsByStandardGroupIdBatch(
      standardGroups?.map((group) => group.id) || []
    );

  const { data: simulationGrades, isLoading: loadingSimulationGrades } =
    useSimulationChatGradesBySimulationChatId(simulationChatId || "");

  const { data: simulationFeedbacks, isLoading: loadingSimulationFeedbacks } =
    useSimulationChatFeedbacksBySimulationChatGradeIdBatch(
      simulationGrades?.map((grade) => grade.id) || []
    );

  // Get the appropriate grade and feedback data
  const grades = simulationGrades;
  const feedbacks = simulationFeedbacks;
  const chatGrade = grades?.[0]; // Assuming one grade per chat

  // Helper function to get feedback for a specific standard
  const getFeedbackForStandard = (standardId: string) => {
    if (!feedbacks || !chatGrade) return null;
    return feedbacks.find((feedback) => {
      if (feedback.standardId !== standardId) return false;
      return (
        "simulationChatGradeId" in feedback &&
        feedback.simulationChatGradeId === chatGrade.id
      );
    });
  };

  // Helper function to determine if a standard was achieved
  const isStandardAchieved = (
    standard: Standard,
    groupStandards: Standard[]
  ) => {
    const feedback = getFeedbackForStandard(standard.id);
    if (!feedback) return false;

    // Find the highest achieved standard in this group
    const groupFeedbacks = groupStandards
      .map((s) => getFeedbackForStandard(s.id))
      .filter(Boolean);

    if (groupFeedbacks.length === 0) return false;

    const maxScore = Math.max(...groupFeedbacks.map((f) => f!.total));
    return feedback.total === maxScore;
  };

  // Helper function to determine if a standard has been passed based on pass points
  const isStandardPassed = (standard: Standard, group: StandardGroup) => {
    const feedback = getFeedbackForStandard(standard.id);
    if (!feedback) return false;

    // Check if the feedback total meets or exceeds the pass points for this group
    return feedback.total >= group.passPoints;
  };

  // Helper function to determine if a standard should be highlighted (achieved or below achieved)
  const shouldHighlight = (standard: Standard, groupStandards: Standard[]) => {
    const feedback = getFeedbackForStandard(standard.id);
    if (!feedback) return false;

    // Find the achieved standard in this group
    const achievedStandard = groupStandards.find((s) =>
      isStandardAchieved(s, groupStandards)
    );
    if (!achievedStandard) return false;

    // Highlight if this standard's points are <= achieved standard's points
    return standard.points <= achievedStandard.points;
  };

  if (
    loadingStandardGroups ||
    loadingStandards ||
    loadingSimulationGrades ||
    loadingSimulationFeedbacks
  ) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading rubric...</p>
        </div>
      </div>
    );
  }

  // Group standards by standard group
  const groupedStandards =
    standardGroups?.map((group: StandardGroup) => ({
      group,
      standards:
        standards
          ?.filter(
            (standard: Standard) => standard.standardGroupId === group.id
          )
          ?.sort((a, b) => b.points - a.points) || [], // Sort by points descending (Level 5 to Level 1)
    })) || [];

  // Determine the maximum number of standards across all groups for consistent column count
  const maxStandards = Math.max(
    ...groupedStandards.map((g) => g.standards.length)
  );

  return (
    <div className="space-y-6 w-full">
      <div className="overflow-auto max-h-[70vh]">
        <Table className="min-w-[600px] text-sm table-fixed">
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead
                className="bg-primary text-primary-foreground font-semibold text-xs"
                style={{ width: "20%" }}
              >
                Criteria
              </TableHead>
              {Array.from({ length: maxStandards }, (_, i) => (
                <TableHead
                  key={i}
                  className="bg-primary text-primary-foreground font-semibold text-xs px-2"
                  style={{ width: `${(100 - 20) / maxStandards}%` }}
                >
                  {groupedStandards[0]?.standards[i]?.name} (
                  {groupedStandards[0]?.standards[i]?.points})
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedStandards.map(
              ({ group, standards: groupStandards }, groupIndex) => (
                <TableRow
                  key={group.id}
                  className={groupIndex % 2 === 1 ? "bg-secondary/20" : ""}
                >
                  <TableCell
                    className="font-medium align-top p-2 text-xs"
                    style={{ width: "20%" }}
                  >
                    <HoverCard openDelay={200} closeDelay={150}>
                      <HoverCardTrigger asChild>
                        <div className="break-words whitespace-normal overflow-hidden cursor-pointer px-2 py-1 rounded-sm hover:bg-accent/40">
                          {group.name}
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent side="right" className="w-80">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold">
                            Standards in this group
                          </div>
                          {groupStandards.length === 0 ? (
                            <div className="text-xs text-muted-foreground">
                              No standards in this group.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-1">
                              {groupStandards.map((s) => {
                                const isAchievedForS = isStandardAchieved(
                                  s,
                                  groupStandards
                                );
                                return (
                                  <div
                                    key={s.id}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <span
                                      className={
                                        isAchievedForS
                                          ? "font-semibold"
                                          : "text-muted-foreground"
                                      }
                                    >
                                      {s.name} ({s.points})
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </TableCell>
                  {Array.from({ length: maxStandards }, (_, standardIndex) => {
                    const standard = groupStandards[standardIndex];
                    if (!standard) {
                      return (
                        <TableCell
                          key={standardIndex}
                          className="whitespace-normal text-xs align-top p-2"
                        ></TableCell>
                      );
                    }

                    const feedback = getFeedbackForStandard(standard.id);
                    const isAchieved = isStandardAchieved(
                      standard,
                      groupStandards
                    );
                    const isPassed = isStandardPassed(standard, group);
                    const shouldHighlightCell = shouldHighlight(
                      standard,
                      groupStandards
                    );

                    return (
                      <TableCell
                        key={standard.id}
                        className={`whitespace-normal text-xs relative align-top p-2 ${
                          // If flipped on an achieved cell, force white background to show the standard cleanly
                          isAchieved && flippedCells.has(standard.id)
                            ? "bg-white dark:bg-white/10"
                            : shouldHighlightCell
                              ? isPassed
                                ? "bg-green-200 dark:bg-green-900/40"
                                : "bg-red-200 dark:bg-red-900/40"
                              : ""
                        }`}
                        role={isAchieved ? "button" : undefined}
                        tabIndex={isAchieved ? 0 : -1}
                        onKeyDown={(e) => {
                          // Keyboard toggle: on achieved cells, flip
                          const target = e.target as HTMLElement;
                          if (
                            target.closest(
                              "textarea, input, button, select, [contenteditable='true']"
                            )
                          ) {
                            return; // do not hijack keys while typing or interacting with controls
                          }
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (isAchieved) {
                              setFlippedCells((prev) => {
                                const next = new Set(prev);
                                if (next.has(standard.id))
                                  next.delete(standard.id);
                                else next.add(standard.id);
                                return next;
                              });
                            }
                          }
                        }}
                        onClick={() => {
                          if (isAchieved) {
                            setFlippedCells((prev) => {
                              const next = new Set(prev);
                              if (next.has(standard.id))
                                next.delete(standard.id);
                              else next.add(standard.id);
                              return next;
                            });
                            return;
                          }
                        }}
                      >
                        {(() => {
                          const isFlippable = isAchieved; // flip only on achieved cell
                          const isFlipped = flippedCells.has(standard.id);

                          /* If we're ABOUT to show the back (isFlipped true), spin forward (+1).
                             If we're ABOUT to show the front (isFlipped false), spin backward (-1). */
                          const dir = isFlipped ? 1 : -1;

                          const frontContent = (
                            <div className="text-xs leading-tight">
                              {feedback?.feedback || standard.description}
                            </div>
                          );
                          const backContent = (
                            <div className="text-xs leading-tight">
                              {standard.description}
                            </div>
                          );

                          const card = isFlippable ? (
                            <div
                              className={`flip3d ${isFlipped ? "is-flipped" : ""}`}
                              data-dir={dir}
                            >
                              <div className="face front">{frontContent}</div>
                              <div className="face back">{backContent}</div>
                            </div>
                          ) : (
                            <div className="space-y-1">{frontContent}</div>
                          );

                          return card;
                        })()}
                      </TableCell>
                    );
                  })}
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>

      {/* Rubric summary (description from simulation_chat_grade) */}
      {simulationChatId && chatGrade?.description && (
        <div className="border rounded-md p-4 bg-card">
          <div className="text-sm font-semibold mb-2">Rubric summary</div>
          <div className="text-sm whitespace-pre-wrap">
            {chatGrade.description}
          </div>
        </div>
      )}
    </div>
  );
}
