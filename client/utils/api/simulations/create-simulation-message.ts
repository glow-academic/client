/**
 * create-simulation-message.ts
 * Used to create a message in a simulation.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError, logInfo } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface CreateSimulationMessageParams {
  chatId: string;
  message: string;
}

export interface CreateSimulationMessageResponse {
  success: boolean;
  message: string;
  status?: "success" | "error" | "processing";
  message_id?: string;
}

export async function createSimulationMessage(
  chatId: string,
  message: string
): Promise<CreateSimulationMessageResponse> {
  try {
    logInfo(`Creating simulation message for chat ${chatId}`, {
      chatId,
      messageLength: message.length,
    });

    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("message", message);

    const response = await fetch(`${getApiUrl()}/simulations/message`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        `Failed to create simulation message: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
    logInfo(`Simulation message created successfully`, {
      chatId,
      status: result.status,
    });

    return {
      success: true,
      message: result.message || "Message is being processed",
      status: result.status || "processing",
      message_id: result.message_id,
    };
  } catch (error) {
    const errorMessage = `Error creating simulation message for chat ${chatId}: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
