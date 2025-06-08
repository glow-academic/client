/**
 * Performance.tsx
 * Used to display the performance for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Target,
  Brain,
  Zap,
  Clock,
  TrendingDown,
  AlertTriangle,
  Award,
  MessageSquare,
} from "lucide-react";
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
} from "recharts";
import { format, subDays } from "date-fns";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { getUsers } from "@/utils/queries/get-users";
import { getAgents } from "@/utils/queries/get-agents";
import { getAttempts } from "@/utils/queries/get-attempts";
import { getAttemptChats } from "@/utils/queries/get-attempt-chats";
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

export default function Performance() {
  // Fetch data
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["attempts"],
    queryFn: () => getAttempts(),
  });

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["chats", attempts?.map((attempt) => attempt.id)],
    queryFn: () => getAttemptChats(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAgents(),
  });

  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["all-rubrics-performance"],
    queryFn: () => getRubrics(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Calculate analytics
  const analytics = useMemo(() => {
    if (!users || !chats || !rubrics || !agents) return null;

    const tas = users.filter((user) => user.role === "ta");

    // Calculate average scores by category
    const avgScores = {
      adaptability:
        rubrics.length > 0
          ? Math.round((rubrics.reduce((sum, r) => sum + r.adaptability, 0) / rubrics.length / 5) * 100)
          : 0,
      listening:
        rubrics.length > 0
          ? Math.round((rubrics.reduce((sum, r) => sum + r.listening, 0) / rubrics.length / 5) * 100)
          : 0,
      objectives:
        rubrics.length > 0
          ? Math.round((rubrics.reduce((sum, r) => sum + r.objectives, 0) / rubrics.length / 5) * 100)
          : 0,
      timeManagement:
        rubrics.length > 0
          ? Math.round((rubrics.reduce((sum, r) => sum + r.timeManagement, 0) / rubrics.length / 5) * 100)
          : 0,
      overall:
        rubrics.length > 0
          ? Math.round((rubrics.reduce((sum, r) => sum + r.score, 0) / rubrics.length / 20) * 100)
          : 0,
    };

    // Performance by student type
    const performanceByType = agents.map((agent) => {
      const profileChats = chats.filter((chat) => chat.agentId === agent.id);
      const profileRubrics = rubrics.filter((rubric) => {
        const chat = chats.find((c) => c.id === rubric.chatId);
        return chat?.agentId === agent.id;
      });

      const avgScore =
        profileRubrics.length > 0
          ? Math.round(
              (profileRubrics.reduce((sum, r) => sum + r.score, 0) / profileRubrics.length / 20) * 100,
            )
          : 0;

      return {
        name: agent.name,
        score: avgScore,
        sessions: profileChats.length,
        color: getAgentConfig(agent.name).colors.bgColor,
      };
    });

    // Skill progression data (mock for now)
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

    // TA performance for distribution
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
            ? Math.round((taRubrics.reduce((sum, r) => sum + r.score, 0) / taRubrics.length / 20) * 100)
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

    const totalSessions = chats.length;
    const completedChats = chats.filter((chat) => chat.completed);
    const completionRate =
      totalSessions > 0 ? (completedChats.length / totalSessions) * 100 : 0;

    return {
      avgScores,
      performanceByType,
      skillProgressionData,
      taPerformance,
      completionRate,
    };
  }, [users, chats, rubrics, agents, attempts]);

  // Loading state
  if (
    isLoadingUsers ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingRubrics ||
    isLoadingAgents
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading performance analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
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
                  name="Content Mastery"
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
              <span className="text-sm">Content Mastery</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.purple }}></div>
              <span className="text-sm">Time Management</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Distribution and Training Insights */}
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
                    bgColor: 'bg-green-50'
                  },
                  { 
                    label: 'Good', 
                    range: '80-89%', 
                    count: analytics.taPerformance.filter(ta => ta.avgScore >= 80 && ta.avgScore < 90).length, 
                    color: COLORS.primary, 
                    bgColor: 'bg-blue-50'
                  },
                  { 
                    label: 'Average', 
                    range: '70-79%', 
                    count: analytics.taPerformance.filter(ta => ta.avgScore >= 70 && ta.avgScore < 80).length, 
                    color: COLORS.warning, 
                    bgColor: 'bg-yellow-50'
                  },
                  { 
                    label: 'Needs Support', 
                    range: '<70%', 
                    count: analytics.taPerformance.filter(ta => ta.avgScore < 70).length, 
                    color: COLORS.danger, 
                    bgColor: 'bg-red-50'
                  },
                ].map((tier) => (
                  <div 
                    key={tier.label}
                    className={`p-3 rounded-lg border ${tier.bgColor}`}
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
                  </div>
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
                  { skill: 'Time Management', avgScore: analytics.avgScores.timeManagement, improvement: '+3%', trend: 'up' },
                  { skill: 'Adaptability', avgScore: analytics.avgScores.adaptability, improvement: '+1%', trend: 'up' },
                  { skill: 'Active Listening', avgScore: analytics.avgScores.listening, improvement: '-2%', trend: analytics.avgScores.listening >= 70 ? 'up' : 'down' },
                  { skill: 'Meeting Objectives', avgScore: analytics.avgScores.objectives, improvement: '+5%', trend: 'up' },
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
                <div className="text-2xl font-bold text-blue-600">
                  {analytics.avgScores.overall}%
                </div>
                <div className="text-xs text-blue-600">Average Score</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(analytics.completionRate)}%
                </div>
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
    </div>
  );
}
