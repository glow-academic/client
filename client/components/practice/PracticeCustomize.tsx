/**
 * PracticeCustomize.tsx
 * Used to customize practice sessions - supports persona, parameter, and department selection
 * Migrated to GenericForm pattern with draft autosave
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";

import type {
  PatchPracticeDraftIn,
  PatchPracticeDraftOut,
} from "@/app/(main)/practice/custom/page";
import type { ProfileItem } from "@/app/(main)/layout-server";
import type { PracticeOut } from "@/app/(main)/practice/page";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import { ParameterSelector } from "@/components/parameters/ParameterSelector";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

export interface PracticeCustomizeProps {
  practiceData: PracticeOut;
  effectiveProfile: ProfileItem | null;
  activeProfile: ProfileItem | null;
  isGuest?: boolean;
  // Draft action: Resource-specific prop name is acceptable since types are resource-specific
  patchPracticeDraftAction?: (
    input: PatchPracticeDraftIn
  ) => Promise<PatchPracticeDraftOut>;
}

function PracticeCustomizeComponent({
  practiceData,
  effectiveProfile,
  activeProfile,
  isGuest: _isGuest = false,
  patchPracticeDraftAction,
}: PracticeCustomizeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isConnected,
    emitCreatePracticeScenario,
    selectedDraftId,
    setSelectedDraftId,
  } = useProfile();

  const [_isStartingAttempt, setIsStartingAttempt] = useState(false);
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(
    null,
  );
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Extract entity arrays from practiceData (API now returns arrays, not mappings)
  const bundle = practiceData;

  // Build mappings from arrays for components
  const personaMapping = useMemo(() => {
    const mapping: Record<
      string,
      { name: string; description: string; color: string; icon: string }
    > = {};
    if (bundle?.personas) {
      for (const persona of bundle.personas) {
        if (persona.persona_id) {
          mapping[String(persona.persona_id)] = {
            name: persona.name || "",
            description: persona.description || "",
            color: persona.color || "",
            icon: persona.icon || "",
          };
        }
      }
    }
    return mapping;
  }, [bundle?.personas]);

  const scenarioMapping = useMemo(() => {
    const mapping: Record<
      string,
      { name: string; description: string; persona_ids: string[] }
    > = {};
    if (bundle?.scenarios) {
      for (const scenario of bundle.scenarios) {
        if (scenario.scenario_id) {
          mapping[String(scenario.scenario_id)] = {
            name: scenario.name || "",
            description: scenario.description || "",
            persona_ids: scenario.persona_ids || [],
          };
        }
      }
    }
    return mapping;
  }, [bundle?.scenarios]);

  const parameterMapping = useMemo(() => {
    const mapping: Record<
      string,
      {
        name: string;
        description: string;
        document_parameter: boolean;
        persona_parameter: boolean;
      }
    > = {};
    if (bundle?.parameters) {
      for (const parameter of bundle.parameters) {
        if (parameter.parameter_id) {
          mapping[String(parameter.parameter_id)] = {
            name: parameter.name || "",
            description: parameter.description || "",
            document_parameter: parameter.document_parameter || false,
            persona_parameter: parameter.persona_parameter || false,
          };
        }
      }
    }
    return mapping;
  }, [bundle?.parameters]);

  const parameterItemMapping = useMemo(() => {
    const mapping: Record<
      string,
      {
        name: string;
        description: string;
        parameter_id: string;
        parameter_name: string;
      }
    > = {};
    if (bundle?.fields) {
      for (const field of bundle.fields) {
        if (field.field_id) {
          mapping[String(field.field_id)] = {
            name: field.name || "",
            description: field.description || "",
            parameter_id: String(field.parameter_id || ""),
            parameter_name: field.parameter_name || "",
          };
        }
      }
    }
    return mapping;
  }, [bundle?.fields]);

  const departmentMapping = useMemo(() => {
    const mapping: Record<string, { name: string; description: string }> =
      {};
    if (bundle?.departments) {
      for (const department of bundle.departments) {
        if (department.department_id) {
          mapping[String(department.department_id)] = {
            name: department.name || "",
            description: department.description || "",
          };
        }
      }
    }
    return mapping;
  }, [bundle?.departments]);

  const validDepartmentIds = useMemo(
    () => bundle?.valid_department_ids || [],
    [bundle?.valid_department_ids],
  );

  // Build valid IDs from arrays (server already filtered to relevant items)
  const validSimulationIds = useMemo(
    () =>
      bundle?.simulations?.map((s) => String(s.simulation_id)).filter(Boolean) ||
      [],
    [bundle?.simulations],
  );

  // Build personas array for SelectableGrid
  const personasArray = useMemo(() => {
    return Object.entries(personaMapping).map(([id, p]) => ({
      id,
      name: p.name,
      description: p.description,
      color: p.color,
      icon: p.icon,
    }));
  }, [personaMapping]);

  // Build scenarios array for finding default scenarios
  const scenarios = useMemo(
    () =>
      Object.entries(scenarioMapping).map(([id, sc]) => ({
        id,
        name: sc.name,
        defaultScenario: true,
        personaId:
          sc.persona_ids && sc.persona_ids.length > 0
            ? sc.persona_ids[0]
            : undefined,
      })),
    [scenarioMapping],
  );

  // Inline parsers for URL-backed state (navigation/search params only)
  const practiceSearchParamsClient = {
    // Draft ID (URL-backed, updated when draft is created)
    draftId: parseAsString,
    // Search params (URL-backed, updated via debounced callback in StepCard)
    personaSearch: parseAsString,
    parameterSearch: parseAsString,
    departmentSearch: parseAsString,
    // Filter params (URL-backed)
    personaShowSelected: parseAsBoolean,
    parameterShowSelected: parseAsBoolean,
  } as const;

  // URL-backed state using nuqs (only navigation/search params)
  const [urlParams, setUrlParams] = useQueryStates(practiceSearchParamsClient, {
    history: "replace",
    shallow: true, // Use shallow routing to prevent server component re-renders
  });

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  const draftId = urlDraftId;

  // Local draft state (not in URL) - initialized from server data or draft payload
  type DraftState = {
    personaIds: string[];
    parameterItemIds: string[];
    departmentIds: string[];
  };

  // Initialize draft state from server data or draft payload
  // IMPORTANT: Include actual data fields in dependencies, not just IDs, so it recomputes when content changes
  const initialDraftState = useMemo((): DraftState => {
    // Extract from draft payload fields first (if draft exists)
    let personaIds: string[] = [];
    let parameterItemIds: string[] = [];
    let departmentIds: string[] = [];

    // Try to read from draft payload fields (returned by SQL when draft exists)
    if (bundle && "draft_persona_ids" in bundle && bundle.draft_persona_ids) {
      try {
        const parsed =
          typeof bundle.draft_persona_ids === "string"
            ? JSON.parse(bundle.draft_persona_ids)
            : bundle.draft_persona_ids;
        if (parsed && Array.isArray(parsed)) {
          personaIds = parsed.map((id) => String(id));
        }
      } catch (e) {
        // Ignore parse errors, fall back to empty array
      }
    }

    if (
      bundle &&
      "draft_parameter_item_ids" in bundle &&
      bundle.draft_parameter_item_ids
    ) {
      try {
        const parsed =
          typeof bundle.draft_parameter_item_ids === "string"
            ? JSON.parse(bundle.draft_parameter_item_ids)
            : bundle.draft_parameter_item_ids;
        if (parsed && Array.isArray(parsed)) {
          parameterItemIds = parsed.map((id) => String(id));
        }
      } catch (e) {
        // Ignore parse errors, fall back to empty array
      }
    }

    if (
      bundle &&
      "draft_department_ids" in bundle &&
      bundle.draft_department_ids
    ) {
      try {
        const parsed =
          typeof bundle.draft_department_ids === "string"
            ? JSON.parse(bundle.draft_department_ids)
            : bundle.draft_department_ids;
        if (parsed && Array.isArray(parsed)) {
          departmentIds = parsed.map((id) => String(id));
        }
      } catch (e) {
        // Ignore parse errors, fall back to empty array
      }
    }

    return {
      personaIds,
      parameterItemIds,
      departmentIds,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftId,
    urlDraftId,
    // Include actual content fields so it recomputes when server data changes
    bundle?.draft_persona_ids,
    bundle?.draft_parameter_item_ids,
    bundle?.draft_department_ids,
  ]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

  // Track previous initialDraftState content to avoid unnecessary updates
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState)
  );

  // Update draft state when server data changes (e.g., draft selected)
  useEffect(() => {
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);

    if (currentStateStr !== newStateStr) {
      prevInitialDraftStateRef.current = newStateStr;
      setDraftState(initialDraftState);
    }
  }, [initialDraftState]);

  // Integrate autosave hook
  const {
    saveStatus: _saveStatus,
    saveNow: _saveNow,
    lastSavedVersion: _lastSavedVersion,
  } = useDraftAutosave({
    draftId,
    draftState,
    patchDraftAction: patchPracticeDraftAction
      ? async (input) => {
          // Transform hook API → backend API
          const result = await patchPracticeDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: input.body.patch as Record<string, unknown>,
              expected_version: input.body.expected_version,
            } as PatchPracticeDraftIn["body"],
          });
          // Transform backend API → hook API
          return {
            draftId: result.draft_id || "",
            newVersion: result.new_version || 0,
            draftExists: result.draft_exists || false,
          };
        }
      : async () => ({ draftId: "", newVersion: 0, draftExists: false }),
    debounceMs: 1000,
    onDraftCreated: useCallback(
      (newDraftId: string) => {
        // Only update URL if draftId actually changed
        const currentUrlDraftId = searchParams.get("draftId");
        if (newDraftId === currentUrlDraftId) {
          return;
        }
        // Update URL with new draftId and trigger server-side refetch
        const params = new URLSearchParams(searchParams.toString());
        params.set("draftId", newDraftId);
        const newUrl = `?${params.toString()}`;
        router.replace(newUrl, { scroll: false });
        // Force server components to re-render with updated search params
        router.refresh();
      },
      [router, searchParams]
    ),
  });

  // Merge draftState with urlParams for formData (GenericForm expects single formData object)
  const formData = useMemo(() => {
    return {
      ...draftState,
      personaSearch: urlParams.personaSearch || null,
      parameterSearch: urlParams.parameterSearch || null,
      departmentSearch: urlParams.departmentSearch || null,
      personaShowSelected: urlParams.personaShowSelected ?? false,
      parameterShowSelected: urlParams.parameterShowSelected ?? false,
    } as Record<string, unknown>;
  }, [draftState, urlParams]);

  // Wrapper for setFormData that updates draftState for form fields, urlParams for navigation
  const setFormData = useCallback(
    (
      updates:
        | Partial<Record<string, unknown>>
        | ((prev: Record<string, unknown>) => Partial<Record<string, unknown>>)
    ) => {
      // Handle function form
      const resolvedUpdates =
        typeof updates === "function" ? updates(formData) : updates;

      const draftUpdates: Partial<DraftState> = {};
      const urlUpdates: Partial<Record<string, unknown>> = {};

      Object.entries(resolvedUpdates).forEach(([key, value]) => {
        if (
          key === "personaIds" ||
          key === "parameterItemIds" ||
          key === "departmentIds"
        ) {
          draftUpdates[key as keyof DraftState] = value as never;
        } else if (
          key === "personaSearch" ||
          key === "parameterSearch" ||
          key === "departmentSearch" ||
          key === "personaShowSelected" ||
          key === "parameterShowSelected"
        ) {
          urlUpdates[key] = value;
        }
      });

      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }
      if (Object.keys(urlUpdates).length > 0) {
        // Check if URL params actually changed before updating
        const hasChanges = Object.keys(urlUpdates).some((key) => {
          const newValue = urlUpdates[key];
          const currentValue = urlParams[key as keyof typeof urlParams];
          return newValue !== currentValue;
        });

        if (hasChanges) {
          setUrlParams(urlUpdates as Parameters<typeof setUrlParams>[0]);
        }
      }
    },
    [formData, setUrlParams, urlParams]
  );

  // Filter personas based on search and showSelected filter
  const filteredPersonasArray = useMemo(() => {
    let filtered = personasArray;

    // Apply search filter
    const personaSearch = urlParams.personaSearch || "";
    if (personaSearch.trim()) {
      const searchLower = personaSearch.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          (p.description || "").toLowerCase().includes(searchLower)
      );
    }

    // Apply showSelected filter
    const personaShowSelected = urlParams.personaShowSelected ?? false;
    if (personaShowSelected && draftState.personaIds.length > 0) {
      filtered = filtered.filter((p) =>
        draftState.personaIds.includes(p.id)
      );
    }

    return filtered;
  }, [
    personasArray,
    urlParams.personaSearch,
    urlParams.personaShowSelected,
    draftState.personaIds,
  ]);

  // Filter parameter items based on search and showSelected filter
  const filteredParameterItemMapping = useMemo(() => {
    let filtered = parameterItemMapping;

    // Apply search filter
    const parameterSearch = urlParams.parameterSearch || "";
    if (parameterSearch.trim()) {
      const searchLower = parameterSearch.toLowerCase();
      filtered = Object.fromEntries(
        Object.entries(filtered).filter(
          ([, item]) =>
            item.name.toLowerCase().includes(searchLower) ||
            (item.description || "").toLowerCase().includes(searchLower) ||
            item.parameter_name.toLowerCase().includes(searchLower)
        )
      );
    }

    // Apply showSelected filter
    const parameterShowSelected = urlParams.parameterShowSelected ?? false;
    if (parameterShowSelected && draftState.parameterItemIds.length > 0) {
      filtered = Object.fromEntries(
        Object.entries(filtered).filter(([id]) =>
          draftState.parameterItemIds.includes(id)
        )
      );
    }

    return filtered;
  }, [
    parameterItemMapping,
    urlParams.parameterSearch,
    urlParams.parameterShowSelected,
    draftState.parameterItemIds,
  ]);


  const validParameterItemIds = useMemo(
    () => Object.keys(filteredParameterItemMapping),
    [filteredParameterItemMapping]
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
      setIsStartingAttempt(false);
      const { attemptId } = event.detail;
      router.refresh();
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
      setIsStartingAttempt(false);
      toast.error("Failed to start simulation. Please try again.");
    };

    window.addEventListener(
      "simulationStarted",
      handleSimulationStarted as unknown as EventListener
    );
    window.addEventListener("simulationError", handleSimulationError);

    return () => {
      window.removeEventListener(
        "simulationStarted",
        handleSimulationStarted as unknown as EventListener
      );
      window.removeEventListener("simulationError", handleSimulationError);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [router, loadingToastId]);

  // Submit handler for GenericForm (uses draftState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (!isConnected) {
        toast.error("WebSocket not connected. Please refresh the page.");
        throw new Error("WebSocket not connected");
      }

      const selectedPersonaId = draftState.personaIds[0];
      if (!selectedPersonaId) {
        toast.error("Please select a persona");
        throw new Error("Persona selection required");
      }

      const selectedPersona = personasArray.find((p) => p.id === selectedPersonaId);
      if (!selectedPersona) {
        toast.error("Selected persona not found");
        throw new Error("Selected persona not found");
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
        throw new Error("No practice simulation found");
      }

      setIsStartingAttempt(true);
      const profileIdForEmit =
        effectiveProfile?.role === "guest"
          ? ""
          : String(effectiveProfile?.id || "");

      // Store toast ID so it can be dismissed when simulation starts
      const practiceToastId = toast.loading("Creating practice scenario...", {
        dismissible: true,
      });
      setLoadingToastId(practiceToastId);

      // Set timeout for practice scenario creation
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        toast.dismiss(practiceToastId);
        toast.error(
          "Practice scenario creation timed out. Please try again."
        );
        setLoadingToastId(null);
        setIsStartingAttempt(false);
      }, 30000);

      const departmentId =
        draftState.departmentIds.length > 0
          ? draftState.departmentIds[0]
          : undefined;

      emitCreatePracticeScenario({
        persona_id: selectedPersona.id,
        parameter_item_ids: draftState.parameterItemIds,
        department_id: departmentId || null,
        profile_id: profileIdForEmit,
        infinite_mode: false,
      });
    },
    [
      isConnected,
      draftState,
      personasArray,
      scenarios,
      validSimulationIds,
      effectiveProfile,
      emitCreatePracticeScenario,
    ]
  );

  // Step status logic (for GenericForm)
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const personaIds = (formData["personaIds"] as string[] | null | undefined) || [];
      const hasPersona = personaIds.length > 0;

      switch (stepId) {
        case "persona":
          return hasPersona ? "completed" : "active";
        case "parameters":
          if (!hasPersona) return "pending";
          return "completed"; // Parameters are optional
        case "department":
          if (!hasPersona) return "pending";
          return "completed"; // Department is optional
        default:
          return "pending";
      }
    },
    []
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "persona",
        title: "Target Persona",
        description:
          "Choose the target persona you'll practice with in standard mode.",
        resetFields: ["personaIds", "personaSearch", "personaShowSelected"],
      },
      {
        id: "parameters",
        title: "Parameters",
        description: "Select specific parameters for this practice session.",
        resetFields: [
          "parameterItemIds",
          "parameterSearch",
          "parameterShowSelected",
        ],
      },
      ...(validDepartmentIds.length > 1
        ? [
            {
              id: "department",
              title: "Department",
              description: "Select a department (optional).",
              resetFields: ["departmentIds", "departmentSearch"],
            },
          ]
        : []),
    ],
    [validDepartmentIds.length]
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => ["personaIds", "parameterItemIds", "departmentIds"],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "persona":
        return "Persona selection reset";
      case "parameters":
        return "Parameter selection reset";
      case "department":
        return "Department selection reset";
      default:
        return "Reset";
    }
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/practice",
      backLabel: "Cancel",
      createLabel: "Start Practice",
      updateLabel: "Start Practice",
      disabled: effectiveProfile?.id !== activeProfile?.id,
    }),
    [effectiveProfile?.id, activeProfile?.id]
  );

  // Create filter onChange callbacks
  const createPersonaFilterOnChange = useCallback(
    (value: boolean) => {
      setFormData({ personaShowSelected: value || null });
    },
    [setFormData]
  );

  const createParameterFilterOnChange = useCallback(
    (value: boolean) => {
      setFormData({ parameterShowSelected: value || null });
    },
    [setFormData]
  );

  // Memoize renderStep to prevent GenericForm re-renders
  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData: stepFormData,
      setFormData: setStepFormData,
      onReset,
    }: {
      stepId: string;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      stepStatus: StepStatus;
      isOptional: boolean;
      formData: Record<string, unknown>;
      setFormData: (updates: Partial<Record<string, unknown>>) => void;
      filters?: Array<{
        key: string;
        label: string;
        value: boolean;
        onChange: (value: boolean) => void;
      }>;
      onReset?: () => void;
    }) => {
      switch (stepId) {
        case "persona": {
          const selectedPersonaId =
            ((stepFormData["personaIds"] as string[] | null | undefined) ||
              [])[0] || null;
          const personaShowSelected =
            (stepFormData["personaShowSelected"] as boolean | null | undefined) ??
            false;

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={false}
              isEditMode={false}
              searchTerm={
                (stepFormData["personaSearch"] as string | null | undefined) || ""
              }
              onSearchChange={(term: string) =>
                setStepFormData({ personaSearch: term || null })
              }
              searchPlaceholder="Search personas..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: personaShowSelected,
                  onChange: createPersonaFilterOnChange,
                },
              ]}
              resetFields={["personaIds", "personaSearch", "personaShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <SelectableGrid
                items={filteredPersonasArray}
                selectedId={selectedPersonaId}
                onSelect={(personaId) => {
                  const currentIds =
                    (stepFormData["personaIds"] as string[] | null | undefined) ||
                    [];
                  const isSelected = currentIds.includes(personaId);
                  setStepFormData({
                    personaIds: isSelected ? [] : [personaId],
                  });
                }}
                getId={(persona) => persona.id}
                renderItem={(persona, isSelected) => (
                  <div
                    className={cn(
                      "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                      "hover:shadow-md hover:bg-accent/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected && "ring-2 ring-primary bg-accent"
                    )}
                  >
                    {/* Check icon - top right */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      {persona.color && (
                        <div
                          className="w-10 h-10 rounded-lg border-2 border-border shrink-0"
                          style={{ backgroundColor: persona.color }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm leading-tight">
                          {persona.name || "Unnamed Persona"}
                        </h3>
                        {persona.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {persona.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                emptyMessage="No personas found. Try adjusting your search or filters."
                disabled={false}
              />
            </StepCard>
          );
        }

        case "parameters": {
          const parameterShowSelected =
            (stepFormData["parameterShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={false}
              isEditMode={false}
              searchTerm={
                (stepFormData["parameterSearch"] as string | null | undefined) ||
                ""
              }
              onSearchChange={(term: string) =>
                setStepFormData({ parameterSearch: term || null })
              }
              searchPlaceholder="Search parameters..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: parameterShowSelected,
                  onChange: createParameterFilterOnChange,
                },
              ]}
              resetFields={[
                "parameterItemIds",
                "parameterSearch",
                "parameterShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
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
                selectedParameterItemIds={
                  (stepFormData["parameterItemIds"] as
                    | string[]
                    | null
                    | undefined) || []
                }
                onParameterItemIdsChange={(ids) =>
                  setStepFormData({
                    parameterItemIds: ids.length > 0 ? ids : null,
                  })
                }
              />
            </StepCard>
          );
        }

        case "department": {
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={false}
              isEditMode={false}
              searchTerm={
                (stepFormData["departmentSearch"] as string | null | undefined) ||
                ""
              }
              onSearchChange={(term: string) =>
                setStepFormData({ departmentSearch: term || null })
              }
              searchPlaceholder="Search departments..."
              debounceMs={300}
              resetFields={["departmentIds", "departmentSearch"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-2">
                <GenericPicker
                  items={departmentMapping}
                  itemIds={validDepartmentIds}
                  selectedIds={
                    (stepFormData["departmentIds"] as
                      | string[]
                      | null
                      | undefined) || []
                  }
                  onSelect={(ids) =>
                    setStepFormData({
                      departmentIds: ids.length > 0 ? ids : null,
                    })
                  }
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
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      filteredPersonasArray,
      parameterMapping,
      filteredParameterItemMapping,
      validParameterItemIds,
      departmentMapping,
      validDepartmentIds,
      createPersonaFilterOnChange,
      createParameterFilterOnChange,
    ]
  );


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

      {/* GenericForm */}
      <GenericForm
        nuqsParsers={
          practiceSearchParamsClient as Record<string, Parser<unknown>>
        }
        steps={steps}
        getStepStatus={getStepStatus}
        formData={formData}
        setFormData={setFormData}
        serverData={bundle}
        formFieldKeys={formFieldKeys}
        resetSuccessMessage={resetSuccessMessage}
        onSubmit={handleSubmit}
        submitButton={submitButton}
        isReadonly={false}
        isEditMode={false}
        renderStep={renderStep}
      />
    </div>
  );
}

// Memoize component to prevent re-renders when only prop references change
export default React.memo(PracticeCustomizeComponent, (prevProps, nextProps) => {
  // Compare primitive props
  if (
    prevProps.isGuest !== nextProps.isGuest ||
    prevProps.effectiveProfile?.id !== nextProps.effectiveProfile?.id ||
    prevProps.activeProfile?.id !== nextProps.activeProfile?.id
  ) {
    return false; // Props changed, re-render
  }

  // Compare practiceData by checking key fields
  const prevData = prevProps.practiceData;
  const nextData = nextProps.practiceData;
  if (
    prevData?.valid_department_ids?.length !==
      nextData?.valid_department_ids?.length ||
    prevData?.personas?.length !== nextData?.personas?.length ||
    prevData?.fields?.length !== nextData?.fields?.length
  ) {
    return false; // Content changed, re-render
  }

  // All props are equivalent (same content), skip re-render
  return true;
});
