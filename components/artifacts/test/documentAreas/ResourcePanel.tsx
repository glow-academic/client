/**
 * ResourcePanel.tsx
 * Agent config form for the test chat. All fields are full-state — the form
 * is the canonical source for the next /test/run payload (server wiring
 * lands in a follow-up).
 *
 * Layout mirrors AttemptDocumentArea: ResizableHandle + ResizablePanel
 * (defaultSize 30, min 20, max 50). Renders a Card with a scrollable form.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Label } from "@/components/ui/label";
import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import MarkdownInline from "@/components/common/markdown/MarkdownInline";
import { Eye, Pencil, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { components } from "@/lib/api/schema";

type InvocationDetail = components["schemas"]["InvocationDetail"];

export type AgentConfigFormState = {
  tool_ids: string[];
  prompt_text: string;
  instructions: string[];
  temperature: number;
  reasoning_level: string;
  quality_ids: string[];
  modality_ids: string[];
};

export const EMPTY_AGENT_CONFIG: AgentConfigFormState = {
  tool_ids: [],
  prompt_text: "",
  instructions: [""],
  temperature: 0.7,
  reasoning_level: "",
  quality_ids: [],
  modality_ids: [],
};

interface ResourceMap {
  [id: string]: { [key: string]: unknown };
}

/** One run's slot inside the stacked panel. */
export interface AgentConfigPanelEntry {
  /** Stable key — typically the run_id of the picker config. */
  run_id: string;
  /** Heading shown above this run's form (model · agent · timestamp etc.). */
  label: string;
  form_state: AgentConfigFormState;
  on_form_change: (
    updater: (prev: AgentConfigFormState) => AgentConfigFormState,
  ) => void;
  /** Optional per-run tool catalog (filtered by historical permissions). */
  tools?: ResourceMap | null | undefined;
}

export interface ResourcePanelProps {
  visible: boolean;
  /** One stacked form per selected run. Empty → placeholder. */
  panels: AgentConfigPanelEntry[];
  // Shared option catalogs — same across all stacked forms.
  qualities?: ResourceMap | null | undefined;
  modalities?: ResourceMap | null | undefined;
  reasoning_levels?: ResourceMap | null | undefined;
  /** Read-only snapshot mode. When provided, renders the historical
   *  config bundle for this invocation instead of the editable form —
   *  matches the user's "show the historical things used for that run"
   *  pattern. Form mode is preserved for picker-driven new-run flows
   *  (when ``snapshot`` is null/undefined). */
  snapshot?: InvocationDetail | null;
  /** Resource maps from /test/get's ``resources`` field. Used by the
   *  snapshot renderer to resolve agent_id / model_id / prompt_id /
   *  tool_ids / instruction_ids / voice_id / temperature_level_id /
   *  reasoning_level_id / quality_id / modality_ids to display labels.
   *  Each is the same dict[id, dict] shape the server emits. */
  snapshot_resources?: {
    agents?: ResourceMap | null;
    models?: ResourceMap | null;
    prompts?: ResourceMap | null;
    tools?: ResourceMap | null;
    instructions?: ResourceMap | null;
    voices?: ResourceMap | null;
    temperature_levels?: ResourceMap | null;
    reasoning_levels?: ResourceMap | null;
    qualities?: ResourceMap | null;
    modalities?: ResourceMap | null;
  };
  disabled?: boolean;
}

interface NamedItem {
  id: string;
  label: string;
}

function toItems(
  map: ResourceMap | null | undefined,
  labelField: string = "name",
): NamedItem[] {
  if (!map) return [];
  return Object.entries(map).map(([id, raw]) => {
    const v = (raw as Record<string, unknown> | null) ?? {};
    const lbl = v[labelField];
    return {
      id,
      label: typeof lbl === "string" && lbl ? lbl : "Untitled",
    };
  });
}

export function ResourcePanel({
  visible,
  panels,
  qualities,
  modalities,
  reasoning_levels,
  snapshot,
  snapshot_resources,
  disabled,
}: ResourcePanelProps) {
  if (!visible) return null;

  const qualityItems = toItems(qualities, "quality");
  const modalityItems = toItems(modalities, "name");
  const reasoningItems = toItems(reasoning_levels, "reasoning_level");

  return (
    <>
      <ResizableHandle className="bg-transparent hidden md:block" />
      <ResizablePanel
        defaultSize={30}
        minSize={20}
        maxSize={50}
        className="hidden md:block"
      >
        <Card className="h-full flex flex-col ml-2 p-0 border-0 border-l-0 shadow-none rounded-l-none">
          <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
            <ScrollArea className="h-full">
              <div className="space-y-6 p-4">
                {snapshot ? (
                  // Snapshot mode (graded view): read-only summary of the
                  // historical config bundle. The form panels are
                  // intentionally suppressed here — this view is for
                  // inspecting what was tested, not queueing new runs.
                  <AgentSnapshotView
                    snapshot={snapshot}
                    resources={snapshot_resources ?? {}}
                  />
                ) : panels.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    Select a run from the picker to customize its agent
                    resources.
                  </div>
                ) : (
                  panels.map((p, idx) => (
                    <div
                      key={p.run_id}
                      className={cn(
                        "space-y-5",
                        idx > 0 && "pt-5 border-t border-border",
                      )}
                    >
                      <h3 className="text-sm font-semibold">{p.label}</h3>
                      <AgentConfigForm
                        form_state={p.form_state}
                        on_form_change={p.on_form_change}
                        tools={p.tools}
                        qualityItems={qualityItems}
                        modalityItems={modalityItems}
                        reasoningItems={reasoningItems}
                        disabled={disabled}
                      />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </ResizablePanel>
    </>
  );
}

// =============================================================================
// Snapshot view — read-only render of an invocation's historical bundle
// =============================================================================

function lookupLabel(
  map: ResourceMap | null | undefined,
  id: string | null | undefined,
  field: string,
): string | null {
  if (!map || !id) return null;
  const row = map[id] as Record<string, unknown> | undefined;
  if (!row) return null;
  const val = row[field];
  return typeof val === "string" && val ? val : null;
}

function lookupString(
  map: ResourceMap | null | undefined,
  id: string | null | undefined,
  field: string,
): string | null {
  return lookupLabel(map, id, field);
}

interface AgentSnapshotViewProps {
  snapshot: InvocationDetail;
  resources: NonNullable<ResourcePanelProps["snapshot_resources"]>;
}

function SnapshotRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function AgentSnapshotView({ snapshot, resources }: AgentSnapshotViewProps) {
  // Resolve the agent first — its bundle (prompt_id / tool_ids /
  // instruction_ids / model_id / etc.) is the historical truth. The
  // invocation row carries the agent's id directly so this resolves
  // even when the agent isn't the test's default target (e.g. replay /
  // picker fan-out flows that swapped the agent).
  const agentRow = useMemo(() => {
    if (!snapshot.agent_id || !resources.agents) return null;
    const row = resources.agents[snapshot.agent_id];
    return (row as Record<string, unknown>) ?? null;
  }, [snapshot.agent_id, resources.agents]);

  const agentName =
    lookupString(resources.agents, snapshot.agent_id, "name") ?? "Agent";
  const modelName =
    lookupString(resources.models, snapshot.model_id, "name") ?? "—";
  const voiceName = lookupString(resources.voices, snapshot.voice_id, "voice");
  const tempValue = lookupString(
    resources.temperature_levels,
    snapshot.temperature_level_id,
    "temperature",
  );
  const reasoningValue = lookupString(
    resources.reasoning_levels,
    snapshot.reasoning_level_id,
    "reasoning_level",
  );
  const qualityValue = lookupString(
    resources.qualities,
    snapshot.quality_id,
    "quality",
  );
  const modalityLabels = (snapshot.modality_ids ?? [])
    .map((mid) => lookupString(resources.modalities, mid, "name"))
    .filter((s): s is string => !!s);

  // Bundle from the agent row — prompt / tools / instructions are the
  // historical things the LLM was given to work with. Falls back to
  // empty arrays when the agent row isn't in the resources map.
  // Bracket-access required because the row type is dict[string, unknown].
  const promptId =
    typeof agentRow?.["prompt_id"] === "string"
      ? (agentRow["prompt_id"] as string)
      : null;
  const promptText = lookupString(resources.prompts, promptId, "prompt");
  const toolIds = Array.isArray(agentRow?.["tool_ids"])
    ? (agentRow["tool_ids"] as string[])
    : [];
  const instructionIds = Array.isArray(agentRow?.["instruction_ids"])
    ? (agentRow["instruction_ids"] as string[])
    : [];
  const toolNames = toolIds
    .map((tid) => lookupString(resources.tools, tid, "name"))
    .filter((s): s is string => !!s);
  const instructionTexts = instructionIds
    .map((iid) => lookupString(resources.instructions, iid, "instruction"))
    .filter((s): s is string => !!s);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold truncate">{agentName}</h3>
        <Badge variant="outline" className="text-[10px]">
          Snapshot
        </Badge>
      </div>

      <SnapshotRow label="Model" value={modelName} />

      {voiceName && <SnapshotRow label="Voice" value={voiceName} />}
      {tempValue && <SnapshotRow label="Temperature" value={tempValue} />}
      {reasoningValue && (
        <SnapshotRow label="Reasoning" value={reasoningValue} />
      )}
      {qualityValue && <SnapshotRow label="Quality" value={qualityValue} />}

      {modalityLabels.length > 0 && (
        <SnapshotRow
          label="Modalities"
          value={
            <div className="flex flex-wrap gap-1">
              {modalityLabels.map((m) => (
                <Badge key={m} variant="secondary" className="text-[10px]">
                  {m}
                </Badge>
              ))}
            </div>
          }
        />
      )}

      {toolNames.length > 0 && (
        <SnapshotRow
          label={`Tools · ${toolNames.length}`}
          value={
            <div className="flex flex-wrap gap-1">
              {toolNames.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          }
        />
      )}

      {promptText && (
        <SnapshotRow
          label="Prompt"
          value={
            <div className="rounded border bg-muted/30 px-2 py-2 text-xs max-h-[280px] overflow-y-auto whitespace-pre-wrap">
              <MarkdownInline>{promptText}</MarkdownInline>
            </div>
          }
        />
      )}

      {instructionTexts.length > 0 && (
        <SnapshotRow
          label={`Instructions · ${instructionTexts.length}`}
          value={
            <div className="space-y-2">
              {instructionTexts.map((text, i) => (
                <div
                  key={i}
                  className="rounded border bg-muted/30 px-2 py-2 text-xs max-h-[180px] overflow-y-auto whitespace-pre-wrap"
                >
                  <MarkdownInline>{text}</MarkdownInline>
                </div>
              ))}
            </div>
          }
        />
      )}
    </div>
  );
}

interface AgentConfigFormProps {
  form_state: AgentConfigFormState;
  on_form_change: (
    updater: (prev: AgentConfigFormState) => AgentConfigFormState,
  ) => void;
  tools?: ResourceMap | null | undefined;
  qualityItems: NamedItem[];
  modalityItems: NamedItem[];
  reasoningItems: NamedItem[];
  disabled?: boolean | undefined;
}

function AgentConfigForm({
  form_state,
  on_form_change,
  tools,
  qualityItems,
  modalityItems,
  reasoningItems,
  disabled,
}: AgentConfigFormProps) {
  const toolItems = toItems(tools, "name");

  // Per-section render mode — section toggle (not per-instruction).
  // Edit shows the textarea(s); preview renders Markdown over the
  // current text. Untouched textareas keep their value when the user
  // flips back. Defaults to edit since users land here to tweak.
  const [promptMode, setPromptMode] = useState<"edit" | "preview">("edit");
  const [instructionsMode, setInstructionsMode] = useState<
    "edit" | "preview"
  >("edit");

  const setField = <K extends keyof AgentConfigFormState>(
    key: K,
    value: AgentConfigFormState[K],
  ) => on_form_change((prev) => ({ ...prev, [key]: value }));

  const setInstruction = (i: number, value: string) =>
    on_form_change((prev) => {
      const next = [...prev.instructions];
      next[i] = value;
      return { ...prev, instructions: next };
    });

  const addInstruction = () =>
    on_form_change((prev) => ({
      ...prev,
      instructions: [...prev.instructions, ""],
    }));

  const removeInstruction = (i: number) =>
    on_form_change((prev) => {
      const next = prev.instructions.filter((_, j) => j !== i);
      return { ...prev, instructions: next.length > 0 ? next : [""] };
    });

  return (
    <>
      {/* Tools */}
      <div className="space-y-1.5">
        <Label className="text-xs">Tools</Label>
        <GenericPicker<NamedItem>
          items={toolItems}
          selectedIds={form_state.tool_ids}
          onSelect={(ids) => setField("tool_ids", ids)}
          multiSelect
          getId={(i) => i.id}
          getLabel={(i) => i.label}
          placeholder="Select tools..."
          disabled={disabled ?? false}
          showLabel={false}
          compact
        />
      </div>

      {/* Prompt */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Prompt</Label>
          <ModeToggle
            mode={promptMode}
            on_change={setPromptMode}
            disabled={disabled}
          />
        </div>
        {promptMode === "edit" ? (
          <Textarea
            value={form_state.prompt_text}
            onChange={(e) => setField("prompt_text", e.target.value)}
            placeholder="System prompt for the agent..."
            disabled={disabled}
            className="min-h-[180px] text-sm"
          />
        ) : (
          <MarkdownPreview text={form_state.prompt_text} min_height={180} />
        )}
      </div>

      {/* Instructions */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Instructions</Label>
          <div className="flex items-center gap-2">
            <ModeToggle
              mode={instructionsMode}
              on_change={setInstructionsMode}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={addInstruction}
              disabled={disabled || instructionsMode === "preview"}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {form_state.instructions.map((value, i) =>
            instructionsMode === "edit" ? (
              <div key={i} className="flex items-start gap-1.5">
                <Textarea
                  value={value}
                  onChange={(e) => setInstruction(i, e.target.value)}
                  placeholder={`Instruction ${i + 1}`}
                  disabled={disabled}
                  className="min-h-[140px] text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 mt-0.5"
                  onClick={() => removeInstruction(i)}
                  disabled={
                    disabled || form_state.instructions.length <= 1
                  }
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <MarkdownPreview key={i} text={value} min_height={140} />
            ),
          )}
        </div>
      </div>

      {/* Temperature */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Temperature</Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {form_state.temperature.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[form_state.temperature]}
          onValueChange={(v) => {
            const next = v[0];
            if (typeof next === "number") setField("temperature", next);
          }}
          min={0}
          max={2}
          step={0.05}
          {...(disabled !== undefined && { disabled })}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Deterministic</span>
          <span>Creative</span>
        </div>
      </div>

      {/* Reasoning */}
      {reasoningItems.length > 0 && (
        <PillGroup
          label="Reasoning"
          items={reasoningItems}
          selected_ids={
            form_state.reasoning_level ? [form_state.reasoning_level] : []
          }
          on_change={(ids) => {
            const next = ids[0] ?? "";
            setField("reasoning_level", next);
          }}
          multi={false}
          disabled={disabled}
        />
      )}

      {/* Qualities */}
      {qualityItems.length > 0 && (
        <PillGroup
          label="Qualities"
          items={qualityItems}
          selected_ids={form_state.quality_ids}
          on_change={(ids) => setField("quality_ids", ids)}
          multi
          disabled={disabled}
        />
      )}

      {/* Modalities */}
      {modalityItems.length > 0 && (
        <PillGroup
          label="Modalities"
          items={modalityItems}
          selected_ids={form_state.modality_ids}
          on_change={(ids) => setField("modality_ids", ids)}
          multi
          disabled={disabled}
        />
      )}
    </>
  );
}

/** Two-icon segmented toggle: pencil = edit, eye = preview. Active
 *  state is tinted; inactive is muted. Sits flex-right of the
 *  section label and flips that section's render mode. */
interface ModeToggleProps {
  mode: "edit" | "preview";
  on_change: (next: "edit" | "preview") => void;
  disabled?: boolean | undefined;
}

function ModeToggle({ mode, on_change, disabled }: ModeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-md border border-border overflow-hidden">
      <button
        type="button"
        disabled={disabled}
        onClick={() => on_change("edit")}
        className={cn(
          "h-6 w-6 flex items-center justify-center transition-colors",
          mode === "edit"
            ? "bg-primary text-primary-foreground"
            : "bg-background text-muted-foreground hover:bg-muted",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        aria-pressed={mode === "edit"}
        aria-label="Edit"
        title="Edit"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => on_change("preview")}
        className={cn(
          "h-6 w-6 flex items-center justify-center transition-colors",
          mode === "preview"
            ? "bg-primary text-primary-foreground"
            : "bg-background text-muted-foreground hover:bg-muted",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        aria-pressed={mode === "preview"}
        aria-label="Preview"
        title="Preview"
      >
        <Eye className="h-3 w-3" />
      </button>
    </div>
  );
}

interface MarkdownPreviewProps {
  text: string;
  min_height?: number;
}

function MarkdownPreview({ text, min_height }: MarkdownPreviewProps) {
  // Mirrors the Textarea's framing so the preview lands in the same
  // visual slot — same border/padding/text-size — only the input
  // surface swaps for rendered markdown. Empty string still gets a
  // placeholder so the slot doesn't collapse to zero height.
  //
  // ``min-w-0 w-full`` on the wrapper + ``overflow-x-auto`` makes long
  // code blocks scroll horizontally inside the column rather than
  // pushing the column itself wider (which clips at the panel edge in
  // a fixed-width ResizablePanel). Without min-w-0 the wrapper inherits
  // ``min-width: auto`` from the surrounding flex stack, defeating the
  // overflow-auto.
  return (
    <div
      className="rounded-md border border-input bg-muted/20 px-3 py-2 text-sm overflow-x-auto overflow-y-auto min-w-0 w-full [&_pre]:max-w-full [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_code]:break-words"
      style={
        typeof min_height === "number" ? { minHeight: min_height } : undefined
      }
    >
      {text.trim() ? (
        <MarkdownInline>{text}</MarkdownInline>
      ) : (
        <span className="text-muted-foreground italic text-xs">
          (empty — switch to Edit to add content)
        </span>
      )}
    </div>
  );
}

interface PillGroupProps {
  label: string;
  items: NamedItem[];
  selected_ids: string[];
  on_change: (ids: string[]) => void;
  multi: boolean;
  disabled?: boolean | undefined;
}

function PillGroup({
  label,
  items,
  selected_ids,
  on_change,
  multi,
  disabled,
}: PillGroupProps) {
  const isSelected = (id: string) => selected_ids.includes(id);

  const toggle = (id: string) => {
    if (multi) {
      on_change(
        isSelected(id)
          ? selected_ids.filter((x) => x !== id)
          : [...selected_ids, id],
      );
    } else {
      on_change(isSelected(id) ? [] : [id]);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(item.id)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs border transition-colors",
              isSelected(item.id)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-border text-foreground",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
