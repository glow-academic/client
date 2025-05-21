/**
 * Analytics.tsx
 * Used to display analytics for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */

import { getAllChats } from "@/utils/queries/get-all-chats";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { getUsers } from "@/utils/queries/get-users";
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
import {
  BarChart3,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Brain,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Legend,
} from "recharts";
import {
  format,
  compareAsc,
  startOfDay,
  differenceInDays,
  subDays,
} from "date-fns";

// Interface for Teaching Assistant data
interface TeachingAssistant {
  id: string;
  name: string;
  username: string;
  admin: boolean;
  [key: string]: any; // For other properties
}

// Interface for TA data with score
interface TAWithScore {
  id: string;
  name: string;
  username: string;
  score: number;
}

// Interface for chart data point
interface ChartDataPoint {
  date: string;
  value: number;
  name: string;
}

// Interface for custom tooltip props
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<any>;
  label?: string;
}

// Interfaces for modal props
interface TotalTAsModalProps {
  show: boolean;
  onClose: () => void;
  tas: TeachingAssistant[];
}

interface AvgScoreModalProps {
  show: boolean;
  onClose: () => void;
  scoreData: ChartDataPoint[];
  avgScore: number;
  CustomTooltip: React.FC<CustomTooltipProps>;
}

interface TotalInteractionsModalProps {
  show: boolean;
  onClose: () => void;
  interactionsData: ChartDataPoint[];
  totalInteractions: number;
  CustomTooltip: React.FC<CustomTooltipProps>;
}

interface NeedAttentionModalProps {
  show: boolean;
  onClose: () => void;
  tas: TAWithScore[];
  getInitials: (name: string) => string;
}

export default function Analytics() {
  const [showTotalTAsModal, setShowTotalTAsModal] = useState(false);
  const [showAvgScoreModal, setShowAvgScoreModal] = useState(false);
  const [showTotalInteractionsModal, setShowTotalInteractionsModal] =
    useState(false);
  const [showNeedAttentionModal, setShowNeedAttentionModal] = useState(false);

  // Fetch Users
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  // Fetch Chats
  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["all-chats"],
    queryFn: () => getAllChats(),
  });

  // Fetch Rubrics (after chats are loaded)
  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["all-rubrics"],
    queryFn: () => getRubrics(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Calculate Total TAs (users who are not admins)
  const teachingAssistants = useMemo<TeachingAssistant[]>(() => {
    if (!users) return [];
    return users.filter((user) => !user.admin);
  }, [users]);

  // Calculate Average Score from rubrics
  const averageScore = useMemo(() => {
    if (!rubrics || rubrics.length === 0) return 0;
    const sum = rubrics.reduce((acc, rubric) => acc + rubric.score, 0);
    return Math.round(sum / rubrics.length);
  }, [rubrics]);

  // Get the score color class based on value
  const getScoreColorClass = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 70) return "text-amber-600";
    return "text-red-600";
  };

  // Get badge variant based on score
  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80)
      return { className: "bg-green-50 text-green-700 border-green-200" };
    if (score >= 70)
      return { className: "bg-amber-50 text-amber-700 border-amber-200" };
    return { className: "bg-red-50 text-red-700 border-red-200" };
  };

  // Calculate TAs needing attention (score < 70%)
  const needAttentionTAs = useMemo<TAWithScore[]>(() => {
    if (!users || !rubrics) return [];

    // Group rubrics by chat.userId to get average scores per TA
    const taScores: Record<
      string,
      { scores: number[]; name: string; username: string }
    > = {};

    if (chats && rubrics) {
      chats.forEach((chat) => {
        const chatRubrics = rubrics.filter((r) => r.chatId === chat.id);
        const user = users.find((u) => u.id === chat.userId);

        if (chatRubrics.length > 0 && user && !user.admin) {
          if (!taScores[user.id]) {
            taScores[user.id] = {
              scores: [],
              name: user.name,
              username: user.username,
            };
          }

          chatRubrics.forEach((rubric) => {
            taScores[user.id].scores.push(rubric.score);
          });
        }
      });
    }

    // Calculate average scores and filter TAs with scores < 70%
    const lowPerformers = Object.entries(taScores)
      .map(([id, data]) => {
        const avgScore =
          data.scores.length > 0
            ? Math.round(
                data.scores.reduce((sum, score) => sum + score, 0) /
                  data.scores.length,
              )
            : 0;

        return {
          id,
          name: data.name,
          username: data.username,
          score: avgScore,
        };
      })
      .filter((ta) => ta.score < 70);

    return lowPerformers;
  }, [users, chats, rubrics]);

  // Generate time-series data for scores
  const scoreTimeData = useMemo<ChartDataPoint[]>(() => {
    if (!chats || !rubrics) return [];

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
      const chat = chats.find((c) => c.id === rubric.chatId);
      if (chat) {
        const createdAt = new Date(rubric.createdAt);
        const dateStr = format(createdAt, "yyyy-MM-dd");

        if (dates[dateStr]) {
          dates[dateStr].scores.push(rubric.score);
        }
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
          date: dateStr,
          value: avgScore,
          name: format(data.date, "MMM dd"),
        };
      })
      .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));
  }, [chats, rubrics]);

  // Generate time-series data for interactions
  const interactionsTimeData = useMemo<ChartDataPoint[]>(() => {
    if (!chats) return [];

    const today = startOfDay(new Date());
    const dates: Record<string, { date: Date; count: number }> = {};

    // Initialize last 7 days
    for (let i = 0; i < 7; i++) {
      const date = subDays(today, i);
      const dateStr = format(date, "yyyy-MM-dd");
      dates[dateStr] = { date, count: 0 };
    }

    // Count interactions by date
    chats.forEach((chat) => {
      const createdAt = new Date(chat.createdAt);
      const dateStr = format(createdAt, "yyyy-MM-dd");

      if (dates[dateStr]) {
        dates[dateStr].count++;
      }
    });

    return Object.entries(dates)
      .map(([dateStr, data]) => ({
        date: dateStr,
        value: data.count,
        name: format(data.date, "MMM dd"),
      }))
      .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));
  }, [chats]);

  // Get score trend (compared to previous day)
  const scoreTrend = useMemo(() => {
    if (scoreTimeData.length < 2) return { value: 0, isPositive: true };

    const latest = scoreTimeData[scoreTimeData.length - 1].value;
    const previous = scoreTimeData[scoreTimeData.length - 2].value;

    if (previous === 0) return { value: 0, isPositive: true };

    const change = Math.round(((latest - previous) / previous) * 100);
    return { value: Math.abs(change), isPositive: change >= 0 };
  }, [scoreTimeData]);

  // Get interactions trend (compared to previous day)
  const interactionsTrend = useMemo(() => {
    if (interactionsTimeData.length < 2) return { value: 0, isPositive: true };

    const latest = interactionsTimeData[interactionsTimeData.length - 1].value;
    const previous =
      interactionsTimeData[interactionsTimeData.length - 2].value;

    if (previous === 0) return { value: 0, isPositive: true };

    const change = Math.round(((latest - previous) / previous) * 100);
    return { value: Math.abs(change), isPositive: change >= 0 };
  }, [interactionsTimeData]);

  // Get initials from name
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

  // Get performance by student type
  const studentTypePerformance = useMemo(() => {
    if (!chats || !rubrics)
      return {
        happy: 0,
        confused: 0,
        aggressive: 0,
      };

    const typeScores: Record<string, number[]> = {
      happy: [],
      confused: [],
      aggressive: [],
    };

    chats.forEach((chat) => {
      const chatRubrics = rubrics.filter((r) => r.chatId === chat.id);
      if (chatRubrics.length > 0) {
        const profileType = chat.profile.toLowerCase();

        chatRubrics.forEach((rubric) => {
          if (typeScores[profileType]) {
            typeScores[profileType].push(rubric.score);
          }
        });
      }
    });

    // Calculate average for each type
    const result = {
      happy:
        typeScores.happy.length > 0
          ? Math.round(
              typeScores.happy.reduce((sum, score) => sum + score, 0) /
                typeScores.happy.length,
            )
          : 0,
      confused:
        typeScores.confused.length > 0
          ? Math.round(
              typeScores.confused.reduce((sum, score) => sum + score, 0) /
                typeScores.confused.length,
            )
          : 0,
      aggressive:
        typeScores.aggressive.length > 0
          ? Math.round(
              typeScores.aggressive.reduce((sum, score) => sum + score, 0) /
                typeScores.aggressive.length,
            )
          : 0,
    };

    return result;
  }, [chats, rubrics]);

  // Get top and bottom performers
  const taPerformers = useMemo(() => {
    if (!users || !chats || !rubrics)
      return {
        topPerformers: [],
        needImprovement: [],
      };

    // Group rubrics by chat.userId to get average scores per TA
    const taScores: Record<
      string,
      {
        scores: number[];
        name: string;
        username: string;
        id: string;
      }
    > = {};

    chats.forEach((chat) => {
      const chatRubrics = rubrics.filter((r) => r.chatId === chat.id);
      const user = users.find((u) => u.id === chat.userId);

      if (chatRubrics.length > 0 && user && !user.admin) {
        if (!taScores[user.id]) {
          taScores[user.id] = {
            scores: [],
            name: user.name,
            username: user.username,
            id: user.id,
          };
        }

        chatRubrics.forEach((rubric) => {
          taScores[user.id].scores.push(rubric.score);
        });
      }
    });

    // Calculate average scores
    const taWithScores = Object.values(taScores).map((data) => {
      const avgScore =
        data.scores.length > 0
          ? Math.round(
              data.scores.reduce((sum, score) => sum + score, 0) /
                data.scores.length,
            )
          : 0;

      return {
        id: data.id,
        name: data.name,
        username: data.username,
        score: avgScore,
        initials: getInitials(data.name),
      };
    });

    // Sort by score
    taWithScores.sort((a, b) => b.score - a.score);

    return {
      topPerformers: taWithScores.slice(0, 3),
      needImprovement: taWithScores.slice(-3).reverse(),
    };
  }, [users, chats, rubrics]);

  // Custom tooltip for charts
  const CustomTooltip: React.FC<CustomTooltipProps> = ({
    active,
    payload,
    label,
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-2 border rounded shadow text-sm">
          <p className="font-medium">{label}</p>
          <p className="text-primary">{`Value: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  // If all data is still loading, show loading state
  if (isLoadingUsers || isLoadingChats || isLoadingRubrics) {
    return (
      <div className="flex justify-center items-center p-10">
        Loading analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
          onClick={() => setShowTotalTAsModal(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total TAs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teachingAssistants.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Active teaching assistants
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
          onClick={() => setShowAvgScoreModal(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div
                className={`text-2xl font-bold ${getScoreColorClass(averageScore)}`}
              >
                {averageScore}%
              </div>
              {scoreTrend.value > 0 && (
                <Badge
                  variant="outline"
                  className={
                    scoreTrend.isPositive
                      ? "ml-2 bg-green-50 text-green-700 border-green-200"
                      : "ml-2 bg-red-50 text-red-700 border-red-200"
                  }
                >
                  {scoreTrend.isPositive ? (
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                  )}
                  {scoreTrend.value}%
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              From all interactions
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
          onClick={() => setShowTotalInteractionsModal(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Interactions
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="text-2xl font-bold">{chats?.length || 0}</div>
              {interactionsTrend.value > 0 && (
                <Badge
                  variant="outline"
                  className={
                    interactionsTrend.isPositive
                      ? "ml-2 bg-green-50 text-green-700 border-green-200"
                      : "ml-2 bg-red-50 text-red-700 border-red-200"
                  }
                >
                  {interactionsTrend.isPositive ? (
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                  )}
                  {interactionsTrend.value}%
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Total interactions</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
          onClick={() => setShowNeedAttentionModal(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Need Attention
            </CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="text-2xl font-bold">
                {needAttentionTAs.length}
              </div>
              <Badge
                variant="outline"
                className="ml-2 bg-red-50 text-red-700 border-red-200"
              >
                <ArrowDownRight className="h-3 w-3 mr-1" />
                Critical
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              TAs scoring below 70%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance by Student Type and TA Performance */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Performance by Student Type</CardTitle>
            <CardDescription>
              How TAs perform with different student personalities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-4 w-4 rounded-full bg-green-500 mr-2"></div>
                    <span className="font-medium">Happy Students</span>
                  </div>
                  <span className="font-bold">
                    {studentTypePerformance.happy}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${studentTypePerformance.happy}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-4 w-4 rounded-full bg-amber-500 mr-2"></div>
                    <span className="font-medium">Confused Students</span>
                  </div>
                  <span className="font-bold">
                    {studentTypePerformance.confused}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${studentTypePerformance.confused}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-4 w-4 rounded-full bg-red-500 mr-2"></div>
                    <span className="font-medium">Aggressive Students</span>
                  </div>
                  <span className="font-bold">
                    {studentTypePerformance.aggressive}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${studentTypePerformance.aggressive}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>TA Performance</CardTitle>
            <CardDescription>Top and bottom performers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Top Performers
                </h4>
                <div className="space-y-2">
                  {taPerformers.topPerformers.map((ta) => (
                    <div
                      key={ta.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10">
                            {ta.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span>{ta.name}</span>
                      </div>
                      <Badge variant="secondary">{ta.score}%</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Need Improvement
                </h4>
                <div className="space-y-2">
                  {taPerformers.needImprovement.map((ta) => (
                    <div
                      key={ta.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-red-100 text-red-800">
                            {ta.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span>{ta.name}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-red-600 border-red-200 bg-red-50"
                      >
                        {ta.score}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <TotalTAsModal
        show={showTotalTAsModal}
        onClose={() => setShowTotalTAsModal(false)}
        tas={teachingAssistants}
      />

      <AvgScoreModal
        show={showAvgScoreModal}
        onClose={() => setShowAvgScoreModal(false)}
        scoreData={scoreTimeData}
        avgScore={averageScore}
        CustomTooltip={CustomTooltip}
      />

      <TotalInteractionsModal
        show={showTotalInteractionsModal}
        onClose={() => setShowTotalInteractionsModal(false)}
        interactionsData={interactionsTimeData}
        totalInteractions={chats?.length || 0}
        CustomTooltip={CustomTooltip}
      />

      <NeedAttentionModal
        show={showNeedAttentionModal}
        onClose={() => setShowNeedAttentionModal(false)}
        tas={needAttentionTAs}
        getInitials={getInitials}
      />
    </div>
  );
}

// Modal component for displaying all TAs
function TotalTAsModal({ show, onClose, tas }: TotalTAsModalProps) {
  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Teaching Assistants</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto py-4">
          {tas.map((ta) => (
            <div
              key={ta.id}
              className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {ta.name ? ta.name.substring(0, 2).toUpperCase() : "TA"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{ta.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {ta.username}@purdue.edu
                  </div>
                </div>
              </div>
            </div>
          ))}
          {tas.length === 0 && (
            <p className="text-center text-muted-foreground">
              No teaching assistants found
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Modal component for displaying Average Score
function AvgScoreModal({
  show,
  onClose,
  scoreData,
  avgScore,
  CustomTooltip,
}: AvgScoreModalProps) {
  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Average Score Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex justify-center items-center mb-4">
            <div
              className={`text-4xl font-bold ${avgScore >= 80 ? "text-green-600" : avgScore >= 70 ? "text-amber-600" : "text-red-600"}`}
            >
              {avgScore}%
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={scoreData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Score"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="text-sm text-muted-foreground text-center mt-2">
            Average score trend over the past 7 days
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Modal component for displaying Total Interactions
function TotalInteractionsModal({
  show,
  onClose,
  interactionsData,
  totalInteractions,
  CustomTooltip,
}: TotalInteractionsModalProps) {
  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Interaction Analytics</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex justify-center items-center mb-4">
            <div className="text-4xl font-bold">{totalInteractions}</div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={interactionsData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="value"
                  name="Interactions"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className="text-sm text-muted-foreground text-center mt-2">
            Interaction count over the past 7 days
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Modal component for displaying TAs needing improvement
function NeedAttentionModal({
  show,
  onClose,
  tas,
  getInitials,
}: NeedAttentionModalProps) {
  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>TAs Needing Improvement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto py-4">
          {tas.map((ta) => (
            <div
              key={ta.id}
              className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-red-100 text-red-800">
                    {getInitials(ta.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{ta.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {ta.username}@purdue.edu
                  </div>
                </div>
              </div>
              <Badge
                variant="outline"
                className="text-red-600 border-red-200 bg-red-50"
              >
                {ta.score}%
              </Badge>
            </div>
          ))}
          {tas.length === 0 && (
            <p className="text-center text-muted-foreground">
              All TAs are performing well!
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
