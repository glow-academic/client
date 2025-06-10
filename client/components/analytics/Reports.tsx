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
import { Award, AlertTriangle, Download, Filter, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAllUsers } from "@/utils/queries/users/get-all-users";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getSimulationAttemptsByUsers } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-users";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { toast } from "sonner";

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

  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  const { data: scenarios, isLoading: isLoadingScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
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
      !standardGroups
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

        // Calculate skill breakdown for this TA
        const taFeedbacks = feedbacks.filter((f) =>
          taGrades.some((g) => g.id === f.simulationChatGradeId),
        );

        const skillBreakdown = standardGroups.map((group) => {
          const groupStandards = standards.filter(
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
                  groupStandards[0]?.points || 1) * 100,
              )
              : 0;

          return {
            skill: group.name,
            score: avgSkillScore,
          };
        });

        // Find weakest skill
        const weakestSkill = skillBreakdown.reduce(
          (min, skill) => (skill.score < min.score ? skill : min),
          skillBreakdown[0] || { skill: "Unknown", score: 100 },
        );

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
          isStruggling: avgScore < 70 && totalSessions > 0,
        };
      });

    return {
      taPerformance,
    };
  }, [users, chats, grades, feedbacks, standards, standardGroups, attempts]);

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
    isLoadingAgents ||
    isLoadingScenarios
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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter & Sort
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div>
                <Label htmlFor="filter">Filter by Performance</Label>
                <Select value={filterBy} onValueChange={(value: FilterOption) => setFilterBy(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All TAs</SelectItem>
                    <SelectItem value="struggling">Struggling TAs (Score &lt; 70%)</SelectItem>
                    <SelectItem value="performing-well">Performing Well (Score ≥ 70%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sort">Sort by</Label>
                <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                  <SelectTrigger>
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
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-3">
        {sortedFilteredAndSearchedTAs.length > 0 ? (
          sortedFilteredAndSearchedTAs.map((ta, index) => (
            <div
              key={ta.id}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${ta.isStruggling
                ? "border-orange-200 bg-orange-50/50 hover:bg-orange-50"
                : "hover:bg-muted/50"
                }`}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                  #{index + 1}
                </div>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={ta.isStruggling ? "bg-orange-100 text-orange-800" : ""}>
                    {ta.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{ta.name}</p>
                    {ta.isStruggling && (
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {ta.username}@purdue.edu
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
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
                <div className="flex items-center gap-2">
                  {ta.isStruggling && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Support
                        </Button>
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

                          {/* Skill Breakdown */}
                          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                            <h4 className="font-medium text-blue-800 mb-2">
                              Skill Performance
                            </h4>
                            <div className="space-y-2">
                              {ta.skillBreakdown.map((skill, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <span className="text-muted-foreground">
                                    {skill.skill}:
                                  </span>
                                  <span
                                    className={`font-medium ${skill.score < 70 ? "text-red-600" : skill.score < 80 ? "text-yellow-600" : "text-green-600"}`}
                                  >
                                    {skill.score}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="font-medium">Recommended Actions:</h4>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                              <li>• Schedule one-on-one mentoring session</li>
                              <li>
                                • Focus on {ta.weakestSkill.skill.toLowerCase()}{" "}
                                improvement
                              </li>
                              <li>• Review specific feedback patterns</li>
                              <li>• Practice with similar student scenarios</li>
                              <li>
                                • Pair with high-performing TA for shadowing
                              </li>
                            </ul>
                          </div>
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
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <Award className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">
              {searchQuery.trim() 
                ? `No TAs found matching "${searchQuery}"` 
                : "No TAs match the current filter"
              }
            </p>
            {searchQuery.trim() && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
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
          <Download className="h-4 w-4 mr-2" />
          {isDownloading ? "Generating..." : "Download Report"}
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
