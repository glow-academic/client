/**
 * TableRubric.tsx
 * Used to display a rubric in a table format
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/contexts/profile-context";
import { Standard, StandardGroup } from "@/types";
import {
  simulationChatCrowdsourcedFeedbacks,
  simulationChatFeedbacks,
} from "@/utils/drizzle/schema";
import { createSimulationChatCrowdsourcedFeedback } from "@/utils/mutations/simulation_chat_crowdsourced_feedbacks/create-simulation-chat-crowdsourced-feedback";
import { getRubric } from "@/utils/queries/rubrics/get-rubric";
import { getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbacks } from "@/utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-simulationchatfeedbacks";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getStandardGroupsByRubric } from "@/utils/queries/standard_groups/get-standard-groups-by-rubric";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type SimulationChatFeedback = typeof simulationChatFeedbacks.$inferSelect;
type SimulationChatCrowdsourcedFeedback =
  typeof simulationChatCrowdsourcedFeedbacks.$inferSelect;

export interface TableRubricProps {
  rubricId: string;
  simulationChatId?: string;
}

export default function TableRubric({
  rubricId,
  simulationChatId,
}: TableRubricProps) {
  const queryClient = useQueryClient();
  const { effectiveProfile } = useProfile();
  const canCrowdsource =
    !!effectiveProfile &&
    ["instructional", "admin", "superadmin"].includes(
      effectiveProfile.role as string
    );

  const [activeStandardId, setActiveStandardId] = React.useState<string | null>(
    null
  );
  const [crowdFeedbackText, setCrowdFeedbackText] = React.useState<string>("");

  const { isLoading: loadingRubric } = useQuery({
    queryKey: ["rubric", rubricId],
    queryFn: () => getRubric(rubricId),
    enabled: !!rubricId,
  });

  const { data: standardGroups, isLoading: loadingStandardGroups } = useQuery({
    queryKey: ["standardGroups", rubricId],
    queryFn: () => getStandardGroupsByRubric(rubricId),
    enabled: !!rubricId,
  });

  const { data: standards, isLoading: loadingStandards } = useQuery({
    queryKey: [
      "standards",
      standardGroups?.map((group: StandardGroup) => group.id),
    ],
    queryFn: () =>
      getStandardsByStandardGroups(
        standardGroups!.map((group: StandardGroup) => group.id)
      ),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  // Fetch grades and feedback for simulation chats
  const { data: simulationGrades, isLoading: loadingSimulationGrades } =
    useQuery({
      queryKey: ["simulationGrades", simulationChatId],
      queryFn: () =>
        getSimulationChatGradesBySimulationChats([simulationChatId!]),
      enabled: !!simulationChatId,
    });

  const { data: simulationFeedbacks, isLoading: loadingSimulationFeedbacks } =
    useQuery({
      queryKey: [
        "simulationFeedbacks",
        simulationGrades?.map((grade) => grade.id),
      ],
      queryFn: () =>
        getSimulationChatFeedbacksBySimulationChatGrades(
          simulationGrades!.map((grade) => grade.id)
        ),
      enabled: !!simulationGrades && simulationGrades.length > 0,
    });

  // Get the appropriate grade and feedback data
  const grades = simulationGrades;
  const feedbacks = simulationFeedbacks;
  const chatGrade = grades?.[0]; // Assuming one grade per chat

  // Map standards to their simulation feedback rows for quick lookup
  const standardIdToFeedback = React.useMemo(() => {
    const map = new Map<string, SimulationChatFeedback>();
    (feedbacks || []).forEach((f: SimulationChatFeedback) => {
      if (f?.standardId) map.set(f.standardId, f);
    });
    return map;
  }, [feedbacks]);

  // Fetch all crowdsourced feedbacks for the feedback rows shown in this rubric
  const allFeedbackIds = React.useMemo(
    () => (feedbacks || []).map((f: SimulationChatFeedback) => f.id),
    [feedbacks]
  );

  const { data: crowdFeedbacks, isLoading: loadingCrowdFeedbacks } = useQuery({
    queryKey: ["simulationCrowdFeedbacks", allFeedbackIds],
    queryFn: () =>
      getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbacks(
        allFeedbackIds
      ),
    enabled: allFeedbackIds.length > 0,
  });

  const crowdCountsByFeedbackId = React.useMemo(() => {
    const counts = new Map<string, number>();
    (crowdFeedbacks || []).forEach((cf: SimulationChatCrowdsourcedFeedback) => {
      const key = cf.simulationChatFeedbackId as string;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [crowdFeedbacks]);

  const { mutateAsync: submitCrowdFeedback, isPending: isSubmitting } =
    useMutation({
      mutationFn: async ({
        simulationChatFeedbackId,
        total,
        feedback,
      }: {
        simulationChatFeedbackId: string;
        total: number;
        feedback: string | null;
      }) => {
        const payload: typeof simulationChatCrowdsourcedFeedbacks.$inferInsert =
          {
            simulationChatFeedbackId,
            total,
            feedback,
          };
        return createSimulationChatCrowdsourcedFeedback(payload);
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["simulationCrowdFeedbacks"],
        });
      },
    });

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
    loadingRubric ||
    loadingStandardGroups ||
    loadingStandards ||
    loadingSimulationGrades ||
    loadingSimulationFeedbacks ||
    loadingCrowdFeedbacks
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
    <div className="space-y-4 w-full">
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
                        <div className="break-words whitespace-normal overflow-hidden cursor-help">
                          {group.name}
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent side="right" className="w-80">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold">
                            Crowdsourced suggestions
                          </div>
                          {groupStandards.length === 0 ? (
                            <div className="text-xs text-muted-foreground">
                              No standards in this group.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-1">
                              {groupStandards.map((s) => {
                                const f = standardIdToFeedback.get(s.id);
                                const count = f
                                  ? crowdCountsByFeedbackId.get(f.id) || 0
                                  : 0;
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
                                    <span className="inline-flex items-center rounded bg-secondary px-1.5 py-0.5 text-[10px]">
                                      {count} vote{count === 1 ? "" : "s"}
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
                    const isClickable =
                      canCrowdsource &&
                      !!simulationChatId &&
                      !!feedback &&
                      !isAchieved;

                    return (
                      <TableCell
                        key={standard.id}
                        className={`whitespace-normal text-xs relative align-top p-2 ${
                          shouldHighlightCell
                            ? isPassed
                              ? "bg-green-200 dark:bg-green-900/40"
                              : "bg-red-200 dark:bg-red-900/40"
                            : ""
                        } ${
                          isClickable ? "cursor-pointer hover:bg-accent/40" : ""
                        }`}
                        role={isClickable ? "button" : undefined}
                        tabIndex={isClickable ? 0 : -1}
                        onKeyDown={(e) => {
                          if (!isClickable) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setActiveStandardId(standard.id);
                          }
                        }}
                        onClick={() => {
                          if (!isClickable) return;
                          setActiveStandardId(standard.id);
                        }}
                      >
                        <div className="space-y-1">
                          {isAchieved && feedback ? (
                            <div className="text-xs leading-tight">
                              {feedback.feedback}
                            </div>
                          ) : (
                            <div className="text-xs leading-tight">
                              {standard.description}
                            </div>
                          )}
                        </div>

                        {isClickable && activeStandardId === standard.id && (
                          <Popover
                            open
                            onOpenChange={(open) => {
                              if (!open) {
                                setActiveStandardId(null);
                                setCrowdFeedbackText("");
                              }
                            }}
                          >
                            {/* Anchor to this cell so the popover positions correctly */}
                            <PopoverAnchor />
                            <PopoverContent
                              align="center"
                              side="top"
                              className="w-80"
                            >
                              <div className="space-y-3">
                                <div className="text-xs font-semibold">
                                  Propose this level?
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {standard.name} ({standard.points} points)
                                </div>
                                <Textarea
                                  value={crowdFeedbackText}
                                  onChange={(e) =>
                                    setCrowdFeedbackText(e.target.value)
                                  }
                                  placeholder="Optional: Why should this be the level?"
                                  className="min-h-20 text-xs"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setActiveStandardId(null);
                                      setCrowdFeedbackText("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    disabled={isSubmitting}
                                    onClick={async () => {
                                      if (!feedback) return;
                                      await submitCrowdFeedback({
                                        simulationChatFeedbackId: feedback.id,
                                        total: standard.points,
                                        feedback:
                                          crowdFeedbackText.trim() || null,
                                      });
                                      setActiveStandardId(null);
                                      setCrowdFeedbackText("");
                                    }}
                                  >
                                    {isSubmitting ? "Submitting..." : "Submit"}
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
