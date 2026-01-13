/**
 * NewModel.tsx
 * Separate component for new model creation (maintains compatibility)
 * Follows Persona.tsx patterns - uses unified get/save endpoints
 * @AshokSaravanan222
 * 01/13/2026
 */
"use client";

import type {
  GetModelOut,
  PatchModelDraftIn,
  PatchModelDraftOut,
  SaveModelIn,
  SaveModelOut,
} from "@/app/(main)/engine/models/new/page";
import Model from "./Model";

export interface NewModelProps {
  // Server-provided data (for server-side rendering)
  modelData?: GetModelOut;
  // Server actions (replaces useMutation)
  saveModelAction?: (input: SaveModelIn) => Promise<SaveModelOut>;
  patchModelDraftAction?: (
    input: PatchModelDraftIn
  ) => Promise<PatchModelDraftOut>;
}

/**
 * NewModel component - wrapper around Model.tsx for new model creation
 * Uses unified get/save endpoints (model_id = null for new mode)
 */
export default function NewModel({
  modelData,
  saveModelAction,
  patchModelDraftAction,
}: NewModelProps) {
  // Pass props to Model component (modelId is undefined for new mode)
  return (
    <Model
      modelDetailDefault={modelData}
      saveModelAction={saveModelAction}
      patchModelDraftAction={patchModelDraftAction}
    />
  );
}
