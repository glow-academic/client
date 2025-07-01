/**
 * delete-audio.ts
 * Used to delete an audio.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiBase } from "@/lib/api-base";
import { logError } from "@/utils/logger";

export interface DeleteAudioParams {
  messageId: string;
  force?: boolean;
}

export interface DeleteAudioResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
}

export async function deleteAudio(
  messageId: string,
  force: boolean = true
): Promise<DeleteAudioResponse> {
  try {
    const url = new URL(`${getApiBase()}/audio/id/${messageId}`);
    if (force) {
      url.searchParams.set("force", "true");
    }

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        `Failed to delete audio: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message || "Audio deleted successfully",
      status: result.status || "success",
    };
  } catch (error) {
    const errorMessage = `Error deleting audio ${messageId}: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
