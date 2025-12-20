"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { ParameterSelector } from "@/components/parameters/ParameterSelector";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useRef } from "react";
import { toast } from "sonner";

// ProfileItem type derived from server response (single source of truth)
import type { ProfileItem } from "@/app/(main)/layout-server";
import type { PracticeOut } from "@/app/(main)/practice/page";
import { useProfile } from "@/contexts/profile-context";

interface PracticeCustomizeProps {
  practiceData: PracticeOut;
  effectiveProfile: ProfileItem | null;
  activeProfile: ProfileItem | null;
  isGuest?: boolean;
}

export default function PracticeCustomize({
  practiceData,
  effectiveProfile,
  activeProfile,
  isGuest: _isGuest = false,
}: PracticeCustomizeProps) {
  const router = useRouter();
  const {
    isConnected,
    emitCreatePracticeScenario,
  } = useProfile();

  // State for the form
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [selectedParameterItemIds, setSelectedParameterItemIds] = useState<
    string[]
  >([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(
    [],
  );
  const [isStartingAttempt, setIsStartingAttempt] = useState(false);
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(
    null,
  );
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Extract entity mappings from practiceData
  const bundle = practiceData;
  const personaMapping = useMemo(
    () => bundle?.persona_mapping || {},
    [bundle?.persona_mapping],
  );
  const scenarioMapping = useMemo(
    () => bundle?.scenario_mapping || {},
    [bundle?.scenario_mapping],
  );
  const parameterMapping = useMemo(
    () => bundle?.parameter_mapping || {},
    [bundle?.parameter_mapping],
  );
  const parameterItemMapping = useMemo(
    () => bundle?.field_mapping || {},
    [bundle?.field_mapping],
  );
  const simulationMapping = useMemo(
    () => bundle?.simulation_mapping || {},
    [bundle?.simulation_mapping],
  );
  const departmentMapping = useMemo(
    () => bundle?.department_mapping || {},
    [bundle?.department_mapping],
  );
  const validDepartmentIds = useMemo(
    () => bundle?.valid_department_ids || [],
    [bundle?.valid_department_ids],
  );

  // Build valid IDs from mappings (server already filtered to relevant items)
  const validSimulationIds = useMemo(
    () => Object.keys(simulationMapping),
    [simulationMapping],
  );

  // Filter personas and parameter items based on selected departments
  const filteredPersonaMapping = useMemo(() => {
    if (selectedDepartmentIds.length === 0) {
      return personaMapping; // Show all if no department selected
    }
    // Filter personas that are available to selected departments
    // This is a simplified filter - in reality, we'd need to check persona_departments junction
    // For now, we'll show all personas and let the backend handle filtering
    return personaMapping;
  }, [personaMapping, selectedDepartmentIds]);

  const filteredParameterItemMapping = useMemo(() => {
    if (selectedDepartmentIds.length === 0) {
      return parameterItemMapping; // Show all if no department selected
    }
    // Filter parameter items that are available to selected departments
    // This is a simplified filter - in reality, we'd need to check parameter_item_departments junction
    // For now, we'll show all parameter items and let the backend handle filtering
    return parameterItemMapping;
  }, [parameterItemMapping, selectedDepartmentIds]);

  const validPersonaIds = useMemo(
    () => Object.keys(filteredPersonaMapping),
    [filteredPersonaMapping],
  );

  const validParameterItemIds = useMemo(
    () => Object.keys(filteredParameterItemMapping),
    [filteredParameterItemMapping],
  );

  // Build arrays from mappings for components that need them
  const scenarios = useMemo(
    () =>
      Object.entries(scenarioMapping).map(([id, sc]) => ({
        id,
        name: sc.name,
        defaultScenario: true, // Server filters to defaults
        personaId:
          sc.persona_ids && sc.persona_ids.length > 0
            ? sc.persona_ids[0]
            : undefined,
      })),
    [scenarioMapping],
  );

  const personas = useMemo(
    () =>
      Object.entries(personaMapping).map(([id, p]) => ({
        id,
        name: p.name,
      })),
    [personaMapping],
  );

  // Set up simulation-specific event listeners using global WebSocket
  useEffect(() => {
    // Listen for successful simulation starts to handle navigation
    const handleSimulationStarted = async (event: CustomEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
        setLoadingToastId(null);
      }
      setIsStartingAttempt(false); // Reset practice scenario loading state
      const { attemptId } = event.detail;
      // Server-side Redis cache is already invalidated by the WebSocket handler
      router.refresh(); // Refresh current page data so it's updated when user returns
      router.push(`/practice/a/${attemptId}`);
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
      setIsStartingAttempt(false); // Reset practice scenario loading state
      toast.error("Failed to start simulation. Please try again.");
    };

    window.addEventListener(
      "simulationStarted",
      handleSimulationStarted as unknown as EventListener,
    );
    window.addEventListener("simulationError", handleSimulationError);

    return () => {
      window.removeEventListener(
        "simulationStarted",
        handleSimulationStarted as unknown as EventListener,
      );
      window.removeEventListener("simulationError", handleSimulationError);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [router, loadingToastId]);

  const handleStartAttempt = async () => {
    if (!isConnected) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    const departmentId =
      selectedDepartmentIds.length > 0 ? selectedDepartmentIds[0] : undefined;

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
      s.name.toLowerCase().includes(selectedPersona.name.toLowerCase()),
    );

    // Use first available practice simulation (server filtered to practice only)
    const firstSimulationId = validSimulationIds[0];
    if (!firstSimulationId || !baseScenario) {
      toast.error(
        `No practice simulation found for persona "${selectedPersona.name}". Please contact an administrator.`,
      );
      return;
    }

    setIsStartingAttempt(true);
    const profileIdForEmit =
      effectiveProfile?.role === "guest"
        ? ""
        : String(effectiveProfile?.id || "");

    // Standard mode - use simulation_text_practice WebSocket event
    // Store toast ID so it can be dismissed when simulation starts
    const practiceToastId = toast.loading(
      "Creating practice scenario...",
      {
        dismissible: true,
      },
    );
    setLoadingToastId(practiceToastId);

    // Set timeout for practice scenario creation
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      toast.dismiss(practiceToastId);
      toast.error(
        "Practice scenario creation timed out. Please try again.",
      );
      setLoadingToastId(null);
      setIsStartingAttempt(false);
    }, 30000);

    emitCreatePracticeScenario({
      persona_id: selectedPersona.id,
      parameter_item_ids: selectedParameterItemIds,
      department_id: departmentId || null,
      profile_id: profileIdForEmit,
      infinite_mode: false,
    });
  };

  const isDisabled = effectiveProfile?.id !== activeProfile?.id;

  if (!effectiveProfile) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="practice-customize-page">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link href="/practice">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Customize Practice Session</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Practice with a single target persona and specific parameter set.
          </p>
        </div>
      </div>

      {/* Form Content */}
      <div className="space-y-6">
        <div className="grid gap-6">
          {validDepartmentIds.length > 1 && (
            <div
              className="grid gap-2"
              data-testid="practice-department-picker"
            >
              <Label>Department</Label>
              <GenericPicker
                items={departmentMapping}
                itemIds={validDepartmentIds}
                selectedIds={selectedDepartmentIds}
                onSelect={setSelectedDepartmentIds}
                getId={(dept) => (dept as unknown as { id: string }).id}
                getLabel={(dept) => dept.name || ""}
                getSearchText={(dept) =>
                  `${dept.name} ${dept.description || ""}`
                }
                multiSelect={false}
                placeholder="Select department (optional)"
                hideSelectedChips={true}
                buttonClassName="w-full"
              />
            </div>
          )}
          <div className="grid gap-2" data-testid="practice-persona-picker">
            <Label>Target Persona</Label>
            <GenericPicker
              items={filteredPersonaMapping}
              itemIds={validPersonaIds}
              selectedIds={selectedPersonaIds}
              onSelect={setSelectedPersonaIds}
              getId={(item) => {
                const entry = Object.entries(filteredPersonaMapping).find(
                  ([, v]) => v === item,
                );
                return entry ? entry[0] : "";
              }}
              getLabel={(item) => (item as { name: string }).name || ""}
              getSearchText={(item) =>
                `${(item as { name: string }).name} ${(item as { description?: string }).description || ""}`
              }
              multiSelect={false}
              placeholder="Choose the target persona you'll practice with in standard mode."
              buttonClassName="w-full"
            />
          </div>
          <div
            className="grid gap-2"
            data-testid="practice-parameter-selector"
          >
            <ParameterSelector
              parameterMapping={
                parameterMapping as Parameters<
                  typeof ParameterSelector
                >[0]["parameterMapping"]
              }
              fieldMapping={
                filteredParameterItemMapping as Parameters<
                  typeof ParameterSelector
                >[0]["fieldMapping"]
              }
              validParameterItemIds={validParameterItemIds}
              selectedParameterItemIds={selectedParameterItemIds}
              onParameterItemIdsChange={setSelectedParameterItemIds}
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Link href="/practice">
          <Button variant="outline">Cancel</Button>
        </Link>
        {isDisabled ? (
          <Button className="cursor-not-allowed opacity-70" disabled>
            Unavailable
          </Button>
        ) : (
          <Button
            onClick={handleStartAttempt}
            disabled={isStartingAttempt}
            className="min-w-[120px]"
            data-testid="practice-start-button"
          >
            {isStartingAttempt ? "Starting..." : "Start Practice"}
          </Button>
        )}
      </div>
    </div>
  );
}

