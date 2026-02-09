import { type Dispatch, type SetStateAction, useCallback } from "react";

interface ParameterField {
  id?: string | null;
  field_id?: string | null;
  parameter_id?: string | null;
  /** Persona uses singular conditional_parameter_id */
  conditional_parameter_id?: string | null;
  /** Scenario uses plural conditional_parameter_ids */
  conditional_parameter_ids?: (string | null)[] | null;
}

interface FormStateWithParameters {
  parameter_ids: string[];
  parameter_field_ids: string[];
}

/**
 * Handles conditional parameter auto-select/deselect when a field triggers it.
 * Supports transitive chains: when a field's conditional parameter is deselected,
 * we also deselect any conditional parameters that were triggered by that parameter's fields.
 *
 * Normalizes Persona's singular `conditional_parameter_id` and Scenario's plural
 * `conditional_parameter_ids` internally.
 */
export function useConditionalParameterToggle<
  FS extends FormStateWithParameters,
>(config: {
  setFormState: Dispatch<SetStateAction<FS>>;
  getParameterFields: () => ParameterField[];
}) {
  const { setFormState, getParameterFields } = config;

  const handleConditionalParameterToggle = useCallback(
    (conditionalParameterId: string, selected: boolean) => {
      setFormState((prev) => {
        if (selected) {
          if (!prev.parameter_ids.includes(conditionalParameterId)) {
            return {
              ...prev,
              parameter_ids: [...prev.parameter_ids, conditionalParameterId],
            };
          }
        } else {
          const toRemove = new Set<string>([conditionalParameterId]);
          const allFields = getParameterFields();

          // Recursively find conditional params that should also be removed
          let changed = true;
          while (changed) {
            changed = false;
            for (const field of allFields) {
              if (field.parameter_id && toRemove.has(field.parameter_id)) {
                // Normalize singular and plural conditional_parameter_id(s)
                const condIds: string[] = [];
                if (field.conditional_parameter_id) {
                  condIds.push(field.conditional_parameter_id);
                }
                if (field.conditional_parameter_ids) {
                  for (const cid of field.conditional_parameter_ids) {
                    if (cid) condIds.push(cid);
                  }
                }
                for (const condId of condIds) {
                  if (!toRemove.has(condId)) {
                    toRemove.add(condId);
                    changed = true;
                  }
                }
              }
            }
          }

          // Also find fields that should be deselected (fields of removed parameters)
          const fieldsToRemove = new Set<string>();
          for (const field of allFields) {
            if (field.parameter_id && toRemove.has(field.parameter_id)) {
              // Use field_id if available (Scenario), otherwise id (Persona)
              const fieldId = field.field_id ?? field.id;
              if (fieldId) {
                fieldsToRemove.add(fieldId);
              }
            }
          }

          return {
            ...prev,
            parameter_ids: prev.parameter_ids.filter(
              (id) => !toRemove.has(id)
            ),
            parameter_field_ids: prev.parameter_field_ids.filter(
              (id) => !fieldsToRemove.has(id)
            ),
          };
        }
        return prev;
      });
    },
    [setFormState, getParameterFields]
  );

  return { handleConditionalParameterToggle };
}
