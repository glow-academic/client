/**
 * ResourcePanel.tsx
 * Compact resource selectors for test runs — plugs into the document_area slot of GenericChatInterface.
 * Uses GenericPicker directly for lightweight selection without AI/draft/suggestion machinery.
 */
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { GenericPicker } from "@/components/common/forms/GenericPicker";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ResourceSection { show?: boolean; current?: any[]; resources?: any[] }

interface BundleData {
  modalities?: ResourceSection;
  prompts?: ResourceSection;
  instructions?: ResourceSection;
  voices?: ResourceSection;
  temperature_levels?: ResourceSection;
  reasoning_levels?: ResourceSection;
  tools?: ResourceSection;
  qualities?: ResourceSection;
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
  modality_ids: string[];
  prompt_ids: string[];
  instruction_ids: string[];
  voice_ids: string[];
  temperature_level_ids: string[];
  reasoning_level_ids: string[];
  tool_ids: string[];
  quality_ids: string[];
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

// Minimal item shape for GenericPicker
interface PickerItem { id: string; label: string }

// Convert resource arrays to picker items using field mappings
function toItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resources: any[] | undefined,
  idField: string,
  labelField: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  labelTransform?: (val: any) => string,
): PickerItem[] {
  if (!resources) return [];
  return resources
    .filter((r) => r[idField] && r[labelField] != null)
    .map((r) => ({
      id: r[idField] as string,
      label: labelTransform ? labelTransform(r[labelField]) : String(r[labelField]),
    }));
}

// Resource configuration — defines how each section maps to picker items
const RESOURCE_CONFIG = {
  modalities: { idField: "modality_id", labelField: "name", multi: true, label: "Modalities", formKey: "modality_ids" },
  prompts: { idField: "id", labelField: "name", multi: false, label: "Prompt", formKey: "prompt_ids" },
  instructions: { idField: "id", labelField: "template", multi: false, label: "Instructions", formKey: "instruction_ids" },
  voices: { idField: "id", labelField: "voice", multi: true, label: "Voices", formKey: "voice_ids" },
  temperature_levels: { idField: "id", labelField: "temperature", multi: false, label: "Temperature", formKey: "temperature_level_ids", labelTransform: String },
  reasoning_levels: { idField: "id", labelField: "reasoning_level", multi: false, label: "Reasoning", formKey: "reasoning_level_ids", labelTransform: (v: string) => v.charAt(0).toUpperCase() + v.slice(1) },
  tools: { idField: "id", labelField: "name", multi: true, label: "Tools", formKey: "tool_ids" },
  qualities: { idField: "id", labelField: "quality", multi: true, label: "Qualities", formKey: "quality_ids" },
} as const;

type ConfigKey = keyof typeof RESOURCE_CONFIG;

export function ResourcePanel({
  visible,
  bundle_data,
  form_state,
  on_form_change,
  disabled,
}: ResourcePanelProps) {
  if (!visible) return null;

  const sections = bundle_data
    ? (Object.keys(RESOURCE_CONFIG) as ConfigKey[]).filter(
        (key) => bundle_data[key]?.show,
      )
    : [];

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
              <div className="space-y-3 p-4">
                <h3 className="text-sm font-semibold">Agent Resources</h3>

                {sections.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No resources available for this evaluation.
                  </p>
                )}

                {sections.map((key) => {
                  const cfg = RESOURCE_CONFIG[key];
                  const section = bundle_data![key]!;
                  const items = toItems(section.resources, cfg.idField, cfg.labelField, cfg.labelTransform);
                  const formKey = cfg.formKey as keyof BenchmarkBundleFormState;
                  const selectedIds = form_state[formKey];

                  return (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs">{cfg.label}</Label>
                      <GenericPicker<PickerItem>
                        items={items}
                        selectedIds={selectedIds}
                        onSelect={(ids) =>
                          on_form_change((prev) => ({ ...prev, [formKey]: ids }))
                        }
                        multiSelect={cfg.multi}
                        getId={(item) => item.id}
                        getLabel={(item) => item.label}
                        placeholder={`Select ${cfg.label.toLowerCase()}...`}
                        disabled={disabled ?? false}
                        showLabel={false}
                        compact={true}
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </ResizablePanel>
    </>
  );
}
