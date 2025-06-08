/**
 * components/admin/class-details-content.tsx
 * Simplified Class Dashboard component
 */
"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format, compareAsc, startOfDay, subDays, isAfter } from "date-fns";

import { getAllChats } from "@/utils/queries/get-all-chats";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { getSimulations } from "@/utils/queries/get-simulations";
import { getTopics } from "@/utils/queries/get-topics";
import { getEvents } from "@/utils/queries/get-events";
import { getEnhancedAttempts } from "@/utils/queries/get-enhanced-attempts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
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
  BookOpen
} from "lucide-react";
import { getSchedules } from "@/utils/queries/get-schedules";

interface ClassDetailsContentProps {
  classData: {
    id: string;
    classCode: string;
    name: string;
    description: string;
    year: number;
    term: string;
    simulationIds: string[];
  };
}

export function ClassDetailsContent({ classData }: ClassDetailsContentProps) {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [topicSort, setTopicSort] = useState<"all" | "prerequisites" | "non-prerequisites">("all");

  // Fetch all required data
  const { data: chats = [] } = useQuery({
    queryKey: ["all-chats"],
    queryFn: () => getAllChats(),
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getSimulations(),
  });

  const { data: topics = [] } = useQuery({
    queryKey: ["topics", classData.id],
    queryFn: () => getTopics(classData.id),
  });

  const {data: schedules = []} = useQuery({
    queryKey: ["schedules", classData.id],
    queryFn: () => getSchedules(classData.id),
  });

  const {data: events = []} = useQuery({
    queryKey: ["events", classData.id],
    queryFn: () => getEvents(schedules.map((schedule) => schedule.id)),
    enabled: !!schedules,
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ["enhanced-attempts"],
    queryFn: () => getEnhancedAttempts(),
  });

  const { data: rubrics = [] } = useQuery({
    queryKey: ["all-rubrics"],
    queryFn: () => getRubrics(chats.map((chat) => chat.id)),
    enabled: chats.length > 0,
  });

  // Filter data for this specific class
  const classChats = useMemo(() => 
    chats.filter(chat => chat.classId === classData.id), 
    [chats, classData.id]
  );

  const classAttempts = useMemo(() => 
    attempts.filter(attempt => attempt.classId === classData.id), 
    [attempts, classData.id]
  );

  const classSimulations = useMemo(() => 
    simulations.filter(simulation => classData.simulationIds.includes(simulation.id)), 
    [simulations, classData.simulationIds]
  );

  // Generate performance trend data
  const performanceTrendData = useMemo(() => {
    if (!rubrics.length) return [];

    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const today = startOfDay(new Date());
    const dates: Record<string, { date: Date; scores: number[]; attempts: number }> = {};

    // Initialize date range
    for (let i = 0; i < days; i++) {
      const date = subDays(today, i);
      const dateStr = format(date, "yyyy-MM-dd");
      dates[dateStr] = { date, scores: [], attempts: 0 };
    }

    // Group data by date
    rubrics.forEach((rubric) => {
      const createdAt = new Date(rubric.createdAt);
      const dateStr = format(createdAt, "yyyy-MM-dd");

      if (dates[dateStr]) {
        dates[dateStr].scores.push(rubric.score);
        dates[dateStr].attempts += 1;
      }
    });

    // Calculate metrics for each day
    return Object.entries(dates)
      .map(([_, data]) => {
        const avgScore = data.scores.length > 0
          ? Math.round(data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length)
          : 0;

        return {
          date: format(data.date, timeRange === "7d" ? "MM/dd" : "MM/dd"),
          avgScore,
          attempts: data.attempts,
        };
      })
      .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));
  }, [rubrics, timeRange]);

  // Simulation usage analytics
  const simulationUsageData = useMemo(() => {
    return classSimulations.map(simulation => {
      const simulationAttempts = classAttempts.filter(attempt => 
        attempt.simulationId === simulation.id
      ).length;
      
      const simulationChats = classChats.filter(chat => 
        classAttempts.some(attempt => 
          attempt.id === chat.attemptId && attempt.simulationId === simulation.id
        )
      ).length;

      return {
        name: simulation.title,
        attempts: simulationAttempts,
        chats: simulationChats,
        completion: simulationAttempts > 0 ? Math.round((simulationChats / simulationAttempts) * 100) : 0,
      };
    });
  }, [classSimulations, classAttempts, classChats]);

  // Upcoming events from schedules
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(event => isAfter(new Date(event.time), now))
      .sort((a, b) => compareAsc(new Date(a.time), new Date(b.time)))
      .slice(0, 3);
  }, [events]);

  // Filter topics based on prerequisite status
  const filteredTopics = useMemo(() => {
    if (topicSort === "all") return topics;
    if (topicSort === "prerequisites") return topics.filter(topic => topic.prerequisite);
    return topics.filter(topic => !topic.prerequisite);
  }, [topics, topicSort]);

  // Student engagement metrics
  const engagementData = useMemo(() => {
    const totalStudents = new Set(classChats.map(chat => chat.userId)).size;
    const activeStudents = new Set(
      classChats
        .filter(chat => isAfter(new Date(chat.createdAt), subDays(new Date(), 7)))
        .map(chat => chat.userId)
    ).size;

    return [
      { name: "Active", value: activeStudents, fill: "#10b981" },
      { name: "Inactive", value: totalStudents - activeStudents, fill: "#e5e7eb" },
    ];
  }, [classChats]);

  const totalStudents = new Set(classChats.map(chat => chat.userId)).size;
  const avgPerformance = rubrics.length > 0 
    ? Math.round(rubrics.reduce((sum, r) => sum + r.score, 0) / rubrics.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Students</p>
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
                <p className="text-sm font-medium text-muted-foreground">Simulations</p>
                <p className="text-2xl font-bold">{classSimulations.length}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Score</p>
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
                <p className="text-sm font-medium text-muted-foreground">Topics</p>
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
            <Select value={timeRange} onValueChange={(value: "7d" | "30d" | "90d") => setTimeRange(value)}>
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
                  <span className="text-sm">{entry.name}: {entry.value}</span>
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
                    <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{event.name}</p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {event.documentType}
                        </Badge>
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
                {simulationUsageData.map((simulation) => (
                  <div key={simulation.name} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{simulation.name}</h4>
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
                ))}
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
            <Select value={topicSort} onValueChange={(value: "all" | "prerequisites" | "non-prerequisites") => setTopicSort(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Topics</SelectItem>
                <SelectItem value="prerequisites">Prerequisites</SelectItem>
                <SelectItem value="non-prerequisites">Non-Prerequisites</SelectItem>
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
                  <p className="text-sm text-muted-foreground">{topic.description}</p>
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