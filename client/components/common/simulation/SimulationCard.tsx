/**
 * SimulationCard.tsx
 * This is the simulation card component for the home page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Persona, Profile, Scenario, Simulation } from "@/types";
import { getPersonaConfig } from "@/utils/personas";
import { FileText, Info, Timer, User, Users } from "lucide-react";
import TableRubric from "../rubric/TableRubric";

interface AttemptData {
  attempt: number;
  overallScore: number;
  skillScores: Record<string, number>;
  createdAt: string;
}

export interface SimulationCardProps {
  simulation: Simulation;
  type: "default" | "cohort";
  onStartSimulation: (id: string) => void;
  loadingSimulation: string | null;
  effectiveProfile: Profile;
  rubricData: { attempts: AttemptData[]; highestScore: number };
  scenarios?: Scenario[];
  personas?: Persona[];
}

export default function SimulationCard({
  simulation,
  type,
  onStartSimulation,
  loadingSimulation,
  effectiveProfile,
  rubricData,
  scenarios,
  personas,
}: SimulationCardProps) {
  const validScenarioIds =
    simulation.scenarioIds?.filter((id: string) => id !== "RAY") || [];

  // Default simulation-specific data
  const interaction =
    type === "default"
      ? scenarios?.find((i: Scenario) => i.id === validScenarioIds[0])
      : null;
  const persona = interaction
    ? personas?.find((a: Persona) => a.id === interaction.personaId)
    : null;

  // Get persona configuration based on persona name
  const personaConfig = persona ? getPersonaConfig(persona.name) : null;
  const IconComponent =
    type === "default" ? personaConfig?.icon || User : Users;

  const gradientClass =
    type === "default"
      ? personaConfig?.colors?.gradient || "from-gray-500 to-gray-600"
      : "from-blue-500 to-purple-600";

  const backgroundGradient =
    type === "default"
      ? "from-gray-900 to-gray-600"
      : "from-blue-900 to-purple-600";

  // Make the card fill available height and stretch the header to create space
  return (
    <div className="relative h-full">
      <Card
        data-testid={
          type === "default" ? "permanent-simulation-card" : "simulation-card"
        }
        className="group overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 bg-white dark:bg-gray-900 border-0 shadow-lg rounded-lg flex flex-col h-full"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none select-none">
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
              className={`p-2 rounded-xl bg-gradient-to-br ${gradientClass} shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}
              style={{
                minHeight: 40,
                minWidth: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconComponent className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col items-end space-y-1 flex-1 min-h-[40px] justify-between">
              {/* Rubric Icon */}
              {effectiveProfile?.role !== "guest" && (
                <Dialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <button className="p-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors relative z-20">
                          <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        </button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Rubric</p>
                    </TooltipContent>
                  </Tooltip>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>
                        Grading Rubric: {simulation.title}
                      </DialogTitle>
                    </DialogHeader>
                    {simulation.rubricId ? (
                      <TableRubric rubricId={simulation.rubricId} />
                    ) : (
                      <p className="text-sm text-gray-500">
                        No rubric is associated with this simulation.
                      </p>
                    )}
                  </DialogContent>
                </Dialog>
              )}
              {effectiveProfile?.role === "guest" && (
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

        {/* Make content take up remaining space, but not push footer off */}
        <CardContent className="space-y-1 relative z-10 flex-1 flex flex-col justify-start">
          <div className="flex flex-col justify-between h-full">
            <h3
              className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
              data-testid="simulation-title"
            >
              {simulation.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
              {type === "default"
                ? persona?.description
                : `Interactive simulation with ${validScenarioIds.length} scenario${validScenarioIds.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400 mt-2">
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
            {effectiveProfile?.role !== "guest" &&
              rubricData.highestScore > 0 && (
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
            data-testid={`start-simulation-${simulation.id}`}
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
    </div>
  );
}
