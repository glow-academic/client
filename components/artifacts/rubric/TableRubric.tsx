/**
 * TableRubric.tsx
 * Used to display a rubric in a table format
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import * as React from "react";
import { Loader2, TableProperties } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

type GradingState = {
  achievedStandards: Record<string, boolean>;
  passedStandards: Record<string, boolean>;
  feedbackByStandardId?: Record<string, string> | undefined;
} | null;

type AnalysisEntry = {
  content?: string | null;
};

export interface TableRubricProps {
  // Core rubric structure (from V2 API)
  standardGroups: Record<string, string[]>; // group_id -> [standard_ids]
  standardGroupsMapping: Record<string, StandardGroupMappingItem>;
  standardsMapping: Record<string, StandardMappingItem>;

  // Optional: grading state for visualization (from v2 server-side)
  gradingState?: GradingState;

  // Optional: analyses entries (chat-level analysis content)
  analyses?: AnalysisEntry[] | null;

  // Optional: show full standards table on mobile (with horizontal scroll)
  // When false (default), shows simplified 2-column view on mobile
  showFullStandardsOnMobile?: boolean;

  // Identifiers used by the mobile "Open Full Rubric" PDF button.
  // The button is only rendered when both are set and gradingState
  // exists — matches v1 parity (post-grading only).
  rubricId?: string | null;
  chatId?: string | null;
}

export default function TableRubric({
  standardGroups,
  standardGroupsMapping,
  standardsMapping,
  gradingState,
  analyses,
  showFullStandardsOnMobile = false,
  rubricId,
  chatId,
}: TableRubricProps) {
  const [flippedCells, setFlippedCells] = React.useState<Set<string>>(
    () => new Set<string>(),
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  // v1 parity: only surface the download affordance once the chat has
  // a grade overlay. Without one the PDF would be an empty template
  // which isn't a useful action from this surface.
  const canDownload = Boolean(rubricId && chatId && gradingState);

  const handleDownloadPdf = React.useCallback(async () => {
    // Open the target window SYNCHRONOUSLY inside the click handler —
    // Safari (iOS) strips the user-gesture token from an async
    // window.open, which breaks the tab open after fetch resolves.
    // Match v1's pattern exactly: open now, redirect once the blob URL
    // is ready.
    const newWindow = window.open("", "_blank");
    setIsGeneratingPdf(true);
    try {
      const res = await fetch("/api/rubric/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rubric_id: rubricId, chat_id: chatId }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (newWindow) {
        newWindow.location.href = url;
      } else {
        // Fallback — browser blocked the synchronous open (rare).
        window.open(url, "_blank");
      }
    } catch {
      newWindow?.close();
      toast.error("Failed to generate rubric PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [rubricId, chatId]);

  // Helper function to determine if a standard was achieved (from server-computed state)
  const isStandardAchieved = (standardId: string) => {
    if (!gradingState) return false;
    return gradingState.achievedStandards?.[standardId] || false;
  };

  // Helper function to determine if a standard has been passed (from server-computed state)
  const isStandardPassed = (standardId: string) => {
    if (!gradingState) return false;
    return gradingState.passedStandards?.[standardId] || false;
  };

  // Group standards by standard group using props data
  const groupedStandards = Object.entries(standardGroups).map(
    ([groupId, standardIds]) => {
      const groupInfo = standardGroupsMapping[groupId];
      return {
        groupId,
        groupInfo,
        standardIds: [...standardIds].sort((a, b) => {
          // Sort by points descending (Level 5 to Level 1)
          const aPoints = standardsMapping[a]?.points || 0;
          const bPoints = standardsMapping[b]?.points || 0;
          return bPoints - aPoints;
        }),
      };
    },
  );

  const scoreColumns = Array.from(
    groupedStandards
      .flatMap((group) =>
        group.standardIds
          .map((standardId) => standardsMapping[standardId])
          .filter((standard): standard is StandardMappingItem =>
            Boolean(standard),
          ),
      )
      .reduce((columns, standard) => {
        const existing = columns.get(standard.points);
        if (!existing || standard.name.length > existing.name.length) {
          columns.set(standard.points, standard);
        }
        return columns;
      }, new Map<number, StandardMappingItem>())
      .values(),
  ).sort((a, b) => b.points - a.points);

  // Determine the maximum number of standards across all groups for consistent column count
  const maxStandards = scoreColumns.length;

  // Mobile-only "Open Full Rubric" affordance. Matches v1 — the
  // simplified 2-column mobile view can't show per-cell feedback
  // density, so we offer the full PDF as an out-of-band view.
  // Rendered between the criteria table and the analyses block so the
  // user sees the summary scores first, then the affordance to expand,
  // then the coach-style analyses (matches v1 ordering).
  const downloadButton = canDownload ? (
    <Button
      variant="default"
      size="sm"
      className="w-full md:hidden"
      disabled={isGeneratingPdf}
      onClick={handleDownloadPdf}
      data-testid="rubric-open-full-button"
    >
      {isGeneratingPdf ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Generating...
        </>
      ) : (
        <>
          <TableProperties className="h-4 w-4 mr-2" />
          Open Full Rubric
        </>
      )}
    </Button>
  ) : null;

  return (
    <div className="space-y-6 w-full">
      {/* Mobile: 2-column simplified view (only when showFullStandardsOnMobile is false) */}
      {!showFullStandardsOnMobile && (
        <div className="md:hidden space-y-4">
          <div className="border-l border-r border-b border-border">
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold border-r border-border">
                    Criteria
                  </TableHead>
                  <TableHead className="w-24 font-semibold">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedStandards.map(
                  ({ groupId, groupInfo, standardIds }, groupIndex) => {
                    // Find achieved standard for this group
                    const achievedStandardId = standardIds.find((sid) =>
                      isStandardAchieved(sid),
                    );
                    const achievedStandard = achievedStandardId
                      ? standardsMapping[achievedStandardId]
                      : null;
                    const isPassed = achievedStandardId
                      ? isStandardPassed(achievedStandardId)
                      : false;
                    const isFlipped = achievedStandardId
                      ? flippedCells.has(achievedStandardId)
                      : false;

                    return (
                      <TableRow
                        key={groupId}
                        className={
                          groupIndex % 2 === 1 ? "bg-secondary/20" : ""
                        }
                      >
                        <TableCell className="font-medium p-2 text-xs border-r border-border">
                          <div className="break-words whitespace-normal">
                            {groupInfo?.name || "Unknown Group"}
                          </div>
                        </TableCell>
                        <TableCell
                          className={`p-2 text-xs cursor-pointer transition-colors ${
                            isPassed
                              ? "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50"
                              : achievedStandard
                                ? "bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50"
                                : ""
                          }`}
                          onClick={() => {
                            if (achievedStandardId) {
                              setFlippedCells((prev) => {
                                const next = new Set(prev);
                                if (next.has(achievedStandardId)) {
                                  next.delete(achievedStandardId);
                                } else {
                                  next.add(achievedStandardId);
                                }
                                return next;
                              });
                            }
                          }}
                        >
                          {achievedStandard ? (
                            <div className="text-center">
                              {isFlipped ? (
                                <div className="text-xs whitespace-normal break-words">
                                  {gradingState?.feedbackByStandardId?.[
                                    achievedStandardId || ""
                                  ] || "No feedback provided"}
                                </div>
                              ) : (
                                <div className="font-semibold">
                                  {achievedStandard.name} (
                                  {achievedStandard.points})
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {isFlipped
                                  ? "Tap to show name"
                                  : "Tap to show feedback"}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center text-muted-foreground">
                              No score
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  },
                )}
              </TableBody>
            </Table>
          </div>

          {/* Open Full Rubric — between criteria table and analyses. */}
          {downloadButton}

          {/* Rubric summary (analyses) - mobile view */}
          {analyses && analyses.length > 0 && (
            <div className="space-y-2 pt-0">
              {analyses.map((entry, idx) => (
                <div key={idx} className="text-sm whitespace-pre-wrap">
                  {entry.content}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Desktop: Full table view (also shown on mobile when showFullStandardsOnMobile is true) */}
      <div
        className={
          showFullStandardsOnMobile ? "block w-full" : "hidden md:block w-full"
        }
      >
        <div className="space-y-4">
          <div className="border-l border-r border-b border-border">
            <div className="overflow-x-auto">
              <Table className="min-w-[600px] text-sm table-fixed">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead
                      className="bg-primary text-primary-foreground font-semibold text-sm py-3 border-r border-border"
                      style={{ width: "20%" }}
                    >
                      Criteria
                    </TableHead>
                    {scoreColumns.map((standardInfo, i) => {
                      const isLast = i === maxStandards - 1;
                      return (
                        <TableHead
                          key={standardInfo.points}
                          className={`bg-primary text-primary-foreground font-semibold text-sm px-2 py-3 ${
                            !isLast ? "border-r border-border" : ""
                          }`}
                          style={{ width: `${(100 - 20) / maxStandards}%` }}
                        >
                          {`${standardInfo.name} (${standardInfo.points})`}
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
                        className={
                          groupIndex % 2 === 1 ? "bg-secondary/20" : ""
                        }
                      >
                        <TableCell
                          className="font-medium align-top p-2 text-xs border-r border-border"
                          style={{ width: "20%" }}
                        >
                          <div className="break-words whitespace-normal overflow-hidden px-2 py-1">
                            {groupInfo?.name || "Unknown Group"}
                          </div>
                        </TableCell>
                        {Array.from(
                          { length: maxStandards },
                          (_, standardIndex) => {
                            const scoreColumn = scoreColumns[standardIndex];
                            const standardId = standardIds.find(
                              (id) =>
                                standardsMapping[id]?.points ===
                                scoreColumn?.points,
                            );
                            const isLast = standardIndex === maxStandards - 1;
                            if (!standardId) {
                              return (
                                <TableCell
                                  key={standardIndex}
                                  className={`whitespace-normal text-xs align-top p-2 ${
                                    !isLast ? "border-r border-border" : ""
                                  }`}
                                ></TableCell>
                              );
                            }

                            const standardInfo = standardsMapping[standardId];
                            if (!standardInfo) {
                              return (
                                <TableCell
                                  key={standardIndex}
                                  className={`whitespace-normal text-xs align-top p-2 ${
                                    !isLast ? "border-r border-border" : ""
                                  }`}
                                ></TableCell>
                              );
                            }

                            const isAchieved = isStandardAchieved(standardId);
                            const isPassed = isStandardPassed(standardId);
                            const shouldHighlightCell = isAchieved; // Only the achieved cell

                            return (
                              <TableCell
                                key={standardIndex}
                                className={`whitespace-normal text-xs relative align-top p-2 ${
                                  !isLast ? "border-r border-border" : ""
                                } ${
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
                                      "textarea, input, button, select, [contenteditable='true']",
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
                                      if (next.has(standardId))
                                        next.delete(standardId);
                                      else next.add(standardId);
                                      return next;
                                    });
                                    return;
                                  }
                                }}
                              >
                                {(() => {
                                  const isFlippable = isAchieved; // flip only on achieved cell
                                  const isFlipped =
                                    flippedCells.has(standardId);

                                  /* If we're ABOUT to show the back (isFlipped true), spin forward (+1).
                               If we're ABOUT to show the front (isFlipped false), spin backward (-1). */
                                  const dir = isFlipped ? 1 : -1;

                                  // Get feedback for this standard
                                  const feedbackText =
                                    gradingState?.feedbackByStandardId?.[
                                      standardId
                                    ];

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
                                      <div className="face front">
                                        {frontContent}
                                      </div>
                                      <div className="face back">
                                        {backContent}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      {frontContent}
                                    </div>
                                  );

                                  return card;
                                })()}
                              </TableCell>
                            );
                          },
                        )}
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Rubric summary (analyses) - inside scrollable area */}
          {analyses && analyses.length > 0 && (
            <div className="space-y-2 pt-0 px-2">
              {analyses.map((entry, idx) => (
                <div key={idx} className="text-sm whitespace-pre-wrap">
                  {entry.content}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
