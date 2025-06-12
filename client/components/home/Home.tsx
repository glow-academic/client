/**
 * Home.tsx
 * This is the unified home page with role-based access control
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";
import React, { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Timer, Users, User, ChevronLeft, ChevronRight, RotateCcw, ArrowLeft, FileText, Info } from "lucide-react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAgentConfig } from "@/utils/agents";
import { useRole } from "@/contexts/role-context";
import SimulationHistory from "../common/history/SimulationHistory";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { Agent, Scenario, Simulation } from "@/types";
import { useSession } from "next-auth/react";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";

// Type for attempt data
interface AttemptData {
  attempt: number;
  overallScore: number;
  skillScores: Record<string, number>;
  createdAt: string;
}

// Progress Circle Component
const ProgressCircle = ({ percentage, size = 40 }: { percentage: number; size?: number }) => {
  const radius = (size - 4) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
  
  const getColor = (percent: number) => {
    if (percent >= 80) return "#10b981"; // green
    if (percent >= 60) return "#f59e0b"; // yellow
    return "#ef4444"; // red
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
          fill="transparent"
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(percentage)}
          strokeWidth="2"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold" style={{ color: getColor(percentage) }}>
          {percentage}%
        </span>
      </div>
    </div>
  );
};

// Rubric Modal Component
const RubricModal = React.memo(({ simulationId, rubrics, standardGroups, standards }: {
  simulationId: string;
  rubrics: any[];
  standardGroups: any[];
  standards: any[];
}) => {
  // Find the rubric associated with this simulation
  const simulationRubric = rubrics?.find(rubric => 
    rubric.simulationId === simulationId || rubrics.length === 1
  ) || rubrics?.[0];

  const rubricStandardGroups = standardGroups?.filter(
    group => group.rubricId === simulationRubric?.id
  ) || [];

  // Create rubric data structure for table display
  const rubricData = rubricStandardGroups.map(group => {
    const groupStandards = standards?.filter(
      standard => standard.standardGroupId === group.id
    ) || [];
    
    return {
      groupName: group.name,
      groupDescription: group.description,
      standards: groupStandards
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
                  {rubricData.map((group: any, groupIndex: number) => 
                    group.standards.map((standard: any, standardIndex: number) => (
                      <TableRow 
                        key={`${group.groupName}-${standard.id}`}
                        className={standardIndex % 2 === 0 ? "" : "bg-secondary/20"}
                      >
                        <TableCell className="font-medium">
                          {standard.name || group.groupName}
                        </TableCell>
                        <TableCell className="whitespace-normal text-xs">
                          {standard.description || "Excellent performance in this criteria"}
                        </TableCell>
                        <TableCell className="whitespace-normal text-xs">
                          Good performance with minor areas for improvement
                        </TableCell>
                        <TableCell className="whitespace-normal text-xs">
                          Acceptable performance meeting basic requirements
                        </TableCell>
                        <TableCell className="whitespace-normal text-xs">
                          Marginal performance with significant areas needing improvement
                        </TableCell>
                        <TableCell className="whitespace-normal text-xs">
                          Poor performance not meeting minimum standards
                        </TableCell>
                      </TableRow>
                    ))
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
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Scoring System</h4>
            <p className="text-sm mb-2 text-blue-700 dark:text-blue-300">
              Your interactions are scored based on the criteria above:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 text-blue-700 dark:text-blue-300">
              <li>
                <span className="font-medium">Pass:</span> Score of 85%+ overall
              </li>
              <li>
                <span className="font-medium">Fail:</span> Score below 85%
              </li>
              <li>
                Each criterion must score at least 3 points to pass
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

RubricModal.displayName = "RubricModal";

// Memoized Simulation Card Component with localized flip state
const SimulationCard = React.memo(({ 
  simulation, 
  type, 
  onStartSimulation, 
  loadingSimulation, 
  effectiveRole, 
  rubricData, 
  scenarios, 
  agents, 
  rubrics, 
  standardGroups, 
  standards 
}: {
  simulation: Simulation;
  type: "solo" | "multi";
  onStartSimulation: (id: string) => void;
  loadingSimulation: string | null;
  effectiveRole: string;
  rubricData: { attempts: AttemptData[]; highestScore: number };
  scenarios?: Scenario[];
  agents?: Agent[];
  rubrics?: any[];
  standardGroups?: any[];
  standards?: any[];
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleCardFlip = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setIsFlipped(prev => !prev);
  }, []);

  const validScenarioIds = simulation.scenarioIds?.filter((id: string) => id !== "RAY") || [];
  
  // Solo-specific data
  const interaction = type === "solo" ? scenarios?.find((i: Scenario) => i.id === validScenarioIds[0]) : null;
  const agent = interaction ? agents?.find((a: Agent) => a.id === interaction.agentId) : null;
  const agentConfig = agent ? getAgentConfig(agent.name || "general") : null;
  const IconComponent = type === "solo" ? (agentConfig?.icon || User) : Users;

  const gradientClass = type === "solo" 
    ? (agentConfig?.colors?.gradient || "from-gray-500 to-gray-600")
    : "from-blue-500 to-purple-600";

  const backgroundGradient = type === "solo"
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
          data-testid={type === "solo" ? "permanent-simulation-card" : "simulation-card"}
          className="group overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 bg-white dark:bg-gray-900 border-0 shadow-lg backface-hidden"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className={`absolute inset-0 bg-gradient-to-br ${backgroundGradient}`}></div>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }}
            ></div>
          </div>

          <CardHeader className="pb-4 relative z-10">
            <div className="flex items-start justify-between">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${gradientClass} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <IconComponent className="h-6 w-6 text-white" />
              </div>
              <div className="flex flex-col items-end space-y-2">
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
                      data-testid={type === "solo" ? "simulation-type" : "simulation-class"}
                    >
                      {type === "solo" ? "Solo" : "Multi"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {type === "solo" ? "Simulation" : "Simulations"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 relative z-10">
            <div>
              <h3
                className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
                data-testid="simulation-title"
              >
                {simulation.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                {type === "solo" 
                  ? agent?.description 
                  : `Interactive simulation with ${validScenarioIds.length} scenario${validScenarioIds.length !== 1 ? "s" : ""}`
                }
              </p>
            </div>

            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center" data-testid="simulation-duration">
                <Timer className="h-3 w-3 mr-1" />
                <span>{simulation.timeLimit ? `${simulation.timeLimit}` : "∞"} min</span>
              </div>
              <div className="flex items-center">
                {type === "solo" ? <User className="h-3 w-3 mr-1" /> : <Users className="h-3 w-3 mr-1" />}
                <span>
                  {type === "solo" 
                    ? "1 session" 
                    : `${validScenarioIds.length} session${validScenarioIds.length !== 1 ? "s" : ""}`
                  }
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
              className={`w-full text-center py-3 rounded-lg bg-gradient-to-r ${gradientClass} text-white font-medium text-sm hover:shadow-lg transition-all duration-300 ${
                loadingSimulation === simulation.id
                  ? "animate-pulse cursor-not-allowed"
                  : "hover:scale-105 cursor-pointer"
              } disabled:opacity-70`}
            >
              {loadingSimulation === simulation.id
                ? "Starting..."
                : type === "solo" ? "Start Simulation" : "Start Simulations"}
            </button>
          </CardFooter>
        </Card>

        {/* Back Side - Only render when flipped */}
        {isFlipped && (
          <Card className="absolute inset-0 bg-white dark:bg-gray-900 border-0 shadow-lg rotate-y-180 backface-hidden">
            <CardHeader className="pb-3">
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
                  {rubrics && standardGroups && standards && (
                    <RubricModal
                      simulationId={simulation.id}
                      rubrics={rubrics}
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

            <CardContent className="max-h-48 overflow-auto">
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
                      {standardGroups && standardGroups.slice(0, 3).map((group) => (
                        <th key={group.id} className="text-center py-1 px-1 font-semibold text-gray-700 dark:text-gray-300">
                          {group.shortName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rubricData.attempts.map((attemptData: AttemptData, index: number) => (
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
                        {standardGroups && standardGroups.slice(0, 3).map((group) => {
                          const score = attemptData.skillScores[group.shortName] || 0;
                          return (
                            <td key={group.id} className="text-center py-1 px-1">
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
                    ))}
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
});

SimulationCard.displayName = "SimulationCard";

export default function Home() {
  const router = useRouter();
  const [loadingSimulation, setLoadingSimulation] = useState<string | null>(null);
  const [soloCarouselIndex, setSoloCarouselIndex] = useState(0);
  const [multiCarouselIndex, setMultiCarouselIndex] = useState(0);

  // Use the role context instead of local state
  const { effectiveRole } = useRole();

  const session = useSession();
  const userId = session.data?.user?.id;

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(userId!),
    select: (data) => data[0],
    enabled: !!userId,
  });

  // Fetch classes and simulations
  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
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
        grades!.map((grade) => grade.id),
      ),
    enabled: !!grades && grades.length > 0,
  });

  const handleStartSimulation = useCallback(async (simulationId: string) => {
    try {
      if (!classes) {
        toast.error("No classes found. Please contact an administrator.");
        return;
      }

      setLoadingSimulation(simulationId);
      toast.loading("Starting simulation...");

      // For guests, use all available classes; for users, use their assigned classes or all if none assigned
      const availableClasses =
        effectiveRole === "guest"
          ? classes
          : profile?.classIds?.length || 0 > 0
            ? classes.filter((c) => profile?.classIds.includes(c.id))
            : classes;

      const classId =
        availableClasses.length > 0
          ? availableClasses[
              Math.floor(Math.random() * availableClasses.length)
            ].id
          : classes[Math.floor(Math.random() * classes.length)].id;

      const formData = new FormData();
      formData.append("simulation_id", simulationId);

      // Handle user_id for guest mode
      if (effectiveRole === "guest" || !profile) {
        // pass
      } else {
        formData.append("user_id", profile.id);
      }

      formData.append("class_id", classId);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/simulations/start`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.ok) {
        const data = await response.json();
        toast.dismiss();
        toast.success("Simulation started");
        router.push(`/home/a/${data.attempt_id}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail ||
            response.statusText ||
            "Failed to start simulation",
        );
      }
    } catch (error) {
      console.error("Error starting simulation:", error);
      toast.dismiss();
      toast.error("Failed to start simulation. Please try again.");
    } finally {
      setLoadingSimulation(null);
    }
  }, [classes, effectiveRole, profile, router]);

  // Separate simulations into solo and multi based on interaction count
  const soloSimulations = useMemo(() =>
    simulations?.filter((simulation: Simulation) => {
      const validInteractionIds =
        simulation.scenarioIds?.filter((id: string) => id !== "RAY") || [];
      return validInteractionIds.length === 1 || validInteractionIds.length === 0;
    }) || [], [simulations]);

  const multiSimulations = useMemo(() =>
    simulations?.filter((simulation: Simulation) => {
      const validInteractionIds =
        simulation.scenarioIds?.filter((id: string) => id !== "RAY") || [];
      return validInteractionIds.length > 1;
    }) || [], [simulations]);

  // Memoize rubric data calculation to prevent unnecessary recalculations
  const rubricDataCache = useMemo(() => {
    if (!attempts || !chats || !grades || !feedbacks || !standards || !standardGroups) {
      return new Map();
    }

    const cache = new Map();
    
    // Pre-calculate for all simulations to avoid recalculation on each render
    const allSimulationIds = [...new Set(attempts.map(a => a.simulationId))];
    
    allSimulationIds.forEach(simulationId => {
      // Get attempts for this simulation
      const simulationAttempts = attempts.filter(
        (attempt) => attempt.simulationId === simulationId,
      );

      // Get chats for these attempts
      const simulationChats = chats.filter((chat) =>
        simulationAttempts.some((attempt) => attempt.id === chat.attemptId),
      );

      // Get grades for these chats
      const simulationGrades = grades.filter((grade) =>
        simulationChats.some((chat) => chat.id === grade.simulationChatId),
      );

      // Get feedbacks for these grades
      const simulationFeedbacks = feedbacks.filter((feedback) =>
        simulationGrades.some((grade) => grade.id === feedback.simulationChatGradeId),
      );

      // Group by attempt and calculate scores
      const attemptData = simulationAttempts.map((attempt, index) => {
        const attemptChats = simulationChats.filter(
          (chat) => chat.attemptId === attempt.id,
        );
        const attemptGrades = simulationGrades.filter((grade) =>
          attemptChats.some((chat) => chat.id === grade.simulationChatId),
        );
        const attemptFeedbacks = simulationFeedbacks.filter((feedback) =>
          attemptGrades.some((grade) => grade.id === feedback.simulationChatGradeId),
        );

        // Calculate skill scores similar to Overview.tsx
        const skillScores = standardGroups.reduce(
          (acc, group) => {
            const groupStandards = standards.filter(
              (s) => s.standardGroupId === group.id,
            );
            const groupFeedbacks = attemptFeedbacks.filter((f) =>
              groupStandards.some((s) => s.id === f.standardId),
            );

            if (groupFeedbacks.length > 0) {
              const maxPoints = Math.max(...groupStandards.map((s) => s.points));
              const avgScore = Math.round(
                (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
                  groupFeedbacks.length /
                  maxPoints) *
                  100,
              );
              acc[group.shortName] = avgScore;
            }

            return acc;
          },
          {} as Record<string, number>,
        );

        // Calculate overall score
        const overallScore =
          attemptGrades.length > 0
            ? Math.round(
                attemptGrades.reduce((sum, g) => sum + g.score, 0) /
                  attemptGrades.length,
              )
            : 0;

        return {
          attempt: index + 1,
          overallScore,
          skillScores,
          createdAt: attempt.createdAt,
        };
      });

      const highestScore = attemptData.length > 0 
        ? Math.max(...attemptData.map((a) => a.overallScore))
        : 0;

      cache.set(simulationId, { attempts: attemptData, highestScore });
    });

    return cache;
  }, [attempts, chats, grades, feedbacks, standards, standardGroups]);

  // Get real rubric data for a simulation
  const getRealRubricData = useCallback((simulationId: string) => {
    return rubricDataCache.get(simulationId) || { attempts: [], highestScore: 0 };
  }, [rubricDataCache]);

  const renderCarousel = useCallback((simulations: Simulation[], type: "solo" | "multi") => {
    const carouselIndex = type === "solo" ? soloCarouselIndex : multiCarouselIndex;
    const setCarouselIndex = type === "solo" ? setSoloCarouselIndex : setMultiCarouselIndex;
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
            {type === "solo" ? "Solo Simulations" : "Multi Simulations"}
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
              scenarios={scenarios}
              agents={agents}
              rubrics={rubrics}
              standardGroups={standardGroups}
              standards={standards}
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
  }, [soloCarouselIndex, multiCarouselIndex, handleStartSimulation, loadingSimulation, effectiveRole, getRealRubricData, scenarios, agents, rubrics, standardGroups, standards]);

  // Loading state
  if (simulationsLoading) {
    return (
      <div className="space-y-8">
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
        <div className="space-y-8">
          {/* Solo Simulations Carousel */}
          {soloSimulations.length > 0 && renderCarousel(soloSimulations, "solo")}

          {/* Multi Simulations Carousel */}
          {multiSimulations.length > 0 && renderCarousel(multiSimulations, "multi")}

          {/* No simulations message */}
          {soloSimulations.length === 0 && multiSimulations.length === 0 && (
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
      </TooltipProvider>
    );
  }

  // Regular user view - show all simulations with carousels
  return (
    <TooltipProvider>
      <div className="space-y-8">
        {/* Solo Simulations Carousel */}
        {soloSimulations.length > 0 && renderCarousel(soloSimulations, "solo")}

        {/* Multi Simulations Carousel */}
        {multiSimulations.length > 0 && renderCarousel(multiSimulations, "multi")}

        <SimulationHistory showAll={false} showChats={false} showExport={false} />

        {/* No simulations message */}
        {soloSimulations.length === 0 && multiSimulations.length === 0 && (
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
    </TooltipProvider>
  );
}
