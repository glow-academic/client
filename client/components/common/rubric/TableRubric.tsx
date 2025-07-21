/**
 * TableRubric.tsx
 * Used to display a rubric in a table format
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { getRubric } from "@/utils/queries/rubrics/get-rubric";
import { getStandardGroupsByRubric } from "@/utils/queries/standard_groups/get-standard-groups-by-rubric";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { StandardGroup, Standard } from "@/types";

export interface TableRubricProps {
    rubricId: string;
    simulationChatId?: string;
}

export default function TableRubric({ rubricId, simulationChatId }: TableRubricProps) {
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
        queryKey: ["standards", standardGroups?.map((group: StandardGroup) => group.id)],
        queryFn: () => getStandardsByStandardGroups(standardGroups!.map((group: StandardGroup) => group.id)),
        enabled: !!standardGroups && standardGroups.length > 0,
    });

    // Fetch grades and feedback for simulation chats
    const { data: simulationGrades, isLoading: loadingSimulationGrades } = useQuery({
        queryKey: ["simulationGrades", simulationChatId],
        queryFn: () => getSimulationChatGradesBySimulationChats([simulationChatId!]),
        enabled: !!simulationChatId,
    });

    const { data: simulationFeedbacks, isLoading: loadingSimulationFeedbacks } = useQuery({
        queryKey: ["simulationFeedbacks", simulationGrades?.map((grade) => grade.id)],
        queryFn: () => getSimulationChatFeedbacksBySimulationChatGrades(simulationGrades!.map((grade) => grade.id)),
        enabled: !!simulationGrades && simulationGrades.length > 0,
    });

    // Get the appropriate grade and feedback data
    const grades = simulationGrades;
    const feedbacks = simulationFeedbacks;
    const chatGrade = grades?.[0]; // Assuming one grade per chat

    // Helper function to get feedback for a specific standard
    const getFeedbackForStandard = (standardId: string) => {
        if (!feedbacks || !chatGrade) return null;
        return feedbacks.find(feedback => {
            if (feedback.standardId !== standardId) return false;
            return 'simulationChatGradeId' in feedback && feedback.simulationChatGradeId === chatGrade.id;
        });
    };

    // Helper function to determine if a standard was achieved
    const isStandardAchieved = (standard: Standard, groupStandards: Standard[]) => {
        const feedback = getFeedbackForStandard(standard.id);
        if (!feedback) return false;

        // Find the highest achieved standard in this group
        const groupFeedbacks = groupStandards
            .map(s => getFeedbackForStandard(s.id))
            .filter(Boolean);

        if (groupFeedbacks.length === 0) return false;

        const maxScore = Math.max(...groupFeedbacks.map(f => f!.total));
        return feedback.total === maxScore;
    };

    // Helper function to determine if a standard should be highlighted (achieved or below achieved)
    const shouldHighlight = (standard: Standard, groupStandards: Standard[]) => {
        const feedback = getFeedbackForStandard(standard.id);
        if (!feedback) return false;

        // Find the achieved standard in this group
        const achievedStandard = groupStandards.find(s => isStandardAchieved(s, groupStandards));
        if (!achievedStandard) return false;

        // Highlight if this standard's points are <= achieved standard's points
        return standard.points <= achievedStandard.points;
    };

    if (loadingRubric || loadingStandardGroups || loadingStandards || loadingSimulationGrades || loadingSimulationFeedbacks) {
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
    const groupedStandards = standardGroups?.map((group: StandardGroup) => ({
        group,
        standards: standards!
            .filter((standard: Standard) => standard.standardGroupId === group.id)
            .sort((a, b) => b.points - a.points), // Sort by points descending (Level 5 to Level 1)
    }));

    // Determine the maximum number of standards across all groups for consistent column count
    const maxStandards = Math.max(...groupedStandards!.map(g => g.standards.length));

    return (
        <div className="space-y-4 w-full">
            <div className="overflow-auto max-h-[70vh]">
                <Table className="min-w-[600px] text-sm table-fixed">
                    <TableHeader className="sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="bg-primary text-primary-foreground font-semibold text-xs" style={{ width: '20%' }}>
                                Criteria
                            </TableHead>
                            {Array.from({ length: maxStandards }, (_, i) => (
                                <TableHead key={i} className="bg-primary text-primary-foreground font-semibold text-xs px-2" style={{ width: `${(100 - 20) / maxStandards}%` }}>
                                    {groupedStandards![0]?.standards[i]?.name} ({groupedStandards![0]?.standards[i]?.points})
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedStandards!.map(({ group, standards: groupStandards }, groupIndex) => (
                            <TableRow key={group.id} className={groupIndex % 2 === 1 ? "bg-secondary/20" : ""}>
                                <TableCell className="font-medium align-top p-2 text-xs" style={{ width: '20%' }}>
                                    <div className="break-words whitespace-normal overflow-hidden">{group.name}</div>
                                </TableCell>
                                {Array.from({ length: maxStandards }, (_, standardIndex) => {
                                    const standard = groupStandards[standardIndex];
                                    if (!standard) {
                                        return <TableCell key={standardIndex} className="whitespace-normal text-xs align-top p-2"></TableCell>;
                                    }

                                    const feedback = getFeedbackForStandard(standard.id);
                                    const isAchieved = isStandardAchieved(standard, groupStandards);
                                    const shouldHighlightCell = shouldHighlight(standard, groupStandards);

                                    return (
                                        <TableCell 
                                            key={standard.id} 
                                            className={`whitespace-normal text-xs relative align-top p-2 ${shouldHighlightCell
                                                ? isAchieved
                                                    ? "bg-green-200 dark:bg-green-900/40"
                                                    : "bg-green-100 dark:bg-green-900/20"
                                                : ""
                                            }`}
                                        >
                                            <div className="space-y-1">
                                                {isAchieved && feedback ? (
                                                    <div className="text-xs leading-tight">{feedback.feedback}</div>
                                                ) : <div className="text-xs leading-tight">
                                                    {standard.description}
                                                </div>}
                                            </div>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}