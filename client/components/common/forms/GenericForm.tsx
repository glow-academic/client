/**
 * GenericForm.tsx
 * Generic form component with automatic step status calculation and nuqs integration
 * Similar to GenericPicker - works with any form structure via function-based extraction
 */

"use client";

import { cn } from "@/lib/utils";
import type { Parser } from "nuqs";
import { useQueryStates, type Values } from "nuqs";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export type StepStatus = "pending" | "active" | "completed";

export interface GenericFormStep {
  id: string;
  title: string;
  description: string;
  optional?: boolean;
  filters?: Array<{
    key: string;
    label: string;
  }>;
  // Reset fields for this step
  resetFields?: (keyof Values<any>)[];
}

export interface GenericFormProps<T extends Record<string, Parser<unknown>>> {
  // nuqs parsers config (like scenarioSearchParamsClient)
  nuqsParsers: T;

  // Steps configuration
  steps: GenericFormStep[];

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
  serverData?: any;
  initializeForm?: (serverData: any, isEditMode: boolean) => Partial<Values<T>>;
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
  serverData: any;
  isEditMode: boolean;
  formData: Values<T>;
  formFieldKeys?: (keyof Values<T>)[];
  initializeForm?: (serverData: any, isEditMode: boolean) => Partial<Values<T>>;
  setFormData: (updates: Partial<Values<T>>) => void;
}) {
  const hasInitializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!serverData || hasInitializedRef.current || !initializeForm) {
      return;
    }

    // Check if URL has any actual form field values
    // Only check for meaningful form field values - empty strings or undefined should not prevent initialization
    const keysToCheck = formFieldKeys || (Object.keys(formData) as (keyof Values<T>)[]);
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
    const updates = initializeForm(serverData, isEditMode);
    
    // Only set fields that have values (don't write nulls/empty strings to URL)
    const filteredUpdates: Partial<Values<T>> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === "string" && value.trim() !== "") {
          filteredUpdates[key as keyof Values<T>] = value as Values<T>[keyof Values<T>];
        } else if (typeof value !== "string") {
          filteredUpdates[key as keyof Values<T>] = value as Values<T>[keyof Values<T>];
        }
      }
    });

    // Only update if we have fields to set
    if (Object.keys(filteredUpdates).length > 0) {
      setFormData(filteredUpdates);
    }

    hasInitializedRef.current = true;
  }, [serverData, isEditMode, formData, formFieldKeys, initializeForm, setFormData]);
}

export function GenericForm<T extends Record<string, Parser<unknown>>>({
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

  // Form initialization from server data
  useFormInitialization({
    serverData,
    isEditMode: _isEditMode,
    formData,
    formFieldKeys,
    initializeForm,
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

  // Helper to update form data (merges with existing data)
  const handleSetFormData = React.useCallback(
    (updates: Partial<Values<T>>) => {
      setFormData((prev) => ({
        ...prev,
        ...updates,
      }));
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
        resetUpdates[field] = null as any;
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
          error instanceof Error
            ? error.message
            : "Failed to submit form"
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit, formData, isSubmitting]
  );

  // Build ordered steps with content sections
  const orderedSteps = React.useMemo(() => {
    const result: Array<{ type: "step"; step: GenericFormStep; index: number } | { type: "content"; content: NonNullable<typeof contentSections>[0] }> = [];
    
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
      {orderedSteps.map((item, idx) => {
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
              onReset: step.resetFields ? () => handleReset(step.id) : undefined,
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
            ) : submitButton.label
            ? submitButton.label
            : _isEditMode
            ? submitButton.updateLabel || "Update"
            : submitButton.createLabel || "Create"}
          </Button>
        </div>
      )}
    </form>
  );
}
