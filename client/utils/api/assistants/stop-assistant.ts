/**
 * stop-assistant.ts
 * Used to stop an assistant.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface StopAssistantParams {
  chat_id: string;
}

export interface StopAssistantResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
}

export async function stopAssistant(
  params: StopAssistantParams
): Promise<StopAssistantResponse> {
  try {
    const formData = new FormData();
    formData.append("chat_id", params.chat_id);

    const response = await fetch(`${getApiUrl()}/assistants/stop`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        errorData.detail ||
        `Failed to stop assistant: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
    return {
      success: result.success || true,
      message: result.message || "Assistant stopped successfully",
      status: result.status || "success",
    };
  } catch (error) {
    const errorMessage = `Error stopping assistant: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
