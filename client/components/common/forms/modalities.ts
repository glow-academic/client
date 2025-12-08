/**
 * Modality definitions for model input/output
 * Extracted from ModalityPicker for reuse
 */

export const MODALITIES = [
  { id: "text", name: "Text" },
  { id: "audio", name: "Audio" },
  { id: "video", name: "Video" },
  { id: "image", name: "Image" },
] as const;

export type Modality = (typeof MODALITIES)[number]["id"];
