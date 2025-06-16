/**
 * Reports.tsx
 * Used to display the reports for the analytics page in a dense table format.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { logError } from "@/utils/logger";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import {
  AlertTriangle,
  ArrowUp,
  Award,
  Download,
  Loader2,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

interface ReportOptions {
  includeStudentTypeChart: boolean;
  includePerformanceChart: boolean;
  includeRadarChart: boolean;
  includeTimeChart: boolean;
  includeDetailedScores: boolean;
  includeFeedback: boolean;
}

type SortOption =
  | "score-desc"
  | "score-asc"
  | "name-asc"
  | "name-desc"
  | "sessions-desc";
type FilterOption = "all" | "struggling" | "performing-well";

export default function Reports() {
  const [sortBy, setSortBy] = useState<SortOption>("score-desc");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [downloadingReports, setDownloadingReports] = useState<Set<string>>(
    new Set()
  );

  // Fetch data
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
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
    }
  );

  const { data: standards, isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", profiles?.map((profile) => profile.id)],
    queryFn: () =>
      getSimulationAttemptsByProfiles(profiles!.map((profile) => profile.id)),
    enabled: !!profiles && profiles.length > 0,
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
        grades!.map((grade) => grade.id)
      ),
    enabled: !!grades && grades.length > 0,
  });

  // Calculate analytics
  const analytics = useMemo(() => {
    if (
      !profiles ||
      !chats ||
      !grades ||
      !feedbacks ||
      !standards ||
      !standardGroups ||
      !rubrics
    )
      return null;

    const tas = profiles.filter((profile) => profile.role === "ta");

    // TA leaderboard based on actual grades
    const taPerformance = tas.map((ta) => {
      const taAttempts =
        attempts?.filter((attempt) => attempt.profileId === ta.id) || [];
      const taChats = chats.filter((chat) =>
        taAttempts.some((attempt) => attempt.id === chat.attemptId)
      );
      const taGrades = grades.filter((grade) =>
        taChats.some((chat) => chat.id === grade.simulationChatId)
      );

      const avgScore =
        taGrades.length > 0
          ? Math.round(
              taGrades.reduce((sum, g) => sum + g.score, 0) / taGrades.length
            )
          : 0;

      const completedSessions = taChats.filter((chat) => chat.completed).length;
      const totalSessions = taChats.length;

      // Calculate skill breakdown for this TA using only simulation chat rubrics
      const taFeedbacks = feedbacks.filter((f) =>
        taGrades.some((g) => g.id === f.simulationChatGradeId)
      );

      const validRubrics = rubrics?.filter((r) =>
        simulations?.some((s) => s.rubricId === r.id)
      );
      const validGroupStandards = standardGroups?.filter((g) =>
        validRubrics?.some((r) => r.id === g.rubricId)
      );
      const validStandards = standards?.filter((s) =>
        validGroupStandards?.some((g) => g.id === s.standardGroupId)
      );

      const skillBreakdown = validGroupStandards.map((group) => {
        const groupStandards = validStandards.filter(
          (s) => s.standardGroupId === group.id
        );
        const groupFeedbacks = taFeedbacks.filter((f) =>
          groupStandards.some((s) => s.id === f.standardId)
        );

        const avgSkillScore =
          groupFeedbacks.length > 0
            ? Math.round(
                (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
                  groupFeedbacks.length /
                  (rubrics?.find((r) => r.id === group.rubricId)?.points ||
                    100)) *
                  100
              )
            : 0;

        return {
          skill: group.shortName,
          score: avgSkillScore,
          feedbackCount: groupFeedbacks.length,
        };
      });

      // Find weakest and strongest skills
      const weakestSkill = skillBreakdown.reduce(
        (min, skill) => (skill.score < min.score ? skill : min),
        skillBreakdown[0] || { skill: "Unknown", score: 100, feedbackCount: 0 }
      );

      const strongestSkill = skillBreakdown.reduce(
        (max, skill) => (skill.score > max.score ? skill : max),
        skillBreakdown[0] || { skill: "Unknown", score: 0, feedbackCount: 0 }
      );

      // Calculate average time taken
      const avgTimeMinutes =
        taGrades.length > 0
          ? Math.round(
              taGrades.reduce((sum, g) => sum + g.timeTaken, 0) /
                taGrades.length /
                60
            )
          : 0;

      // Calculate pass rate
      const passRate =
        taGrades.length > 0
          ? Math.round(
              (taGrades.filter((g) => g.passed).length / taGrades.length) * 100
            )
          : 0;

      // Determine if struggling (no sessions OR low performance)
      const isStruggling =
        totalSessions === 0 || (avgScore < 70 && totalSessions > 0);

      // Calculate trend (last 3 vs first 3 sessions)
      const sortedGrades = taGrades.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      let trend = "stable";
      if (sortedGrades.length >= 3) {
        const firstThree = sortedGrades.slice(0, 3);
        const lastThree = sortedGrades.slice(-3);
        const firstAvg =
          firstThree.reduce((sum, g) => sum + g.score, 0) / firstThree.length;
        const lastAvg =
          lastThree.reduce((sum, g) => sum + g.score, 0) / lastThree.length;

        if (lastAvg > firstAvg + 5) trend = "improving";
        else if (lastAvg < firstAvg - 5) trend = "declining";
      }

      return {
        id: ta.id,
        firstName: ta.firstName,
        lastName: ta.lastName,
        username: ta.alias,
        avgScore,
        completedSessions,
        totalSessions,
        completionRate:
          totalSessions > 0
            ? Math.round((completedSessions / totalSessions) * 100)
            : 0,
        initials:
          ta.firstName +
          " " +
          ta.lastName
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
  }, [
    profiles,
    chats,
    grades,
    feedbacks,
    standards,
    standardGroups,
    attempts,
    rubrics,
    simulations,
  ]);

  // Sort, filter, and search TAs
  const sortedFilteredAndSearchedTAs = useMemo(() => {
    if (!analytics) return [];

    let filtered = [...analytics.taPerformance];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (ta) =>
          ta.firstName.toLowerCase().includes(query) ||
          ta.lastName.toLowerCase().includes(query) ||
          ta.username.toLowerCase().includes(query)
      );
    }

    // Apply performance filter
    switch (filterBy) {
      case "struggling":
        filtered = filtered.filter((ta) => ta.isStruggling);
        break;
      case "performing-well":
        filtered = filtered.filter((ta) => !ta.isStruggling);
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
        filtered.sort((a, b) => a.firstName.localeCompare(b.firstName));
        break;
      case "name-desc":
        filtered.sort((a, b) => b.firstName.localeCompare(a.firstName));
        break;
      case "sessions-desc":
        filtered.sort((a, b) => b.totalSessions - a.totalSessions);
        break;
    }

    return filtered;
  }, [analytics, sortBy, filterBy, searchQuery]);

  const handleDownloadReport = async (
    profileId: string,
    options: ReportOptions
  ) => {
    setDownloadingReports((prev) => new Set(prev).add(profileId));

    try {
      const queryParams = new URLSearchParams({
        includeStudentTypeChart: options.includeStudentTypeChart.toString(),
        includePerformanceChart: options.includePerformanceChart.toString(),
        includeRadarChart: options.includeRadarChart.toString(),
        includeTimeChart: options.includeTimeChart.toString(),
        includeDetailedScores: options.includeDetailedScores.toString(),
        includeFeedback: options.includeFeedback.toString(),
      });

      const response = await fetch(
        `${process.env["NEXT_PUBLIC_API_URL"]}/profiles/${profileId}?${queryParams}`,
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get("content-disposition");
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
        : `TA_Report_${profileId}.pdf`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "report.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Report downloaded successfully");
    } catch (error) {
      toast.error(
        `Failed to download report: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      logError(
        `Failed to download report: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setDownloadingReports((prev) => {
        const newSet = new Set(prev);
        newSet.delete(profileId);
        return newSet;
      });
    }
  };

  // Loading state
  if (
    isLoadingProfiles ||
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
      {/* Header with search and filters */}
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
            <Label htmlFor="filter" className="text-sm font-medium">
              Filter:
            </Label>
            <Select
              value={filterBy}
              onValueChange={(value: FilterOption) => setFilterBy(value)}
            >
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
            <Label htmlFor="sort" className="text-sm font-medium">
              Sort:
            </Label>
            <Select
              value={sortBy}
              onValueChange={(value: SortOption) => setSortBy(value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score-desc">Score (High to Low)</SelectItem>
                <SelectItem value="score-asc">Score (Low to High)</SelectItem>
                <SelectItem value="name-asc">Name (A to Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z to A)</SelectItem>
                <SelectItem value="sessions-desc">
                  Sessions (Most to Least)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Dense Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead className="w-[60px]">TA</TableHead>
              <TableHead className="min-w-[150px]">Name</TableHead>
              <TableHead className="w-[120px]">Username</TableHead>
              <TableHead className="w-[80px] text-center">Score</TableHead>
              <TableHead className="w-[90px] text-center">Sessions</TableHead>
              <TableHead className="w-[80px] text-center">Pass Rate</TableHead>
              <TableHead className="w-[80px] text-center">Avg Time</TableHead>
              <TableHead className="w-[100px] text-center">
                Completion
              </TableHead>
              <TableHead className="w-[80px] text-center">Trend</TableHead>
              <TableHead className="min-w-[200px]">Skills</TableHead>
              <TableHead className="w-[120px] text-center">Weakest</TableHead>
              <TableHead className="w-[120px] text-center">Strongest</TableHead>
              <TableHead className="w-[80px] text-center">Status</TableHead>
              <TableHead className="w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedFilteredAndSearchedTAs.length > 0 ? (
              sortedFilteredAndSearchedTAs.map((ta, index) => (
                <TableRow
                  key={ta.id}
                  className={`${
                    ta.isStruggling
                      ? "bg-orange-50/50 border-orange-200"
                      : "hover:bg-muted/30"
                  } transition-colors`}
                >
                  {/* Rank */}
                  <TableCell className="font-medium text-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {index + 1}
                    </div>
                  </TableCell>

                  {/* Avatar */}
                  <TableCell>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback
                        className={
                          ta.isStruggling ? "bg-orange-100 text-orange-800" : ""
                        }
                      >
                        {ta.initials}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>

                  {/* Name */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium">
                          {ta.firstName} {ta.lastName}
                        </div>
                        {ta.isStruggling && (
                          <div className="flex items-center gap-1 text-orange-600 text-xs">
                            <AlertTriangle className="h-3 w-3" />
                            Needs Attention
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Username */}
                  <TableCell className="text-sm text-muted-foreground">
                    {ta.username}@purdue.edu
                  </TableCell>

                  {/* Score */}
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        ta.avgScore >= 80
                          ? "default"
                          : ta.avgScore >= 70
                            ? "secondary"
                            : "destructive"
                      }
                      className="text-sm font-medium"
                    >
                      {ta.hasNoSessions ? "No Data" : `${ta.avgScore}%`}
                    </Badge>
                  </TableCell>

                  {/* Sessions */}
                  <TableCell className="text-center">
                    <div className="text-sm font-medium">
                      {ta.completedSessions}/{ta.totalSessions}
                    </div>
                  </TableCell>

                  {/* Pass Rate */}
                  <TableCell className="text-center">
                    <div className="text-sm font-medium">
                      {ta.hasNoSessions ? "N/A" : `${ta.passRate}%`}
                    </div>
                  </TableCell>

                  {/* Avg Time */}
                  <TableCell className="text-center">
                    <div className="text-sm font-medium">
                      {ta.hasNoSessions ? "N/A" : `${ta.avgTimeMinutes}min`}
                    </div>
                  </TableCell>

                  {/* Completion Rate */}
                  <TableCell className="text-center">
                    <div className="text-sm font-medium">
                      {ta.completionRate}%
                    </div>
                  </TableCell>

                  {/* Trend */}
                  <TableCell className="text-center">
                    {ta.trend === "improving" ? (
                      <div className="flex items-center justify-center gap-1 text-green-600">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-xs">Up</span>
                      </div>
                    ) : ta.trend === "declining" ? (
                      <div className="flex items-center justify-center gap-1 text-red-600">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-xs">Down</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1 text-gray-600">
                        <ArrowUp className="h-4 w-4 rotate-90" />
                        <span className="text-xs">Stable</span>
                      </div>
                    )}
                  </TableCell>

                  {/* Skills */}
                  <TableCell>
                    {!ta.hasNoSessions && (
                      <div className="flex flex-wrap gap-1">
                        {ta.skillBreakdown
                          .slice(0, 3)
                          .map((skill, skillIndex) => (
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
                        {ta.skillBreakdown.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{ta.skillBreakdown.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>

                  {/* Weakest Skill */}
                  <TableCell className="text-center">
                    {!ta.hasNoSessions && (
                      <div className="text-xs">
                        <div className="font-medium text-red-600">
                          {ta.weakestSkill.skill}
                        </div>
                        <div className="text-red-500">
                          {ta.weakestSkill.score}%
                        </div>
                      </div>
                    )}
                  </TableCell>

                  {/* Strongest Skill */}
                  <TableCell className="text-center">
                    {!ta.hasNoSessions && (
                      <div className="text-xs">
                        <div className="font-medium text-green-600">
                          {ta.strongestSkill.skill}
                        </div>
                        <div className="text-green-500">
                          {ta.strongestSkill.score}%
                        </div>
                      </div>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="text-center">
                    {ta.hasNoSessions ? (
                      <Badge variant="destructive" className="text-xs">
                        No Sessions
                      </Badge>
                    ) : ta.isStruggling ? (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-orange-100 text-orange-800"
                      >
                        Struggling
                      </Badge>
                    ) : (
                      <Badge
                        variant="default"
                        className="text-xs bg-green-100 text-green-800"
                      >
                        Good
                      </Badge>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <ReportDownloadDialog
                      ta={ta}
                      onDownload={(options) =>
                        handleDownloadReport(ta.id, options)
                      }
                      isDownloading={downloadingReports.has(ta.id)}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={15} className="text-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <Award className="h-16 w-16 text-muted-foreground" />
                    <div>
                      <h3 className="text-lg font-medium mb-2">
                        {searchQuery.trim()
                          ? `No TAs found matching "${searchQuery}"`
                          : "No TAs match the current filter"}
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
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface ReportDownloadDialogProps {
  ta: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
  };
  onDownload: (options: ReportOptions) => void;
  isDownloading: boolean;
}

function ReportDownloadDialog({
  ta,
  onDownload,
  isDownloading,
}: ReportDownloadDialogProps) {
  const [options, setOptions] = useState<ReportOptions>({
    includeStudentTypeChart: true,
    includePerformanceChart: true,
    includeRadarChart: true,
    includeTimeChart: true,
    includeDetailedScores: true,
    includeFeedback: true,
  });

  const handleOptionChange = (key: keyof ReportOptions, value: boolean) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isDownloading}>
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Download Report for {ta.firstName} {ta.lastName}
          </DialogTitle>
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
                  handleOptionChange(
                    "includeStudentTypeChart",
                    checked as boolean
                  )
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
                  handleOptionChange(
                    "includePerformanceChart",
                    checked as boolean
                  )
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
                  handleOptionChange(
                    "includeDetailedScores",
                    checked as boolean
                  )
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
