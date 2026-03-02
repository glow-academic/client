/**
 * ResourcePanel.tsx
 * Editable agent resource selectors — plugs into the document_area slot of GenericChatInterface.
 * Wraps resource components from @/components/resources/ in a scrollable resizable panel.
 */
"use client";

import { ResizablePanel } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Models } from "@/components/resources/Models";
import { Prompts } from "@/components/resources/Prompts";
import { Instructions } from "@/components/resources/Instructions";
import { Voices } from "@/components/resources/Voices";
import { TemperatureLevels } from "@/components/resources/TemperatureLevels";
import { ReasoningLevels } from "@/components/resources/ReasoningLevels";
import { Tools } from "@/components/resources/Tools";
import { Keys } from "@/components/resources/Keys";

// Bundle data shape — matches the invocation/get response.
// Typed as a scaffold interface since the invocation OpenAPI route
// isn't fully typed yet. Each resource section has { show, current, resources }.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ResourceSection { show?: boolean; current?: any[]; resources?: any[] }
interface BundleData {
  models?: ResourceSection;
  prompts?: ResourceSection;
  instructions?: ResourceSection;
  voices?: ResourceSection;
  temperature_levels?: ResourceSection;
  reasoning_levels?: ResourceSection;
  tools?: ResourceSection;
  keys?: ResourceSection;
}

export interface ResourcePanelProps {
  visible: boolean;
  bundle_data: BundleData | null;
  form_state: BenchmarkBundleFormState;
  on_form_change: (updater: (prev: BenchmarkBundleFormState) => BenchmarkBundleFormState) => void;
  disabled?: boolean;
}

export type BenchmarkBundleFormState = {
  department_ids: string[];
  model_ids: string[];
  prompt_ids: string[];
  instruction_ids: string[];
  voice_ids: string[];
  temperature_level_ids: string[];
  reasoning_level_ids: string[];
  tool_ids: string[];
  key_ids: string[];
};

export function extractIds<T>(
  items: T[] | null | undefined,
  idKey: keyof T,
): string[] {
  if (!items) return [];
  return items
    .map((item) => item[idKey] as string | null | undefined)
    .filter((id): id is string => !!id);
}

export function ResourcePanel({
  visible,
  bundle_data,
  form_state,
  on_form_change,
  disabled,
}: ResourcePanelProps) {
  if (!visible || !bundle_data) return null;

  const s = bundle_data;

  return (
    <ResizablePanel
      defaultSize={30}
      minSize={20}
      maxSize={50}
      className="hidden md:block"
    >
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          <h3 className="text-sm font-semibold">Agent Resources</h3>

          {s.models?.show && (
            <Models
              model_id={form_state.model_ids[0] ?? null}
              model_resource={s.models.current?.[0] ?? null}
              show_models={s.models.show}
              models={s.models.resources ?? []}
              disabled={disabled ?? false}
              onModelIdChange={(id: string | null) =>
                on_form_change((prev) => ({
                  ...prev,
                  model_ids: id ? [id] : [],
                }))
              }
              label="Model"
            />
          )}

          {s.prompts?.show && (
            <Prompts
              prompt_id={form_state.prompt_ids[0] ?? null}
              prompt_resource={s.prompts.current?.[0] ?? null}
              show_prompts={s.prompts.show}
              prompts={s.prompts.resources ?? []}
              disabled={disabled ?? false}
              onPromptIdChange={(id: string | null) =>
                on_form_change((prev) => ({
                  ...prev,
                  prompt_ids: id ? [id] : [],
                }))
              }
              label="Prompt"
            />
          )}

          {s.instructions?.show && (
            <Instructions
              instructions_id={form_state.instruction_ids[0] ?? null}
              show_instructions={s.instructions.show}
              instructions={s.instructions.resources ?? []}
              disabled={disabled ?? false}
              onInstructionsIdChange={(id: string | null) =>
                on_form_change((prev) => ({
                  ...prev,
                  instruction_ids: id ? [id] : [],
                }))
              }
              label="Instructions"
            />
          )}

          {s.voices?.show && (
            <Voices
              voice_ids={form_state.voice_ids}
              voice_resources={s.voices.current ?? []}
              show_voices={s.voices.show}
              voices={s.voices.resources ?? []}
              disabled={disabled ?? false}
              onVoiceIdsChange={(ids) =>
                on_form_change((prev) => ({ ...prev, voice_ids: ids }))
              }
              label="Voices"
            />
          )}

          {s.temperature_levels?.show && (
            <TemperatureLevels
              temperature_level_id={form_state.temperature_level_ids[0] ?? null}
              temperature_level_resource={
                s.temperature_levels.current?.[0] ?? null
              }
              show_temperature_levels={s.temperature_levels.show}
              temperature_levels={s.temperature_levels.resources ?? []}
              disabled={disabled ?? false}
              onTemperatureLevelIdChange={(id: string | null) =>
                on_form_change((prev) => ({
                  ...prev,
                  temperature_level_ids: id ? [id] : [],
                }))
              }
            />
          )}

          {s.reasoning_levels?.show && (
            <ReasoningLevels
              reasoning_level_id={form_state.reasoning_level_ids[0] ?? null}
              reasoning_level_resource={
                s.reasoning_levels.current?.[0] ?? null
              }
              show_reasoning_levels={s.reasoning_levels.show}
              reasoning_levels={s.reasoning_levels.resources ?? []}
              disabled={disabled ?? false}
              onReasoningLevelIdChange={(id: string | null) =>
                on_form_change((prev) => ({
                  ...prev,
                  reasoning_level_ids: id ? [id] : [],
                }))
              }
            />
          )}

          {s.tools?.show && (
            <Tools
              tool_ids={form_state.tool_ids}
              tool_resources={s.tools.current ?? []}
              show_tools={s.tools.show}
              tools={s.tools.resources ?? []}
              disabled={disabled ?? false}
              onChange={(ids) =>
                on_form_change((prev) => ({ ...prev, tool_ids: ids }))
              }
            />
          )}

          {s.keys?.show && (
            <Keys
              key_id={form_state.key_ids[0] ?? null}
              key_resource={s.keys.current?.[0] ?? null}
              show_key={s.keys.show}
              keys={s.keys.resources ?? []}
              disabled={disabled ?? false}
              onKeyIdChange={(id: string | null) =>
                on_form_change((prev) => ({
                  ...prev,
                  key_ids: id ? [id] : [],
                }))
              }
            />
          )}
        </div>
      </ScrollArea>
    </ResizablePanel>
  );
}
