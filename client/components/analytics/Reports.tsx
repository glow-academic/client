/**
 * Reports.tsx
 * Used to display the reports for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, AlertTriangle, Download, Search, Loader2, TrendingDown, Clock, Target, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAllUsers } from "@/utils/queries/users/get-all-users";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getSimulationAttemptsByUsers } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-users";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { toast } from "sonner";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

interface ReportOptions {
  includeStudentTypeChart: boolean;
  includePerformanceChart: boolean;
  includeRadarChart: boolean;
  includeTimeChart: boolean;
  includeDetailedScores: boolean;
  includeFeedback: boolean;
}

type SortOption = "score-desc" | "score-asc" | "name-asc" | "name-desc" | "sessions-desc";
type FilterOption = "all" | "struggling" | "performing-well";

export default function Reports() {
  const [sortBy, setSortBy] = useState<SortOption>("score-desc");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [downloadingReports, setDownloadingReports] = useState<Set<string>>(new Set());

  // Fetch data
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => getAllUsers(),
  });

  const { data: simulations, isLoading: isLoadingSimulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups, isLoading: isLoadingStandardGroups } = useQuery(
    {
      queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
      queryFn: () =>
        getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
      enabled: !!rubrics && rubrics.length > 0,
    },
  );

  const { data: standards, isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", users?.map((user) => user.id)],
    queryFn: () => getSimulationAttemptsByUsers(users!.map((user) => user.id)),
    enabled: !!users && users.length > 0,
  });

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades, isLoading: isLoadingGrades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: feedbacks, isLoading: isLoadingFeedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id),
      ),
    enabled: !!grades && grades.length > 0,
  });

  // Calculate analytics
  const analytics = useMemo(() => {
    if (
      !users ||
      !chats ||
      !grades ||
      !feedbacks ||
      !standards ||
      !standardGroups ||
      !rubrics
    )
      return null;

    const tas = users.filter((user) => user.role === "ta");

    // TA leaderboard based on actual grades
    const taPerformance = tas
      .map((ta) => {
        const taAttempts =
          attempts?.filter((attempt) => attempt.userId === ta.id) || [];
        const taChats = chats.filter((chat) =>
          taAttempts.some((attempt) => attempt.id === chat.attemptId),
        );
        const taGrades = grades.filter((grade) =>
          taChats.some((chat) => chat.id === grade.simulationChatId),
        );

        const avgScore =
          taGrades.length > 0
            ? Math.round(
              taGrades.reduce((sum, g) => sum + g.score, 0) / taGrades.length,
            )
            : 0;

        const completedSessions = taChats.filter(
          (chat) => chat.completed,
        ).length;
        const totalSessions = taChats.length;

        // Calculate skill breakdown for this TA using only simulation chat rubrics
        const taFeedbacks = feedbacks.filter((f) =>
          taGrades.some((g) => g.id === f.simulationChatGradeId),
        );

        const validRubrics = rubrics?.filter((r) => simulations?.some((s) => s.rubricId === r.id));
        const validGroupStandards = standardGroups?.filter((g) => validRubrics?.some((r) => r.id === g.rubricId));
        const validStandards = standards?.filter((s) => validGroupStandards?.some((g) => g.id === s.standardGroupId));

        const skillBreakdown = validGroupStandards.map((group) => {
          const groupStandards = validStandards.filter(
            (s) => s.standardGroupId === group.id,
          );
          const groupFeedbacks = taFeedbacks.filter((f) =>
            groupStandards.some((s) => s.id === f.standardId),
          );

          const avgSkillScore =
            groupFeedbacks.length > 0
              ? Math.round(
                (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
                  groupFeedbacks.length /
                  (groupStandards[0]?.points || 1)) * 100,
              )
              : 0;

          return {
            skill: group.name,
            score: avgSkillScore,
            feedbackCount: groupFeedbacks.length,
          };
        });

        // Find weakest and strongest skills
        const weakestSkill = skillBreakdown.reduce(
          (min, skill) => (skill.score < min.score ? skill : min),
          skillBreakdown[0] || { skill: "Unknown", score: 100, feedbackCount: 0 },
        );

        const strongestSkill = skillBreakdown.reduce(
          (max, skill) => (skill.score > max.score ? skill : max),
          skillBreakdown[0] || { skill: "Unknown", score: 0, feedbackCount: 0 },
        );

        // Calculate average time taken
        const avgTimeMinutes = taGrades.length > 0
          ? Math.round(taGrades.reduce((sum, g) => sum + g.timeTaken, 0) / taGrades.length / 60)
          : 0;

        // Calculate pass rate
        const passRate = taGrades.length > 0
          ? Math.round((taGrades.filter(g => g.passed).length / taGrades.length) * 100)
          : 0;

        // Determine if struggling (no sessions OR low performance)
        const isStruggling = totalSessions === 0 || (avgScore < 70 && totalSessions > 0);

        // Calculate trend (last 3 vs first 3 sessions)
        const sortedGrades = taGrades.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        let trend = "stable";
        if (sortedGrades.length >= 3) {
          const firstThree = sortedGrades.slice(0, 3);
          const lastThree = sortedGrades.slice(-3);
          const firstAvg = firstThree.reduce((sum, g) => sum + g.score, 0) / firstThree.length;
          const lastAvg = lastThree.reduce((sum, g) => sum + g.score, 0) / lastThree.length;
          
          if (lastAvg > firstAvg + 5) trend = "improving";
          else if (lastAvg < firstAvg - 5) trend = "declining";
        }

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
          initials: ta.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase(),
          skillBreakdown,
          weakestSkill,
          strongestSkill,
          avgTimeMinutes,
          passRate,
          trend,
          isStruggling,
          hasNoSessions: totalSessions === 0,
        };
      });

    return {
      taPerformance,
    };
  }, [users, chats, grades, feedbacks, standards, standardGroups, attempts, rubrics]);

  // Sort, filter, and search TAs
  const sortedFilteredAndSearchedTAs = useMemo(() => {
    if (!analytics) return [];

    let filtered = [...analytics.taPerformance];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(ta => 
        ta.name.toLowerCase().includes(query) || 
        ta.username.toLowerCase().includes(query)
      );
    }

    // Apply performance filter
    switch (filterBy) {
      case "struggling":
        filtered = filtered.filter(ta => ta.isStruggling);
        break;
      case "performing-well":
        filtered = filtered.filter(ta => !ta.isStruggling);
        break;
      // "all" shows everyone
    }

    // Apply sort
    switch (sortBy) {
      case "score-desc":
        filtered.sort((a, b) => b.avgScore - a.avgScore);
        break;
      case "score-asc":
        filtered.sort((a, b) => a.avgScore - b.avgScore);
        break;
      case "name-asc":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "sessions-desc":
        filtered.sort((a, b) => b.totalSessions - a.totalSessions);
        break;
    }

    return filtered;
  }, [analytics, sortBy, filterBy, searchQuery]);

  const handleDownloadReport = async (userId: string, options: ReportOptions) => {
    setDownloadingReports(prev => new Set(prev).add(userId));

    try {
      const queryParams = new URLSearchParams({
        includeStudentTypeChart: options.includeStudentTypeChart.toString(),
        includePerformanceChart: options.includePerformanceChart.toString(),
        includeRadarChart: options.includeRadarChart.toString(),
        includeTimeChart: options.includeTimeChart.toString(),
        includeDetailedScores: options.includeDetailedScores.toString(),
        includeFeedback: options.includeFeedback.toString(),
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}?${queryParams}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `TA_Report_${userId}.pdf`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Report downloaded successfully');
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
    } finally {
      setDownloadingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  // Loading state
  if (
    isLoadingUsers ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingGrades ||
    isLoadingFeedbacks ||
    isLoadingStandards ||
    isLoadingStandardGroups ||
    isLoadingRubrics ||
    isLoadingSimulations
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search TAs by name or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="filter" className="text-sm font-medium">Filter:</Label>
            <Select value={filterBy} onValueChange={(value: FilterOption) => setFilterBy(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All TAs</SelectItem>
                <SelectItem value="struggling">Struggling TAs</SelectItem>
                <SelectItem value="performing-well">Performing Well</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="sort" className="text-sm font-medium">Sort:</Label>
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score-desc">Score (High to Low)</SelectItem>
                <SelectItem value="score-asc">Score (Low to High)</SelectItem>
                <SelectItem value="name-asc">Name (A to Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z to A)</SelectItem>
                <SelectItem value="sessions-desc">Sessions (Most to Least)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {sortedFilteredAndSearchedTAs.length > 0 ? (
          sortedFilteredAndSearchedTAs.map((ta, index) => (
            <Card
              key={ta.id}
              className={`transition-colors ${ta.isStruggling
                ? "border-orange-200 bg-orange-50/30"
                : "hover:bg-muted/30"
                }`}
            >
              <CardContent className="px-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      #{index + 1}
                    </div>
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className={ta.isStruggling ? "bg-orange-100 text-orange-800" : ""}>
                        {ta.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{ta.name}</h3>
                        {ta.isStruggling && (
                          <AlertTriangle className="h-5 w-5 text-orange-500" />
                        )}
                        {ta.trend === "improving" && (
                          <Badge variant="secondary" className="text-green-700 bg-green-100">
                            Improving
                          </Badge>
                        )}
                        {ta.trend === "declining" && (
                          <Badge variant="secondary" className="text-red-700 bg-red-100">
                            Declining
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mb-3">
                        {ta.username}@purdue.edu
                      </p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Average Score</p>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                ta.avgScore >= 80
                                  ? "default"
                                  : ta.avgScore >= 70
                                    ? "secondary"
                                    : "destructive"
                              }
                              className="text-sm"
                            >
                              {ta.hasNoSessions ? "No Data" : `${ta.avgScore}%`}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Sessions</p>
                          <p className="font-medium">
                            {ta.completedSessions}/{ta.totalSessions}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ta.completionRate}% completion
                          </p>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Pass Rate</p>
                          <p className="font-medium">
                            {ta.hasNoSessions ? "N/A" : `${ta.passRate}%`}
                          </p>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Avg Time</p>
                          <p className="font-medium">
                            {ta.hasNoSessions ? "N/A" : `${ta.avgTimeMinutes}min`}
                          </p>
                        </div>
                      </div>
                      
                      {!ta.hasNoSessions && (
                        <div className="mt-4">
                          <p className="text-sm text-muted-foreground mb-2">Skill Performance</p>
                          <div className="flex flex-wrap gap-2">
                            {ta.skillBreakdown.map((skill, skillIndex) => (
                              <Badge
                                key={skillIndex}
                                variant="outline"
                                className={`text-xs ${
                                  skill.score < 70 
                                    ? "border-red-200 text-red-700 bg-red-50" 
                                    : skill.score >= 85 
                                      ? "border-green-200 text-green-700 bg-green-50"
                                      : ""
                                }`}
                              >
                                {skill.skill}: {skill.score}%
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {ta.isStruggling && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Support
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>
                              Support Recommendations for {ta.name}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-6">
                            {ta.hasNoSessions ? (
                              <Card className="border-red-200 bg-red-50">
                                <CardHeader>
                                  <CardTitle className="text-red-800 flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    No Training Sessions Completed
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-4">
                                    <p className="text-red-700">
                                      This TA has not completed any training simulations yet.
                                    </p>
                                    
                                    <div className="space-y-3">
                                      <h4 className="font-medium text-red-800">Immediate Actions Required:</h4>
                                      <ul className="space-y-2 text-sm text-red-700">
                                        <li className="flex items-start gap-2">
                                          <Target className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                          <span>Schedule mandatory training session within 48 hours</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                          <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                          <span>Assign experienced TA mentor for guidance</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                          <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                          <span>Provide training timeline and expectations document</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                          <span>Follow up daily until first simulation is completed</span>
                                        </li>
                                      </ul>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ) : (
                              <>
                                <div className="grid grid-cols-2 gap-4">
                                  <Card className="border-orange-200 bg-orange-50">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="text-orange-800 text-sm">
                                        Performance Overview
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Average Score:</span>
                                        <span className="font-medium text-orange-800">{ta.avgScore}%</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Pass Rate:</span>
                                        <span className="font-medium text-orange-800">{ta.passRate}%</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Completion Rate:</span>
                                        <span className="font-medium text-orange-800">{ta.completionRate}%</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Avg Time:</span>
                                        <span className="font-medium text-orange-800">{ta.avgTimeMinutes}min</span>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  <Card className="border-blue-200 bg-blue-50">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="text-blue-800 text-sm">
                                        Skill Analysis
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                      <div className="text-sm">
                                        <span className="text-muted-foreground">Weakest Skill:</span>
                                        <div className="font-medium text-red-600 mt-1">
                                          {ta.weakestSkill.skill} ({ta.weakestSkill.score}%)
                                        </div>
                                      </div>
                                      <div className="text-sm">
                                        <span className="text-muted-foreground">Strongest Skill:</span>
                                        <div className="font-medium text-green-600 mt-1">
                                          {ta.strongestSkill.skill} ({ta.strongestSkill.score}%)
                                        </div>
                                      </div>
                                      <div className="text-sm">
                                        <span className="text-muted-foreground">Trend:</span>
                                        <div className={`font-medium mt-1 ${
                                          ta.trend === "improving" ? "text-green-600" :
                                          ta.trend === "declining" ? "text-red-600" : "text-gray-600"
                                        }`}>
                                          {ta.trend === "improving" ? "📈 Improving" :
                                           ta.trend === "declining" ? "📉 Declining" : "➡️ Stable"}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>

                                <Card className="border-purple-200 bg-purple-50">
                                  <CardHeader>
                                    <CardTitle className="text-purple-800 flex items-center gap-2">
                                      <Target className="h-5 w-5" />
                                      Targeted Action Plan
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="font-medium text-purple-800 mb-2">Priority Focus Areas:</h4>
                                        <ul className="space-y-2 text-sm text-purple-700">
                                          <li className="flex items-start gap-2">
                                            <TrendingDown className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                            <span>
                                              <strong>{ta.weakestSkill.skill}</strong> - Score {ta.weakestSkill.score}% 
                                              (needs immediate attention)
                                            </span>
                                          </li>
                                          {ta.passRate < 70 && (
                                            <li className="flex items-start gap-2">
                                              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                              <span>
                                                <strong>Pass Rate</strong> - Only {ta.passRate}% of sessions passed
                                              </span>
                                            </li>
                                          )}
                                          {ta.completionRate < 80 && (
                                            <li className="flex items-start gap-2">
                                              <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                              <span>
                                                <strong>Session Completion</strong> - {ta.completionRate}% completion rate
                                              </span>
                                            </li>
                                          )}
                                        </ul>
                                      </div>

                                      <div>
                                        <h4 className="font-medium text-purple-800 mb-2">Recommended Interventions:</h4>
                                        <ul className="space-y-2 text-sm text-purple-700">
                                          <li>• Schedule 1-on-1 coaching session focused on {ta.weakestSkill.skill.toLowerCase()}</li>
                                          <li>• Provide additional practice scenarios targeting weak areas</li>
                                          <li>• Pair with high-performing TA ({ta.strongestSkill.skill} mentor)</li>
                                          {ta.avgTimeMinutes > 30 && (
                                            <li>• Time management training - current avg: {ta.avgTimeMinutes}min (target: &lt;25min)</li>
                                          )}
                                          <li>• Weekly progress check-ins for next 4 weeks</li>
                                          <li>• Review specific feedback patterns from failed sessions</li>
                                        </ul>
                                      </div>

                                      <div>
                                        <h4 className="font-medium text-purple-800 mb-2">Success Metrics:</h4>
                                        <ul className="space-y-1 text-sm text-purple-700">
                                          <li>• Target: {ta.weakestSkill.skill} score &gt; 75% within 2 weeks</li>
                                          <li>• Target: Overall average score &gt; 75% within 3 weeks</li>
                                          <li>• Target: Pass rate &gt; 80% within 3 weeks</li>
                                        </ul>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    <ReportDownloadDialog
                      ta={ta}
                      onDownload={(options) => handleDownloadReport(ta.id, options)}
                      isDownloading={downloadingReports.has(ta.id)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-12">
            <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery.trim() 
                ? `No TAs found matching "${searchQuery}"` 
                : "No TAs match the current filter"
              }
            </h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filter criteria
            </p>
            {searchQuery.trim() && (
              <Button 
                variant="outline" 
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ReportDownloadDialogProps {
  ta: {
    id: string;
    name: string;
    username: string;
  };
  onDownload: (options: ReportOptions) => void;
  isDownloading: boolean;
}

function ReportDownloadDialog({ ta, onDownload, isDownloading }: ReportDownloadDialogProps) {
  const [options, setOptions] = useState<ReportOptions>({
    includeStudentTypeChart: true,
    includePerformanceChart: true,
    includeRadarChart: true,
    includeTimeChart: true,
    includeDetailedScores: true,
    includeFeedback: true,
  });

  const handleOptionChange = (key: keyof ReportOptions, value: boolean) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isDownloading}>
          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Download Report for {ta.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select which sections to include in the PDF report:
          </p>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="studentTypeChart"
                checked={options.includeStudentTypeChart}
                onCheckedChange={(checked) =>
                  handleOptionChange("includeStudentTypeChart", checked as boolean)
                }
              />
              <Label htmlFor="studentTypeChart" className="text-sm">
                Student Type Distribution Chart
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="performanceChart"
                checked={options.includePerformanceChart}
                onCheckedChange={(checked) =>
                  handleOptionChange("includePerformanceChart", checked as boolean)
                }
              />
              <Label htmlFor="performanceChart" className="text-sm">
                Performance by Student Type Chart
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="radarChart"
                checked={options.includeRadarChart}
                onCheckedChange={(checked) =>
                  handleOptionChange("includeRadarChart", checked as boolean)
                }
              />
              <Label htmlFor="radarChart" className="text-sm">
                Skills Radar Chart
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="timeChart"
                checked={options.includeTimeChart}
                onCheckedChange={(checked) =>
                  handleOptionChange("includeTimeChart", checked as boolean)
                }
              />
              <Label htmlFor="timeChart" className="text-sm">
                Performance Over Time Chart
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="detailedScores"
                checked={options.includeDetailedScores}
                onCheckedChange={(checked) =>
                  handleOptionChange("includeDetailedScores", checked as boolean)
                }
              />
              <Label htmlFor="detailedScores" className="text-sm">
                Detailed Score Table
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="feedback"
                checked={options.includeFeedback}
                onCheckedChange={(checked) =>
                  handleOptionChange("includeFeedback", checked as boolean)
                }
              />
              <Label htmlFor="feedback" className="text-sm">
                Detailed Feedback Section
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={() => onDownload(options)}
              disabled={isDownloading}
              className="w-full"
            >
              {isDownloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating Report...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate & Download PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
