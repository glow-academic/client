/**
 * Shared helpers for building resource action payloads with tool call tracking.
 *
 * Each resource in a save/patch payload carries:
 * - resource_id / resource_ids — the actual ID(s)
 * - group_id — from the server's entity data section
 * - create_tool_id — set when the resource was freshly created (flushed)
 * - link_tool_id — set when the resource changed from its reference state
 */

export type ResourceSection = {
  group_id?: string | null;
  create_tool_id?: string | null;
  link_tool_id?: string | null;
};

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

export function buildSingleAction(opts: {
  resourceId: string | null | undefined;
  wasCreated: boolean;
  changed: boolean;
  section: ResourceSection | undefined;
}) {
  return {
    resource_id: opts.resourceId ?? null,
    group_id: opts.section?.group_id ?? null,
    create_tool_id: opts.wasCreated
      ? (opts.section?.create_tool_id ?? null)
      : null,
    link_tool_id: opts.changed ? (opts.section?.link_tool_id ?? null) : null,
  };
}

export function buildMultiAction(opts: {
  resourceIds: string[];
  wasCreated: boolean;
  changed: boolean;
  section: ResourceSection | undefined;
}) {
  return {
    resource_ids: opts.resourceIds.length > 0 ? opts.resourceIds : null,
    group_id: opts.section?.group_id ?? null,
    create_tool_id: opts.wasCreated
      ? (opts.section?.create_tool_id ?? null)
      : null,
    link_tool_id: opts.changed ? (opts.section?.link_tool_id ?? null) : null,
  };
}

/**
 * Build resource action objects for all configured resources.
 * Used by both patch (autosave) and save (manual submit) paths.
 *
 * For each resource, computes:
 * - effectiveValue: flushResults[flushKey] ?? formState[formKey]
 * - wasCreated: whether flush produced a new ID
 * - changed: whether effectiveValue differs from referenceState[formKey]
 */
export function buildResourceActions(
  resources: readonly ResourceConfig[],
  opts: {
    formState: Record<string, unknown>;
    referenceState: Record<string, unknown> | null;
    flushResults: Record<string, unknown>;
    entityData: Record<string, unknown> | null | undefined;
  },
): Record<string, unknown> {
  const { formState, referenceState, flushResults, entityData } = opts;
  const result: Record<string, unknown> = {};

  for (const r of resources) {
    const section = entityData?.[r.key] as ResourceSection | undefined;

    if (r.type === "single") {
      const effectiveId =
        r.flushKey && flushResults[r.flushKey] !== undefined
          ? (flushResults[r.flushKey] as string | null)
          : (formState[r.formKey] as string | null);
      const wasCreated =
        r.flushKey !== null &&
        flushResults[r.flushKey!] !== undefined &&
        flushResults[r.flushKey!] !== null;
      const refId = referenceState
        ? (referenceState[r.formKey] as string | null)
        : null;
      const changed = referenceState ? effectiveId !== refId : !!effectiveId;

      result[r.key] = buildSingleAction({
        resourceId: effectiveId,
        wasCreated,
        changed,
        section,
      });
    } else {
      const ids = formState[r.formKey] as string[];
      const effectiveIds =
        r.flushKey && flushResults[r.flushKey] !== undefined
          ? (flushResults[r.flushKey] as string[])
          : ids;
      const wasCreated =
        r.flushKey !== null && flushResults[r.flushKey!] !== undefined;
      const refIds = referenceState
        ? (referenceState[r.formKey] as string[])
        : [];
      const changed = JSON.stringify(effectiveIds) !== JSON.stringify(refIds);

      result[r.key] = buildMultiAction({
        resourceIds: effectiveIds ?? [],
        wasCreated,
        changed,
        section,
      });
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
