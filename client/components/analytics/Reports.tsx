/**
 * Reports.tsx
 * Used to display the reports for the analytics page.
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Award,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { getUsers } from "@/utils/queries/get-users";
import { getAttempts } from "@/utils/queries/get-attempts";
import { getAttemptChats } from "@/utils/queries/get-attempt-chats";

export default function Reports() {
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

  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["all-rubrics-leaderboard"],
    queryFn: () => getRubrics(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Calculate analytics
  const analytics = useMemo(() => {
    if (!users || !chats || !rubrics) return null;

    const tas = users.filter((user) => user.role === "ta");

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

    // Struggling TAs (score < 70)
    const strugglingTAs = taPerformance.filter(
      (ta) => ta.avgScore < 70 && ta.totalSessions > 0,
    );

    return {
      taPerformance,
      strugglingTAs,
    };
  }, [users, chats, rubrics, attempts]);

  // Loading state
  if (
    isLoadingUsers ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingRubrics
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
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
    </div>
  );
}
