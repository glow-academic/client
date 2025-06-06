/**
 * components/admin/class-details-content.tsx
 * Enhanced Class Dashboard component
 */
"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format, compareAsc, startOfDay, subDays, isAfter, isBefore, addDays } from "date-fns";

import { getAllChats } from "@/utils/queries/get-all-chats";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { getSimulations } from "@/utils/queries/get-simulations";
import { getTopics } from "@/utils/queries/get-topics";
import { getEvents } from "@/utils/queries/get-events";
import { getEnhancedAttempts } from "@/utils/queries/get-enhanced-attempts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

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
  Area,
  AreaChart,
} from "recharts";
import { 
  Calendar, 
  Clock, 
  Users, 
  Target, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  PlayCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Activity
} from "lucide-react";

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
  const [chartType, setChartType] = useState<"line" | "area" | "bar">("area");
  const [activeTab, setActiveTab] = useState("overview");

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

  const { data: events = [] } = useQuery({
    queryKey: ["events", classData.id],
    queryFn: () => getEvents(classData.id),
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

  // Calculate course progress based on deadlines
  const courseProgress = useMemo(() => {
    if (events.length === 0) return 0;
    
    const now = new Date();
    const completedEvents = events.filter(event => 
      isBefore(new Date(event.time), now)
    ).length;
    
    return Math.round((completedEvents / events.length) * 100);
  }, [events]);

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
          engagement: Math.min(data.attempts * 10, 100), // Engagement metric
        };
      })
      .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));
  }, [rubrics, timeRange]);

  // Simulation usage analytics
  const simulationUsageData = useMemo(() => {
    const usage = classSimulations.map(simulation => {
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
        completion: simulationChats > 0 ? Math.round((simulationChats / simulationAttempts) * 100) : 0,
      };
    });

    return usage;
  }, [classSimulations, classAttempts, classChats]);

  // Upcoming deadlines
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const upcoming = events
      .filter(event => isAfter(new Date(event.time), now))
      .sort((a, b) => compareAsc(new Date(a.time), new Date(b.time)))
      .slice(0, 5);
    
    return upcoming;
  }, [events]);

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

  const renderChart = () => {
    const ChartComponent = chartType === "line" ? LineChart : chartType === "area" ? AreaChart : RechartsBarChart;
    
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent data={performanceTrendData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          {chartType === "line" && (
            <>
              <Line type="monotone" dataKey="avgScore" stroke="#3b82f6" strokeWidth={2} name="Avg Score" />
              <Line type="monotone" dataKey="engagement" stroke="#10b981" strokeWidth={2} name="Engagement" />
            </>
          )}
          {chartType === "area" && (
            <>
              <Area type="monotone" dataKey="avgScore" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Avg Score" />
              <Area type="monotone" dataKey="engagement" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Engagement" />
            </>
          )}
          {chartType === "bar" && (
            <>
              <Bar dataKey="avgScore" fill="#3b82f6" name="Avg Score" />
              <Bar dataKey="engagement" fill="#10b981" name="Engagement" />
            </>
          )}
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-6">

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold">{new Set(classChats.map(chat => chat.userId)).size}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Simulations</p>
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
                <p className="text-sm font-medium text-muted-foreground">Avg Performance</p>
                <p className="text-2xl font-bold">
                  {rubrics.length > 0 
                    ? Math.round(rubrics.reduce((sum, r) => sum + r.score, 0) / rubrics.length)
                    : 0}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Upcoming Deadlines</p>
                <p className="text-2xl font-bold">{upcomingDeadlines.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="simulations">Simulations</TabsTrigger>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Performance Analytics */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Performance Analytics
                  </CardTitle>
                  <CardDescription>
                    Track student performance and engagement over time
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
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
                  <Select value={chartType} onValueChange={(value: "line" | "area" | "bar") => setChartType(value)}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Line</SelectItem>
                      <SelectItem value="area">Area</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderChart()}
            </CardContent>
          </Card>

          {/* Student Engagement & Upcoming Deadlines */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Student Engagement
                </CardTitle>
                <CardDescription>Active vs inactive students (last 7 days)</CardDescription>
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Deadlines
                </CardTitle>
                <CardDescription>Next {upcomingDeadlines.length} deadlines</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-3">
                    {upcomingDeadlines.length > 0 ? (
                      upcomingDeadlines.map((event) => (
                        <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{event.name}</p>
                            <p className="text-sm text-muted-foreground">{event.description}</p>
                            <Badge variant="outline" className="mt-1">
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
                      <p className="text-center text-muted-foreground py-8">
                        No upcoming deadlines
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Course Progress Timeline
              </CardTitle>
              <CardDescription>Track progress through course deadlines and milestones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events.map((event, index) => {
                  const isCompleted = isBefore(new Date(event.time), new Date());
                  const isUpcoming = isAfter(new Date(event.time), new Date()) && 
                                   isBefore(new Date(event.time), addDays(new Date(), 7));
                  
                  return (
                    <div key={event.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="flex-shrink-0">
                        {isCompleted ? (
                          <CheckCircle className="h-6 w-6 text-green-500" />
                        ) : isUpcoming ? (
                          <Clock className="h-6 w-6 text-yellow-500" />
                        ) : (
                          <div className="h-6 w-6 border-2 border-gray-300 rounded-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{event.name}</h4>
                          <Badge variant={isCompleted ? "default" : isUpcoming ? "secondary" : "outline"}>
                            {event.documentType}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Due: {format(new Date(event.time), "PPP 'at' p")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Simulations Tab */}
        <TabsContent value="simulations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Simulation Usage Analytics
              </CardTitle>
              <CardDescription>Monitor how simulations are being used in this class</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {simulationUsageData.map((simulation) => (
                  <div key={simulation.name} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{simulation.name}</h4>
                      <Badge variant="outline">{simulation.completion}% completion</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Attempts</p>
                        <p className="font-medium">{simulation.attempts}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Completed Simulations</p>
                        <p className="font-medium">{simulation.chats}</p>
                      </div>
                    </div>
                    <Progress value={simulation.completion} className="mt-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Curriculum Tab */}
        <TabsContent value="curriculum" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Topics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Course Topics
                </CardTitle>
                <CardDescription>Key topics covered in this course</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {topics.length > 0 ? (
                      topics.map((topic) => (
                        <div key={topic.id} className="p-3 border rounded-lg">
                          <h4 className="font-medium">{topic.name}</h4>
                          <p className="text-sm text-muted-foreground">{topic.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        No topics defined
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>


      </Tabs>
    </div>
  );
} 