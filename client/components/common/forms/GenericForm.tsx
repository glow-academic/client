/**
 * GenericForm.tsx
 * Generic form component with automatic step status calculation and nuqs integration
 * Similar to GenericPicker - works with any form structure via function-based extraction
 */

"use client";

import { cn } from "@/lib/utils";
import type { Parser } from "nuqs";
import { useQueryStates, type Values } from "nuqs";
import * as React from "react";

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
  }) => React.ReactNode;

  // Optional: external formData/setFormData (if state is managed externally)
  formData?: Values<T>;
  setFormData?: (
    updates: Partial<Values<T>> | ((prev: Values<T>) => Partial<Values<T>>)
  ) => void;

  // Optional props
  isReadonly?: boolean;
  isEditMode?: boolean;
  className?: string;
}

export function GenericForm<T extends Record<string, Parser<unknown>>>({
  nuqsParsers,
  steps,
  getStepStatus,
  renderStep,
  formData: externalFormData,
  setFormData: externalSetFormData,
  isReadonly: _isReadonly = false,
  isEditMode: _isEditMode = false,
  className,
}: GenericFormProps<T>) {
  // Use nuqs for all state management (URL-backed)
  // If external state is provided, use it; otherwise manage internally
  const [internalFormData, internalSetFormData] = useQueryStates(nuqsParsers, {
    history: "replace", // Don't spam back button for every keystroke
    shallow: false, // Trigger server-side re-fetch when params change
  });

  const formData = externalFormData ?? internalFormData;
  const setFormData = externalSetFormData ?? internalSetFormData;

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

  return (
    <div className={cn("space-y-8", className)}>
      {steps.map((step, index) => {
        const stepNumber = index + 1;
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
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
}
