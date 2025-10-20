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
import type {
  ParameterItemMapping,
  ParameterMapping,
  PersonaMapping,
  ScenarioMapping,
  SimulationMapping,
} from "@/lib/api/v2/schemas/base";
import { ProfileItem } from "@/lib/api/v2/schemas/profile";
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
  effectiveProfile: ProfileItem | null;
  activeProfile: ProfileItem | null;
  // Entity mappings from parent
  personaMapping: PersonaMapping;
  scenarioMapping: ScenarioMapping;
  parameterMapping: ParameterMapping;
  parameterItemMapping: ParameterItemMapping;
  simulationMapping: SimulationMapping;
}

export function PracticeCustomizeDialog({
  open,
  onClose,
  onStartAttempt,
  isStartingAttempt,
  effectiveProfile,
  activeProfile,
  personaMapping,
  scenarioMapping,
  parameterMapping,
  parameterItemMapping,
  simulationMapping,
}: PracticeCustomizeDialogProps) {
  // State for the dialog
  const [isInfiniteMode, setIsInfiniteMode] = useState(false);
  const [infiniteTimeLimit, setInfiniteTimeLimit] = useState<string>("");
  const [selectedSimulationId, setSelectedSimulationId] = useState<string>("");
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [selectedParameterItemIds, setSelectedParameterItemIds] = useState<
    string[]
  >([]);

  // Build valid IDs from mappings (server already filtered to relevant items)
  const validSimulationIds = useMemo(
    () => Object.keys(simulationMapping),
    [simulationMapping]
  );

  const validPersonaIds = useMemo(
    () => Object.keys(personaMapping),
    [personaMapping]
  );

  // Build arrays from mappings for components that need them
  const scenarios = useMemo(
    () =>
      Object.entries(scenarioMapping).map(([id, sc]) => ({
        id,
        name: sc.name,
        defaultScenario: true, // Server filters to defaults
        personaId: sc.persona_id,
      })),
    [scenarioMapping]
  );

  const personas = useMemo(
    () =>
      Object.entries(personaMapping).map(([id, p]) => ({
        id,
        name: p.name,
      })),
    [personaMapping]
  );

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

      const selectedPersona = personas.find((p) => p.id === selectedPersonaId);
      if (!selectedPersona) {
        toast.error("Selected persona not found");
        return;
      }

      // Find base default practice scenario for this persona
      const baseScenario = scenarios.find((s) =>
        s.name.toLowerCase().includes(selectedPersona.name.toLowerCase())
      );

      // Use first available practice simulation (server filtered to practice only)
      const firstSimulationId = validSimulationIds[0];
      if (!firstSimulationId || !baseScenario) {
        toast.error(
          `No practice simulation found for persona "${selectedPersona.name}". Please contact an administrator.`
        );
        return;
      }

      onStartAttempt({
        simulationId: firstSimulationId,
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
                  simulationMapping={simulationMapping}
                  validSimulationIds={validSimulationIds}
                  selectedSimulationIds={
                    selectedSimulationId ? [selectedSimulationId] : []
                  }
                  onSelect={(ids) => {
                    setSelectedSimulationId(ids[0] || "");
                  }}
                  multiSelect={false}
                  label="Start Simulation"
                  placeholder="Choose a practice simulation"
                  description="Select a practice simulation to start in infinite mode."
                  hideSelectedChips={true}
                  showLabel={true}
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
                  parameterMapping={parameterMapping}
                  parameterItemMapping={parameterItemMapping}
                  validParameterItemIds={Object.keys(parameterItemMapping)}
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
