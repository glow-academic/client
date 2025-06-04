/**
 * Analytics.tsx
 * Graduate TA Training Analytics Dashboard
 * Tracks TA performance across different student personality interactions
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */

import { getRubrics } from "@/utils/queries/get-rubrics";
import { getUsers } from "@/utils/queries/get-users";
import { getProfiles } from "@/utils/queries/get-profiles";
import { getAttempts } from "@/utils/queries/get-attempts";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  TrendingUp,
  Clock,
  Target,
  Award,
  AlertTriangle,
  MessageSquare,
  Brain,
  Zap,
  Calendar,
  Eye,
  TrendingDown,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Area,
  AreaChart,
} from "recharts";
import { format, subDays } from "date-fns";
import { getProfileConfig } from "@/utils/profiles";
import { getAttemptChats } from "@/utils/queries/get-attempt-chats";
import { getTemplates } from "@/utils/queries/get-templates";
import { getChatTemplates } from "@/utils/queries/get-chat-templates";

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

const CHART_COLORS = [
  COLORS.primary,
  COLORS.success,
  COLORS.warning,
  COLORS.danger,
  COLORS.purple,
  COLORS.pink,
];

export default function Analytics() {
  const [selectedTimeRange, setSelectedTimeRange] = useState("7d");
  const [selectedClass, setSelectedClass] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch data
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["attempts"],
    queryFn: () => getAttempts(),
  });

  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["templates"],
    queryFn: () => getTemplates(),
  });

  const { data: chatTemplates, isLoading: isLoadingChatTemplates } = useQuery({
    queryKey: ["chat-templates"],
    queryFn: () => getChatTemplates(),
  });

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["chats", attempts?.map((attempt) => attempt.id)],
    queryFn: () => getAttemptChats(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getProfiles(),
  });

  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["all-rubrics-analytics"],
    queryFn: () => getRubrics(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Calculate key metrics
  const analytics = useMemo(() => {
    if (!users || !chats || !rubrics || !profiles) return null;

    const tas = users.filter((user) => user.role === "ta");
    const completedChats = chats.filter((chat) => chat.completed);
    const totalSessions = chats.length;
    const completionRate =
      totalSessions > 0 ? (completedChats.length / totalSessions) * 100 : 0;

    // Calculate average scores by category
    const avgScores = {
      overall:
        rubrics.length > 0
          ? Math.round(rubrics.reduce((sum, r) => sum + r.score, 0) / rubrics.length)
          : 0,
      adaptability:
        rubrics.length > 0
          ? Math.round(rubrics.reduce((sum, r) => sum + r.adaptability, 0) / rubrics.length)
          : 0,
      listening:
        rubrics.length > 0
          ? Math.round(rubrics.reduce((sum, r) => sum + r.listening, 0) / rubrics.length)
          : 0,
      objectives:
        rubrics.length > 0
          ? Math.round(rubrics.reduce((sum, r) => sum + r.objectives, 0) / rubrics.length)
          : 0,
      timeManagement:
        rubrics.length > 0
          ? Math.round(rubrics.reduce((sum, r) => sum + r.timeManagement, 0) / rubrics.length)
          : 0,
    };

    // Performance by student type
    const performanceByType = profiles.map((profile) => {
      const profileChats = chats.filter((chat) => chat.profileId === profile.id);
      const profileRubrics = rubrics.filter((rubric) => {
        const chat = chats.find((c) => c.id === rubric.chatId);
        return chat?.profileId === profile.id;
      });

      const avgScore =
        profileRubrics.length > 0
          ? Math.round(
              profileRubrics.reduce((sum, r) => sum + r.score, 0) / profileRubrics.length,
            )
          : 0;

      return {
        name: profile.name,
        score: avgScore,
        sessions: profileChats.length,
        color: getProfileConfig(profile.name).colors.bgColor,
      };
    });

    // Filter out entries with no sessions, then use mock data if we don't have meaningful real data
    const realDataWithSessions = performanceByType.filter(type => type.sessions > 0);
    
    const performanceByTypeWithMock = realDataWithSessions.length > 0 
      ? realDataWithSessions 
      : [
          {
            name: 'Aggressive',
            score: 72,
            sessions: 15,
            color: 'bg-red-200',
          },
          {
            name: 'Happy',
            score: 88,
            sessions: 23,
            color: 'bg-green-200',
          },
          {
            name: 'Confused',
            score: 79,
            sessions: 18,
            color: 'bg-yellow-200',
          },
        ];

    // Mock time-series data for skill progression
    const skillProgressionData = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const baseAdaptability = 65 + i * 2 + Math.random() * 10;
      const baseListening = 70 + i * 1.5 + Math.random() * 8;
      const baseObjectives = 75 + i * 1.8 + Math.random() * 6;
      const baseTimeManagement = 68 + i * 2.2 + Math.random() * 9;
      
      return {
        date: format(date, "MMM dd"),
        adaptability: Math.min(95, Math.round(baseAdaptability)),
        listening: Math.min(95, Math.round(baseListening)),
        objectives: Math.min(95, Math.round(baseObjectives)),
        timeManagement: Math.min(95, Math.round(baseTimeManagement)),
      };
    });

    // TA leaderboard
    const taPerformance = tas
      .map((ta) => {
        const taAttempts = attempts?.filter((attempt) => attempt.userId === ta.id) || [];
        const taChats = chats.filter((chat) =>
          taAttempts.some((attempt) => attempt.id === chat.attemptId),
        );
        const taRubrics = rubrics.filter((rubric) =>
          taChats.some((chat) => chat.id === rubric.chatId),
        );

        const avgScore =
          taRubrics.length > 0
            ? Math.round(taRubrics.reduce((sum, r) => sum + r.score, 0) / taRubrics.length)
            : 0;

        const completedSessions = taChats.filter((chat) => chat.completed).length;
        const totalSessions = taChats.length;

        return {
          id: ta.id,
          name: ta.name,
          username: ta.username,
          avgScore,
          completedSessions,
          totalSessions,
          completionRate:
            totalSessions > 0
              ? Math.round((completedSessions / totalSessions) * 100)
              : 0,
          initials: ta.name.split(" ").map((n) => n[0]).join("").toUpperCase(),
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);

    // Time series data (last 7 days)
    const timeSeriesData = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dateStr = format(date, "yyyy-MM-dd");

      const dayRubrics = rubrics.filter((rubric) => {
        const rubricDate = format(new Date(rubric.createdAt), "yyyy-MM-dd");
        return rubricDate === dateStr;
      });

      const dayChats = chats.filter((chat) => {
        const chatDate = format(new Date(chat.createdAt), "yyyy-MM-dd");
        return chatDate === dateStr;
      });

      return {
        date: format(date, "MMM dd"),
        score:
          dayRubrics.length > 0
            ? Math.round(dayRubrics.reduce((sum, r) => sum + r.score, 0) / dayRubrics.length)
            : 0,
        sessions: dayChats.length,
        completed: dayChats.filter((chat) => chat.completed).length,
      };
    });

    // Struggling TAs (score < 70)
    const strugglingTAs = taPerformance.filter(
      (ta) => ta.avgScore < 70 && ta.totalSessions > 0,
    );

    return {
      totalTAs: tas.length,
      totalSessions,
      completionRate,
      avgScores,
      performanceByType: performanceByTypeWithMock,
      taPerformance,
      timeSeriesData,
      strugglingTAs,
      skillProgressionData,
    };
  }, [users, chats, rubrics, profiles, attempts]);

  // Loading state
  if (
    isLoadingUsers ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingRubrics ||
    isLoadingProfiles
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading training analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  // Custom tooltip component for better positioning
  const CustomBarTooltip = ({ active, payload, label }: {active: boolean, payload: {name: string, value: number, color: string}[], label: string}) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg text-sm relative z-50">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: { name: string, value: number, color: string }, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active TAs</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {analytics.totalTAs}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Graduate teaching assistants
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Training Sessions</CardTitle>
            <MessageSquare className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {analytics.totalSessions}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Badge
                variant="outline"
                className="text-xs text-green-600 border-green-300"
              >
                {Math.round(analytics.completionRate)}% completed
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Training Hours</CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {Math.round(analytics.totalSessions * 0.75)}h
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-purple-600">
                Avg 45min per session
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Need Support</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              {analytics.strugglingTAs.length}
            </div>
            <p className="text-xs text-orange-600 mt-1">
              TAs scoring below 70%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Performance Trends */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance Trends
                </CardTitle>
                <CardDescription>
                  Training scores and session completion over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.timeSeriesData}>
                      <defs>
                        <linearGradient
                          id="scoreGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke={COLORS.primary}
                        strokeWidth={2}
                        fill="url(#scoreGradient)"
                        name="Average Score"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Skill Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Skill Breakdown
                </CardTitle>
                <CardDescription>Average scores by competency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      name: "Adaptability",
                      score: analytics.avgScores.adaptability * 20,
                      icon: Zap,
                    },
                    {
                      name: "Active Listening",
                      score: analytics.avgScores.listening * 20,
                      icon: Eye,
                    },
                    {
                      name: "Objectives",
                      score: analytics.avgScores.objectives * 20,
                      icon: Target,
                    },
                    {
                      name: "Time Management",
                      score: analytics.avgScores.timeManagement * 20,
                      icon: Clock,
                    },
                  ].map((skill) => (
                    <div key={skill.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <skill.icon className="h-4 w-4 text-muted-foreground" />
                          <span>{skill.name}</span>
                        </div>
                        <span className="font-medium">{skill.score}%</span>
                      </div>
                      <Progress value={skill.score} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Session Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Daily Session Activity
              </CardTitle>
              <CardDescription>
                Training session volume and completion rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.timeSeriesData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      content={<CustomBarTooltip active={false} payload={[]} label={""} />}
                      position={{ x: 0, y: 0 }}
                      allowEscapeViewBox={{ x: false, y: true }}
                      offset={20}
                    />
                    <Bar
                      dataKey="sessions"
                      fill={COLORS.primary}
                      name="Total Sessions"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="completed"
                      fill={COLORS.success}
                      name="Completed Sessions"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {/* Performance by Student Type */}
          <Card>
            <CardHeader>
              <CardTitle>Performance by Student Personality</CardTitle>
              <CardDescription>
                How TAs handle different student types during training
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.performanceByType} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="name" type="category" width={80} />
                      <Tooltip 
                        formatter={(value: number) => [`${value}%`, 'Average Score']}
                        labelFormatter={(label) => `${label} Students`}
                      />
                      <Bar
                        dataKey="score"
                        fill={COLORS.primary}
                        radius={[0, 4, 4, 0]}
                        name="Average Score"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-4">
                  {analytics.performanceByType.map((type, index) => (
                    <div
                      key={type.name}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${type.color}`}></div>
                        <div>
                          <p className="font-medium">{type.name} Student</p>
                          <p className="text-sm text-muted-foreground">
                            {type.sessions} sessions
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{type.score}%</p>
                        <Badge
                          variant={
                            type.score >= 80
                              ? "default"
                              : type.score >= 70
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {type.score >= 80
                            ? "Excellent"
                            : type.score >= 70
                            ? "Good"
                            : "Needs Work"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Skill Development Over Time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Skill Development Over Time
              </CardTitle>
              <CardDescription>
                Track improvement in key competencies across all TAs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.skillProgressionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                      formatter={(value: number) => [`${value}%`, '']}
                    />
                    <Line
                      type="monotone"
                      dataKey="adaptability"
                      stroke={COLORS.primary}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      name="Adaptability"
                    />
                    <Line
                      type="monotone"
                      dataKey="listening"
                      stroke={COLORS.success}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      name="Active Listening"
                    />
                    <Line
                      type="monotone"
                      dataKey="objectives"
                      stroke={COLORS.warning}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      name="Objectives"
                    />
                    <Line
                      type="monotone"
                      dataKey="timeManagement"
                      stroke={COLORS.purple}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      name="Time Management"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.primary }}></div>
                  <span className="text-sm">Adaptability</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.success }}></div>
                  <span className="text-sm">Active Listening</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.warning }}></div>
                  <span className="text-sm">Objectives</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.purple }}></div>
                  <span className="text-sm">Time Management</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Distribution */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Performance Analytics
                </CardTitle>
                <CardDescription>
                  Detailed breakdown of TA performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Score Distribution */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Score Distribution
                  </h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {[
                      { 
                        label: 'Excellent', 
                        range: '90-100%', 
                        count: analytics.taPerformance.filter(ta => ta.avgScore >= 90).length, 
                        color: COLORS.success, 
                        bgColor: 'bg-green-50',
                        tas: analytics.taPerformance.filter(ta => ta.avgScore >= 90)
                      },
                      { 
                        label: 'Good', 
                        range: '80-89%', 
                        count: analytics.taPerformance.filter(ta => ta.avgScore >= 80 && ta.avgScore < 90).length, 
                        color: COLORS.primary, 
                        bgColor: 'bg-blue-50',
                        tas: analytics.taPerformance.filter(ta => ta.avgScore >= 80 && ta.avgScore < 90)
                      },
                      { 
                        label: 'Average', 
                        range: '70-79%', 
                        count: analytics.taPerformance.filter(ta => ta.avgScore >= 70 && ta.avgScore < 80).length, 
                        color: COLORS.warning, 
                        bgColor: 'bg-yellow-50',
                        tas: analytics.taPerformance.filter(ta => ta.avgScore >= 70 && ta.avgScore < 80)
                      },
                      { 
                        label: 'Needs Support', 
                        range: '<70%', 
                        count: analytics.taPerformance.filter(ta => ta.avgScore < 70).length, 
                        color: COLORS.danger, 
                        bgColor: 'bg-red-50',
                        tas: analytics.taPerformance.filter(ta => ta.avgScore < 70)
                      },
                    ].map((tier) => (
                      <Dialog key={tier.label}>
                        <DialogTrigger asChild>
                          <div 
                            className={`p-3 rounded-lg border ${tier.bgColor} cursor-pointer hover:shadow-md transition-all duration-200 relative group`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{tier.label}</span>
                              <span className="text-lg font-bold" style={{ color: tier.color }}>
                                {tier.count}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">{tier.range}</div>
                            <div className="mt-2 h-1 bg-gray-200 rounded">
                              <div 
                                className="h-1 rounded transition-all duration-200"
                                style={{ 
                                  backgroundColor: tier.color, 
                                  width: `${analytics.taPerformance.length > 0 ? (tier.count / analytics.taPerformance.length) * 100 : 0}%` 
                                }}
                              />
                            </div>
                            
                            {/* Quick preview tooltip - only shows on hover when not empty */}
                            {tier.tas.length > 0 && tier.tas.length <= 3 && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
                                <div className="font-medium mb-1">{tier.label} TAs:</div>
                                <div className="space-y-1">
                                  {tier.tas.map((ta) => (
                                    <div key={ta.id} className="flex justify-between">
                                      <span>{ta.name}</span>
                                      <span className="ml-2 opacity-75">{ta.avgScore}%</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                              </div>
                            )}
                            
                            {/* Click to view more indicator */}
                            {tier.tas.length > 3 && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
                                <div className="font-medium">Click to view all {tier.tas.length} TAs</div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                              </div>
                            )}
                          </div>
                        </DialogTrigger>
                        
                        {tier.tas.length > 0 && (
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color }}></div>
                                {tier.label} TAs ({tier.range})
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {tier.tas.map((ta) => (
                                <div key={ta.id} className="flex items-center justify-between p-3 rounded-lg border">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                      <AvatarFallback>{ta.initials}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium text-sm">{ta.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {ta.completedSessions}/{ta.totalSessions} sessions
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-lg font-bold" style={{ color: tier.color }}>
                                      {ta.avgScore}%
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {ta.completionRate}% completion
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </DialogContent>
                        )}
                      </Dialog>
                    ))}
                  </div>
                </div>

                {/* Competency Breakdown */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Skill Change
                  </h4>
                  <div className="space-y-3">
                    {[
                      { skill: 'Time Management', avgScore: 68, improvement: '+3%', trend: 'up' },
                      { skill: 'Adaptability', avgScore: 72, improvement: '+1%', trend: 'up' },
                      { skill: 'Active Listening', avgScore: 76, improvement: '-2%', trend: 'down' },
                      { skill: 'Meeting Objectives', avgScore: 78, improvement: '+5%', trend: 'up' },
                    ].map((competency) => (
                      <div key={competency.skill} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                          <span className="text-sm font-medium">{competency.skill}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{competency.avgScore}%</span>
                          <div className={`flex items-center gap-1 text-xs ${
                            competency.trend === 'up' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {competency.trend === 'up' ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {competency.improvement}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">84%</div>
                    <div className="text-xs text-blue-600">Average Score</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">92%</div>
                    <div className="text-xs text-green-600">Pass Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Training Insights
                </CardTitle>
                <CardDescription>
                  Patterns and recommendations from training data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Session Completion Insights */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Session Patterns
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-yellow-800">
                            Peak Difficulty: Aggressive Students
                          </div>
                          <div className="text-xs text-yellow-700 mt-1">
                            TAs score 15% lower when handling aggressive personalities
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Award className="h-4 w-4 text-green-600 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-green-800">
                            Strength: Happy Students
                          </div>
                          <div className="text-xs text-green-700 mt-1">
                            Highest success rate (88%) with positive personalities
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-blue-800">
                            Improvement Trend
                          </div>
                          <div className="text-xs text-blue-700 mt-1">
                            Overall scores increased 8% over the last month
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Action Items
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 text-sm bg-purple-50 rounded border">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span>Focus training on de-escalation techniques</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 text-sm bg-orange-50 rounded border">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span>Review time management strategies</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 text-sm bg-teal-50 rounded border">
                      <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                      <span>Pair struggling TAs with high performers</span>
                    </div>
                  </div>
                </div>

                {/* Performance Trends */}
                <div>
                  <h4 className="font-medium mb-3">Weekly Progress</h4>
                  <div className="space-y-2">
                    {[
                      { week: 'This Week', score: 84, change: '+2%' },
                      { week: 'Last Week', score: 82, change: '+1%' },
                      { week: '2 Weeks Ago', score: 81, change: '+3%' },
                    ].map((week, index) => (
                      <div key={week.week} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{week.week}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{week.score}%</span>
                          <span className="text-green-600 text-xs">{week.change}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-6">
          {/* TA Leaderboard */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  TA Performance Leaderboard
                </CardTitle>
                <CardDescription>
                  Ranked by overall training performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.taPerformance.slice(0, 10).map((ta, index) => (
                    <div
                      key={ta.id}
                      className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                          #{index + 1}
                        </div>
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{ta.initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{ta.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {ta.username}@purdue.edu
                          </p>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              ta.avgScore >= 80
                                ? "default"
                                : ta.avgScore >= 70
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {ta.avgScore}%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {ta.completedSessions}/{ta.totalSessions} sessions
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* TAs Needing Support */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Need Support
                </CardTitle>
                <CardDescription>
                  TAs who may need additional training
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.strugglingTAs.length > 0 ? (
                    analytics.strugglingTAs.map((ta) => (
                      <Dialog key={ta.id}>
                        <DialogTrigger asChild>
                          <div className="flex items-center gap-3 p-3 rounded-lg border border-orange-200 hover:bg-orange-50 transition-colors cursor-pointer">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-orange-100 text-orange-800">
                                {ta.initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{ta.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {ta.avgScore}% avg score
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              Support Recommendations for {ta.name}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                              <h4 className="font-medium text-orange-800 mb-2">
                                Current Performance
                              </h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">
                                    Average Score:
                                  </span>
                                  <span className="font-medium ml-2">
                                    {ta.avgScore}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Completion Rate:
                                  </span>
                                  <span className="font-medium ml-2">
                                    {ta.completionRate}%
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-medium">Recommended Actions:</h4>
                              <ul className="text-sm space-y-1 text-muted-foreground">
                                <li>• Schedule one-on-one mentoring session</li>
                                <li>• Focus on confused student interaction patterns</li>
                                <li>• Review active listening techniques</li>
                                <li>• Practice time management strategies</li>
                              </ul>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <Award className="h-12 w-12 text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-green-700">
                        All TAs are performing well!
                      </p>
                      <p className="text-xs text-muted-foreground">
                        No additional support needed
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
