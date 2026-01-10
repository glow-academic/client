/**
 * GenericForm.tsx
 * Generic form component with automatic step status calculation and nuqs integration
 * Similar to GenericPicker - works with any form structure via function-based extraction
 */

"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Parser } from "nuqs";
import { useQueryStates, type Values } from "nuqs";
import * as React from "react";
import { toast } from "sonner";

export type StepStatus = "pending" | "active" | "completed";

export interface GenericFormStep<
  T extends Record<string, Parser<unknown>> = Record<string, Parser<unknown>>,
> {
  id: string;
  title: string;
  description: string;
  optional?: boolean;
  filters?: Array<{
    key: string;
    label: string;
  }>;
  // Reset fields for this step
  resetFields?: (keyof Values<T>)[];
}

export interface GenericFormProps<T extends Record<string, Parser<unknown>>> {
  // nuqs parsers config (like scenarioSearchParamsClient)
  nuqsParsers: T;

  // Steps configuration
  steps: GenericFormStep<T>[];

  // Step status calculation function
  getStepStatus: (stepId: string, formData: Values<T>) => StepStatus;

  // Render prop for each step (flexible - card-based or custom)
  renderStep: (props: {
    stepId: string;
    stepTitle: string;
    stepDescription: string;
    stepNumber: number;
    stepStatus: StepStatus;
    isOptional: boolean;
    formData: Values<T>;
    setFormData: (updates: Partial<Values<T>>) => void;
    filters?: Array<{
      key: string;
      label: string;
      value: boolean;
      onChange: (value: boolean) => void;
    }>;
    onReset?: () => void;
  }) => React.ReactNode;

  // Optional: external formData/setFormData (if state is managed externally)
  formData?: Values<T>;
  setFormData?: (
    updates: Partial<Values<T>> | ((prev: Values<T>) => Partial<Values<T>>)
  ) => void;

  // Form initialization from server data
  serverData?: unknown;
  initializeForm?: (
    serverData: unknown,
    isEditMode: boolean
  ) => Partial<Values<T>>;
  formFieldKeys?: (keyof Values<T>)[];

  // Reset handlers
  onReset?: (stepId: string, fields: (keyof Values<T>)[]) => void;
  resetSuccessMessage?: (stepId: string) => string;

  // Nested content sections (for complex workflows like scenarios in simulations)
  contentSections?: Array<{
    id: string;
    render: (props: {
      formData: Values<T>;
      setFormData: (updates: Partial<Values<T>>) => void;
    }) => React.ReactNode;
    insertAfter?: string; // stepId to insert after
  }>;

  // Submit handler
  onSubmit?: (formData: Values<T>) => Promise<void>;
  submitButton?: {
    label?: string;
    createLabel?: string;
    updateLabel?: string;
    disabled?: boolean;
    backUrl?: string;
    backLabel?: string;
  };

  // Optional props
  isReadonly?: boolean;
  isEditMode?: boolean;
  className?: string;

  // Optional bridge for parent side-effects (draft patching, websocket, etc.)
  onFormDataChange?: (formData: Values<T>) => void;

  // Optional bridge so parent can imperatively update URL-backed state
  registerSetFormData?: (
    setFormData: (
      updates: Partial<Values<T>> | ((prev: Values<T>) => Partial<Values<T>>)
    ) => void
  ) => void;
}

// Hook for form initialization from server data
function useFormInitialization<T extends Record<string, Parser<unknown>>>({
  serverData,
  isEditMode,
  formData,
  formFieldKeys,
  initializeForm,
  setFormData,
}: {
  serverData: unknown;
  isEditMode: boolean;
  formData: Values<T>;
  formFieldKeys?: (keyof Values<T>)[];
  initializeForm?: (
    serverData: unknown,
    isEditMode: boolean
  ) => Partial<Values<T>>;
  setFormData: (updates: Partial<Values<T>>) => void;
}) {
  const hasInitializedRef = React.useRef(false);
  const initializeFormRef = React.useRef(initializeForm);
  const setFormDataRef = React.useRef(setFormData);
  const serverDataIdRef = React.useRef<string | null>(null);

  // Update refs when they change
  React.useEffect(() => {
    initializeFormRef.current = initializeForm;
  }, [initializeForm]);

  React.useEffect(() => {
    setFormDataRef.current = setFormData;
  }, [setFormData]);

  // Generate stable ID from serverData content (not object reference)
  // This ID should only change when the actual data content changes, not when object reference changes
  const serverDataId = React.useMemo(() => {
    if (!serverData) return null;
    // Try to find a stable identifier
    if (typeof serverData === "object" && serverData !== null) {
      // For edit mode (PersonaDetailOut), use persona_id
      if ("persona_id" in serverData && serverData.persona_id) {
        return `persona_id:${String(serverData.persona_id)}`;
      }
      // For create mode (PersonaNewOut), there's no ID
      // Use a stable hash of immutable fields that represent the data identity
      // These fields come from the server and shouldn't change between renders
      const keyFields: Record<string, unknown> = {};
      if ("preset_colors" in serverData) {
        keyFields["preset_colors"] = Array.isArray(serverData["preset_colors"])
          ? serverData["preset_colors"].length
          : serverData["preset_colors"];
      }
      if ("valid_icons" in serverData) {
        keyFields["valid_icons"] = Array.isArray(serverData["valid_icons"])
          ? serverData["valid_icons"].length
          : serverData["valid_icons"];
      }
      if ("suggested_icons" in serverData) {
        keyFields["suggested_icons"] = Array.isArray(
          serverData["suggested_icons"]
        )
          ? serverData["suggested_icons"].length
          : serverData["suggested_icons"];
      }
      if ("valid_department_ids" in serverData) {
        const ids = serverData["valid_department_ids"];
        keyFields["valid_department_ids"] = Array.isArray(ids)
          ? [...ids].sort().join(",") // ✅ copy first to avoid mutation
          : ids;
      }
      // Create a stable hash from sorted keys and values
      const sortedKeys = Object.keys(keyFields).sort();
      const hash = sortedKeys
        .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
        .join("|");
      return `new:${hash.length}:${hash.slice(0, 100)}`;
    }
    return String(serverData);
  }, [serverData]);

  React.useEffect(() => {
    setFormDataRef.current = setFormData;

    // Reset initialization flag only if serverData content actually changed (by ID, not reference)
    if (serverDataIdRef.current !== serverDataId) {
      hasInitializedRef.current = false;
      serverDataIdRef.current = serverDataId;
    }

    if (
      !serverData ||
      hasInitializedRef.current ||
      !initializeFormRef.current
    ) {
      return;
    }

    // Check if URL has any actual form field values (only check once on mount/serverData change)
    // Only check for meaningful form field values - empty strings or undefined should not prevent initialization
    const keysToCheck =
      formFieldKeys || (Object.keys(formData) as (keyof Values<T>)[]);
    const hasUrlFormData = keysToCheck.some((key) => {
      const value = formData[key];
      if (value === undefined || value === null) return false;
      if (typeof value === "string") return value.trim() !== "";
      if (typeof value === "boolean") return true;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    });

    if (hasUrlFormData) {
      // URL params exist with actual form field values - they are the source of truth, don't override
      hasInitializedRef.current = true;
      return;
    }

    // URL is clean - initialize from server data
    const updates = initializeFormRef.current(serverData, isEditMode);

    // Only set fields that have values (don't write nulls/empty strings to URL)
    const filteredUpdates: Partial<Values<T>> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === "string" && value.trim() !== "") {
          filteredUpdates[key as keyof Values<T>] =
            value as Values<T>[keyof Values<T>];
        } else if (typeof value !== "string") {
          filteredUpdates[key as keyof Values<T>] =
            value as Values<T>[keyof Values<T>];
        }
      }
    });

    // Only update if we have fields to set
    if (Object.keys(filteredUpdates).length > 0) {
      setFormDataRef.current(filteredUpdates);
    }

    hasInitializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverDataId, isEditMode, formFieldKeys]);
  // Note: formData, initializeForm, and setFormData are intentionally excluded from dependencies to prevent infinite loops
  // formData is checked once when serverData changes, initializeForm and setFormData are stored in refs
  // serverDataId is used instead of serverData to detect actual content changes, not object reference changes
}

function GenericFormComponent<T extends Record<string, Parser<unknown>>>({
  nuqsParsers,
  steps,
  getStepStatus,
  renderStep,
  formData: externalFormData,
  setFormData: externalSetFormData,
  serverData,
  initializeForm,
  formFieldKeys,
  onReset,
  resetSuccessMessage,
  contentSections,
  onSubmit,
  submitButton,
  isReadonly: _isReadonly = false,
  isEditMode: _isEditMode = false,
  className,
  onFormDataChange,
  registerSetFormData,
}: GenericFormProps<T>) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const router = useRouter();

  // Use nuqs for all state management (URL-backed)
  // If external state is provided, use it; otherwise manage internally
  const [internalFormData, internalSetFormData] = useQueryStates(nuqsParsers, {
    history: "replace", // Don't spam back button for every keystroke
    shallow: false, // Trigger server-side re-fetch when params change
  });

  const formData = externalFormData ?? internalFormData;
  const setFormData = externalSetFormData ?? internalSetFormData;

  // Keep ref of current formData for diff checking in handleSetFormData
  const formDataRef = React.useRef(formData);
  React.useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Bridge API: notify parent whenever URL-backed state changes
  const onFormDataChangeRef = React.useRef(onFormDataChange);
  React.useEffect(() => {
    onFormDataChangeRef.current = onFormDataChange;
  }, [onFormDataChange]);

  const registerSetFormDataRef = React.useRef(registerSetFormData);
  React.useEffect(() => {
    registerSetFormDataRef.current = registerSetFormData;
  }, [registerSetFormData]);

  // Compute stable key of URL fields parent cares about (not object identity)
  // Only include fields you actually want the parent to react to
  const draftIdValue = formData["draftId"] ?? null;
  const colorSearchValue = formData["colorSearch"] ?? null;
  const iconSearchValue = formData["iconSearch"] ?? null;
  const colorShowSelectedValue = formData["colorShowSelected"] ?? null;
  const iconShowSelectedValue = formData["iconShowSelected"] ?? null;

  const formDataKey = React.useMemo(() => {
    return JSON.stringify({
      draftId: draftIdValue,
      colorSearch: colorSearchValue,
      iconSearch: iconSearchValue,
      colorShowSelected: colorShowSelectedValue,
      iconShowSelected: iconShowSelectedValue,
    });
  }, [
    draftIdValue,
    colorSearchValue,
    iconSearchValue,
    colorShowSelectedValue,
    iconShowSelectedValue,
  ]);

  // Keep ref of latest formData for onFormDataChange effect (avoids stale reads)
  const formDataLatestRef = React.useRef(formData);
  React.useEffect(() => {
    formDataLatestRef.current = formData;
  }, [formData]);

  // Notify parent whenever URL-backed state changes (keyed on stable key, not object identity)
  React.useEffect(() => {
    onFormDataChangeRef.current?.(formDataLatestRef.current);
  }, [formDataKey]); // Only depend on formDataKey, not formData object identity

  // Give parent access to the setter (once, gated to prevent constant re-registration)
  const lastSetterRef = React.useRef<typeof setFormData | null>(null);
  React.useEffect(() => {
    if (lastSetterRef.current === setFormData) return;
    lastSetterRef.current = setFormData;
    registerSetFormDataRef.current?.(setFormData);
  }, [setFormData]);

  // Stabilize serverData prop reference to prevent unnecessary re-renders
  // Generate stable ID from serverData content (same logic as in useFormInitialization)
  const serverDataId = React.useMemo(() => {
    if (!serverData) return null;
    if (typeof serverData === "object" && serverData !== null) {
      if ("persona_id" in serverData && serverData.persona_id) {
        return `persona_id:${String(serverData.persona_id)}`;
      }
      const keyFields: Record<string, unknown> = {};
      if ("preset_colors" in serverData) {
        keyFields["preset_colors"] = Array.isArray(serverData["preset_colors"])
          ? serverData["preset_colors"].length
          : serverData["preset_colors"];
      }
      if ("valid_icons" in serverData) {
        keyFields["valid_icons"] = Array.isArray(serverData["valid_icons"])
          ? serverData["valid_icons"].length
          : serverData["valid_icons"];
      }
      if ("suggested_icons" in serverData) {
        keyFields["suggested_icons"] = Array.isArray(
          serverData["suggested_icons"]
        )
          ? serverData["suggested_icons"].length
          : serverData["suggested_icons"];
      }
      if ("valid_department_ids" in serverData) {
        const ids = serverData["valid_department_ids"];
        keyFields["valid_department_ids"] = Array.isArray(ids)
          ? [...ids].sort().join(",") // ✅ copy first to avoid mutation
          : ids;
      }
      const sortedKeys = Object.keys(keyFields).sort();
      const hash = sortedKeys
        .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
        .join("|");
      return `new:${hash.length}:${hash.slice(0, 100)}`;
    }
    return String(serverData);
  }, [serverData]);

  // Use ref to track stable serverData - only update when ID changes
  const stableServerDataRef = React.useRef<{
    data: typeof serverData;
    id: string | null;
  }>({ data: serverData, id: serverDataId });

  // Update ref when ID changes (in effect to avoid render-time mutations)
  React.useEffect(() => {
    if (stableServerDataRef.current.id !== serverDataId) {
      stableServerDataRef.current = { data: serverData, id: serverDataId };
    }
  }, [serverData, serverDataId]);

  // Return stable reference - only changes when ID changes (via ref update)
  const stableServerData = stableServerDataRef.current.data;

  // Form initialization from server data (use stable reference to prevent re-renders)
  useFormInitialization({
    serverData: stableServerData,
    isEditMode: _isEditMode,
    formData,
    ...(formFieldKeys ? { formFieldKeys } : {}),
    ...(initializeForm ? { initializeForm } : {}),
    setFormData,
  });

  // Calculate step statuses automatically
  const stepStatuses = React.useMemo(() => {
    const statuses: Record<string, StepStatus> = {};
    steps.forEach((step) => {
      statuses[step.id] = getStepStatus(step.id, formData);
    });
    return statuses;
  }, [steps, getStepStatus, formData]);

  // Helper to update form data - pass updates directly to nuqs setter
  // nuqs expects partial updates, not merged full state
  const handleSetFormData = React.useCallback(
    (updates: Partial<Values<T>>) => {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/c8b3b631-8d97-43e2-acb2-6df2c63b5121",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "GenericForm.tsx:425",
            message: "handleSetFormData called",
            data: { updates },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "ALL",
          }),
        }
      ).catch(() => {});
      // #endregion agent log

      const current = formDataRef.current;

      // Only forward changes that actually differ
      const filtered: Partial<Values<T>> = {};
      let changed = false;

      for (const [k, v] of Object.entries(updates) as Array<
        [keyof Values<T>, Values<T>[keyof Values<T>]]
      >) {
        if (current[k] !== v) {
          filtered[k] = v;
          changed = true;
        }
      }

      if (!changed) {
        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/c8b3b631-8d97-43e2-acb2-6df2c63b5121",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "GenericForm.tsx:425",
              message: "handleSetFormData no-op (no changes)",
              data: { updates, current },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "ALL",
            }),
          }
        ).catch(() => {});
        // #endregion agent log
        return;
      }

      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/c8b3b631-8d97-43e2-acb2-6df2c63b5121",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "GenericForm.tsx:425",
            message: "handleSetFormData forwarding changes",
            data: { filtered },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "ALL",
          }),
        }
      ).catch(() => {});
      // #endregion agent log

      setFormData(filtered);
    },
    [setFormData]
  );

  // Reset handler for steps
  const handleReset = React.useCallback(
    (stepId: string) => {
      const step = steps.find((s) => s.id === stepId);
      if (!step || !step.resetFields) return;

      const fieldsToReset = step.resetFields as (keyof Values<T>)[];
      const resetUpdates: Partial<Values<T>> = {};
      fieldsToReset.forEach((field) => {
        resetUpdates[field] = undefined as Values<T>[typeof field];
      });

      handleSetFormData(resetUpdates);

      const message = resetSuccessMessage
        ? resetSuccessMessage(stepId)
        : `${step.title} reset`;
      toast.success(message);

      if (onReset) {
        onReset(stepId, fieldsToReset);
      }
    },
    [steps, resetSuccessMessage, onReset, handleSetFormData]
  );

  // Submit handler
  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!onSubmit || isSubmitting) return;

      setIsSubmitting(true);
      try {
        await onSubmit(formData);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to submit form"
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit, formData, isSubmitting]
  );

  // Build ordered steps with content sections
  const orderedSteps = React.useMemo(() => {
    const result: Array<
      | { type: "step"; step: GenericFormStep<T>; index: number }
      | { type: "content"; content: NonNullable<typeof contentSections>[0] }
    > = [];

    steps.forEach((step, index) => {
      result.push({ type: "step", step, index });

      // Insert content sections after this step
      if (contentSections) {
        contentSections.forEach((content) => {
          if (content.insertAfter === step.id) {
            result.push({ type: "content", content });
          }
        });
      }
    });

    return result;
  }, [steps, contentSections]);

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-8", className)}>
      {orderedSteps.map((item, _idx) => {
        if (item.type === "content") {
          return (
            <React.Fragment key={item.content.id}>
              {item.content.render({
                formData,
                setFormData: handleSetFormData,
              })}
            </React.Fragment>
          );
        }

        const step = item.step;
        const stepNumber = item.index + 1;
        const stepStatus = stepStatuses[step.id] || "pending";

        // Build filter props if filters are configured
        const filterProps:
          | Array<{
              key: string;
              label: string;
              value: boolean;
              onChange: (value: boolean) => void;
            }>
          | undefined = step.filters
          ? step.filters.map((filter) => ({
              key: filter.key,
              label: filter.label,
              value:
                (formData[filter.key] as boolean | null | undefined) ?? false,
              onChange: (value: boolean) => {
                handleSetFormData({ [filter.key]: value || null } as Partial<
                  Values<T>
                >);
              },
            }))
          : undefined;

        return (
          <React.Fragment key={step.id}>
            {renderStep({
              stepId: step.id,
              stepTitle: step.title,
              stepDescription: step.description,
              stepNumber,
              stepStatus,
              isOptional: step.optional || false,
              formData,
              setFormData: handleSetFormData,
              ...(filterProps ? { filters: filterProps } : {}),
              ...(step.resetFields
                ? { onReset: () => handleReset(step.id) }
                : {}),
            })}
          </React.Fragment>
        );
      })}

      {/* Submit button */}
      {onSubmit && submitButton && (
        <div className="flex justify-end gap-3">
          {submitButton.backUrl && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (router) {
                  router.push(submitButton.backUrl!);
                }
              }}
              disabled={isSubmitting}
            >
              {submitButton.backLabel || "Back"}
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || submitButton.disabled || _isReadonly}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {_isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : submitButton.label ? (
              submitButton.label
            ) : _isEditMode ? (
              submitButton.updateLabel || "Update"
            ) : (
              submitButton.createLabel || "Create"
            )}
          </Button>
        </div>
      )}
    </form>
  );
}

// Memoize GenericForm to prevent re-renders when props haven't changed
// This is critical because GenericForm receives many props that might have new references
// even if their content is the same (e.g., renderStep, onSubmit, etc.)
export const GenericForm = React.memo(
  GenericFormComponent,
  (prevProps, nextProps) => {
    // Shallow comparison for primitive props
    if (
      prevProps.isReadonly !== nextProps.isReadonly ||
      prevProps.isEditMode !== nextProps.isEditMode ||
      prevProps.className !== nextProps.className
    ) {
      return false; // Props changed, re-render
    }

    // Compare formData by key values, not object reference (nuqs returns new objects frequently)
    const prevKey = JSON.stringify({
      draftId: prevProps.formData?.["draftId"] ?? null,
      colorSearch: prevProps.formData?.["colorSearch"] ?? null,
      iconSearch: prevProps.formData?.["iconSearch"] ?? null,
      colorShowSelected: prevProps.formData?.["colorShowSelected"] ?? null,
      iconShowSelected: prevProps.formData?.["iconShowSelected"] ?? null,
    });
    const nextKey = JSON.stringify({
      draftId: nextProps.formData?.["draftId"] ?? null,
      colorSearch: nextProps.formData?.["colorSearch"] ?? null,
      iconSearch: nextProps.formData?.["iconSearch"] ?? null,
      colorShowSelected: nextProps.formData?.["colorShowSelected"] ?? null,
      iconShowSelected: nextProps.formData?.["iconShowSelected"] ?? null,
    });
    if (prevKey !== nextKey) {
      return false; // FormData key values changed, re-render
    }

    // Compare steps array by reference (should be memoized in parent)
    if (prevProps.steps !== nextProps.steps) {
      return false; // Steps changed, re-render
    }

    // Compare serverData by stable ID (same logic as in useFormInitialization)
    const prevServerDataId = prevProps.serverData
      ? typeof prevProps.serverData === "object" &&
        prevProps.serverData !== null
        ? "persona_id" in prevProps.serverData &&
          prevProps.serverData.persona_id
          ? `persona_id:${String(prevProps.serverData.persona_id)}`
          : "new"
        : String(prevProps.serverData)
      : null;
    const nextServerDataId = nextProps.serverData
      ? typeof nextProps.serverData === "object" &&
        nextProps.serverData !== null
        ? "persona_id" in nextProps.serverData &&
          nextProps.serverData.persona_id
          ? `persona_id:${String(nextProps.serverData.persona_id)}`
          : "new"
        : String(nextProps.serverData)
      : null;

    if (prevServerDataId !== nextServerDataId) {
      return false; // ServerData content changed, re-render
    }

    // For function props, compare by reference (they should be memoized in parent)
    // If they're new references but functionally equivalent, we still need to re-render
    // because React can't know they're equivalent without calling them
    if (
      prevProps.getStepStatus !== nextProps.getStepStatus ||
      prevProps.renderStep !== nextProps.renderStep ||
      prevProps.onSubmit !== nextProps.onSubmit ||
      prevProps.setFormData !== nextProps.setFormData
    ) {
      return false; // Function props changed, re-render
    }

    // All props are equivalent, skip re-render
    return true;
  }
) as typeof GenericFormComponent;
