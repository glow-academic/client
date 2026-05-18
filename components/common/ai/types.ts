/** Typed operation reference — matches server's TypeItem (name + operation). */
export interface TypeItem {
  name: string;
  operation: string;
}

/** Tab selector for the generation panel. */
export type PanelTab = "artifacts" | "resources" | "entries";

/** Flat representation of a single message from a group run. */
export interface GroupMessage {
  message_id: string | null;
  run_id: string | null;
  role: string | null;
  message_created_at: string | null;
  text_ids: string[] | null;
  audio_ids: string[] | null;
  image_ids: string[] | null;
  video_ids: string[] | null;
  file_ids: string[] | null;
  call_ids: string[] | null;
}
