/**
 * ClassDetails.tsx
 * Used to display the details for the classes page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, compareAsc, startOfDay, subDays, isAfter } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Calendar,
  Users,
  TrendingUp,
  PlayCircle,
  Activity,
  BookOpen,
} from "lucide-react";

// Import class-specific queries
import { getClass } from "@/utils/queries/classes/get-class";
import { getTopicsByClass } from "@/utils/queries/topics/get-topics-by-class";
import { getSimulationsByClass } from "@/utils/queries/simulations/get-simulations-by-class";
import { getSimulationAttemptsByClass } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-class";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getAllSchedules } from "@/utils/queries/schedules/get-all-schedules";
import { getAllEvents } from "@/utils/queries/events/get-all-events";
import { getAllUsers } from "@/utils/queries/users/get-all-users";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";

type ClassDetailsProps = {
  classId: string;
};

export default function ClassDetails({ classId }: ClassDetailsProps) {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [topicSort, setTopicSort] = useState<
    "all" | "prerequisites" | "non-prerequisites"
  >("all");

  // Fetch class data
  const { data: classData, isLoading: isLoadingClass } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getClass(classId),
  });

  // Fetch all users to filter by class
  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => getAllUsers(),
  });

  // Filter users assigned to this class
  const classUsers = useMemo(() => {
    return allUsers.filter((user) => user.classIds?.includes(classId));
  }, [allUsers, classId]);

  // Fetch class-specific data
  const { data: topics = [], isLoading: isLoadingTopics } = useQuery({
    queryKey: ["topics", classId],
    queryFn: () => getTopicsByClass([classId]),
  });

  const { data: simulations = [], isLoading: isLoadingSimulations } = useQuery({
    queryKey: ["simulations", classId],
    queryFn: () => getSimulationsByClass([classId]),
  });

  const { data: attempts = [], isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", classId],
    queryFn: () => getSimulationAttemptsByClass([classId]),
  });

  const { data: chats = [], isLoading: isLoadingChats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades = [], isLoading: isLoadingGrades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: feedbacks = [], isLoading: isLoadingFeedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id),
      ),
    enabled: !!grades && grades.length > 0,
  });

  // Fetch rubrics and standards for dynamic rubric data
  const { data: allRubrics = [], isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups = [], isLoading: isLoadingStandardGroups } =
    useQuery({
      queryKey: ["standardGroups", allRubrics?.map((rubric) => rubric.id)],
      queryFn: () =>
        getStandardGroupsByRubrics(allRubrics!.map((rubric) => rubric.id)),
      enabled: !!allRubrics && allRubrics.length > 0,
    });

  const { data: standards = [], isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  // Fetch schedules and events
  const { data: schedules = [], isLoading: isLoadingSchedules } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => getAllSchedules(),
  });

  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ["events"],
    queryFn: () => getAllEvents(),
  });

  // Generate performance trend data based on grades
  const performanceTrendData = useMemo(() => {
    if (!grades || grades.length === 0) return [];

    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const today = startOfDay(new Date());
    const dates: Record<
      string,
      { date: Date; scores: number[]; attempts: number }
    > = {};

    // Initialize date range
    for (let i = 0; i < days; i++) {
      const date = subDays(today, i);
      const dateStr = format(date, "yyyy-MM-dd");
      dates[dateStr] = { date, scores: [], attempts: 0 };
    }

    // Group data by date
    grades.forEach((grade) => {
      const createdAt = new Date(grade.createdAt);
      const dateStr = format(createdAt, "yyyy-MM-dd");

      if (dates[dateStr]) {
        dates[dateStr].scores.push(grade.score);
        dates[dateStr].attempts += 1;
      }
    });

    // Calculate metrics for each day
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
          date: format(data.date, timeRange === "7d" ? "MM/dd" : "MM/dd"),
          avgScore,
          attempts: data.attempts,
        };
      })
      .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));
  }, [grades, timeRange]);

  // Simulation usage analytics
  const simulationUsageData = useMemo(() => {
    return simulations.map((simulation) => {
      const simulationAttempts = attempts.filter(
        (attempt) => attempt.simulationId === simulation.id,
      ).length;

      const simulationChats = chats.filter((chat) =>
        attempts.some(
          (attempt) =>
            attempt.id === chat.attemptId &&
            attempt.simulationId === simulation.id,
        ),
      ).length;

      return {
        name: simulation.title,
        attempts: simulationAttempts,
        chats: simulationChats,
        completion:
          simulationAttempts > 0
            ? Math.round((simulationChats / simulationAttempts) * 100)
            : 0,
      };
    });
  }, [simulations, attempts, chats]);

  // Upcoming events from schedules
  const upcomingEvents = useMemo(() => {
    if (!events || events.length === 0) return [];

    const now = new Date();
    return events
      .filter((event) => isAfter(new Date(event.time), now))
      .sort((a, b) => compareAsc(new Date(a.time), new Date(b.time)))
      .slice(0, 3);
  }, [events]);

  // Filter topics based on prerequisite status
  const filteredTopics = useMemo(() => {
    if (topicSort === "all") return topics;
    if (topicSort === "prerequisites")
      return topics.filter((topic) => topic.prerequisite);
    return topics.filter((topic) => !topic.prerequisite);
  }, [topics, topicSort]);

  // Student engagement metrics
  const engagementData = useMemo(() => {
    // Get user IDs from attempts that have chats
    const chatUserIds = chats
      .map((chat) => {
        const attempt = attempts.find((a) => a.id === chat.attemptId);
        return attempt?.userId;
      })
      .filter(Boolean) as string[];

    const totalStudents = new Set(chatUserIds).size;

    const activeStudents = new Set(
      chats
        .filter((chat) =>
          isAfter(new Date(chat.createdAt), subDays(new Date(), 7)),
        )
        .map((chat) => {
          const attempt = attempts.find((a) => a.id === chat.attemptId);
          return attempt?.userId;
        })
        .filter(Boolean) as string[],
    ).size;

    return [
      { name: "Active", value: activeStudents, fill: "#10b981" },
      {
        name: "Inactive",
        value: totalStudents - activeStudents,
        fill: "#e5e7eb",
      },
    ];
  }, [chats, attempts]);

  const totalStudents = useMemo(() => {
    const chatUserIds = chats
      .map((chat) => {
        const attempt = attempts.find((a) => a.id === chat.attemptId);
        return attempt?.userId;
      })
      .filter(Boolean) as string[];
    return new Set(chatUserIds).size;
  }, [chats, attempts]);
  const avgPerformance =
    grades && grades.length > 0
      ? Math.round(grades.reduce((sum, r) => sum + r.score, 0) / grades.length)
      : 0;

  // Loading state
  if (
    isLoadingClass ||
    isLoadingUsers ||
    isLoadingTopics ||
    isLoadingSimulations ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingGrades ||
    isLoadingFeedbacks ||
    isLoadingRubrics ||
    isLoadingStandardGroups ||
    isLoadingStandards ||
    isLoadingSchedules ||
    isLoadingEvents
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading class details...</p>
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Class Not Found</h1>
          <p className="text-muted-foreground">
            The class you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  const formatClassTerm = (term: string) => {
    switch (term) {
      case "fall":
        return "Fall";
      case "spring":
        return "Spring";
      case "summer":
        return "Summer";
      default:
        return term;
    }
  };

  return (
    <div className="space-y-6">
      {/* Class Header */}
      <div>
        <h1 className="text-2xl font-bold">{classData.name}</h1>
        <p className="text-muted-foreground">
          {classData.classCode} • {formatClassTerm(classData.term)}{" "}
          {classData.year}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {classData.description}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Students
                </p>
                <p className="text-2xl font-bold">{totalStudents}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Simulations
                </p>
                <p className="text-2xl font-bold">{simulations.length}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Avg Score
                </p>
                <p className="text-2xl font-bold">{avgPerformance}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Topics
                </p>
                <p className="text-2xl font-bold">{topics.length}</p>
              </div>
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Performance Trend
            </CardTitle>
            <Select
              value={timeRange}
              onValueChange={(value: "7d" | "30d" | "90d") =>
                setTimeRange(value)
              }
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="90d">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={performanceTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="avgScore"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
                name="Avg Score"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Engagement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Student Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={engagementData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {engagementData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-4">
              {engagementData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.fill }}
                  />
                  <span className="text-sm">
                    {entry.name}: {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-3">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm">{event.name}</p>
                        {event.documentType && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {event.documentType}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {format(new Date(event.time), "MMM dd")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.time), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    No upcoming events
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Simulations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Simulations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-3">
                {simulationUsageData.length > 0 ? (
                  simulationUsageData.map((simulation) => (
                    <div
                      key={simulation.name}
                      className="p-3 border rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">
                          {simulation.name}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {simulation.completion}%
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-2">
                        <div>Attempts: {simulation.attempts}</div>
                        <div>Completed: {simulation.chats}</div>
                      </div>
                      <Progress value={simulation.completion} className="h-2" />
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    No simulations found
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Course Topics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Course Topics
            </CardTitle>
            <Select
              value={topicSort}
              onValueChange={(
                value: "all" | "prerequisites" | "non-prerequisites",
              ) => setTopicSort(value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Topics</SelectItem>
                <SelectItem value="prerequisites">Prerequisites</SelectItem>
                <SelectItem value="non-prerequisites">
                  Non-Prerequisites
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTopics.length > 0 ? (
              filteredTopics.map((topic) => (
                <div key={topic.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{topic.name}</h4>
                    {topic.prerequisite && (
                      <Badge variant="secondary" className="text-xs">
                        Prerequisite
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {topic.description}
                  </p>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center text-muted-foreground py-8">
                No topics found for the selected filter
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
