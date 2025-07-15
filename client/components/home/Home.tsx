/**
 * Home.tsx
 * This is the unified home page with role-based access control
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  RotateCcw,
  Timer,
  User,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRole } from "@/contexts/role-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { Agent, Scenario, Simulation, Standard, StandardGroup } from "@/types";
import { getAgentConfig } from "@/utils/agents";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useSession } from "next-auth/react";
import SimulationHistory from "../common/history/SimulationHistory";
import { updateProfile } from "@/utils/mutations/profiles/update-profile";

// Overlay Component for First-Time Users
const WelcomeOverlay = React.memo(({ onClose }: { onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black/50  z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome to Glow! 🌟
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg
                className="w-6 h-6 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* My Cohorts Section */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                📚 My Cohorts
              </h3>
              <p className="text-blue-800 dark:text-blue-200">
                These are like quizzes and this is what you get graded on. You
                will have a "x" amount of students to interact with in a "y"
                number of minutes. You will keep retaking these cohorts until
                you get a passing score.
              </p>
            </div>

            {/* Default Simulations Section */}
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                🎯 Default Simulations
              </h3>
              <p className="text-green-800 dark:text-green-200">
                These are practice simulations with a specific type of student.
                You have unlimited time for these and you still get a score, but
                it doesn't go into the gradebook.
              </p>
            </div>

            {/* History Section */}
            <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
                📊 History
              </h3>
              <p className="text-purple-800 dark:text-purple-200">
                This will show your previous interactions and you can see how
                you did in previous cohorts and simulations. You can click on
                individual ones to go and see exactly what you said, and you can
                also filter by various characteristics to try and find a
                particular conversation you may have had.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

WelcomeOverlay.displayName = "WelcomeOverlay";

// Type for attempt data
interface AttemptData {
  attempt: number;
  overallScore: number;
  skillScores: Record<string, number>;
  createdAt: string;
}

// Rubric Modal Component
const RubricModal = React.memo(
  ({
    simulations,
    simulationId,
    standardGroups,
    standards,
  }: {
    simulations: Simulation[];
    simulationId: string;
    standardGroups: StandardGroup[];
    standards: Standard[];
  }) => {
    // Find the rubric associated with this simulation
    const simulationRubric = simulations.find(
      (simulation) => simulation.id === simulationId
    )?.rubricId;

    const rubricStandardGroups =
      standardGroups?.filter((group) => group.rubricId === simulationRubric) ||
      [];

    // Create rubric data structure for table display
    const rubricData = rubricStandardGroups.map((group) => {
      const groupStandards =
        standards?.filter(
          (standard) => standard.standardGroupId === group.id
        ) || [];

      return {
        groupName: group.name,
        groupDescription: group.description,
        standards: groupStandards,
      };
    });

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="p-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View Rubric</p>
            </TooltipContent>
          </Tooltip>
        </DialogTrigger>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Simulation Rubric</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 w-full">
            {rubricData.length > 0 ? (
              <div className="overflow-auto max-h-[70vh]">
                <Table className="min-w-[800px]">
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="bg-primary text-primary-foreground font-semibold w-[120px]">
                        Criteria
                      </TableHead>
                      <TableHead className="bg-primary text-primary-foreground font-semibold">
                        Excellent (5)
                      </TableHead>
                      <TableHead className="bg-primary text-primary-foreground font-semibold">
                        Good (4)
                      </TableHead>
                      <TableHead className="bg-primary text-primary-foreground font-semibold">
                        Acceptable (3)
                      </TableHead>
                      <TableHead className="bg-primary text-primary-foreground font-semibold">
                        Marginal (2)
                      </TableHead>
                      <TableHead className="bg-primary text-primary-foreground font-semibold">
                        Poor (1)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rubricData.map(
                      (group: {
                        groupName: string;
                        groupDescription: string;
                        standards: Standard[];
                      }) =>
                        group.standards.map(
                          (standard: Standard, standardIndex: number) => (
                            <TableRow
                              key={`${group.groupName}-${standard.id}`}
                              className={
                                standardIndex % 2 === 0 ? "" : "bg-secondary/20"
                              }
                            >
                              <TableCell className="font-medium">
                                {standard.name || group.groupName}
                              </TableCell>
                              <TableCell className="whitespace-normal text-xs">
                                {standard.description ||
                                  "Excellent performance in this criteria"}
                              </TableCell>
                              <TableCell className="whitespace-normal text-xs">
                                Good performance with minor areas for
                                improvement
                              </TableCell>
                              <TableCell className="whitespace-normal text-xs">
                                Acceptable performance meeting basic
                                requirements
                              </TableCell>
                              <TableCell className="whitespace-normal text-xs">
                                Marginal performance with significant areas
                                needing improvement
                              </TableCell>
                              <TableCell className="whitespace-normal text-xs">
                                Poor performance not meeting minimum standards
                              </TableCell>
                            </TableRow>
                          )
                        )
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">
                  No rubric information available for this simulation.
                </p>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                Scoring System
              </h4>
              <p className="text-sm mb-2 text-blue-700 dark:text-blue-300">
                Your interactions are scored based on the criteria above:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 text-blue-700 dark:text-blue-300">
                <li>
                  <span className="font-medium">Pass:</span> Score of 85%+
                  overall
                </li>
                <li>
                  <span className="font-medium">Fail:</span> Score below 85%
                </li>
                <li>Each criterion must score at least 3 points to pass</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

RubricModal.displayName = "RubricModal";

// Memoized Simulation Card Component with localized flip state
const SimulationCard = React.memo(
  ({
    simulation,
    type,
    onStartSimulation,
    loadingSimulation,
    effectiveRole,
    rubricData,
    scenarios,
    agents,
    simulations,
    standardGroups,
    standards,
  }: {
    simulation: Simulation;
    type: "default" | "cohort";
    onStartSimulation: (id: string) => void;
    loadingSimulation: string | null;
    effectiveRole: string;
    rubricData: { attempts: AttemptData[]; highestScore: number };
    scenarios?: Scenario[];
    agents?: Agent[];
    simulations?: Simulation[];
    standardGroups?: StandardGroup[];
    standards?: Standard[];
  }) => {
    const [isFlipped, setIsFlipped] = useState(false);

    const handleCardFlip = useCallback((event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      setIsFlipped((prev) => !prev);
    }, []);

    const validScenarioIds =
      simulation.scenarioIds?.filter((id: string) => id !== "RAY") || [];

    // Default simulation-specific data
    const interaction =
      type === "default"
        ? scenarios?.find((i: Scenario) => i.id === validScenarioIds[0])
        : null;
    const agent = interaction
      ? agents?.find((a: Agent) => a.id === interaction.agentId)
      : null;
    const agentConfig = agent ? getAgentConfig(agent.name || "general") : null;
    const IconComponent =
      type === "default" ? agentConfig?.icon || User : Users;

    const gradientClass =
      type === "default"
        ? agentConfig?.colors?.gradient || "from-gray-500 to-gray-600"
        : "from-blue-500 to-purple-600";

    const backgroundGradient =
      type === "default"
        ? "from-gray-900 to-gray-600"
        : "from-blue-900 to-purple-600";

    return (
      <div className="relative perspective-1000">
        <div
          className={`relative transition-transform duration-700 transform-style-preserve-3d ${
            isFlipped ? "rotate-y-180" : ""
          }`}
        >
          {/* Front Side */}
          <Card
            data-testid={
              type === "default"
                ? "permanent-simulation-card"
                : "simulation-card"
            }
            className="group overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 bg-white dark:bg-gray-900 border-0 shadow-lg backface-hidden rounded-lg"
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div
                className={`absolute inset-0 bg-gradient-to-br ${backgroundGradient}`}
              ></div>
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
                  backgroundSize: "20px 20px",
                }}
              ></div>
            </div>

            <CardHeader className="pb-1 relative z-10">
              <div className="flex items-start justify-between">
                <div
                  className={`p-2 rounded-xl bg-gradient-to-br ${gradientClass} shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  <IconComponent className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col items-end space-y-1">
                  {/* Flip Icon */}
                  {effectiveRole !== "guest" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleCardFlip}
                          className="p-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors relative z-20"
                        >
                          <RotateCcw className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View Previous Attempts</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {effectiveRole === "guest" && (
                    <div className="text-right">
                      <div
                        className="text-xs font-medium text-gray-500 dark:text-gray-400"
                        data-testid={
                          type === "default"
                            ? "simulation-type"
                            : "simulation-class"
                        }
                      >
                        {type === "default" ? "Default" : "Cohort"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {type === "default" ? "Simulation" : "Simulations"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-1 relative z-10">
              <div>
                <h3
                  className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
                  data-testid="simulation-title"
                >
                  {simulation.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                  {type === "default"
                    ? agent?.description
                    : `Interactive simulation with ${validScenarioIds.length} scenario${validScenarioIds.length !== 1 ? "s" : ""}`}
                </p>
              </div>

              <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                <div
                  className="flex items-center"
                  data-testid="simulation-duration"
                >
                  <Timer className="h-3 w-3 mr-1" />
                  <span>
                    {simulation.timeLimit ? `${simulation.timeLimit}` : "∞"} min
                  </span>
                </div>
                <div className="flex items-center">
                  {type === "default" ? (
                    <User className="h-3 w-3 mr-1" />
                  ) : (
                    <Users className="h-3 w-3 mr-1" />
                  )}
                  <span>
                    {type === "default"
                      ? "1 session"
                      : `${validScenarioIds.length} session${validScenarioIds.length !== 1 ? "s" : ""}`}
                  </span>
                </div>
                {effectiveRole !== "guest" && rubricData.highestScore > 0 && (
                  <div className="flex items-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center">
                          <Info className="h-3 w-3 mr-1" />
                          <span>{rubricData.highestScore}%</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Your highest score</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="pt-0 relative z-10">
              <button
                onClick={() => onStartSimulation(simulation.id)}
                disabled={loadingSimulation === simulation.id}
                className={`w-full text-center py-2 rounded-lg bg-gradient-to-r ${gradientClass} text-white font-medium text-sm hover:shadow-lg transition-all duration-300 ${
                  loadingSimulation === simulation.id
                    ? "animate-pulse cursor-not-allowed"
                    : "hover:scale-105 cursor-pointer"
                } disabled:opacity-70`}
              >
                {loadingSimulation === simulation.id
                  ? "Starting..."
                  : type === "default"
                    ? "Start Simulation"
                    : "Start Simulations"}
              </button>
            </CardFooter>
          </Card>

          {/* Back Side - Only render when flipped */}
          {isFlipped && (
            <Card className="absolute inset-0 bg-white dark:bg-gray-900 border-0 shadow-lg rotate-y-180 backface-hidden rounded-lg">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      Previous Attempts
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {simulation.title}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {simulations && standardGroups && standards && (
                      <RubricModal
                        simulations={simulations}
                        simulationId={simulation.id}
                        standardGroups={standardGroups}
                        standards={standards}
                      />
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleCardFlip}
                          className="p-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <ArrowLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Back to Card</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="max-h-40 overflow-auto">
                {rubricData.attempts.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white dark:bg-gray-900">
                      <tr className="border-b">
                        <th className="text-left py-1 px-1 font-semibold text-gray-700 dark:text-gray-300">
                          #
                        </th>
                        <th className="text-center py-1 px-1 font-semibold text-gray-700 dark:text-gray-300">
                          Score
                        </th>
                        {standardGroups &&
                          standardGroups.slice(0, 3).map((group) => (
                            <th
                              key={group.id}
                              className="text-center py-1 px-1 font-semibold text-gray-700 dark:text-gray-300"
                            >
                              {group.shortName}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rubricData.attempts.map(
                        (attemptData: AttemptData, index: number) => (
                          <tr
                            key={index}
                            className="border-b border-gray-100 dark:border-gray-800"
                          >
                            <td className="py-1 px-1 font-medium text-gray-900 dark:text-white">
                              {attemptData.attempt}
                            </td>
                            <td className="text-center py-1 px-1">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-4 rounded text-xs font-semibold ${
                                  attemptData.overallScore >= 80
                                    ? "bg-green-100 text-green-800"
                                    : attemptData.overallScore >= 60
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-red-100 text-red-800"
                                }`}
                              >
                                {attemptData.overallScore}%
                              </span>
                            </td>
                            {standardGroups &&
                              standardGroups.slice(0, 3).map((group) => {
                                const score =
                                  attemptData.skillScores[group.shortName] || 0;
                                return (
                                  <td
                                    key={group.id}
                                    className="text-center py-1 px-1"
                                  >
                                    <span
                                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-semibold ${
                                        score >= 80
                                          ? "bg-green-100 text-green-800"
                                          : score >= 60
                                            ? "bg-yellow-100 text-yellow-800"
                                            : "bg-red-100 text-red-800"
                                      }`}
                                    >
                                      {score}
                                    </span>
                                  </td>
                                );
                              })}
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No previous attempts
                    </p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-0">
                <div className="w-full text-center py-2 text-xs text-gray-500">
                  {rubricData.attempts.length} attempt
                  {rubricData.attempts.length !== 1 ? "s" : ""}
                </div>
              </CardFooter>
            </Card>
          )}
        </div>

        <style jsx>{`
          .perspective-1000 {
            perspective: 1000px;
          }
          .transform-style-preserve-3d {
            transform-style: preserve-3d;
            will-change: transform;
          }
          .backface-hidden {
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
          }
          .rotate-y-180 {
            transform: rotateY(180deg);
          }
        `}</style>
      </div>
    );
  }
);

SimulationCard.displayName = "SimulationCard";

export default function Home() {
  const router = useRouter();
  const [loadingSimulation, setLoadingSimulation] = useState<string | null>(
    null
  );
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(
    null
  );
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [soloCarouselIndex, setSoloCarouselIndex] = useState(0);
  const [multiCarouselIndex, setMultiCarouselIndex] = useState(0);
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);

  // Use global WebSocket context instead of local connection
  const { isConnected, emitStartSimulation } = useWebSocket();

  // Use the role context instead of local state
  const { effectiveRole } = useRole();

  const userId = useSession().data?.user?.id;

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
  });

  // Fetch classes and simulations
  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: simulations, isLoading: simulationsLoading } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  // Fetch rubric-related data for real progress tracking
  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups } = useQuery({
    queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
    queryFn: () =>
      getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
    enabled: !!rubrics && rubrics.length > 0,
  });

  const { data: standards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: attempts } = useQuery({
    queryKey: ["simulationAttempts", profile?.id],
    queryFn: () => getSimulationAttemptsByProfiles([profile!.id]),
    enabled: !!profile?.id && effectiveRole !== "guest",
  });

  const { data: chats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: feedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id)
      ),
    enabled: !!grades && grades.length > 0,
  });

  const handleCloseWelcomeOverlay = useCallback(async () => {
    try {
      if (!profile) {
        logError("Profile not found");
        return;
      }
      await updateProfile(profile.id, {
        viewedIntro: true,
      });
    } catch (error) {
      logError("Error updating profile", error);
    }
    setShowWelcomeOverlay(false);
  }, [profile]);

  useEffect(() => {
    if (profile) {
      if (!profile.viewedIntro) {
        setShowWelcomeOverlay(true);
      }
    }
  }, [profile]);

  // Set up simulation-specific event listeners using global WebSocket
  useEffect(() => {
    // Listen for successful simulation starts to handle navigation
    const handleSimulationStarted = (event: CustomEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
        setLoadingToastId(null);
      }
      const { attemptId } = event.detail;
      logInfo("Navigating to simulation attempt", { attemptId });
      router.push(`/home/a/${attemptId}`);
      setLoadingSimulation(null);
    };

    // Listen for simulation errors to reset loading state
    const handleSimulationError = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
        setLoadingToastId(null);
      }
      toast.error("Failed to start simulation. Please try again.");
      setLoadingSimulation(null);
    };

    window.addEventListener(
      "simulationStarted",
      handleSimulationStarted as EventListener
    );
    window.addEventListener("simulationError", handleSimulationError);

    return () => {
      window.removeEventListener(
        "simulationStarted",
        handleSimulationStarted as EventListener
      );
      window.removeEventListener("simulationError", handleSimulationError);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [router, loadingToastId]);

  const handleStartSimulation = useCallback(
    async (simulationId: string) => {
      try {
        if (!classes) {
          toast.error("No classes found. Please contact an administrator.");
          return;
        }

        if (!profile?.id) {
          toast.error("Profile not loaded. Please refresh the page.");
          return;
        }

        if (!isConnected) {
          toast.error(
            "WebSocket not connected. Please wait for connection or refresh the page."
          );
          logError("WebSocket not connected when trying to start simulation", {
            simulationId,
            profileId: profile.id,
            isConnected,
          });
          return;
        }

        setLoadingSimulation(simulationId);
        const toastId = toast.loading("Starting simulation...");
        setLoadingToastId(toastId);

        logInfo("Starting simulation via global WebSocket", {
          simulationId,
          profileId: profile.id,
          isConnected,
        });

        // Use global WebSocket to emit start simulation
        emitStartSimulation({
          simulation_id: simulationId,
          profile_id: profile.id,
        });

        // Set a timeout to handle cases where the server doesn't respond
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          logError("Simulation start timeout - no response from server");
          toast.dismiss(toastId);
          toast.error("Simulation start timed out. Please try again.");
          setLoadingSimulation(null);
          setLoadingToastId(null);
        }, 30000); // 30 second timeout
      } catch (error) {
        logError("Error starting simulation:", error);
        if (loadingToastId) {
          toast.dismiss(loadingToastId);
        }
        toast.error("Failed to start simulation. Please try again.");
        setLoadingSimulation(null);
        setLoadingToastId(null);
      }
    },
    [profile, classes, isConnected, emitStartSimulation, loadingToastId]
  );

  // Separate simulations into default and cohort-based
  const defaultSimulations = useMemo(
    () =>
      simulations?.filter((simulation: Simulation) => {
        return simulation.defaultSimulation === true;
      }) || [],
    [simulations]
  );

  // Get user's cohorts and filter simulations based on cohort membership
  // Admins can see all cohorts, regular users only see cohorts they're members of
  const userCohorts = useMemo(() => {
    if (!cohorts) return [];

    // Admins can see all cohorts
    if (effectiveRole === "admin") {
      return cohorts;
    }

    // Regular users only see cohorts they're members of
    if (!profile) return [];
    return cohorts.filter((cohort) => cohort.profileIds?.includes(profile.id));
  }, [cohorts, profile, effectiveRole]);

  const cohortSimulations = useMemo(() => {
    if (!simulations || !userCohorts.length) return [];
    const userCohortIds = userCohorts.map((cohort) => cohort.id);
    return simulations.filter((simulation: Simulation) => {
      // Check if any of the simulation's cohort IDs match user's cohorts
      return simulation.cohortIds?.some(
        (cohortId: string) =>
          cohortId !== "RAY" && userCohortIds.includes(cohortId)
      );
    });
  }, [simulations, userCohorts]);

  // Memoize rubric data calculation to prevent unnecessary recalculations
  const rubricDataCache = useMemo(() => {
    if (
      !attempts ||
      !chats ||
      !grades ||
      !feedbacks ||
      !standards ||
      !standardGroups
    ) {
      return new Map();
    }

    const cache = new Map();

    // Pre-calculate for all simulations to avoid recalculation on each render
    const allSimulationIds = [...new Set(attempts.map((a) => a.simulationId))];

    allSimulationIds.forEach((simulationId) => {
      // Get attempts for this simulation
      const simulationAttempts = attempts.filter(
        (attempt) => attempt.simulationId === simulationId
      );

      // Get chats for these attempts
      const simulationChats = chats.filter((chat) =>
        simulationAttempts.some((attempt) => attempt.id === chat.attemptId)
      );

      // Get grades for these chats
      const simulationGrades = grades.filter((grade) =>
        simulationChats.some((chat) => chat.id === grade.simulationChatId)
      );

      // Get feedbacks for these grades
      const simulationFeedbacks = feedbacks.filter((feedback) =>
        simulationGrades.some(
          (grade) => grade.id === feedback.simulationChatGradeId
        )
      );

      // Group by attempt and calculate scores
      const attemptData = simulationAttempts.map((attempt, index) => {
        const attemptChats = simulationChats.filter(
          (chat) => chat.attemptId === attempt.id
        );
        const attemptGrades = simulationGrades.filter((grade) =>
          attemptChats.some((chat) => chat.id === grade.simulationChatId)
        );
        const attemptFeedbacks = simulationFeedbacks.filter((feedback) =>
          attemptGrades.some(
            (grade) => grade.id === feedback.simulationChatGradeId
          )
        );

        // Calculate skill scores similar to Overview.tsx
        const skillScores = standardGroups.reduce(
          (acc, group) => {
            const groupStandards = standards.filter(
              (s) => s.standardGroupId === group.id
            );
            const groupFeedbacks = attemptFeedbacks.filter((f) =>
              groupStandards.some((s) => s.id === f.standardId)
            );

            if (groupFeedbacks.length > 0) {
              // Use the rubric's total points for this group instead of max standard points
              const rubric = rubrics?.find((r) => r.id === group.rubricId);
              const rubricTotalPoints = rubric?.points || 100;

              const avgScore = Math.round(
                (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
                  groupFeedbacks.length /
                  rubricTotalPoints) *
                  100
              );
              acc[group.shortName] = avgScore;
            }

            return acc;
          },
          {} as Record<string, number>
        );

        // Calculate overall score - normalize to percentage based on rubric total points
        const rubric = rubrics?.find((r) =>
          standardGroups?.some((sg) => sg.rubricId === r.id)
        );
        const rubricTotalPoints = rubric?.points || 20;

        const overallScore =
          attemptGrades.length > 0
            ? Math.round(
                (attemptGrades.reduce((sum, g) => sum + g.score, 0) /
                  attemptGrades.length /
                  rubricTotalPoints) *
                  100 // Convert to percentage
              )
            : 0;

        return {
          attempt: index + 1,
          overallScore,
          skillScores,
          createdAt: attempt.createdAt,
        };
      });

      const highestScore =
        attemptData.length > 0
          ? Math.max(...attemptData.map((a) => a.overallScore))
          : 0;

      cache.set(simulationId, { attempts: attemptData, highestScore });
    });

    return cache;
  }, [attempts, chats, grades, feedbacks, standards, standardGroups, rubrics]);

  // Get real rubric data for a simulation
  const getRealRubricData = useCallback(
    (simulationId: string) => {
      return (
        rubricDataCache.get(simulationId) || { attempts: [], highestScore: 0 }
      );
    },
    [rubricDataCache]
  );

  const renderCarousel = useCallback(
    (simulations: Simulation[], type: "default" | "cohort") => {
      const carouselIndex =
        type === "default" ? soloCarouselIndex : multiCarouselIndex;
      const setCarouselIndex =
        type === "default" ? setSoloCarouselIndex : setMultiCarouselIndex;
      const maxVisible = 3;

      // Fix pagination to avoid duplicates
      const totalPages = Math.ceil(simulations.length / maxVisible);
      const canScrollLeft = carouselIndex > 0;
      const canScrollRight = carouselIndex < totalPages - 1;

      if (simulations.length === 0) return null;

      const handlePrevious = () => {
        if (canScrollLeft) {
          setCarouselIndex(carouselIndex - 1);
        }
      };

      const handleNext = () => {
        if (canScrollRight) {
          setCarouselIndex(carouselIndex + 1);
        }
      };

      // Get simulations for current page
      const startIndex = carouselIndex * maxVisible;
      const endIndex = startIndex + maxVisible;
      const visibleSimulations = simulations.slice(startIndex, endIndex);

      return (
        <div className="space-y-4">
          {/* Header with navigation */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {type === "default" ? "Default Simulations" : "My Cohort Assignments"}
            </h2>
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrevious}
                  disabled={!canScrollLeft}
                  className={`p-2 rounded-lg transition-colors ${
                    canScrollLeft
                      ? "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                      : "bg-gray-50 text-gray-300 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed"
                  }`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {carouselIndex + 1} of {totalPages}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!canScrollRight}
                  className={`p-2 rounded-lg transition-colors ${
                    canScrollRight
                      ? "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                      : "bg-gray-50 text-gray-300 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed"
                  }`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Carousel container */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleSimulations.map((simulation: Simulation) => (
              <SimulationCard
                key={simulation.id}
                simulation={simulation}
                type={type}
                onStartSimulation={handleStartSimulation}
                loadingSimulation={loadingSimulation}
                effectiveRole={effectiveRole}
                rubricData={getRealRubricData(simulation.id)}
                scenarios={scenarios ?? []}
                agents={agents ?? []}
                simulations={simulations ?? []}
                standardGroups={standardGroups ?? []}
                standards={standards ?? []}
              />
            ))}
          </div>

          {/* Dots indicator */}
          {totalPages > 1 && (
            <div className="flex justify-center space-x-2 mt-4">
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index}
                  onClick={() => setCarouselIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === carouselIndex
                      ? "bg-blue-500"
                      : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      );
    },
    [
      soloCarouselIndex,
      multiCarouselIndex,
      handleStartSimulation,
      loadingSimulation,
      effectiveRole,
      getRealRubricData,
      scenarios,
      agents,
      standardGroups,
      standards,
    ]
  );

  // Loading state
  if (simulationsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        {/* Skeleton for Simulation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card
              key={i}
              className="overflow-hidden bg-white dark:bg-gray-900 border-0 shadow-lg"
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="text-right space-y-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Skeleton className="h-10 w-full rounded-lg" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (effectiveRole === "guest") {
    // Guest view - show all simulations with carousels
    return (
      <TooltipProvider>
        <div className="space-y-4">
          {/* Default Simulations Carousel */}
          {defaultSimulations.length > 0 &&
            renderCarousel(defaultSimulations, "default")}

          {/* Cohort Simulations Carousel */}
          {cohortSimulations.length > 0 &&
            renderCarousel(cohortSimulations, "cohort")}

          {/* No simulations message */}
          {defaultSimulations.length === 0 &&
            cohortSimulations.length === 0 && (
              <div className="text-center py-12">
                <h3 className="text-lg font-semibold mb-2">
                  No simulations available
                </h3>
                <p className="text-muted-foreground">
                  Contact an administrator to add simulations.
                </p>
              </div>
            )}
        </div>
        {showWelcomeOverlay && (
          <WelcomeOverlay onClose={handleCloseWelcomeOverlay} />
        )}
      </TooltipProvider>
    );
  }

  // Regular user view - show all simulations with carousels
  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* Cohort Simulations Carousel */}
        {cohortSimulations.length > 0 &&
          renderCarousel(cohortSimulations, "cohort")}

        {/* Default Simulations Carousel */}
        {defaultSimulations.length > 0 &&
          renderCarousel(defaultSimulations, "default")}

        {/* History Section */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            History
          </h2>
          <SimulationHistory showAll={false} showExport={false} />
        </div>

        {/* No simulations message */}
        {defaultSimulations.length === 0 && cohortSimulations.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">
              No simulations available
            </h3>
            <p className="text-muted-foreground">
              Contact an administrator to add simulations.
            </p>
          </div>
        )}
      </div>
      {showWelcomeOverlay && (
        <WelcomeOverlay onClose={handleCloseWelcomeOverlay} />
      )}
    </TooltipProvider>
  );
}
