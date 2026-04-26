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

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Label } from "@/components/ui/label";
import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";

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

export interface ResourcePanelProps {
  visible: boolean;
  form_state: AgentConfigFormState;
  on_form_change: (
    updater: (prev: AgentConfigFormState) => AgentConfigFormState,
  ) => void;
  // Picker option sources — server-provided resource maps.
  tools?: ResourceMap | null | undefined;
  qualities?: ResourceMap | null | undefined;
  modalities?: ResourceMap | null | undefined;
  reasoning_levels?: ResourceMap | null | undefined;
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
  form_state,
  on_form_change,
  tools,
  qualities,
  modalities,
  reasoning_levels,
  disabled,
}: ResourcePanelProps) {
  if (!visible) return null;

  const toolItems = toItems(tools, "name");
  const qualityItems = toItems(qualities, "quality");
  const modalityItems = toItems(modalities, "name");
  const reasoningItems = toItems(reasoning_levels, "reasoning_level");

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
              <div className="space-y-5 p-4">
                <h3 className="text-sm font-semibold">Agent Resources</h3>

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
                  <Label className="text-xs">Prompt</Label>
                  <Textarea
                    value={form_state.prompt_text}
                    onChange={(e) => setField("prompt_text", e.target.value)}
                    placeholder="System prompt for the agent..."
                    disabled={disabled}
                    className="min-h-[80px] text-sm"
                  />
                </div>

                {/* Instructions */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Instructions</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={addInstruction}
                      disabled={disabled}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form_state.instructions.map((value, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <Textarea
                          value={value}
                          onChange={(e) => setInstruction(i, e.target.value)}
                          placeholder={`Instruction ${i + 1}`}
                          disabled={disabled}
                          className="min-h-[60px] text-sm flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 mt-0.5"
                          onClick={() => removeInstruction(i)}
                          disabled={disabled || form_state.instructions.length <= 1}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
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
                      if (typeof next === "number")
                        setField("temperature", next);
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
                      form_state.reasoning_level
                        ? [form_state.reasoning_level]
                        : []
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
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </ResizablePanel>
    </>
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
