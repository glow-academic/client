import { Agent, Profile, Scenario, Simulation } from "@/types";
import SimulationCard from "../common/simulation/SimulationCard";

interface AttemptData {
  attempt: number;
  overallScore: number;
  skillScores: Record<string, number>;
  createdAt: string;
}

interface PracticeZoneProps {
  simulations: Simulation[];
  profile: Profile | null;
  onStartSimulation: (simulationId: string) => void;
  loadingSimulation: string | null;
  getRealRubricData: (simulationId: string) => {
    attempts: AttemptData[];
    highestScore: number;
  };
  scenarios: Scenario[];
  agents: Agent[];
}

export default function PracticeZone({
  simulations,
  profile,
  onStartSimulation,
  loadingSimulation,
  getRealRubricData,
  scenarios,
  agents,
}: PracticeZoneProps) {
  if (!simulations || simulations.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {simulations.map(
          (simulation) =>
            profile && (
              <SimulationCard
                key={simulation.id}
                simulation={simulation}
                type="default"
                onStartSimulation={onStartSimulation}
                loadingSimulation={loadingSimulation}
                effectiveProfile={profile}
                rubricData={getRealRubricData(simulation.id)}
                scenarios={scenarios}
                agents={agents}
              />
            )
        )}
      </div>
    </div>
  );
}
