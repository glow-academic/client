"use client";

import { SimulationPicker } from "@/components/common/cohort/SimulationPicker";
import { ParameterSelector } from "@/components/common/scenario/ParameterSelector";
import { PersonaPicker } from "@/components/common/scenario/PersonaPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDepartments } from "@/contexts/departments-context";
import { useParameterItems } from "@/lib/api/v1/hooks/parameter_items";
import { useParametersByDepartmentIdBatch } from "@/lib/api/v1/hooks/parameters";
import { usePersonasByDepartmentIdBatch } from "@/lib/api/v1/hooks/personas";
import { useScenariosByDepartmentIdBatch } from "@/lib/api/v1/hooks/scenarios";
import { useSimulationsByDepartmentIdBatch } from "@/lib/api/v1/hooks/simulations";
import type {
  Parameter,
  ParameterItem,
  Persona,
  Profile,
  Scenario,
  Simulation,
} from "@/types";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface PracticeCustomizeDialogProps {
  open: boolean;
  onClose: () => void;
  onStartAttempt: (params: {
    simulationId: string;
    personaId?: string;
    parameterItemIds?: string[];
    timeLimit?: number;
  }) => void;
  isStartingAttempt: boolean;
  effectiveProfile: Profile | null;
  activeProfile: Profile | null;
}

export function PracticeCustomizeDialog({
  open,
  onClose,
  onStartAttempt,
  isStartingAttempt,
  effectiveProfile,
  activeProfile,
}: PracticeCustomizeDialogProps) {
  // State for the dialog
  const [isInfiniteMode, setIsInfiniteMode] = useState(false);
  const [infiniteTimeLimit, setInfiniteTimeLimit] = useState<string>("");
  const [selectedSimulationId, setSelectedSimulationId] = useState<string>("");
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [selectedParameterItemIds, setSelectedParameterItemIds] = useState<
    string[]
  >([]);
  const { effectiveDepartmentIds } = useDepartments();

  // API calls - only made when dialog is open
  const { data: simulations = [] } = useSimulationsByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: scenarios = [] } = useScenariosByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: personas = [] } = usePersonasByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: parameters = [] } = useParametersByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: parameterItems = [] } = useParameterItems();

  // Only allow customizing non-default parameters and non-default items
  const customParameters = useMemo(() => {
    return (parameters as Parameter[]).filter(
      (p) => p.defaultParameter === false
    );
  }, [parameters]);

  const customParameterItems = useMemo(() => {
    // Use ONLY default items, but only for the non-default parameters
    const customParamIds = new Set(customParameters.map((p) => p.id));
    return (parameterItems as ParameterItem[]).filter(
      (pi) => pi.defaultItem === true && customParamIds.has(pi.parameterId)
    );
  }, [parameterItems, customParameters]);

  // Build persona mapping for PersonaPicker
  const personaMapping = useMemo(() => {
    const mapping: Record<
      string,
      { name: string; description: string; color: string; icon: string }
    > = {};
    (personas as Persona[]).forEach((p) => {
      mapping[p.id] = {
        name: p.name,
        description: p.description,
        color: p.color,
        icon: p.icon,
      };
    });
    return mapping;
  }, [personas]);

  const validPersonaIds = useMemo(() => {
    return (personas as Persona[]).filter((p) => p.active).map((p) => p.id);
  }, [personas]);

  const handleStartAttempt = async () => {
    if (isInfiniteMode) {
      if (!selectedSimulationId) {
        toast.error("Please select a simulation");
        return;
      }
      if (!infiniteTimeLimit || parseInt(infiniteTimeLimit) < 1) {
        toast.error("Please enter a valid time limit");
        return;
      }

      onStartAttempt({
        simulationId: selectedSimulationId,
        timeLimit: parseInt(infiniteTimeLimit),
      });
    } else {
      const selectedPersonaId = selectedPersonaIds[0];
      if (!selectedPersonaId) {
        toast.error("Please select a persona");
        return;
      }

      const selectedPersona = (personas as Persona[]).find(
        (p) => p.id === selectedPersonaId
      );
      if (!selectedPersona) {
        toast.error("Selected persona not found");
        return;
      }

      // Find base default practice scenario for this persona via junction table
      // Note: This requires querying scenario_personas junction
      // For now, we'll use the simulation directly since practice sims are pre-linked
      const baseScenario = (scenarios as Scenario[]).find(
        (s) =>
          s.defaultScenario === true &&
          s.name.toLowerCase().includes(selectedPersona.name.toLowerCase())
      );

      // Find simulation that includes the base scenario (prefer default+practice)
      const targetSimulation =
        (simulations as Simulation[]).find(
          (sim) =>
            (sim.scenarioIds || []).includes(baseScenario?.id || "") &&
            sim.defaultSimulation === true &&
            sim.practiceSimulation === true
        ) ||
        (simulations as Simulation[]).find((sim) =>
          (sim.scenarioIds || []).includes(baseScenario?.id || "")
        );

      if (!targetSimulation) {
        toast.error(
          `No practice simulation found for persona "${selectedPersona.name}". Please contact an administrator.`
        );
        return;
      }

      onStartAttempt({
        simulationId: targetSimulation.id,
        personaId: selectedPersona.id,
        parameterItemIds: selectedParameterItemIds,
      });
    }
  };

  const isDisabled = effectiveProfile?.id !== activeProfile?.id;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Customize Practice Session</DialogTitle>
          <DialogDescription>
            {isInfiniteMode
              ? "Start an infinite practice session with a specific simulation."
              : "Practice one scenario with a specific persona and parameter set."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="infinite-mode"
              checked={isInfiniteMode}
              onChange={(e) => setIsInfiniteMode(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="infinite-mode">
              Infinite Mode (no scenario limit)
            </Label>
          </div>

          {isInfiniteMode ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <SimulationPicker
                  simulations={(simulations as Simulation[])
                    .filter((sim) => sim.practiceSimulation === true)
                    .map((sim) => ({
                      ...sim,
                      timeLimit: sim.timeLimit || undefined,
                    }))}
                  label="Start Simulation"
                  placeholder="Choose a practice simulation"
                  description="Select a practice simulation to start in infinite mode."
                  onSelect={(selectedSims) => {
                    if (selectedSims.length > 0) {
                      setSelectedSimulationId(selectedSims[0]!.id);
                    } else {
                      setSelectedSimulationId("");
                    }
                  }}
                  selectedSimulations={
                    selectedSimulationId
                      ? (simulations as Simulation[])
                          .filter((sim) => sim.id === selectedSimulationId)
                          .map((sim) => ({
                            ...sim,
                            timeLimit: sim.timeLimit || undefined,
                          }))
                      : []
                  }
                  showPracticeSimulations={true}
                  showOnlyActive={false}
                  hideSelectedChips={true}
                  showLabel={true}
                  singleSelect={true}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="infinite-time-limit">
                  Time Limit (minutes)
                </Label>
                <Input
                  id="infinite-time-limit"
                  type="number"
                  min={1}
                  required
                  placeholder="e.g. 15"
                  value={infiniteTimeLimit}
                  onChange={(e) => setInfiniteTimeLimit(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-6">
              <div className="grid gap-2">
                <PersonaPicker
                  mapping={personaMapping}
                  validIds={validPersonaIds}
                  selectedIds={selectedPersonaIds}
                  onSelect={setSelectedPersonaIds}
                  multiSelect={false}
                  label="Persona"
                  description="Choose who you'll practice with."
                />
              </div>
              <div className="grid gap-2">
                <ParameterSelector
                  parameters={customParameters}
                  parameterItems={customParameterItems}
                  selectedParameterItemIds={selectedParameterItemIds}
                  onParameterItemIdsChange={setSelectedParameterItemIds}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {isDisabled ? (
            <Button className="cursor-not-allowed opacity-70" disabled>
              Unavailable
            </Button>
          ) : (
            <Button
              onClick={handleStartAttempt}
              disabled={isStartingAttempt}
              className="min-w-[120px]"
            >
              {isStartingAttempt ? "Starting..." : "Start Practice"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
