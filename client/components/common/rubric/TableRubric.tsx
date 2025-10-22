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
import { AttemptFullResponse } from "@/lib/api/v2/schemas/attempts";

type StandardGroupMappingItem = {
  name: string;
  description: string;
  points: number;
  passPoints: number;
};

type StandardMappingItem = {
  name: string;
  description: string;
  points: number;
};

export interface TableRubricProps {
  // Core rubric structure (from V2 API)
  standardGroups: Record<string, string[]>; // group_id -> [standard_ids]
  standardGroupsMapping: Record<string, StandardGroupMappingItem>;
  standardsMapping: Record<string, StandardMappingItem>;

  // Optional: grading state for visualization (from v2 server-side)
  gradingState?: AttemptFullResponse["chats"][number]["gradingState"] | null;
}

export default function TableRubric({
  standardGroups,
  standardGroupsMapping,
  standardsMapping,
  gradingState,
}: TableRubricProps) {
  const [flippedCells, setFlippedCells] = React.useState<Set<string>>(
    () => new Set<string>()
  );

  // Helper function to determine if a standard was achieved (from server-computed state)
  const isStandardAchieved = (standardId: string) => {
    if (!gradingState) return false;
    return gradingState.achievedStandards[standardId] || false;
  };

  // Helper function to determine if a standard has been passed (from server-computed state)
  const isStandardPassed = (standardId: string) => {
    if (!gradingState) return false;
    return gradingState.passedStandards[standardId] || false;
  };

  // Group standards by standard group using props data
  const groupedStandards = Object.entries(standardGroups).map(
    ([groupId, standardIds]) => {
      const groupInfo = standardGroupsMapping[groupId];
      return {
        groupId,
        groupInfo,
        standardIds: standardIds.sort((a, b) => {
          // Sort by points descending (Level 5 to Level 1)
          const aPoints = standardsMapping[a]?.points || 0;
          const bPoints = standardsMapping[b]?.points || 0;
          return bPoints - aPoints;
        }),
      };
    }
  );

  // Determine the maximum number of standards across all groups for consistent column count
  const maxStandards = Math.max(
    ...groupedStandards.map((g) => g.standardIds.length),
    0
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
              {Array.from({ length: maxStandards }, (_, i) => {
                const firstGroupStandardId =
                  groupedStandards[0]?.standardIds[i];
                const standardInfo = firstGroupStandardId
                  ? standardsMapping[firstGroupStandardId]
                  : null;
                return (
                  <TableHead
                    key={i}
                    className="bg-primary text-primary-foreground font-semibold text-xs px-2"
                    style={{ width: `${(100 - 20) / maxStandards}%` }}
                  >
                    {standardInfo
                      ? `${standardInfo.name} (${standardInfo.points})`
                      : ""}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedStandards.map(
              ({ groupId, groupInfo, standardIds }, groupIndex) => (
                <TableRow
                  key={groupId}
                  className={groupIndex % 2 === 1 ? "bg-secondary/20" : ""}
                >
                  <TableCell
                    className="font-medium align-top p-2 text-xs"
                    style={{ width: "20%" }}
                  >
                    <HoverCard openDelay={200} closeDelay={150}>
                      <HoverCardTrigger asChild>
                        <div className="break-words whitespace-normal overflow-hidden cursor-pointer px-2 py-1 rounded-sm hover:bg-accent/40">
                          {groupInfo?.name || "Unknown Group"}
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent side="right" className="w-80">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold">
                            Standards in this group
                          </div>
                          {standardIds.length === 0 ? (
                            <div className="text-xs text-muted-foreground">
                              No standards in this group.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-1">
                              {standardIds.map((standardId) => {
                                const standardInfo =
                                  standardsMapping[standardId];
                                const isAchievedForS =
                                  isStandardAchieved(standardId);
                                return (
                                  <div
                                    key={standardId}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <span
                                      className={
                                        isAchievedForS
                                          ? "font-semibold"
                                          : "text-muted-foreground"
                                      }
                                    >
                                      {standardInfo?.name || "Unknown"} (
                                      {standardInfo?.points || 0})
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
                    const standardId = standardIds[standardIndex];
                    if (!standardId) {
                      return (
                        <TableCell
                          key={standardIndex}
                          className="whitespace-normal text-xs align-top p-2"
                        ></TableCell>
                      );
                    }

                    const standardInfo = standardsMapping[standardId];
                    if (!standardInfo) {
                      return (
                        <TableCell
                          key={standardIndex}
                          className="whitespace-normal text-xs align-top p-2"
                        ></TableCell>
                      );
                    }

                    const isAchieved = isStandardAchieved(standardId);
                    const isPassed = isStandardPassed(standardId);
                    const shouldHighlightCell = isAchieved; // Only the achieved cell

                    return (
                      <TableCell
                        key={standardId}
                        className={`whitespace-normal text-xs relative align-top p-2 ${
                          // If flipped on an achieved cell, force white background to show the standard cleanly
                          isAchieved && flippedCells.has(standardId)
                            ? "bg-white dark:bg-white/10"
                            : shouldHighlightCell
                              ? isPassed
                                ? "bg-green-200 dark:bg-green-900/40" // Green if passed
                                : "bg-red-200 dark:bg-red-900/40" // Red if not passed
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
                                if (next.has(standardId))
                                  next.delete(standardId);
                                else next.add(standardId);
                                return next;
                              });
                            }
                          }
                        }}
                        onClick={() => {
                          if (isAchieved) {
                            setFlippedCells((prev) => {
                              const next = new Set(prev);
                              if (next.has(standardId)) next.delete(standardId);
                              else next.add(standardId);
                              return next;
                            });
                            return;
                          }
                        }}
                      >
                        {(() => {
                          const isFlippable = isAchieved; // flip only on achieved cell
                          const isFlipped = flippedCells.has(standardId);

                          /* If we're ABOUT to show the back (isFlipped true), spin forward (+1).
                             If we're ABOUT to show the front (isFlipped false), spin backward (-1). */
                          const dir = isFlipped ? 1 : -1;

                          // Get feedback for this standard
                          const feedbackText =
                            gradingState?.feedbackByStandardId?.[standardId];

                          const frontContent = (
                            <div className="text-xs leading-tight">
                              {feedbackText || standardInfo.description}
                            </div>
                          );
                          const backContent = (
                            <div className="text-xs leading-tight">
                              {standardInfo.description}
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

      {/* Rubric summary (description from grading state) */}
      {gradingState?.gradeDescription && (
        <div className="border rounded-md p-4 bg-card">
          <div className="text-sm font-semibold mb-2">Rubric summary</div>
          <div className="text-sm whitespace-pre-wrap">
            {gradingState.gradeDescription}
          </div>
        </div>
      )}
    </div>
  );
}
