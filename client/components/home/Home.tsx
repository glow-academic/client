/**
 * Home.tsx
 * This is the unified home page with role-based access control
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Timer, Users, User } from "lucide-react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgentConfig } from "@/utils/agents";
import { useRole } from "@/contexts/role-context";
import SimulationHistory from "../common/history/SimulationHistory";
import { useAuth } from "@/hooks/use-auth";
import { getUser } from "@/utils/queries/users/get-user";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { Agent, Scenario, Simulation } from "@/types";

export default function Home() {
  const router = useRouter();
  const [loadingSimulation, setLoadingSimulation] = useState<string | null>(
    null,
  );

  // Use the role context instead of local state
  const { effectiveRole } = useRole();

  const { userId } = useAuth();

  const { data: user } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId!),
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

  const handleStartSimulation = async (simulationId: string) => {
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
          : user?.classIds?.length || 0 > 0
            ? classes.filter((c) => user?.classIds.includes(c.id))
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
      if (effectiveRole === "guest" || !user) {
        // pass
      } else {
        formData.append("user_id", user.id);
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
        router.push(`/a/${data.attempt_id}`);
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
  };

  // Separate simulations into solo and multi based on interaction count
  const soloSimulations =
    simulations?.filter((simulation: Simulation) => {
      const validInteractionIds =
        simulation.scenarioIds?.filter((id: string) => id !== "RAY") || [];
      return validInteractionIds.length === 1;
    }) || [];

  const multiSimulations =
    simulations?.filter((simulation: Simulation) => {
      const validInteractionIds =
        simulation.scenarioIds?.filter((id: string) => id !== "RAY") || [];
      return validInteractionIds.length > 1;
    }) || [];

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
    // Guest view - show all simulations
    return (
      <div className="space-y-8">
        {/* Solo Simulations */}
        {soloSimulations.length > 0 && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {soloSimulations.map((simulation: Simulation) => {
                const validInteractionIds =
                  simulation.scenarioIds?.filter(
                    (id: string) => id !== "RAY",
                  ) || [];
                const interaction = scenarios?.find(
                  (i: Scenario) => i.id === validInteractionIds[0],
                );
                const agent = agents?.find(
                  (a: Agent) => a.id === interaction?.agentId,
                );
                const agentConfig = getAgentConfig(agent?.name || "general");
                const IconComponent = agentConfig.icon;

                return (
                  <Card
                    key={simulation.id}
                    className={`group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${loadingSimulation ? "cursor-not-allowed opacity-70" : "cursor-pointer"} bg-white dark:bg-gray-900 border-0 shadow-lg`}
                    onClick={() =>
                      !loadingSimulation && handleStartSimulation(simulation.id)
                    }
                  >
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5">
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-600"></div>
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
                          backgroundSize: "20px 20px",
                        }}
                      ></div>
                    </div>

                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div
                          className={`p-3 rounded-xl bg-gradient-to-br ${agentConfig.colors.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}
                        >
                          <IconComponent className="h-6 w-6 text-white" />
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Solo
                          </div>
                          <div className="text-xs text-gray-400">
                            Simulation
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                          {simulation.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                          {agent?.description}
                        </p>
                      </div>

                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <Timer className="h-3 w-3 mr-1" />
                          <span className="text-sm">
                            {simulation.timeLimit
                              ? `${simulation.timeLimit}`
                              : "∞"}
                          </span>
                          <span className="ml-1">min</span>
                        </div>
                        <div className="flex items-center">
                          <User className="h-3 w-3 mr-1" />
                          <span>1 session</span>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="pt-0">
                      <div
                        className={`w-full text-center py-3 rounded-lg bg-gradient-to-r ${agentConfig.colors.gradient} text-white font-medium text-sm group-hover:shadow-lg transition-all duration-300 ${loadingSimulation === simulation.id ? "animate-pulse" : ""}`}
                      >
                        {loadingSimulation === simulation.id
                          ? "Starting..."
                          : "Start Simulation"}
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Multi Simulations */}
        {multiSimulations.length > 0 && (
          <div className={soloSimulations.length > 0 ? "border-t pt-8" : ""}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {multiSimulations.map((simulation: Simulation) => {
                const validInteractionIds =
                  simulation.scenarioIds?.filter((id) => id !== "RAY") || [];

                return (
                  <Card
                    key={simulation.id}
                    className={`group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${loadingSimulation ? "cursor-not-allowed opacity-70" : "cursor-pointer"} bg-white dark:bg-gray-900 border-0 shadow-lg`}
                    onClick={() =>
                      !loadingSimulation && handleStartSimulation(simulation.id)
                    }
                  >
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-purple-600"></div>
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
                          backgroundSize: "20px 20px",
                        }}
                      ></div>
                    </div>

                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg group-hover:scale-110 transition-transform duration-300">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Multi
                          </div>
                          <div className="text-xs text-gray-400">
                            Simulations
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                          {simulation.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                          Interactive simulation with{" "}
                          {validInteractionIds.length} interaction
                          {validInteractionIds.length !== 1 ? "s" : ""}
                        </p>
                      </div>

                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <Timer className="h-3 w-3 mr-1" />
                          <span>
                            {simulation.timeLimit
                              ? `${simulation.timeLimit}`
                              : "∞"}{" "}
                            min
                          </span>
                        </div>
                        <div className="flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          <span>
                            {validInteractionIds.length} session
                            {validInteractionIds.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="pt-0">
                      <div
                        className={`w-full text-center py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium text-sm group-hover:shadow-lg transition-all duration-300 ${loadingSimulation === simulation.id ? "animate-pulse" : ""}`}
                      >
                        {loadingSimulation === simulation.id
                          ? "Starting..."
                          : "Start Simulations"}
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

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
    );
  }

  // Regular user view - show all simulations
  return (
    <div className="space-y-8">
      {/* Solo Simulations */}
      {soloSimulations.length > 0 && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {soloSimulations.map((simulation: Simulation) => {
              const validScenarioIds =
                simulation.scenarioIds?.filter((id: string) => id !== "RAY") ||
                [];
              const interaction = scenarios?.find(
                (i: Scenario) => i.id === validScenarioIds[0],
              );
              const agent = agents?.find(
                (a: Agent) => a.id === interaction?.agentId,
              );
              const agentConfig = getAgentConfig(agent?.name || "general");
              const IconComponent = agentConfig.icon;

              return (
                <Card
                  key={simulation.id}
                  data-testid="permanent-simulation-card"
                  className={`group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${loadingSimulation ? "cursor-not-allowed opacity-70" : "cursor-pointer"} bg-white dark:bg-gray-900 border-0 shadow-lg`}
                  onClick={() =>
                    !loadingSimulation && handleStartSimulation(simulation.id)
                  }
                >
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-600"></div>
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
                        backgroundSize: "20px 20px",
                      }}
                    ></div>
                  </div>

                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div
                        className={`p-3 rounded-xl bg-gradient-to-br ${agentConfig.colors.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}
                      >
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-right">
                        <div
                          className="text-xs font-medium text-gray-500 dark:text-gray-400"
                          data-testid="simulation-type"
                        >
                          Solo
                        </div>
                        <div className="text-xs text-gray-400">Simulation</div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div>
                      <h3
                        className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
                        data-testid="simulation-title"
                      >
                        {simulation.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                        {agent?.description}
                      </p>
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <div
                        className="flex items-center"
                        data-testid="simulation-duration"
                      >
                        <Timer className="h-3 w-3 mr-1" />
                        <span className="text-sm">
                          {simulation.timeLimit
                            ? `${simulation.timeLimit}`
                            : "∞"}
                        </span>
                        <span className="ml-1">min</span>
                      </div>
                      <div className="flex items-center">
                        <User className="h-3 w-3 mr-1" />
                        <span>1 session</span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0">
                    <div
                      className={`w-full text-center py-3 rounded-lg bg-gradient-to-r ${agentConfig.colors.gradient} text-white font-medium text-sm group-hover:shadow-lg transition-all duration-300 ${loadingSimulation === simulation.id ? "animate-pulse" : ""}`}
                    >
                      {loadingSimulation === simulation.id
                        ? "Starting..."
                        : "Start Simulation"}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi Simulations */}
      {multiSimulations.length > 0 && (
        <div className={soloSimulations.length > 0 ? "border-t pt-8" : ""}>
          <div
            data-testid="simulation-section"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {multiSimulations.map((simulation: Simulation) => {
              const validScenarioIds =
                simulation.scenarioIds?.filter((id: string) => id !== "RAY") ||
                [];

              return (
                <Card
                  key={simulation.id}
                  data-testid="simulation-card"
                  className={`group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${loadingSimulation ? "cursor-not-allowed opacity-70" : "cursor-pointer"} bg-white dark:bg-gray-900 border-0 shadow-lg`}
                  onClick={() =>
                    !loadingSimulation && handleStartSimulation(simulation.id)
                  }
                >
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-purple-600"></div>
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
                        backgroundSize: "20px 20px",
                      }}
                    ></div>
                  </div>

                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-right">
                        <div
                          className="text-xs font-medium text-gray-500 dark:text-gray-400"
                          data-testid="simulation-class"
                        >
                          Multi
                        </div>
                        <div className="text-xs text-gray-400">Simulations</div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div>
                      <h3
                        className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
                        data-testid="simulation-title"
                      >
                        {simulation.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                        Interactive simulation with {validScenarioIds.length}{" "}
                        scenario{validScenarioIds.length !== 1 ? "s" : ""}
                      </p>
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <div
                        className="flex items-center"
                        data-testid="simulation-duration"
                      >
                        <Timer className="h-3 w-3 mr-1" />
                        <span>
                          {simulation.timeLimit
                            ? `${simulation.timeLimit}`
                            : "∞"}{" "}
                          min
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-3 w-3 mr-1" />
                        <span>
                          {validScenarioIds.length} session
                          {validScenarioIds.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0">
                    <div
                      className={`w-full text-center py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium text-sm group-hover:shadow-lg transition-all duration-300 ${loadingSimulation === simulation.id ? "animate-pulse" : ""}`}
                    >
                      {loadingSimulation === simulation.id
                        ? "Starting..."
                        : "Start Simulations"}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <SimulationHistory showAll={false} showChats={true} />

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
  );
}
