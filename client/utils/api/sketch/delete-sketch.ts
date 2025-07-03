/**
 * delete-sketch.ts
 * Used to delete a sketch.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiBase } from "@/lib/api-base";
import { logError } from "@/utils/logger";

export interface DeleteSketchParams {
  sketchId: string;
  force?: boolean;
}

export interface DeleteSketchResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
}

export async function deleteSketch(
  sketchId: string,
  force: boolean = true
): Promise<DeleteSketchResponse> {
  try {
    const url = new URL(`${getApiBase()}/sketch/id/${sketchId}`);
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
        `Failed to delete sketch: ${response.status} ${response.statusText}`;
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
      message: result.message || "Sketch deleted successfully",
      status: result.status || "success",
    };
  } catch (error) {
    const errorMessage = `Error deleting sketch ${sketchId}: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
