/**
 * Classes.tsx
 * Classes page for the management section.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, compareAsc, startOfDay, subDays } from "date-fns";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
    LineChart,
    Line,
    BarChart as RechartsBarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllUsers } from "@/utils/queries/users/get-all-users";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getSimulationAttemptsByUsers } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-users";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAgentConfig } from "@/utils/agents";

// Color palette for charts
const COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  pink: "#ec4899",
  teal: "#14b8a6",
  orange: "#f97316",
};

export default function ClassesGeneralPage() {
    // Fetch all data for aggregated view
    const { data: classes = [], isLoading: isLoadingClasses } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getAllClasses(),
    });

    const { data: users, isLoading: isLoadingUsers } = useQuery({
        queryKey: ["users"],
        queryFn: () => getAllUsers(),
    });

    const { data: agents, isLoading: isLoadingAgents } = useQuery({
        queryKey: ["agents"],
        queryFn: () => getAllAgents(),
    });

    const { data: scenarios, isLoading: isLoadingScenarios } = useQuery({
        queryKey: ["scenarios"],
        queryFn: () => getAllScenarios(),
    });

    const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
        queryKey: ["rubrics"],
        queryFn: () => getAllRubrics(),
    });

    const { data: standardGroups, isLoading: isLoadingStandardGroups } = useQuery({
        queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
        queryFn: () => getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
        enabled: !!rubrics && rubrics.length > 0,
    });

    const { data: standards, isLoading: isLoadingStandards } = useQuery({
        queryKey: ["standards", standardGroups?.map((group) => group.id)],
        queryFn: () => getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
        enabled: !!standardGroups && standardGroups.length > 0,
    });

    const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
        queryKey: ["simulationAttempts", users?.map((user) => user.id)],
        queryFn: () => getSimulationAttemptsByUsers(users!.map((user) => user.id)),
        enabled: !!users && users.length > 0,
    });

    const { data: chats, isLoading: isLoadingChats } = useQuery({
        queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
        queryFn: () => getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
        enabled: !!attempts && attempts.length > 0,
    });

    const { data: grades, isLoading: isLoadingGrades } = useQuery({
        queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
        queryFn: () => getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
        enabled: !!chats && chats.length > 0,
    });

    const { data: feedbacks, isLoading: isLoadingFeedbacks } = useQuery({
        queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
        queryFn: () => getSimulationChatFeedbacksBySimulationChatGrades(grades!.map((grade) => grade.id)),
        enabled: !!grades && grades.length > 0,
    });

    // Calculate analytics data
    const analytics = useMemo(() => {
        if (!users || !chats || !grades || !agents || !scenarios || !feedbacks || !standards || !standardGroups) return null;

        const tas = users.filter((user) => user.role === "ta");
        const completedChats = chats.filter((chat) => chat.completed);
        const totalSessions = chats.length;
        const completionRate = totalSessions > 0 ? (completedChats.length / totalSessions) * 100 : 0;

        // Calculate overall average score from grades
        const avgOverallScore = grades.length > 0
            ? Math.round((grades.reduce((sum, g) => sum + g.score, 0) / grades.length))
            : 0;

        // Calculate average training time from grades (convert seconds to minutes)
        const avgTrainingTime = grades.length > 0 
            ? Math.round(grades.reduce((sum, g) => sum + g.timeTaken, 0) / grades.length / 60)
            : 0;

        return {
            totalTAs: tas.length,
            totalSessions,
            completionRate,
            avgOverallScore,
            avgTrainingTime,
        };
    }, [users, chats, grades, agents, scenarios, feedbacks, standards, standardGroups]);

    // Generate aggregated score trend data (last 7 days) using grades
    const scoreTrendData = useMemo(() => {
        if (!grades || grades.length === 0) return [];

        const today = startOfDay(new Date());
        const dates: Record<string, { date: Date; scores: number[] }> = {};

        // Initialize last 7 days
        for (let i = 0; i < 7; i++) {
            const date = subDays(today, i);
            const dateStr = format(date, "yyyy-MM-dd");
            dates[dateStr] = { date, scores: [] };
        }

        // Group scores by date using grades data
        grades.forEach((grade) => {
            const createdAt = new Date(grade.createdAt);
            const dateStr = format(createdAt, "yyyy-MM-dd");

            if (dates[dateStr]) {
                dates[dateStr].scores.push(grade.score);
            }
        });

        // Calculate average score for each day
        return Object.entries(dates)
            .map(([_, data]) => {
                const avgScore =
                    data.scores.length > 0
                        ? Math.round(
                            data.scores.reduce((sum, score) => sum + score, 0) /
                            data.scores.length,
                        )
                        : 0;

                return {
                    date: format(data.date, "MM-dd"),
                    avgScore,
                };
            })
            .sort((a, b) => compareAsc(new Date(`2024-${a.date}`), new Date(`2024-${b.date}`)));
    }, [grades]);

    // Generate student personality distribution data based on actual agent usage
    const personalityData = useMemo(() => {
        if (!chats || !agents || !scenarios) return [];

        // Count sessions by agent personality
        const personalityCounts = agents
            .filter(agent => agent.agentType === 'student')
            .map((agent) => {
                const agentScenarios = scenarios.filter(s => s.agentId === agent.id);
                const agentChats = chats.filter(chat => 
                    agentScenarios.some(scenario => scenario.id === chat.scenarioId)
                );

                const config = getAgentConfig(agent.name);
                return {
                    personality: agent.name,
                    value: agentChats.length,
                    fill: config.colors.bgColor.includes('blue') ? COLORS.primary :
                          config.colors.bgColor.includes('green') ? COLORS.success :
                          config.colors.bgColor.includes('red') ? COLORS.danger :
                          config.colors.bgColor.includes('yellow') ? COLORS.warning :
                          COLORS.purple,
                };
            })
            .filter(item => item.value > 0); // Only include personalities that have been used

        return personalityCounts;
    }, [chats, agents, scenarios]);

    // Performance by class data
    const classPerformanceData = useMemo(() => {
        if (!classes || !attempts || !grades || !chats) return [];

        return classes.map((classItem) => {
            const classAttempts = attempts.filter(attempt => attempt.classId === classItem.id);
            const classChats = chats.filter(chat => 
                classAttempts.some(attempt => attempt.id === chat.attemptId)
            );
            const classGrades = grades.filter(grade =>
                classChats.some(chat => chat.id === grade.simulationChatId)
            );

            const avgScore = classGrades.length > 0
                ? Math.round(classGrades.reduce((sum, g) => sum + g.score, 0) / classGrades.length)
                : 0;

            return {
                className: classItem.name || classItem.classCode || `Class ${classItem.id.slice(0, 8)}`,
                avgScore,
                sessions: classChats.length,
                completedSessions: classChats.filter(chat => chat.completed).length,
            };
        }).filter(item => item.sessions > 0); // Only show classes with activity
    }, [classes, attempts, grades, chats]);

    // Loading state
    if (
        isLoadingClasses ||
        isLoadingUsers ||
        isLoadingAgents ||
        isLoadingScenarios ||
        isLoadingRubrics ||
        isLoadingStandardGroups ||
        isLoadingStandards ||
        isLoadingAttempts ||
        isLoadingChats ||
        isLoadingGrades ||
        isLoadingFeedbacks
    ) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground">Loading class analytics...</p>
                </div>
            </div>
        );
    }

    if (!analytics) return null;

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{classes.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Active classes in system
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total TAs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.totalTAs}</div>
                        <p className="text-xs text-muted-foreground">
                            Teaching assistants
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.totalSessions}</div>
                        <p className="text-xs text-muted-foreground">
                            Training interactions
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.avgOverallScore}%</div>
                        <p className="text-xs text-muted-foreground">
                            Overall TA performance
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Trend Charts */}
            <Card>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Line Chart - Score Trends */}
                    <div className="h-80">
                        <h3 className="text-sm font-medium mb-2">
                            Average Score Trend (Last 7 Days)
                        </h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <LineChart data={scoreTrendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" axisLine={true} tickLine={true} />
                                <YAxis domain={[0, 100]} />
                                <Tooltip 
                                    formatter={(value: number) => [`${value}%`, 'Average Score']}
                                    labelFormatter={(label) => `Date: ${label}`}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="avgScore"
                                    stroke={COLORS.primary}
                                    strokeWidth={2}
                                    name="Avg. Score"
                                    dot={{ r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Pie Chart - Student Personality Distribution */}
                    <div className="h-80">
                        <h3 className="text-sm font-medium mb-2">
                            Student Personality Distribution
                        </h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <PieChart>
                                <Pie
                                    data={personalityData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ personality, value, percent }) => 
                                        `${personality}: ${(percent * 100).toFixed(0)}%`
                                    }
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {personalityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(value: number) => [`${value}`, 'Sessions']}
                                    labelFormatter={(label) => `${label} Students`}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Class Performance Breakdown */}
            {classPerformanceData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Performance by Class</CardTitle>
                        <CardDescription>
                            Individual class performance metrics and activity levels
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsBarChart
                                    data={classPerformanceData}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="className" 
                                        axisLine={true} 
                                        tickLine={true}
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                    />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip 
                                        formatter={(value: number, name: string) => [
                                            name === 'avgScore' ? `${value}%` : value,
                                            name === 'avgScore' ? 'Average Score' : 
                                            name === 'sessions' ? 'Total Sessions' : 'Completed Sessions'
                                        ]}
                                        labelFormatter={(label) => `Class: ${label}`}
                                    />
                                    <Bar
                                        dataKey="avgScore"
                                        fill={COLORS.primary}
                                        name="Average Score"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </RechartsBarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Completion Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {Math.round(analytics.completionRate)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Sessions completed successfully
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Avg Training Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">
                            {analytics.avgTrainingTime}min
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Per training session
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Active Personalities</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            {personalityData.length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Student types in use
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}