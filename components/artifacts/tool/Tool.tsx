"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { ArgPositions } from "@/components/resources/ArgPositions";
import { Args } from "@/components/resources/Args";
import { ArgsOutputs } from "@/components/resources/ArgsOutputs";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Instructions } from "@/components/resources/Instructions";
import { Names } from "@/components/resources/Names";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDrafts } from "@/contexts/draft-context";
import { useToolAi } from "@/hooks/use-tool-ai";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type CreateToolIn = InputOf<"/tool/create", "post">;
type CreateToolOut = OutputOf<"/tool/create", "post">;
type UpdateToolIn = InputOf<"/tool/update", "post">;
type UpdateToolOut = OutputOf<"/tool/update", "post">;
type PatchToolDraftIn = InputOf<"/tool/draft", "post">;
type PatchToolDraftOut = OutputOf<"/tool/draft", "post">;
type PreviewToolIn = InputOf<"/tool/preview", "post">;
type PreviewToolOut = OutputOf<"/tool/preview", "post">;
type ToolData = OutputOf<"/tool/get", "post">;

// Per-row drafts for the unified Arguments step card. Saved rows (id !== null)
// are surfaced as immutable chips; new rows (id === null) render the full
// editor. Outputs nest under their owning arg row.
export type ToolArgOutputRowDraft = {
  id: string | null;
  name: string;
  template: string;
};

export type ToolArgRowDraft = {
  id: string | null;
  name: string;
  description: string;
  field_type: string;
  required: boolean;
  default_value: string;
  outputs: ToolArgOutputRowDraft[];
};

type ToolResourceType =
  | "names"
  | "descriptions"
  | "flags"
  | "departments"
  | "args"
  | "arg_positions"
  | "args_outputs"
  | "instructions"
  | "permissions";

type ToolFormState = {
  name_id: string | null;
  name: string | null;
  description_id: string | null;
  description: string | null;
  department_ids: string[];
  flag_ids: string[];
  args_ids: string[];
  arg_position_ids: string[];
  args_outputs_ids: string[];
  // Unified per-arg drafts — when non-null, takes precedence over the three
  // legacy id arrays on save (server resolver mirrors this precedence).
  args_drafts: ToolArgRowDraft[] | null;
  permission_ids: string[];
  instruction_id: string | null;
  pending_ids: string[];
};

export interface ToolProps {
  toolId?: string;
  toolData?: ToolData;
  createToolAction?: (input: CreateToolIn) => Promise<CreateToolOut>;
  updateToolAction?: (input: UpdateToolIn) => Promise<UpdateToolOut>;
  patchToolDraftAction?: (input: PatchToolDraftIn) => Promise<PatchToolDraftOut>;
  /**
   * Renders the configured args+outputs against the supplied mock values via
   * the audited `/tool/preview` endpoint. Powers the Live Preview panel
   * inside the Arguments step.
   */
  previewToolAction?: (input: PreviewToolIn) => Promise<PreviewToolOut>;
}

/**
 * Live preview panel for the Arguments step card.
 *
 * Collects mock values for each declared arg, debounces, and renders the
 * outputs server-side via `/tool/preview` (real Jinja env). Surfaces:
 *   - per-output compiled text or syntax/render errors
 *   - per-arg "used" flag + filter list discovered in the AST
 *   - undeclared variables referenced by templates but not declared as args
 */
function ArgumentsPreviewPanel({
  args,
  runPreview,
  disabled,
}: {
  args: ToolArgRowDraft[];
  runPreview: (
    args: ToolArgRowDraft[],
    mock: Record<string, string>,
  ) => Promise<PreviewToolOut | null>;
  disabled: boolean;
}) {
  const [mock, setMock] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PreviewToolOut | null>(null);
  const [loading, setLoading] = useState(false);

  // Debounced preview — re-renders ~300ms after the user stops typing.
  useEffect(() => {
    const handle = setTimeout(async () => {
      const hasOutputs = args.some((a) => a.outputs.length > 0);
      if (!hasOutputs) {
        setResult(null);
        return;
      }
      setLoading(true);
      try {
        const r = await runPreview(args, mock);
        setResult(r);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [args, mock, runPreview]);

  const declaredArgNames = useMemo(
    () => args.map((a) => a.name).filter((n) => n.trim()),
    [args],
  );
  const hasOutputs = args.some((a) => a.outputs.length > 0);

  if (!hasOutputs) return null;

  return (
    <div className="rounded-md border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Live Preview
        </Label>
        {loading && (
          <span className="text-[10px] text-muted-foreground">rendering…</span>
        )}
      </div>

      {/* Mock value inputs — one per declared arg name. */}
      {declaredArgNames.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {args
            .filter((a) => a.name.trim())
            .map((a) => {
              const hint = result?.type_hints?.find((h) => h.name === a.name);
              return (
                <div key={a.name} className="space-y-1">
                  <Label className="text-xs">{a.name}</Label>
                  <Input
                    value={mock[a.name] ?? ""}
                    onChange={(e) =>
                      setMock((prev) => ({ ...prev, [a.name]: e.target.value }))
                    }
                    placeholder={a.default_value || `Mock ${a.field_type}`}
                    className="h-8"
                    disabled={disabled}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {a.field_type}
                    {hint?.used === false && " · unused in templates"}
                    {hint?.filters && hint.filters.length > 0 &&
                      ` · filters: ${hint.filters.join(", ")}`}
                  </p>
                </div>
              );
            })}
        </div>
      )}

      {/* Compiled outputs. */}
      {result?.outputs && result.outputs.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Compiled
          </Label>
          {result.outputs.map((o, i) => (
            <div
              key={`${o.name}-${i}`}
              className={cn(
                "rounded border px-2 py-1.5 text-xs",
                o.error
                  ? "border-destructive/50 bg-destructive/5"
                  : "bg-background",
              )}
            >
              <div className="font-medium">{o.name || "(unnamed)"}</div>
              {o.error ? (
                <div className="font-mono text-destructive">{o.error}</div>
              ) : (
                <div className="font-mono whitespace-pre-wrap">
                  {o.compiled || "(empty)"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Undeclared variable warning — templates reference these but no arg
          declares them. Hint to fix the template or add the missing arg. */}
      {result?.undeclared && result.undeclared.length > 0 && (
        <p className="text-xs text-amber-600">
          Undeclared variables referenced by templates:{" "}
          <code>{result.undeclared.join(", ")}</code>
        </p>
      )}
    </div>
  );
}

function ToolComponent({
  toolId,
  toolData,
  createToolAction,
  updateToolAction,
  patchToolDraftAction,
  previewToolAction,
}: ToolProps) {
  const router = useRouter();
  const isEditMode = !!toolId;
  const { selectedDraftId, setSelectedDraftId, isAutosaveEnabled } = useDrafts();
  const { flushAllResources } =
    useFlushRegistry<Record<string, unknown>>([]);
  const { isGenerating, generate } = useToolAi({});

  const toolDataRef = useRef(toolData);
  useEffect(() => {
    toolDataRef.current = toolData;
  }, [toolData]);

  const toolSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      argsSearch: parseAsString,
      argPositionsSearch: parseAsString,
      argsOutputsSearch: parseAsString,
      permissionsSearch: parseAsString,
      argsShowSelected: parseAsBoolean,
      argPositionsShowSelected: parseAsBoolean,
      argsOutputsShowSelected: parseAsBoolean,
      permissionsShowSelected: parseAsBoolean,
    }),
    []
  );

  const s = toolData;
  const selectedName = s?.names?.find((item) => item.selected) ?? null;
  const selectedDescription = s?.descriptions?.find((item) => item.selected) ?? null;

  const getInitialFormState = useCallback((): ToolFormState => {
    // Departments may be exposed under the (planned) `departments` field on
    // the GET response; until the API surfaces them, fall back to an empty
    // catalog. The picker below renders selected ids regardless.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const departmentResources = ((s as any)?.departments ?? []) as Array<{
      department_id?: string | null;
      selected?: boolean | null;
    }>;
    return {
      name_id: selectedName?.id ?? null,
      name: null,
      description_id: selectedDescription?.id ?? null,
      description: null,
      department_ids: departmentResources
        .filter((d) => d.selected && d.department_id)
        .map((d) => d.department_id!)
        .filter((id): id is string => !!id),
      flag_ids: (s?.flags?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
      args_ids: (s?.args?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
      arg_position_ids: (s?.arg_positions?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
      args_outputs_ids: (s?.args_outputs?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
      permission_ids: (s?.permissions?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
      // Hydrate saved args as immutable chip rows ordered by their position
      // value, with each row's outputs nested. The user adds/edits rows via
      // the Arguments step; saved rows can only be replaced (cloned to a
      // fresh draft + the saved id removed from args_ids).
      args_drafts: (() => {
        const selectedArgs = (s?.args ?? []).filter((a) => a.selected && a.id);
        if (selectedArgs.length === 0) return null;
        const positionByArgId = new Map<string, number>();
        (s?.arg_positions ?? []).forEach((p) => {
          if (p.args_id && p.value != null) {
            positionByArgId.set(p.args_id, p.value);
          }
        });
        return selectedArgs
          .map((a) => ({
            id: a.id as string,
            name: a.name ?? "",
            description: a.description ?? "",
            field_type: a.field_type ?? "string",
            required: a.required ?? false,
            default_value: "",
            outputs: (s?.args_outputs ?? [])
              .filter((o) => o.selected && o.args_id === a.id && o.id)
              .map((o) => ({
                id: o.id as string,
                name: o.name ?? "",
                template: o.template ?? "",
              })),
          }))
          .sort((x, y) => {
            const xv = positionByArgId.get(x.id ?? "") ?? Number.MAX_SAFE_INTEGER;
            const yv = positionByArgId.get(y.id ?? "") ?? Number.MAX_SAFE_INTEGER;
            return xv - yv;
          });
      })(),
      instruction_id:
        s?.instructions?.find((item) => item.selected)?.id ?? null,
      pending_ids: (s?.pending_ids ?? []) as string[],
    };
  }, [s, selectedDescription, selectedName]);

  const [formState, setFormState] = useState<ToolFormState>(getInitialFormState);
  const formStateRef = useRef(formState);
  useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  useEffect(() => {
    setFormState(getInitialFormState());
  }, [getInitialFormState]);

  const argsItems = useMemo(
    () =>
      (s?.args ?? [])
        .filter((item) => item.id && item.name)
        .map((item) => ({
          id: item.id!,
          name: item.name!,
          description: item.description ?? "",
          field_type: item.field_type ?? "",
          required: item.required ?? false,
          generated: item.generated ?? false,
          suggested: item.suggested ?? false,
          pending: item.pending ?? false,
        })),
    [s?.args]
  );

  const argPositionItems = useMemo(
    () =>
      (s?.arg_positions ?? [])
        .filter((item) => item.id && item.args_id && item.value !== null && item.value !== undefined)
        .map((item) => ({
          id: item.id!,
          args_id: item.args_id!,
          value: item.value!,
          generated: item.generated ?? false,
          suggested: item.suggested ?? false,
          pending: item.pending ?? false,
        }))
        .sort((a, b) => a.value - b.value),
    [s?.arg_positions]
  );

  const argPositionByArgId = useMemo(() => {
    const mapping = new Map<
      string,
      { id: string; value: number; suggested: boolean; pending: boolean }
    >();
    argPositionItems.forEach((item) => {
      mapping.set(item.args_id, {
        id: item.id,
        value: item.value,
        suggested: item.suggested,
        pending: item.pending,
      });
    });
    return mapping;
  }, [argPositionItems]);

  const argsOutputsItems = useMemo(
    () =>
      (s?.args_outputs ?? [])
        .filter((item) => item.id && item.args_id && item.name)
        .map((item) => ({
          id: item.id!,
          args_id: item.args_id!,
          name: item.name!,
          template: item.template ?? "",
          generated: item.generated ?? false,
          suggested: item.suggested ?? false,
          pending: item.pending ?? false,
        })),
    [s?.args_outputs]
  );

  const permissionsItems = useMemo(
    () =>
      (s?.permissions ?? [])
        .filter((item) => item.id && item.name)
        .map((item) => ({
          id: item.id!,
          name: item.name!,
          description: item.description ?? "",
          artifact: item.artifact ?? "",
          operation: item.operation ?? "",
          generated: item.generated ?? false,
          suggested: item.suggested ?? false,
          pending: item.pending ?? false,
        })),
    [s?.permissions]
  );

  const argsNameById = useMemo(() => {
    const mapping = new Map<string, string>();
    argsItems.forEach((item) => {
      mapping.set(item.id, item.name);
    });
    return mapping;
  }, [argsItems]);

  const argsOutputsById = useMemo(() => {
    const mapping = new Map<string, { id: string; args_id: string }>();
    argsOutputsItems.forEach((item) => {
      mapping.set(item.id, item);
    });
    return mapping;
  }, [argsOutputsItems]);

  useEffect(() => {
    setFormState((prev) => {
      if (prev.args_outputs_ids.length === 0) {
        return prev;
      }
      const allowedArgs = new Set(prev.args_ids);
      const nextArgsOutputs = prev.args_outputs_ids.filter((outputId) => {
        const output = argsOutputsById.get(outputId);
        if (!output) return false;
        if (allowedArgs.size === 0) return true;
        return allowedArgs.has(output.args_id);
      });
      if (JSON.stringify(nextArgsOutputs) === JSON.stringify(prev.args_outputs_ids)) {
        return prev;
      }
      return { ...prev, args_outputs_ids: nextArgsOutputs };
    });
  }, [argsOutputsById]);

  useEffect(() => {
    setFormState((prev) => {
      const selectedArgs = new Set(prev.args_ids);
      const nextArgPositionIds = prev.args_ids
        .map((argId) => argPositionByArgId.get(argId))
        .filter((item): item is NonNullable<typeof item> => !!item)
        .sort((a, b) => a.value - b.value)
        .map((item) => item.id)
        .filter((positionId) => {
          const relatedArg = [...argPositionByArgId.entries()].find(
            ([, value]) => value.id === positionId
          )?.[0];
          return relatedArg ? selectedArgs.has(relatedArg) : false;
        });
      if (JSON.stringify(nextArgPositionIds) === JSON.stringify(prev.arg_position_ids)) {
        return prev;
      }
      return { ...prev, arg_position_ids: nextArgPositionIds };
    });
  }, [argPositionByArgId]);

  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = useRef<null | ((updates: Record<string, unknown>) => void)>(null);
  const formDataRef = useRef<Record<string, unknown>>({});

  const onFormDataChange = useCallback((fd: Record<string, unknown>) => {
    formDataRef.current = fd;
    const nextDraftId = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => (prev === nextDraftId ? prev : nextDraftId));
  }, []);

  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

  const patchToolDraftActionRef = useRef(patchToolDraftAction);
  useEffect(() => {
    patchToolDraftActionRef.current = patchToolDraftAction;
  }, [patchToolDraftAction]);

  const serverSyncPendingRef = useRef(false);
  const draftPatchKey = useMemo(() => {
    if (serverSyncPendingRef.current) return undefined;
    return JSON.stringify({
      draftId: draftId || null,
      name: formState.name || null,
      description: formState.description || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      department_ids: formState.department_ids,
      flag_ids: formState.flag_ids,
      args_ids: formState.args_ids,
      arg_position_ids: formState.arg_position_ids,
      args_outputs_ids: formState.args_outputs_ids,
      permission_ids: formState.permission_ids,
      pending_ids: formState.pending_ids,
    });
  }, [draftId, formState]);

  const lastPatchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!draftPatchKey || !patchToolDraftActionRef.current) {
      return;
    }

    const hasContent =
      !!formState.name_id ||
      !!formState.name ||
      !!formState.description_id ||
      !!formState.description ||
      formState.department_ids.length > 0 ||
      formState.flag_ids.length > 0 ||
      formState.args_ids.length > 0 ||
      formState.arg_position_ids.length > 0 ||
      formState.args_outputs_ids.length > 0 ||
      formState.permission_ids.length > 0 ||
      !!formState.instruction_id ||
      formState.pending_ids.length > 0;

    if (!hasContent || lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const current = formStateRef.current;
        const payload: Record<string, unknown> = {
          draft_id: draftId || null,
          input_draft_id: draftId || null,
          department_ids:
            current.department_ids.length > 0 ? current.department_ids : null,
          flag_ids: current.flag_ids.length > 0 ? current.flag_ids : null,
          arg_ids: current.args_ids,
          arg_position_ids: current.arg_position_ids,
          args_output_ids: current.args_outputs_ids,
          args_outputs_ids: current.args_outputs_ids,
          permission_ids: current.permission_ids,
          instruction_id: current.instruction_id,
          pending_ids: current.pending_ids,
        };

        if (current.name && !current.name_id) {
          payload["name"] = current.name;
        } else {
          payload["name_id"] = current.name_id;
        }

        if (current.description && !current.description_id) {
          payload["description"] = current.description;
        } else {
          payload["description_id"] = current.description_id;
        }

        const result = await patchToolDraftActionRef.current?.({
          body: payload,
        } as PatchToolDraftIn);

        if (!result) {
          return;
        }

        lastPatchedKeyRef.current = draftPatchKey;

        if (result.draft_id && result.draft_id !== draftId) {
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        const fs = (result as PatchToolDraftOut).form_state;
        if (fs) {
          serverSyncPendingRef.current = true;
          setFormState((prev) => ({
            ...prev,
            // Fall back to prev for ids/arrays so a server that omits a field
            // doesn't wipe user's existing selection.
            name_id: fs.name_id ?? prev.name_id,
            // Clear value fields only once the server has resolved them to
            // IDs — keeping the value would cause infinite re-saves (value
            // takes precedence → new resource → new id → repeat).
            name: fs.name_id ? null : prev.name,
            description_id: fs.description_id ?? prev.description_id,
            description: fs.description_id ? null : prev.description,
            department_ids: fs.department_ids ?? prev.department_ids,
            flag_ids: fs.flag_ids ?? prev.flag_ids,
            args_ids: fs.arg_ids ?? prev.args_ids,
            arg_position_ids: fs.arg_position_ids ?? prev.arg_position_ids,
            args_outputs_ids: fs.args_outputs_ids ?? fs.args_output_ids ?? prev.args_outputs_ids,
            permission_ids: fs.permission_ids ?? prev.permission_ids,
            instruction_id:
              (fs as { instruction_id?: string | null }).instruction_id ??
              ((fs as { instruction_ids?: string[] | null }).instruction_ids?.[0] ??
                prev.instruction_id),
            pending_ids: fs.pending_ids ?? prev.pending_ids,
          }));
          requestAnimationFrame(() => {
            serverSyncPendingRef.current = false;
          });
        }
      } catch {
        // API error handling is already centralized server-side.
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [draftPatchKey, draftId, formState]);

  // Per-type boolean view of flag_ids, built from the catalog. Rendered by Flags.
  const flagValues = useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const byId = new Map(
      (s?.flags ?? [])
        .filter((f) => f.id)
        .map((f) => [f.id as string, f])
    );
    for (const id of formState.flag_ids) {
      const row = byId.get(id);
      if (!row) continue;
      const type = row.type ?? row.name;
      if (type && row.value != null) map[type] = row.value;
    }
    return map;
  }, [formState.flag_ids, s?.flags]);

  type ToolFlagRow = NonNullable<NonNullable<typeof s>["flags"]>[number];
  const flagRowsByType = useMemo(() => {
    const map = new Map<string, ToolFlagRow[]>();
    for (const f of s?.flags ?? []) {
      const t = f.type ?? f.name;
      if (!t) continue;
      const list = map.get(t) ?? [];
      list.push(f);
      map.set(t, list);
    }
    return map;
  }, [s?.flags]);

  const handleFlagToggle = useCallback(
    (type: string, next: boolean | null) => {
      setFormState((prev) => {
        const rows = flagRowsByType.get(type) ?? [];
        const rowIdsForType = new Set(
          rows.map((r) => r.id).filter((id): id is string => !!id)
        );
        const retained = prev.flag_ids.filter((id) => !rowIdsForType.has(id));
        const target =
          next == null ? null : rows.find((r) => r.value === next)?.id ?? null;
        const nextIds = target ? [...retained, target] : retained;
        return { ...prev, flag_ids: nextIds };
      });
    },
    [flagRowsByType]
  );

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({
      ...prev,
      name_id: id,
      name: id ? null : prev.name,
    }));
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({
      ...prev,
      name,
      name_id: null,
    }));
  }, []);

  const handleDescriptionIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({
      ...prev,
      description_id: id,
      description: id ? null : prev.description,
    }));
  }, []);

  const handleDescriptionChange = useCallback((description: string) => {
    setFormState((prev) => ({
      ...prev,
      description,
      description_id: null,
    }));
  }, []);

  // ─── Per-field pending lifecycle ──────────────────────────────────
  // Mirrors persona pattern. draftPatchKey already includes pending_ids,
  // so accept/reject reliably triggers autosave even when the underlying
  // field id/list doesn't shift. Tool has no value fields for
  // name/description/instruction beyond the existing handlers, so the
  // helpers stay simple.
  type SingleField = "name_id" | "description_id" | "instruction_id";
  type MultiField = "department_ids" | "flag_ids";

  const handleAcceptPendingField = useCallback(
    (field: SingleField, pendingId: string) => {
      setFormState((prev) => ({
        ...prev,
        [field]: pendingId,
        ...(field === "name_id" ? { name: null } : {}),
        ...(field === "description_id" ? { description: null } : {}),
        pending_ids: prev.pending_ids.filter((id) => id !== pendingId),
      }));
    },
    [],
  );

  const handleRejectPendingField = useCallback(
    (field: SingleField, pendingId: string) => {
      setFormState((prev) => ({
        ...prev,
        [field]: prev[field] === pendingId ? null : prev[field],
        pending_ids: prev.pending_ids.filter((id) => id !== pendingId),
      }));
    },
    [],
  );

  const handleAcceptPendingMulti = useCallback(
    (_field: MultiField, pendingIds: string[]) => {
      const removeSet = new Set(pendingIds);
      setFormState((prev) => ({
        ...prev,
        pending_ids: prev.pending_ids.filter((id) => !removeSet.has(id)),
      }));
    },
    [],
  );

  const handleRejectPendingMulti = useCallback(
    (field: MultiField, pendingIds: string[]) => {
      const removeSet = new Set(pendingIds);
      setFormState((prev) => ({
        ...prev,
        [field]: (prev[field] as string[]).filter((id) => !removeSet.has(id)),
        pending_ids: prev.pending_ids.filter((id) => !removeSet.has(id)),
      }));
    },
    [],
  );

  // Live preview against /tool/preview — renders each output template with
  // mock arg values, returns compiled text + per-arg type/filter hints +
  // undeclared variable list. Audited like decrypt.
  const runToolPreview = useCallback(
    async (
      args: ToolArgRowDraft[],
      mock: Record<string, string>,
    ): Promise<PreviewToolOut | null> => {
      if (!previewToolAction) return null;
      const previewArgs = args
        .filter((a) => a.name.trim())
        .map((a) => ({
          name: a.name,
          field_type: a.field_type || "string",
          default_value: a.default_value || "",
        }));
      const previewOutputs: Array<{ name: string; template: string }> = [];
      args.forEach((a) =>
        a.outputs.forEach((o) => {
          if (o.name.trim() || o.template.trim()) {
            previewOutputs.push({ name: o.name, template: o.template });
          }
        }),
      );
      if (previewOutputs.length === 0) return null;
      try {
        return await previewToolAction({
          body: { args: previewArgs, outputs: previewOutputs, mock },
        } as PreviewToolIn);
      } catch (err) {
        console.error("tool preview failed", err);
        return null;
      }
    },
    [previewToolAction],
  );

  const handleGenerateResources = useCallback(
    async (resourceTypes: ToolResourceType[]) => {
      const currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? draftId ?? null;
      generate(resourceTypes, {
        draft_id: currentDraftId,
        artifact_id: toolId ?? null,
      });
    },
    [draftId, generate, toolId]
  );

  const disabled = useMemo(() => !toolData?.can_edit, [toolData?.can_edit]);

  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (!isAutosaveEnabled) {
        await flushAllResources();
      }

      if (!formState.name_id && !formState.name?.trim()) {
        toast.error("Tool name is required");
        throw new Error("Tool name is required");
      }

      // args_drafts is the canonical source of truth when present — the
      // server resolver creates/links each row + nested outputs + position.
      // Fall back to the legacy id triple for backwards-compat callers.
      const argumentsPayload: Record<string, unknown> =
        formState.args_drafts && formState.args_drafts.length > 0
          ? { args_drafts: formState.args_drafts }
          : {
              args_ids: formState.args_ids.length ? formState.args_ids : null,
              arg_positions_ids: formState.arg_position_ids.length
                ? formState.arg_position_ids
                : null,
              args_outputs_ids: formState.args_outputs_ids.length
                ? formState.args_outputs_ids
                : null,
            };

      try {
        if (isEditMode && toolId && updateToolAction) {
          await updateToolAction({
            body: {
              tools: [
                {
                  id: toolId,
                  ...(formState.name_id
                    ? { name_id: formState.name_id }
                    : { name: formState.name }),
                  ...(formState.description_id
                    ? { description_id: formState.description_id }
                    : { description: formState.description || null }),
                  department_ids: formState.department_ids.length
                    ? formState.department_ids
                    : null,
                  flag_ids: formState.flag_ids.length ? formState.flag_ids : null,
                  ...argumentsPayload,
                  permission_ids: formState.permission_ids.length
                    ? formState.permission_ids
                    : null,
                  instruction_id: formState.instruction_id ?? null,
                },
              ],
              group_id: toolData?.group_id ?? null,
            },
          } as UpdateToolIn);
        } else if (createToolAction) {
          await createToolAction({
            body: {
              tools: [
                {
                  ...(formState.name_id
                    ? { name_id: formState.name_id }
                    : { name: formState.name }),
                  ...(formState.description_id
                    ? { description_id: formState.description_id }
                    : { description: formState.description || null }),
                  department_ids: formState.department_ids.length
                    ? formState.department_ids
                    : null,
                  flag_ids: formState.flag_ids.length ? formState.flag_ids : null,
                  ...argumentsPayload,
                  permission_ids: formState.permission_ids.length
                    ? formState.permission_ids
                    : null,
                  instruction_id: formState.instruction_id ?? null,
                },
              ],
              group_id: toolData?.group_id ?? null,
            },
          } as CreateToolIn);
        } else {
          throw new Error("Save action not available");
        }

        toast.success(`Tool ${isEditMode ? "updated" : "created"} successfully`);
        router.push("/intelligence/tools");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} tool: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        throw error;
      }
    },
    [
      createToolAction,
      flushAllResources,
      formState,
      isAutosaveEnabled,
      isEditMode,
      router,
      toolData?.group_id,
      toolId,
      updateToolAction,
    ]
  );

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!formState.name_id || !!formState.name?.trim();
      const hasDescription =
        !!formState.description_id || !!formState.description?.trim();

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "arguments":
          if (!hasName) return "pending";
          return (formState.args_drafts?.length ?? 0) > 0 ||
            formState.args_ids.length > 0
            ? "completed"
            : "active";
        case "permissions":
          if (!hasName) return "pending";
          return formState.permission_ids.length > 0 ? "completed" : "active";
        case "instructions":
          if (!hasName) return "pending";
          return formState.instruction_id ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  const stepResources: Record<string, ToolResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags", "departments"],
      arguments: ["args", "arg_positions", "args_outputs"],
      permissions: ["permissions"],
      instructions: ["instructions"],
      all: [
        "names",
        "descriptions",
        "flags",
        "departments",
        "args",
        "arg_positions",
        "args_outputs",
        "permissions",
        "instructions",
      ],
    }),
    []
  );

  const handleDirectStepGenerate = useCallback(
    (stepId: string) => {
      const resources = stepResources[stepId];
      if (resources) {
        void handleGenerateResources(resources);
      }
    },
    [handleGenerateResources, stepResources]
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the tool name, description, and status.",
        resetFields: ["name", "description", "department_ids", "flag_ids"],
      },
      {
        id: "arguments",
        title: "Arguments",
        description:
          "Define each argument, its position, and the output templates it feeds.",
        resetFields: [
          "args_ids",
          "arg_position_ids",
          "args_outputs_ids",
          "args_drafts",
        ],
      },
      {
        id: "permissions",
        title: "Permissions",
        description: "Select the permissions this tool can use.",
        filters: [{ key: "permissionsShowSelected", label: "Show selected" }],
        resetFields: ["permission_ids"],
      },
      {
        id: "instructions",
        title: "Instructions",
        description:
          "Optional response template applied when the tool returns results.",
        resetFields: ["instruction_id"],
      },
    ],
    []
  );

  const formFieldKeys = useMemo(
    () => [
      "draftId",
      "argsSearch",
      "argPositionsSearch",
      "argsOutputsSearch",
      "permissionsSearch",
      "argsShowSelected",
      "argPositionsShowSelected",
      "argsOutputsShowSelected",
      "permissionsShowSelected",
    ],
    []
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "arguments":
        return "Arguments reset";
      case "permissions":
        return "Permissions reset";
      case "instructions":
        return "Instructions reset";
      default:
        return "Reset";
    }
  }, []);

  const handleReset = useCallback((stepId: string) => {
    setFormState((prev) => {
      switch (stepId) {
        case "basic":
          return {
            ...prev,
            name: null,
            name_id: null,
            description: null,
            description_id: null,
            department_ids: [],
            flag_ids: [],
          };
        case "arguments":
          return {
            ...prev,
            args_ids: [],
            arg_position_ids: [],
            args_outputs_ids: [],
            args_drafts: null,
          };
        case "permissions":
          return { ...prev, permission_ids: [] };
        case "instructions":
          return { ...prev, instruction_id: null };
        default:
          return prev;
      }
    });
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/intelligence/tools",
      backLabel: "Back",
      createLabel: "Create Tool",
      updateLabel: "Update Tool",
    }),
    []
  );

  const canRegenerate = useCallback(
    (resourceType: ToolResourceType) => {
      switch (resourceType) {
        case "args":
          return (s?.args ?? []).some((item) => item.selected && item.generated);
        case "arg_positions":
          return (s?.arg_positions ?? []).some((item) => item.selected && item.generated);
        case "args_outputs":
          return (s?.args_outputs ?? []).some((item) => item.selected && item.generated);
        case "names":
          return (s?.names ?? []).some((item) => item.generated);
        case "descriptions":
          return (s?.descriptions ?? []).some((item) => item.generated);
        case "flags":
          return (s?.flags ?? []).some((item) => item.generated);
        case "permissions":
          return (s?.permissions ?? []).some((item) => item.generated);
        case "instructions":
          return (s?.instructions ?? []).some((item) => item.generated);
        default:
          return false;
      }
    },
    [
      s?.arg_positions,
      s?.args,
      s?.args_outputs,
      s?.names,
      s?.descriptions,
      s?.flags,
      s?.permissions,
      s?.instructions,
    ]
  );

  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData,
      setFormData,
      filters,
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
        case "basic":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              customHeader={
                <Names
                  name_id={formState.name_id}
                  name_resource={selectedName}
                  show_name
                  names={s?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={handleNameIdChange}
                  onNameChange={handleNameChange}
                  onAcceptPending={(pendingId) =>
                    handleAcceptPendingField("name_id", pendingId)
                  }
                  onRejectPending={(pendingId) =>
                    handleRejectPendingField("name_id", pendingId)
                  }
                  placeholder="e.g., Calculator"
                  defaultName="New Tool"
                  hideDescription={true}
                  required={true}
                />
              }
              resetFields={["name", "description", "department_ids", "flag_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["basic"] &&
                stepResources["basic"].length > 0 &&
                toolData?.basic_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"]}
                    canRegenerate={(rt) => canRegenerate(rt as ToolResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ToolResourceType)}
                    onOpenModal={(step) => handleDirectStepGenerate(step)}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id}
                  description_resource={selectedDescription}
                  show_description
                  descriptions={s?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={handleDescriptionIdChange}
                  onDescriptionChange={handleDescriptionChange}
                  onAcceptPending={(pendingId) =>
                    handleAcceptPendingField("description_id", pendingId)
                  }
                  onRejectPending={(pendingId) =>
                    handleRejectPendingField("description_id", pendingId)
                  }
                />
                {/* Departments — multi-select. Catalog is sourced from
                    `(toolData as any).departments` once the GET endpoint
                    surfaces it; the picker simply renders nothing until then.
                    Form state, draft autosave, and create/update payloads all
                    already round-trip `department_ids`. */}
                <Departments
                  department_ids={formState.department_ids}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  departments={((s as any)?.departments ?? []) as any[]}
                  show_departments
                  disabled={disabled}
                  onChange={(ids: string[]) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onAcceptPending={(pendingIds) =>
                    handleAcceptPendingMulti("department_ids", pendingIds)
                  }
                  onRejectPending={(pendingIds) =>
                    handleRejectPendingMulti("department_ids", pendingIds)
                  }
                  label="Departments"
                />
                <Flags
                  values={flagValues}
                  flags={s?.flags ?? []}
                  show_flags
                  columns={1}
                  disabled={disabled}
                  onChange={handleFlagToggle}
                  onAcceptPending={(pendingIds) =>
                    handleAcceptPendingMulti("flag_ids", pendingIds)
                  }
                  onRejectPending={(pendingIds) =>
                    handleRejectPendingMulti("flag_ids", pendingIds)
                  }
                  label="Flags"
                />
              </div>
            </StepCard>
          );

        case "arguments": {
          const argsDrafts = formState.args_drafts ?? [];
          const setArgsDrafts = (
            updater:
              | ToolArgRowDraft[]
              | ((prev: ToolArgRowDraft[]) => ToolArgRowDraft[]),
          ) =>
            setFormState((prev) => {
              const next =
                typeof updater === "function"
                  ? updater(prev.args_drafts ?? [])
                  : updater;
              const nextArgIds = next
                .map((r) => r.id)
                .filter((id): id is string => !!id);
              const nextOutputIds = next.flatMap((r) =>
                r.outputs.map((o) => o.id).filter((id): id is string => !!id),
              );
              return {
                ...prev,
                args_drafts: next,
                args_ids: nextArgIds,
                args_outputs_ids: nextOutputIds,
              };
            });

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={[
                "args_ids",
                "arg_position_ids",
                "args_outputs_ids",
                "args_drafts",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={disabled}
                    onClick={() =>
                      setArgsDrafts((prev) => [
                        ...prev,
                        {
                          id: null,
                          name: "",
                          description: "",
                          field_type: "string",
                          required: false,
                          default_value: "",
                          outputs: [],
                        },
                      ])
                    }
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Add Argument
                  </Button>
                  {stepResources["arguments"] &&
                  stepResources["arguments"].length > 0 &&
                  toolData?.args_show_ai_generate ? (
                    <StepCardAiButton
                      stepId="arguments"
                      resourceTypes={stepResources["arguments"]}
                      canRegenerate={(rt) => canRegenerate(rt as ToolResourceType)}
                      isGenerating={(rt) => isGenerating(rt as ToolResourceType)}
                      onOpenModal={(step) => handleDirectStepGenerate(step)}
                      disabled={disabled}
                    />
                  ) : null}
                </div>
              }
            >
              <div className="space-y-6">
                {argsDrafts.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No arguments yet. Click <strong>Add Argument</strong> to
                    define what comes in, where it sits in the call signature,
                    and which jinja outputs it feeds.
                  </p>
                )}

                {argsDrafts.map((row, rowIdx) => {
                  const isSaved = row.id !== null;
                  const moveRow = (direction: -1 | 1) => {
                    const target = rowIdx + direction;
                    if (target < 0 || target >= argsDrafts.length) return;
                    setArgsDrafts((prev) => {
                      const next = [...prev];
                      const tmp = next[rowIdx];
                      next[rowIdx] = next[target]!;
                      next[target] = tmp!;
                      return next;
                    });
                  };
                  const removeRow = () =>
                    setArgsDrafts((prev) =>
                      prev.filter((_, i) => i !== rowIdx),
                    );
                  const replaceWithDraft = () =>
                    setArgsDrafts((prev) =>
                      prev.map((r, i) =>
                        i === rowIdx
                          ? {
                              ...r,
                              id: null,
                              outputs: r.outputs.map((o) => ({
                                ...o,
                                id: null,
                              })),
                            }
                          : r,
                      ),
                    );
                  const editRow = (patch: Partial<ToolArgRowDraft>) =>
                    setArgsDrafts((prev) =>
                      prev.map((r, i) =>
                        i === rowIdx ? { ...r, ...patch } : r,
                      ),
                    );
                  const addOutput = () =>
                    setArgsDrafts((prev) =>
                      prev.map((r, i) =>
                        i === rowIdx
                          ? {
                              ...r,
                              outputs: [
                                ...r.outputs,
                                { id: null, name: "", template: "" },
                              ],
                            }
                          : r,
                      ),
                    );
                  const editOutput = (
                    outIdx: number,
                    patch: Partial<ToolArgOutputRowDraft>,
                  ) =>
                    setArgsDrafts((prev) =>
                      prev.map((r, i) =>
                        i === rowIdx
                          ? {
                              ...r,
                              outputs: r.outputs.map((o, j) =>
                                j === outIdx ? { ...o, ...patch } : o,
                              ),
                            }
                          : r,
                      ),
                    );
                  const removeOutput = (outIdx: number) =>
                    setArgsDrafts((prev) =>
                      prev.map((r, i) =>
                        i === rowIdx
                          ? {
                              ...r,
                              outputs: r.outputs.filter(
                                (_, j) => j !== outIdx,
                              ),
                            }
                          : r,
                      ),
                    );

                  return (
                    <div
                      key={`${row.id ?? "new"}-${rowIdx}`}
                      className={cn(
                        "rounded-md border p-4 space-y-3 bg-card",
                        isSaved && "bg-muted/30",
                      )}
                    >
                      {/* Row header — position, name (or chip), reorder, remove */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground w-6">
                            #{rowIdx + 1}
                          </span>
                          {isSaved ? (
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">
                                {row.name || argsNameById.get(row.id!) || "Saved arg"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {row.field_type}
                                {row.required ? " · required" : ""} ·{" "}
                                {row.outputs.length} output
                                {row.outputs.length === 1 ? "" : "s"}
                              </div>
                            </div>
                          ) : (
                            <Input
                              value={row.name}
                              onChange={(e) => editRow({ name: e.target.value })}
                              placeholder="Argument name"
                              className="h-8 max-w-xs"
                              disabled={disabled}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={disabled || rowIdx === 0}
                            onClick={() => moveRow(-1)}
                            title="Move up"
                          >
                            ↑
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={disabled || rowIdx === argsDrafts.length - 1}
                            onClick={() => moveRow(1)}
                            title="Move down"
                          >
                            ↓
                          </Button>
                          {isSaved && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7"
                              disabled={disabled}
                              onClick={replaceWithDraft}
                              title="Replace this saved arg with an editable draft"
                            >
                              Replace
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            disabled={disabled}
                            onClick={removeRow}
                            title="Remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Editable card body — only for new rows. Saved rows
                          stay immutable; the user clones via Replace. */}
                      {!isSaved && (
                        <div className="space-y-3 pt-2 border-t">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                Type
                              </Label>
                              <select
                                value={row.field_type}
                                onChange={(e) =>
                                  editRow({ field_type: e.target.value })
                                }
                                disabled={disabled}
                                className="mt-1 h-8 w-full rounded border bg-background px-2 text-sm"
                              >
                                <option value="string">string</option>
                                <option value="number">number</option>
                                <option value="boolean">boolean</option>
                                <option value="array">array</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2 pt-5">
                              <input
                                id={`req-${rowIdx}`}
                                type="checkbox"
                                checked={row.required}
                                onChange={(e) =>
                                  editRow({ required: e.target.checked })
                                }
                                disabled={disabled}
                              />
                              <Label
                                htmlFor={`req-${rowIdx}`}
                                className="text-sm cursor-pointer"
                              >
                                Required
                              </Label>
                            </div>
                            <div>
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                Default
                              </Label>
                              <Input
                                value={row.default_value}
                                onChange={(e) =>
                                  editRow({ default_value: e.target.value })
                                }
                                disabled={disabled}
                                className="mt-1 h-8"
                                placeholder="(none)"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                              Description
                            </Label>
                            <Input
                              value={row.description}
                              onChange={(e) =>
                                editRow({ description: e.target.value })
                              }
                              disabled={disabled}
                              className="mt-1 h-8"
                              placeholder="What this argument is used for"
                            />
                          </div>
                        </div>
                      )}

                      {/* Per-arg outputs — jinja templates that consume this
                          arg (and any other declared args). Saved outputs
                          stay immutable; new outputs are editable. */}
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            Outputs
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7"
                            disabled={disabled}
                            onClick={addOutput}
                          >
                            <Check className="h-3 w-3 mr-1" /> Add output
                          </Button>
                        </div>
                        {row.outputs.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No outputs. The arg will be available to other
                            outputs but emit nothing on its own.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {row.outputs.map((output, oIdx) => {
                              const outputSaved = output.id !== null;
                              return (
                                <div
                                  key={`${output.id ?? "new"}-${oIdx}`}
                                  className={cn(
                                    "rounded border px-2 py-2 space-y-1.5",
                                    outputSaved && "bg-muted/30",
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={output.name}
                                      onChange={(e) =>
                                        editOutput(oIdx, {
                                          name: e.target.value,
                                        })
                                      }
                                      placeholder="Output name"
                                      className="h-8 flex-1"
                                      disabled={disabled || outputSaved}
                                    />
                                    {outputSaved && (
                                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                        Saved
                                      </span>
                                    )}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      disabled={disabled}
                                      onClick={() => removeOutput(oIdx)}
                                      title="Remove output"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                  <textarea
                                    value={output.template}
                                    onChange={(e) =>
                                      editOutput(oIdx, {
                                        template: e.target.value,
                                      })
                                    }
                                    placeholder={`Jinja template — e.g. {{ ${row.name || "arg_name"} }}`}
                                    className="min-h-[60px] w-full rounded border bg-background p-2 text-xs font-mono"
                                    disabled={disabled || outputSaved}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Live Preview panel — calls /tool/preview against the
                    current draft args + outputs with the user-supplied mock
                    values. Renders compiled output blocks + per-arg type/
                    filter hints + undeclared variable warnings. */}
                <ArgumentsPreviewPanel
                  args={argsDrafts}
                  runPreview={runToolPreview}
                  disabled={disabled}
                />
              </div>
            </StepCard>
          );
        }

        // Legacy paths — retained empty switch arms so existing logic doesn't
        // need to know the steps were collapsed. The unified `arguments` case
        // above is the canonical entry point.
        case "args":
        case "arg_positions":
        case "args_outputs": {
          return null;
        }
        case "_legacy_args_unused": {
          const argsSearch = ((formData["argsSearch"] as string | undefined) ?? "").trim().toLowerCase();
          const argsShowSelected = Boolean(formData["argsShowSelected"]);
          let filteredArgs = argsItems;
          if (argsShowSelected) {
            filteredArgs = filteredArgs.filter((item) => formState.args_ids.includes(item.id));
          }
          if (argsSearch) {
            filteredArgs = filteredArgs.filter((item) =>
              `${item.name} ${item.description}`.toLowerCase().includes(argsSearch)
            );
          }

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["args_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              searchTerm={(formData["argsSearch"] as string | undefined) ?? ""}
              onSearchChange={(term) => setFormData({ argsSearch: term || null })}
              searchPlaceholder="Search args..."
              {...(filters ? { filters } : {})}
              actions={
                toolData?.args_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="args"
                    resourceTypes={stepResources["args"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ToolResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ToolResourceType)}
                    onOpenModal={(step) => handleDirectStepGenerate(step)}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
                <SelectableGrid
                  items={filteredArgs}
                  selectedId={null}
                  selectedIds={formState.args_ids}
                  onSelect={(argsId) =>
                    setFormState((prev) => {
                      const isSelected = prev.args_ids.includes(argsId);
                      return {
                        ...prev,
                        args_ids: isSelected
                          ? prev.args_ids.filter((id) => id !== argsId)
                          : [...prev.args_ids, argsId],
                      };
                    })
                  }
                  getId={(item) => item.id}
                  renderItem={(item, isSelected) => (
                    <div
                      className={cn(
                        "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm transition-all",
                        "hover:bg-accent/50 hover:shadow-md",
                        isSelected && "ring-2 ring-primary bg-accent",
                        item.suggested && !isSelected && "ring-2 ring-primary/40",
                        item.pending && "ring-2 ring-success bg-success/10"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="text-sm font-semibold leading-tight">{item.name}</div>
                        {item.description ? (
                          <div className="line-clamp-2 text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {item.field_type ? (
                          <span className="rounded-md border px-2 py-0.5">{item.field_type}</span>
                        ) : null}
                        {item.required ? (
                          <span className="rounded-md border px-2 py-0.5">Required</span>
                        ) : null}
                        {item.pending ? (
                          <span className="rounded-md border px-2 py-0.5">Pending</span>
                        ) : null}
                      </div>
                    </div>
                  )}
                  emptyMessage={argsSearch ? "No args match your search." : "No args available yet."}
                  disabled={disabled}
                />

                <Args
                  args_ids={formState.args_ids}
                  input_args_fields={argsItems
                    .filter((item) => formState.args_ids.includes(item.id))
                    .map((item) => ({
                      args_id: item.id,
                      name: item.name,
                      description: item.description,
                      field_type: item.field_type,
                      required: item.required,
                      default_value: "",
                      generated: item.generated,
                    }))}
                  disabled={disabled}
                />
              </div>
            </StepCard>
          );
        }

        case "arg_positions": {
          const argPositionsSearch = ((formData["argPositionsSearch"] as string | undefined) ?? "").trim().toLowerCase();
          const argPositionsShowSelected = Boolean(formData["argPositionsShowSelected"]);
          let filteredArgs = argsItems.filter((item) => formState.args_ids.includes(item.id));
          if (argPositionsShowSelected) {
            filteredArgs = filteredArgs.filter((item) => {
              const position = argPositionByArgId.get(item.id);
              return position ? formState.arg_position_ids.includes(position.id) : false;
            });
          }
          if (argPositionsSearch) {
            filteredArgs = filteredArgs.filter((item) =>
              `${item.name} ${item.description}`.toLowerCase().includes(argPositionsSearch)
            );
          }

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["arg_position_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              searchTerm={(formData["argPositionsSearch"] as string | undefined) ?? ""}
              onSearchChange={(term) => setFormData({ argPositionsSearch: term || null })}
              searchPlaceholder="Search arg positions..."
              {...(filters ? { filters } : {})}
              actions={
                toolData?.args_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="arg_positions"
                    resourceTypes={stepResources["arg_positions"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ToolResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ToolResourceType)}
                    onOpenModal={(step) => handleDirectStepGenerate(step)}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
                <SelectableGrid
                  items={filteredArgs}
                  selectedId={null}
                  selectedIds={formState.args_ids}
                  onSelect={() => {}}
                  getId={(item) => item.id}
                  renderItem={(item) => {
                    const position = argPositionByArgId.get(item.id);
                    return (
                      <div
                        className={cn(
                          "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm transition-all",
                          position?.suggested && "ring-2 ring-primary/40",
                          position?.pending && "ring-2 ring-success bg-success/10"
                        )}
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-semibold leading-tight">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Position: {(position?.value ?? 0) + 1}
                          </div>
                        </div>
                      </div>
                    );
                  }}
                  emptyMessage={
                    argPositionsSearch
                      ? "No args match your search."
                      : "No selected args available for positions."
                  }
                  disabled
                />

                <ArgPositions
                  args_ids={formState.args_ids}
                  args_resources={argsItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                  }))}
                  arg_position_ids={formState.arg_position_ids}
                  arg_position_resources={argPositionItems.map((item) => ({
                    id: item.id,
                    args_id: item.args_id,
                    value: item.value,
                    generated: item.generated,
                  }))}
                  disabled={disabled}
                  tool_id={toolId ?? null}
                  onPositionIdsChange={(ids) =>
                    setFormState((prev) => ({ ...prev, arg_position_ids: ids }))
                  }
                />
              </div>
            </StepCard>
          );
        }

        case "args_outputs": {
          const argsOutputsSearch = ((formData["argsOutputsSearch"] as string | undefined) ?? "").trim().toLowerCase();
          const argsOutputsShowSelected = Boolean(formData["argsOutputsShowSelected"]);
          const selectedArgs = new Set(formState.args_ids);
          let filteredOutputs = argsOutputsItems;
          if (selectedArgs.size > 0) {
            filteredOutputs = filteredOutputs.filter((item) => selectedArgs.has(item.args_id));
          }
          if (argsOutputsShowSelected) {
            filteredOutputs = filteredOutputs.filter((item) =>
              formState.args_outputs_ids.includes(item.id)
            );
          }
          if (argsOutputsSearch) {
            filteredOutputs = filteredOutputs.filter((item) =>
              `${item.name} ${item.template} ${argsNameById.get(item.args_id) ?? ""}`
                .toLowerCase()
                .includes(argsOutputsSearch)
            );
          }

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["args_outputs_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              searchTerm={(formData["argsOutputsSearch"] as string | undefined) ?? ""}
              onSearchChange={(term) => setFormData({ argsOutputsSearch: term || null })}
              searchPlaceholder="Search args outputs..."
              {...(filters ? { filters } : {})}
              actions={
                toolData?.args_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="args_outputs"
                    resourceTypes={stepResources["args_outputs"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ToolResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ToolResourceType)}
                    onOpenModal={(step) => handleDirectStepGenerate(step)}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
                <SelectableGrid
                  items={filteredOutputs}
                  selectedId={null}
                  selectedIds={formState.args_outputs_ids}
                  onSelect={(outputId) =>
                    setFormState((prev) => {
                      const isSelected = prev.args_outputs_ids.includes(outputId);
                      if (isSelected) {
                        return {
                          ...prev,
                          args_outputs_ids: prev.args_outputs_ids.filter((id) => id !== outputId),
                        };
                      }
                      const output = argsOutputsById.get(outputId);
                      const nextArgsIds =
                        output && !prev.args_ids.includes(output.args_id)
                          ? [...prev.args_ids, output.args_id]
                          : prev.args_ids;
                      return {
                        ...prev,
                        args_ids: nextArgsIds,
                        args_outputs_ids: [...prev.args_outputs_ids, outputId],
                      };
                    })
                  }
                  getId={(item) => item.id}
                  renderItem={(item, isSelected) => (
                    <div
                      className={cn(
                        "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm transition-all",
                        "hover:bg-accent/50 hover:shadow-md",
                        isSelected && "ring-2 ring-primary bg-accent",
                        item.suggested && !isSelected && "ring-2 ring-primary/40",
                        item.pending && "ring-2 ring-success bg-success/10"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="text-sm font-semibold leading-tight">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Arg: {argsNameById.get(item.args_id) ?? "Arg"}
                        </div>
                      </div>
                      {item.template ? (
                        <div className="line-clamp-2 text-xs font-mono text-muted-foreground">
                          {item.template}
                        </div>
                      ) : null}
                    </div>
                  )}
                  emptyMessage={
                    argsOutputsSearch
                      ? "No args outputs match your search."
                      : "No args outputs available yet."
                  }
                  disabled={disabled}
                />

                <ArgsOutputs
                  args_outputs_ids={formState.args_outputs_ids}
                  output_args_outputs={argsOutputsItems
                    .filter((item) => formState.args_outputs_ids.includes(item.id))
                    .map((item) => ({
                      args_outputs_id: item.id,
                      args_id: item.args_id,
                      name: item.name,
                      template: item.template,
                      generated: item.generated,
                    }))}
                  input_args_fields={argsItems
                    .filter((item) => formState.args_ids.includes(item.id))
                    .map((item) => ({
                      args_id: item.id,
                      name: item.name,
                      description: item.description,
                      field_type: item.field_type,
                      required: item.required,
                      default_value: "",
                      generated: item.generated,
                    }))}
                  disabled={disabled}
                />
              </div>
            </StepCard>
          );
        }

        case "permissions": {
          const permissionsSearch = ((formData["permissionsSearch"] as string | undefined) ?? "").trim().toLowerCase();
          const permissionsShowSelected = Boolean(formData["permissionsShowSelected"]);
          let filteredPermissions = permissionsItems;
          if (permissionsShowSelected) {
            filteredPermissions = filteredPermissions.filter((item) =>
              formState.permission_ids.includes(item.id)
            );
          }
          if (permissionsSearch) {
            filteredPermissions = filteredPermissions.filter((item) =>
              `${item.name} ${item.description} ${item.artifact} ${item.operation}`
                .toLowerCase()
                .includes(permissionsSearch)
            );
          }

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["permission_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              searchTerm={(formData["permissionsSearch"] as string | undefined) ?? ""}
              onSearchChange={(term) => setFormData({ permissionsSearch: term || null })}
              searchPlaceholder="Search permissions..."
              {...(filters ? { filters } : {})}
              actions={
                stepResources["permissions"] &&
                stepResources["permissions"].length > 0 &&
                toolData?.permissions_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="permissions"
                    resourceTypes={stepResources["permissions"]}
                    canRegenerate={(rt) => canRegenerate(rt as ToolResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ToolResourceType)}
                    onOpenModal={(step) => handleDirectStepGenerate(step)}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <SelectableGrid
                items={filteredPermissions}
                selectedId={null}
                selectedIds={formState.permission_ids}
                onSelect={(permissionId) =>
                  setFormState((prev) => {
                    const isSelected = prev.permission_ids.includes(permissionId);
                    return {
                      ...prev,
                      permission_ids: isSelected
                        ? prev.permission_ids.filter((id) => id !== permissionId)
                        : [...prev.permission_ids, permissionId],
                    };
                  })
                }
                getId={(item) => item.id}
                renderItem={(item, isSelected) => (
                  <div
                    className={cn(
                      "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm transition-all",
                      "hover:bg-accent/50 hover:shadow-md",
                      isSelected && "ring-2 ring-primary bg-accent",
                      item.suggested && !isSelected && "ring-2 ring-primary/40",
                      item.pending && "ring-2 ring-success bg-success/10"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="text-sm font-semibold leading-tight">{item.name}</div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {item.artifact} / {item.operation}
                      </div>
                      {item.description ? (
                        <div className="line-clamp-2 text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {item.generated ? (
                        <span className="rounded-md border px-2 py-0.5">Generated</span>
                      ) : null}
                      {item.pending ? (
                        <span className="rounded-md border px-2 py-0.5">Pending</span>
                      ) : null}
                    </div>
                  </div>
                )}
                emptyMessage={
                  permissionsSearch
                    ? "No permissions match your search."
                    : "No permissions available yet."
                }
                disabled={disabled}
              />
            </StepCard>
          );
        }

        case "instructions": {
          const selectedInstruction =
            (s?.instructions ?? []).find(
              (item) => item.id === formState.instruction_id,
            ) ?? null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["instruction_id"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["instructions"] &&
                stepResources["instructions"].length > 0 ? (
                  <StepCardAiButton
                    stepId="instructions"
                    resourceTypes={stepResources["instructions"] ?? []}
                    canRegenerate={(rt) =>
                      canRegenerate(rt as ToolResourceType)
                    }
                    isGenerating={(rt) => isGenerating(rt as ToolResourceType)}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Instructions
                instructions_id={formState.instruction_id}
                instructions_resource={
                  selectedInstruction
                    ? {
                        id: selectedInstruction.id ?? null,
                        template: selectedInstruction.template ?? "",
                        generated: selectedInstruction.generated ?? null,
                      }
                    : null
                }
                show_instructions={true}
                instructions={(s?.instructions ?? []).map((item) => ({
                  id: item.id ?? null,
                  template: item.template ?? "",
                  generated: item.generated ?? null,
                  suggested: item.suggested ?? false,
                  pending: item.pending ?? false,
                }))}
                disabled={disabled}
                onInstructionsIdChange={(nextId) =>
                  setFormState((prev) => ({
                    ...prev,
                    instruction_id: nextId,
                  }))
                }
                onAcceptPending={(pendingId) =>
                  handleAcceptPendingField("instruction_id", pendingId)
                }
                onRejectPending={(pendingId) =>
                  handleRejectPendingField("instruction_id", pendingId)
                }
                label="Response Template"
                placeholder="Enter the response template body…"
                required={false}
                isAutosaveEnabled={isAutosaveEnabled}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      argPositionByArgId,
      argPositionItems,
      argsItems,
      argsNameById,
      argsOutputsById,
      argsOutputsItems,
      canRegenerate,
      disabled,
      formState,
      handleDirectStepGenerate,
      isAutosaveEnabled,
      isEditMode,
      isGenerating,
      permissionsItems,
      s?.args,
      s?.args_outputs,
      s?.descriptions,
      s?.flags,
      s?.names,
      selectedDescription,
      selectedName,
      stepResources,
      toolData?.args_show_ai_generate,
      toolId,
    ]
  );

  return (
    <TooltipProvider>
      <div className="w-full space-y-8 p-6" data-page={`tool-${isEditMode ? "edit" : "new"}`}>
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={toolData?.disabled_reason ?? null}
          entityType="tool"
        />

        <GenericForm
          nuqsParsers={toolSearchParamsClient as Record<string, Parser<unknown>>}
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={toolData}
          formFieldKeys={formFieldKeys}
          onReset={(stepId) => handleReset(stepId)}
          resetSuccessMessage={resetSuccessMessage}
          onSubmit={handleSubmit}
          submitButton={submitButton}
          isReadonly={disabled}
          isEditMode={isEditMode}
          renderStep={renderStep}
          onFormDataChange={onFormDataChange}
          registerSetFormData={(setter) => {
            setUrlFormDataRef.current = setter;
          }}
        />
      </div>
    </TooltipProvider>
  );
}

export default ToolComponent;
