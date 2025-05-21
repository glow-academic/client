"use client";

import { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  UserCheck,
  Smile,
  HelpCircle,
  AlertCircle,
  Download,
  Loader2,
} from "lucide-react";
// Import Recharts components
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
import { getClass } from "@/utils/queries/get-class";
import { useQuery } from "@tanstack/react-query";
import { getUsers } from "@/utils/queries/get-users";
import { getAllChats } from "@/utils/queries/get-all-chats";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { format, compareAsc, startOfDay, subDays } from "date-fns";
import { updateClassThresholds } from "@/utils/mutations/update-class-thresholds";
import { toast } from "sonner";
// Interface for Teaching Assistant with scores
interface TeachingAssistant {
  id: string;
  name: string;
  username: string;
  interactions: number;
  avgScore: number;
}

export default function ClassDetailsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const router = useRouter();

  // Fetch class data
  const { data: classDataArray, isLoading: isLoadingClass } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getClass(classId),
  });

  // Ensure classData is a single object
  const classData = useMemo(() => {
    return Array.isArray(classDataArray) ? classDataArray[0] : classDataArray;
  }, [classDataArray]);

  // Fetch users
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  // Fetch chats
  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["all-chats"],
    queryFn: () => getAllChats(),
  });

  // Fetch rubrics (after chats are loaded)
  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["all-rubrics"],
    queryFn: () => getRubrics(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Student behavior controls - initialize with class thresholds if available
  const [happyLevel, setHappyLevel] = useState<number>(
    classData?.happyThreshold || 50,
  );
  const [confusedLevel, setConfusedLevel] = useState<number>(
    classData?.confusedThreshold || 30,
  );
  const [angryLevel, setAngryLevel] = useState<number>(
    classData?.aggressiveThreshold || 20,
  );

  // Update sliders when class data loads
  useEffect(() => {
    if (classData) {
      setHappyLevel(classData.happyThreshold);
      setConfusedLevel(classData.confusedThreshold);
      setAngryLevel(classData.aggressiveThreshold);
    }
  }, [classData]);

  // For emotion tab state
  const [activeEmotion, setActiveEmotion] = useState<
    "happy" | "confused" | "angry"
  >("happy");

  // Calculate TAs and their average scores
  const teachingAssistants = useMemo<TeachingAssistant[]>(() => {
    if (!users || !chats || !rubrics) return [];

    // Filter for non-admin users
    const nonAdminUsers = users.filter((user) => !user.admin);

    // Group chats by user ID
    const chatsByUser: Record<string, any[]> = {};
    chats.forEach((chat) => {
      if (!chatsByUser[chat.userId]) {
        chatsByUser[chat.userId] = [];
      }
      chatsByUser[chat.userId].push(chat);
    });

    // Calculate average scores for each TA
    return nonAdminUsers.map((user) => {
      const userChats = chatsByUser[user.id] || [];
      const userChatIds = userChats.map((chat) => chat.id);

      // Filter rubrics for this user's chats
      const userRubrics = rubrics.filter((rubric) =>
        userChatIds.includes(rubric.chatId),
      );

      // Calculate average score
      const avgScore =
        userRubrics.length > 0
          ? Math.round(
              userRubrics.reduce((sum, rubric) => sum + rubric.score, 0) /
                userRubrics.length,
            )
          : 0;

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        interactions: userChats.length,
        avgScore,
      };
    });
  }, [users, chats, rubrics]);

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
  const taEmotionData = useMemo(() => {
    if (!teachingAssistants || !chats || !rubrics) return [];

    return teachingAssistants.map((ta) => {
      // Get all chats for this TA
      const taChats = chats.filter((chat) => chat.userId === ta.id);

      // Count interactions by profile type
      const profileCounts: Record<string, number> = {
        happy: 0,
        confused: 0,
        angry: 0,
      };

      // Group by profile
      taChats.forEach((chat) => {
        const profile = chat.profile.toLowerCase();
        // Map 'aggressive' to 'angry' for the UI
        const uiProfile = profile === "aggressive" ? "angry" : profile;

        if (profileCounts[uiProfile] !== undefined) {
          profileCounts[uiProfile]++;
        }
      });

      // Calculate percentages
      const total = taChats.length || 1; // Avoid division by zero
      const happy = Math.round((profileCounts.happy / total) * 100);
      const confused = Math.round((profileCounts.confused / total) * 100);
      const angry = Math.round((profileCounts.angry / total) * 100);

      return {
        id: ta.id,
        name:
          ta.name.split(" ")[0] +
          " " +
          (ta.name.split(" ")[1] ? ta.name.split(" ")[1][0] + "." : ""),
        happy,
        confused,
        angry,
      };
    });
  }, [teachingAssistants, chats, rubrics]);

  // Get initials for avatar
  const getInitials = (name: string) => {
    if (!name) return "";

    if (name.includes(" ")) {
      const nameParts = name.split(" ");
      return (
        nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)
      ).toUpperCase();
    } else {
      return name.substring(0, 2).toUpperCase();
    }
  };

  // Add state to track loading downloads
  const [downloadingReports, setDownloadingReports] = useState<{
    [key: string]: boolean;
  }>({});

  // If data is loading, show loading state
  if (isLoadingClass || isLoadingUsers || isLoadingChats || isLoadingRubrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading course details...</p>
      </div>
    );
  }

  // If class data is not found
  if (!classData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Course not found</p>
      </div>
    );
  }

  // Go back to admin dashboard
  const handleBack = () => {
    router.push("/admin");
  };

  // Apply behavior changes
  const handleApplyBehaviorChanges = async () => {
    try {
      const { success, error } = await updateClassThresholds(
        classId,
        happyLevel,
        confusedLevel,
        angryLevel,
      );
      if (success) {
        toast.success(
          `Applied behavior settings: Happy (${happyLevel}%), Confused (${confusedLevel}%), Angry (${angryLevel}%)`,
        );
      } else {
        toast.error(`Error applying behavior changes: ${error}`);
      }
    } catch (error) {
      console.error("Error applying behavior changes:", error);
    }
  };

  // Function to handle PDF download
  const handleDownloadReport = async (ta: TeachingAssistant) => {
    try {
      // Set loading state for this TA
      setDownloadingReports((prev) => ({ ...prev, [ta.id]: true }));

      // Show loading toast and get its ID
      const toastId = toast.loading(`Generating report for ${ta.name}...`);

      // Request the PDF from the server
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/report/${ta.id}`,
        {
          method: "GET",
          headers: {
            Accept: "application/pdf",
          },
        },
      );

      // Dismiss loading toast
      toast.dismiss(toastId);

      if (!response.ok) {
        toast.error(`Failed to download report: ${response.statusText}`);
        return;
      }

      // Get the blob from the response
      const pdfBlob = await response.blob();

      // Create a download link for the blob
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TA_Report_${ta.name.replace(/\s+/g, "_")}.pdf`;
      link.style.display = "none";

      // Append to the DOM, click, and clean up
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      toast.success(`Report for ${ta.name} downloaded successfully`);
    } catch (error) {
      console.error("Error downloading report:", error);
      toast.error("Failed to download the report");
    } finally {
      // Clear loading state
      setDownloadingReports((prev) => ({ ...prev, [ta.id]: false }));
    }
  };

  return (
    <div className="container mx-auto py-8">
      {/* Header with navigation */}
      <div className="flex items-center mb-8">
        <Button variant="ghost" onClick={handleBack} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-medium">
              {classData.classCode}
            </Badge>
            <h1 className="text-2xl font-bold">{classData.name}</h1>
          </div>
          <p className="text-muted-foreground mt-1">{classData.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* TA List */}
        <div className="md:col-span-2 space-y-6">
          <Card className="flex flex-col h-full max-h-[500px]">
            <CardHeader className="pb-0 flex-shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Teaching Assistants</CardTitle>
                  <CardDescription>
                    Manage TAs assigned to {classData.classCode}
                  </CardDescription>
                </div>
                <span className="font-medium text-sm text-muted-foreground mr-16">
                  Avg. Score
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-grow overflow-hidden">
              <div className="border-t overflow-y-auto h-full">
                {teachingAssistants.map((ta) => (
                  <div
                    key={ta.id}
                    className="flex items-center justify-between p-4 border-b"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback
                          className={
                            ta.avgScore >= 80
                              ? "bg-primary/10"
                              : ta.avgScore >= 70
                                ? "bg-amber-100"
                                : "bg-red-100"
                          }
                        >
                          {getInitials(ta.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{ta.name}</p>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <UserCheck className="h-3 w-3 mr-1" />
                          <span>{ta.interactions} interactions</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        className={`
                        ${
                          ta.avgScore >= 80
                            ? "bg-green-100 text-green-800"
                            : ta.avgScore >= 70
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                        }
                      `}
                      >
                        Score: {ta.avgScore}%
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadReport(ta)}
                        disabled={downloadingReports[ta.id]}
                      >
                        {downloadingReports[ta.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
                {teachingAssistants.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground">
                    No teaching assistants found for this course
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Student Behavior Controls */}
        <div>
          <Card className="flex flex-col h-full max-h-[500px]">
            <CardHeader className="flex-shrink-0">
              <CardTitle>AI Student Behavior</CardTitle>
              <CardDescription>
                Adjust the behavior traits for AI students in this course
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow overflow-y-auto">
              {/* Happy students control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Smile className="h-4 w-4 mr-2 text-green-500" />
                    <span className="font-medium">Happy Students</span>
                  </div>
                  <span className="text-sm font-semibold">{happyLevel}%</span>
                </div>
                <Slider
                  value={[happyLevel]}
                  onValueChange={(values) => setHappyLevel(values[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="[&>.data-[value]:bg-green-500]"
                />
                <p className="text-xs text-muted-foreground">
                  These students are engaged, understanding the material well,
                  and responsive to teaching.
                </p>
              </div>

              {/* Confused students control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <HelpCircle className="h-4 w-4 mr-2 text-amber-500" />
                    <span className="font-medium">Confused Students</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {confusedLevel}%
                  </span>
                </div>
                <Slider
                  value={[confusedLevel]}
                  onValueChange={(values) => setConfusedLevel(values[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="[&>.data-[value]:bg-amber-500]"
                />
                <p className="text-xs text-muted-foreground">
                  These students struggle to understand concepts and require
                  additional explanation and patience.
                </p>
              </div>

              {/* Angry students control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                    <span className="font-medium">Angry Students</span>
                  </div>
                  <span className="text-sm font-semibold">{angryLevel}%</span>
                </div>
                <Slider
                  value={[angryLevel]}
                  onValueChange={(values) => setAngryLevel(values[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="[&>.data-[value]:bg-red-500]"
                />
                <p className="text-xs text-muted-foreground">
                  These students are frustrated, possibly confrontational, and
                  need careful handling to resolve issues.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 flex-shrink-0">
              <Button className="w-full" onClick={handleApplyBehaviorChanges}>
                Apply Behavior Changes
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Changes will affect all new interactions with TAs in this
                course.
              </p>
            </CardFooter>
          </Card>
        </div>

        {/* Performance Trend Charts - Now full width */}
        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>
                TA performance metrics and student emotional data
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
                      data={taEmotionData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      barGap={0}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" axisLine={true} tickLine={true} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      {activeEmotion === "happy" && (
                        <Bar
                          dataKey="happy"
                          name="Happy"
                          fill="#10b981"
                          minPointSize={3}
                          isAnimationActive={true}
                        />
                      )}
                      {activeEmotion === "confused" && (
                        <Bar
                          dataKey="confused"
                          name="Confused"
                          fill="#f59e0b"
                          minPointSize={3}
                          isAnimationActive={true}
                        />
                      )}
                      {activeEmotion === "angry" && (
                        <Bar
                          dataKey="angry"
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
        </div>
      </div>
    </div>
  );
}
