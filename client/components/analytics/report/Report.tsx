/**
 * Report.tsx
 * Used to display the individual report for a specific student/TA with detailed metrics and charts.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProfile } from "@/utils/queries/profiles/get-profile";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle,
  Clock,
  GraduationCap,
  Target,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

// Chart configurations
const timeChartConfig = {
  score: {
    label: "Score",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const skillsChartConfig = {
  score: {
    label: "Performance Score",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const sessionChartConfig = {
  completed: {
    label: "Completed",
    color: "hsl(var(--chart-3))",
  },
  total: {
    label: "Total",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

// Helper function to get initials
const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

// Helper function to get role badge variant
const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "admin":
      return "destructive";
    case "instructor":
      return "default";
    case "ta":
      return "secondary";
    default:
      return "outline";
  }
};

// Helper function to get role display name
const getRoleDisplayName = (role: string) => {
  switch (role) {
    case "admin":
      return "Administrator";
    case "instructor":
      return "Instructor";
    case "ta":
      return "Teaching Assistant";
    default:
      return role;
  }
};

export interface ReportProps {
  profileId: string;
}

export default function Report({ profileId }: ReportProps) {
  // Fetch profile data
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => getProfile(profileId),
  });

  // Fetch related data
  const { data: simulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups } = useQuery({
    queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
    queryFn: () =>
      getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
    enabled: !!rubrics && rubrics.length > 0,
  });

  const { data: standards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: attempts } = useQuery({
    queryKey: ["simulationAttempts", profileId],
    queryFn: () => getSimulationAttemptsByProfiles([profileId]),
    enabled: !!profileId,
  });

  const { data: chats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: feedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id)
      ),
    enabled: !!grades && grades.length > 0,
  });

  // Calculate analytics
  const analytics = useMemo(() => {
    if (
      !profile ||
      !chats ||
      !grades ||
      !feedbacks ||
      !standards ||
      !standardGroups ||
      !rubrics ||
      !attempts
    )
      return null;

    const profileAttempts = attempts.filter(
      (attempt) => attempt.profileId === profileId
    );
    const profileChats = chats.filter((chat) =>
      profileAttempts.some((attempt) => attempt.id === chat.attemptId)
    );
    const profileGrades = grades.filter((grade) =>
      profileChats.some((chat) => chat.id === grade.simulationChatId)
    );
    const profileFeedbacks = feedbacks.filter((f) =>
      profileGrades.some((g) => g.id === f.simulationChatGradeId)
    );

    // Basic metrics - calculate avgScore using rubric points
    let avgScore = 0;
    if (profileGrades.length > 0) {
      const scoreSum = profileGrades.reduce((sum, grade) => {
        const chat = profileChats.find((c) => c.id === grade.simulationChatId);
        const attempt = profileAttempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations?.find(
          (s) => s.id === attempt?.simulationId
        );
        const rubric = rubrics?.find((r) => r.id === simulation?.rubricId);
        const rubricTotalPoints = rubric?.points || 100;
        const scorePercent = Math.round(
          (grade.score / rubricTotalPoints) * 100
        );
        return sum + scorePercent;
      }, 0);
      avgScore = Math.round(scoreSum / profileGrades.length);
    }

    const completedSessions = profileChats.filter(
      (chat) => chat.completed
    ).length;
    const totalSessions = profileChats.length;
    const completionRate =
      totalSessions > 0
        ? Math.round((completedSessions / totalSessions) * 100)
        : 0;

    const passRate =
      profileGrades.length > 0
        ? Math.round(
            (profileGrades.filter((g) => g.passed).length /
              profileGrades.length) *
              100
          )
        : 0;

    const avgTimeMinutes =
      profileGrades.length > 0
        ? Math.round(
            profileGrades.reduce((sum, g) => sum + g.timeTaken, 0) /
              profileGrades.length /
              60
          )
        : 0;

    // Skill breakdown
    const validRubrics = rubrics?.filter((r) =>
      simulations?.some((s) => s.rubricId === r.id)
    );
    const validGroupStandards = standardGroups?.filter((g) =>
      validRubrics?.some((r) => r.id === g.rubricId)
    );
    const validStandards = standards?.filter((s) =>
      validGroupStandards?.some((g) => g.id === s.standardGroupId)
    );

    const skillBreakdown = validGroupStandards.map((group) => {
      const groupStandards = validStandards.filter(
        (s) => s.standardGroupId === group.id
      );
      const groupFeedbacks = profileFeedbacks.filter((f) =>
        groupStandards.some((s) => s.id === f.standardId)
      );

      const avgSkillScore =
        groupFeedbacks.length > 0
          ? Math.round(
              (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
                groupFeedbacks.length) *
                10
            ) / 10 // Round to 1 decimal place, score out of 5
          : 0;

      return {
        skill: group.shortName,
        score: avgSkillScore,
        feedbackCount: groupFeedbacks.length,
        fullName: group.name,
      };
    });

    // Performance over time - calculate scores using rubric points
    const sortedGrades = [...profileGrades].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const performanceOverTime = sortedGrades.map((grade, index) => {
      const chat = profileChats.find((c) => c.id === grade.simulationChatId);
      const attempt = profileAttempts.find((a) => a.id === chat?.attemptId);
      const simulation = simulations?.find(
        (s) => s.id === attempt?.simulationId
      );
      const rubric = rubrics?.find((r) => r.id === simulation?.rubricId);
      const rubricTotalPoints = rubric?.points || 100;
      const scorePercent = Math.round((grade.score / rubricTotalPoints) * 100);

      return {
        session: index + 1,
        score: scorePercent,
        date: format(new Date(grade.createdAt), "MM/dd"),
        passed: grade.passed,
        timeTaken: Math.round(grade.timeTaken / 60), // Convert to minutes
      };
    });

    // Trend calculation using rubric-based scores
    let trend = "stable";
    if (sortedGrades.length >= 3) {
      const firstThree = sortedGrades.slice(0, 3);
      const lastThree = sortedGrades.slice(-3);

      // Calculate first three average using rubric points
      const firstAvg =
        firstThree.reduce((sum, grade) => {
          const chat = profileChats.find(
            (c) => c.id === grade.simulationChatId
          );
          const attempt = profileAttempts.find((a) => a.id === chat?.attemptId);
          const simulation = simulations?.find(
            (s) => s.id === attempt?.simulationId
          );
          const rubric = rubrics?.find((r) => r.id === simulation?.rubricId);
          const rubricTotalPoints = rubric?.points || 100;
          const scorePercent = Math.round(
            (grade.score / rubricTotalPoints) * 100
          );
          return sum + scorePercent;
        }, 0) / firstThree.length;

      // Calculate last three average using rubric points
      const lastAvg =
        lastThree.reduce((sum, grade) => {
          const chat = profileChats.find(
            (c) => c.id === grade.simulationChatId
          );
          const attempt = profileAttempts.find((a) => a.id === chat?.attemptId);
          const simulation = simulations?.find(
            (s) => s.id === attempt?.simulationId
          );
          const rubric = rubrics?.find((r) => r.id === simulation?.rubricId);
          const rubricTotalPoints = rubric?.points || 100;
          const scorePercent = Math.round(
            (grade.score / rubricTotalPoints) * 100
          );
          return sum + scorePercent;
        }, 0) / lastThree.length;

      if (lastAvg > firstAvg + 5) trend = "improving";
      else if (lastAvg < firstAvg - 5) trend = "declining";
    }

    // Find weakest and strongest skills
    const weakestSkill = skillBreakdown.reduce(
      (min, skill) => (skill.score < min.score ? skill : min),
      skillBreakdown[0] || { skill: "Unknown", score: 100, feedbackCount: 0 }
    );

    const strongestSkill = skillBreakdown.reduce(
      (max, skill) => (skill.score > max.score ? skill : max),
      skillBreakdown[0] || { skill: "Unknown", score: 0, feedbackCount: 0 }
    );

    // Session type breakdown
    const sessionTypes = profileChats.reduce(
      (acc, chat) => {
        if (chat.completed) {
          acc.completed++;
        } else {
          acc.incomplete++;
        }
        return acc;
      },
      { completed: 0, incomplete: 0 }
    );

    const sessionTypeData = [
      { type: "Completed", count: sessionTypes.completed },
      { type: "Incomplete", count: sessionTypes.incomplete },
    ];

    // Determine status
    const isStruggling =
      totalSessions === 0 || (avgScore < 70 && totalSessions > 0);
    const hasNoSessions = totalSessions === 0;

    return {
      avgScore,
      completedSessions,
      totalSessions,
      completionRate,
      passRate,
      avgTimeMinutes,
      skillBreakdown,
      performanceOverTime,
      trend,
      weakestSkill,
      strongestSkill,
      sessionTypeData,
      isStruggling,
      hasNoSessions,
      recentGrades: sortedGrades.slice(-5), // Last 5 sessions
    };
  }, [
    profile,
    chats,
    grades,
    feedbacks,
    standards,
    standardGroups,
    rubrics,
    attempts,
    profileId,
    simulations,
  ]);
  // Loading state
  if (isLoadingProfile || !profile) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading report...</p>
          </div>
        </div>
      </div>
    );
  }

  // Default analytics when no data is available
  const defaultAnalytics = {
    avgScore: 0,
    completedSessions: 0,
    totalSessions: 0,
    completionRate: 0,
    passRate: 0,
    avgTimeMinutes: 0,
    skillBreakdown: [],
    performanceOverTime: [],
    trend: "stable" as const,
    weakestSkill: { skill: "N/A", score: 0, feedbackCount: 0 },
    strongestSkill: { skill: "N/A", score: 0, feedbackCount: 0 },
    sessionTypeData: [
      { type: "Completed", count: 0 },
      { type: "Incomplete", count: 0 },
    ],
    isStruggling: false,
    hasNoSessions: true,
    recentGrades: [],
  };

  const displayAnalytics = analytics || defaultAnalytics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Avatar
              className="h-10 w-10 outline outline-muted-foreground"
              style={{ outlineWidth: "1px", outlineStyle: "solid" }}
            >
              <AvatarFallback>
                {getInitials(profile.firstName, profile.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="text-muted-foreground">
                {profile.alias}@{process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}
              </p>
            </div>
            <Badge variant={getRoleBadgeVariant(profile.role)}>
              {getRoleDisplayName(profile.role)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {displayAnalytics.hasNoSessions
                ? "N/A"
                : `${displayAnalytics.avgScore}%`}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {displayAnalytics.trend === "improving" ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : displayAnalytics.trend === "declining" ? (
                <TrendingDown className="h-3 w-3 text-red-600" />
              ) : null}
              {displayAnalytics.trend} trend
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {displayAnalytics.completedSessions}/
              {displayAnalytics.totalSessions}
            </div>
            <div className="text-xs text-muted-foreground">
              {displayAnalytics.completionRate}% completion rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {displayAnalytics.hasNoSessions
                ? "N/A"
                : `${displayAnalytics.passRate}%`}
            </div>
            <div className="text-xs text-muted-foreground">
              of completed sessions
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {displayAnalytics.hasNoSessions
                ? "N/A"
                : `${displayAnalytics.avgTimeMinutes}m`}
            </div>
            <div className="text-xs text-muted-foreground">per session</div>
          </CardContent>
        </Card>
      </div>

      {/* Status Alert */}
      {displayAnalytics.isStruggling && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-800">
                  {displayAnalytics.hasNoSessions
                    ? "No Session Data"
                    : "Performance Alert"}
                </p>
                <p className="text-sm text-orange-700">
                  {displayAnalytics.hasNoSessions
                    ? "This student has not completed any sessions yet."
                    : "This student may need additional support based on current performance metrics."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Over Time</CardTitle>
            <CardDescription>Score progression across sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {displayAnalytics.performanceOverTime.length > 0 ? (
              <ChartContainer config={timeChartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayAnalytics.performanceOverTime}>
                    <defs>
                      <linearGradient
                        id="scoreGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--chart-1))"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--chart-1))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="session" />
                    <YAxis domain={[0, 100]} />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value, name) => [
                        `${value}%`,
                        name === "score" ? "Score" : name,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      fill="url(#scoreGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No session data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skills Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Skills Breakdown</CardTitle>
            <CardDescription>
              Performance across different skill areas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {displayAnalytics.skillBreakdown.length > 0 ? (
              <ChartContainer config={skillsChartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={displayAnalytics.skillBreakdown}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="skill" />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value) => [`${value}%`, "Score"]}
                    />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke="hsl(var(--chart-2))"
                      fill="hsl(var(--chart-2))"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No skill data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Session Distribution</CardTitle>
          <CardDescription>
            Breakdown of completed vs incomplete sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayAnalytics.sessionTypeData.some((item) => item.count > 0) ? (
            <ChartContainer config={sessionChartConfig} className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayAnalytics.sessionTypeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--chart-3))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              No session data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skills Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Skill Performance</CardTitle>
            <CardDescription>
              Detailed breakdown of skills and scores
            </CardDescription>
          </CardHeader>
          <CardContent>
            {displayAnalytics.skillBreakdown.length > 0 ? (
              <div className="space-y-4">
                {displayAnalytics.skillBreakdown.map((skill) => (
                  <div key={skill.skill} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{skill.skill}</span>
                      <span className="text-sm text-muted-foreground">
                        {skill.score}/5
                      </span>
                    </div>
                    <Progress value={(skill.score / 5) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No skill data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Insights</CardTitle>
            <CardDescription>
              Strengths and areas for improvement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!displayAnalytics.hasNoSessions ? (
              <>
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Strongest Skill</p>
                    <p className="text-sm text-muted-foreground">
                      {displayAnalytics.strongestSkill.skill} (
                      {displayAnalytics.strongestSkill.score}/5)
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium">Area for Improvement</p>
                    <p className="text-sm text-muted-foreground">
                      {displayAnalytics.weakestSkill.skill} (
                      {displayAnalytics.weakestSkill.score}/5)
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-2">
                  {displayAnalytics.trend === "improving" ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : displayAnalytics.trend === "declining" ? (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  ) : (
                    <Calendar className="h-5 w-5 text-gray-600" />
                  )}
                  <div>
                    <p className="font-medium">Performance Trend</p>
                    <p className="text-sm text-muted-foreground">
                      {displayAnalytics.trend === "improving"
                        ? "Improving over time"
                        : displayAnalytics.trend === "declining"
                          ? "Declining performance"
                          : "Stable performance"}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2" />
                <p>No session data available for insights</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription>Latest 5 completed sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {displayAnalytics.recentGrades.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayAnalytics.recentGrades.map((grade, index) => {
                  // Calculate score percentage using rubric points
                  const profileGrade = grades?.find((g) => g.id === grade.id);
                  const profileChat = chats?.find(
                    (c) => c.id === profileGrade?.simulationChatId
                  );
                  const profileAttempt = attempts?.find(
                    (a) => a.id === profileChat?.attemptId
                  );
                  const simulation = simulations?.find(
                    (s) => s.id === profileAttempt?.simulationId
                  );
                  const rubric = rubrics?.find(
                    (r) => r.id === simulation?.rubricId
                  );
                  const rubricTotalPoints = rubric?.points || 100;
                  const scorePercent = Math.round(
                    (grade.score / rubricTotalPoints) * 100
                  );

                  return (
                    <TableRow key={index}>
                      <TableCell>
                        {format(new Date(grade.createdAt), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            scorePercent >= 80
                              ? "default"
                              : scorePercent >= 70
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {scorePercent}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={grade.passed ? "default" : "destructive"}
                        >
                          {grade.passed ? "Passed" : "Failed"}
                        </Badge>
                      </TableCell>
                      <TableCell>{Math.round(grade.timeTaken / 60)}m</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No recent sessions available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
