/**
 * components/admin/class-details-content.tsx
 * Class Details component
 */
"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, compareAsc, startOfDay, subDays } from "date-fns";

import { getAllChats } from "@/utils/queries/get-all-chats";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { getProfiles } from "@/utils/queries/get-profiles";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import Documents from "@/components/Documents";
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

interface ClassDetailsContentProps {
  classData: any;
}

export function ClassDetailsContent({ classData }: ClassDetailsContentProps) {
  const [activeEmotion, setActiveEmotion] = useState<"happy" | "confused" | "angry">("happy");

  // Fetch chats for class details
  const { data: chats } = useQuery({
    queryKey: ["all-chats"],
    queryFn: () => getAllChats(),
  });

  // Fetch profiles for class details
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getProfiles(),
  });

  // Fetch rubrics for class details
  const { data: rubrics } = useQuery({
    queryKey: ["all-rubrics"],
    queryFn: () => getRubrics(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Generate score trend data (last 7 days)
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
      .map(([dateStr, data]) => {
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

  // Generate emotion data based on chat profiles
  const emotionData = useMemo(() => {
    if (!chats || !profiles) return [];

    // Get chats for this class
    const classChats = chats.filter((chat) => {
      // You might need to filter by class here if chat has classId
      return true; // For now, include all chats
    });

    // Count interactions by profile type
    const profileCounts: Record<string, number> = {
      happy: 0,
      confused: 0,
      angry: 0,
    };

    // Calculate percentages
    const total = classChats.length || 1; // Avoid division by zero
    const happy = Math.round((profileCounts.happy / total) * 100);
    const confused = Math.round((profileCounts.confused / total) * 100);
    const angry = Math.round((profileCounts.angry / total) * 100);

    return [
      { emotion: "Happy", value: happy, fill: "#10b981" },
      { emotion: "Confused", value: confused, fill: "#f59e0b" },
      { emotion: "Angry", value: angry, fill: "#ef4444" },
    ];
  }, [chats, profiles]);

  return (
    <div className="space-y-6">
      {/* Performance Trend Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
          <CardDescription>
            TA performance metrics and student emotional data for {classData.classCode}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Line Chart - Score Trends */}
          <div className="h-80">
            <h3 className="text-sm font-medium mb-2">
              Average Score Trend
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
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">
                Student Emotional Response
              </h3>
              <div className="flex items-center bg-secondary rounded-md p-0.5">
                <button
                  onClick={() => setActiveEmotion("happy")}
                  className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                    activeEmotion === "happy"
                      ? "bg-background shadow"
                      : "hover:bg-secondary-foreground/10"
                  }`}
                >
                  Happy
                </button>
                <button
                  onClick={() => setActiveEmotion("confused")}
                  className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                    activeEmotion === "confused"
                      ? "bg-background shadow"
                      : "hover:bg-secondary-foreground/10"
                  }`}
                >
                  Confused
                </button>
                <button
                  onClick={() => setActiveEmotion("angry")}
                  className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                    activeEmotion === "angry"
                      ? "bg-background shadow"
                      : "hover:bg-secondary-foreground/10"
                  }`}
                >
                  Angry
                </button>
              </div>
            </div>

            <div className="h-[calc(100%-24px)]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart
                  data={emotionData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  barGap={0}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="emotion" axisLine={true} tickLine={true} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  {activeEmotion === "happy" && (
                    <Bar
                      dataKey="value"
                      name="Happy"
                      fill="#10b981"
                      minPointSize={3}
                      isAnimationActive={true}
                    />
                  )}
                  {activeEmotion === "confused" && (
                    <Bar
                      dataKey="value"
                      name="Confused"
                      fill="#f59e0b"
                      minPointSize={3}
                      isAnimationActive={true}
                    />
                  )}
                  {activeEmotion === "angry" && (
                    <Bar
                      dataKey="value"
                      name="Angry"
                      fill="#ef4444"
                      minPointSize={3}
                      isAnimationActive={true}
                    />
                  )}
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle>Class Documents</CardTitle>
          <CardDescription>
            Upload and manage documents for {classData.classCode}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Documents classId={classData.id} />
        </CardContent>
      </Card>
    </div>
  );
} 