/**
 * start-assistant.ts
 * Used to start an assistant.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface StartAssistantParams {
  initial_message: string;
  chat_id: string;
}

export interface StartAssistantResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  chat_id?: string;
}

export async function startAssistant(
  params: StartAssistantParams
): Promise<StartAssistantResponse> {
  try {
    const formData = new FormData();
    formData.append("initial_message", params.initial_message);
    formData.append("chat_id", params.chat_id);

    const response = await fetch(`${getApiUrl()}/assistants/start`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        errorData.detail ||
        `Failed to start assistant: ${response.status} ${response.statusText}`;
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
      message: result.message || "Assistant started successfully",
      status: result.status || "success",
      chat_id: result.chat_id,
    };
  } catch (error) {
    const errorMessage = `Error starting assistant: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
