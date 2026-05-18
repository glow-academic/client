/**
 * Shared helpers for building flat resource payloads.
 *
 * All artifacts send flat IDs (name_id, department_ids, etc.) for both
 * draft patch and save requests. Server's from_request() wraps into
 * internal ResourceAction composites.
 */

export type ResourceConfig = {
  /** Section key in entity data (e.g., "names", "departments") */
  key: string;
  /** Key in form state (e.g., "name_id", "department_ids") */
  formKey: string;
  /** Key in flush results, or null if not flushable */
  flushKey: string | null;
  /** "single" for single-select, "multi" for multi-select */
  type: "single" | "multi";
};

/**
 * Build flat draft payload with only changed fields.
 * Returns an object with formKey→value for fields that differ from reference state.
 */
export function buildDraftPayload(
  resources: readonly ResourceConfig[],
  opts: {
    formState: Record<string, unknown>;
    referenceState: Record<string, unknown> | null;
    flushResults: Record<string, unknown>;
  },
): Record<string, unknown> {
  const { formState, referenceState, flushResults } = opts;
  const result: Record<string, unknown> = {};

  for (const r of resources) {
    if (r.type === "single") {
      const effectiveId =
        r.flushKey && flushResults[r.flushKey] !== undefined
          ? (flushResults[r.flushKey] as string | null)
          : (formState[r.formKey] as string | null);
      const refId = referenceState
        ? (referenceState[r.formKey] as string | null)
        : null;
      const changed = referenceState ? effectiveId !== refId : !!effectiveId;

      if (changed) {
        result[r.formKey] = effectiveId ?? null;
      }
    } else {
      const ids = formState[r.formKey] as string[];
      const effectiveIds =
        r.flushKey && flushResults[r.flushKey] !== undefined
          ? (flushResults[r.flushKey] as string[])
          : ids;
      const refIds = referenceState
        ? (referenceState[r.formKey] as string[])
        : [];
      const changed = JSON.stringify(effectiveIds) !== JSON.stringify(refIds);

      if (changed) {
        result[r.formKey] =
          effectiveIds && effectiveIds.length > 0 ? effectiveIds : null;
      }
    }
  }

  return result;
}

/**
 * Merge flush results over form state for resources that have a flushKey.
 * Returns a new object with flushed values taking precedence.
 */
export function computeEffectiveFormState(
  resources: readonly ResourceConfig[],
  formState: Record<string, unknown>,
  flushResults: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...formState };
  for (const r of resources) {
    if (r.flushKey && flushResults[r.flushKey] !== undefined) {
      result[r.formKey] = flushResults[r.flushKey];
    }
  }
  return result;
}

/**
 * Check if any resource in form state has a non-empty value.
 */
export function checkHasResourceIds(
  resources: readonly ResourceConfig[],
  formState: Record<string, unknown>,
): boolean {
  return resources.some((r) => {
    if (r.type === "single") {
      return !!formState[r.formKey];
    } else {
      const arr = formState[r.formKey] as string[] | undefined;
      return (arr?.length ?? 0) > 0;
    }
  });
}
