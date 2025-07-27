import { Persona, Profile, Scenario, Simulation } from "@/types";
import SimulationCard from "../common/simulation/SimulationCard";

interface PracticeZoneProps {
  simulations: Simulation[];
  profile: Profile | null;
  onStartSimulation: (simulationId: string) => void;
  loadingSimulation: string | null;
  scenarios: Scenario[];
  personas: Persona[];
}

export default function PracticeZone({
  simulations,
  profile,
  onStartSimulation,
  loadingSimulation,
  scenarios,
  personas,
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
                scenarios={scenarios}
                personas={personas}
              />
            )
        )}
      </div>
    </div>
  );
}
