"use client";
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, compareAsc, startOfDay, subDays } from "date-fns";

import { getAllChats } from "@/utils/queries/get-all-chats";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { getAgents } from "@/utils/queries/get-agents";
import { getClasses } from "@/utils/queries/get-classes";
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
} from "recharts";

export default function ClassesGeneralPage() {
  // Fetch all data for aggregated view
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });

  const { data: chats } = useQuery({
    queryKey: ["all-chats"],
    queryFn: () => getAllChats(),
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAgents(),
  });

  const { data: rubrics } = useQuery({
    queryKey: ["all-rubrics"],
    queryFn: () => getRubrics(chats?.map((chat) => chat.id) || []),
    enabled: !!chats && chats.length > 0,
  });

  // Generate aggregated score trend data (last 7 days)
  const scoreTrendData = useMemo(() => {
    if (!rubrics) return [];

    const today = startOfDay(new Date());
    const dates: Record<string, { date: Date; scores: number[] }> = {};

    // Initialize last 7 days
    for (let i = 0; i < 7; i++) {
      const date = subDays(today, i);
      const dateStr = format(date, "yyyy-MM-dd");
      dates[dateStr] = { date, scores: [] };
    }

    // Group scores by date
    rubrics.forEach((rubric) => {
      const createdAt = new Date(rubric.createdAt);
      const dateStr = format(createdAt, "yyyy-MM-dd");

      if (dates[dateStr]) {
        dates[dateStr].scores.push(rubric.score);
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
      .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));
  }, [rubrics]);

  // Generate aggregated emotion data
  const emotionData = useMemo(() => {
    if (!chats || !agents) return [];

    // For demo purposes, generate some sample emotion data
    // In a real implementation, you'd analyze chat sentiment or profile usage
    const happy = Math.round(Math.random() * 40 + 40); // 40-80%
    const confused = Math.round(Math.random() * 30 + 10); // 10-40%
    const angry = Math.max(0, 100 - happy - confused); // Remainder

    return [
      { emotion: "Happy", value: happy, fill: "#10b981" },
      { emotion: "Confused", value: confused, fill: "#f59e0b" },
      { emotion: "Angry", value: angry, fill: "#ef4444" },
    ];
  }, [chats, agents]);

  return (
    <div className="space-y-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{chats?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Student-TA interactions
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rubrics && rubrics.length > 0 
                ? Math.round(rubrics.reduce((sum, r) => sum + r.score, 0) / rubrics.length)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Overall TA performance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trend Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Aggregated Performance Trends</CardTitle>
          <CardDescription>
            Overall TA performance metrics and student emotional data across all classes
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Line Chart - Score Trends */}
          <div className="h-80">
            <h3 className="text-sm font-medium mb-2">
              Average Score Trend (All Classes)
            </h3>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={scoreTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" axisLine={true} tickLine={true} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Avg. Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart - Student Emotions */}
          <div className="h-80">
            <h3 className="text-sm font-medium mb-2">
              Student Emotional Response (All Classes)
            </h3>
            <ResponsiveContainer width="100%" height="90%">
              <RechartsBarChart
                data={emotionData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="emotion" axisLine={true} tickLine={true} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  name="Percentage"
                  fill="#8884d8"
                  minPointSize={3}
                />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
