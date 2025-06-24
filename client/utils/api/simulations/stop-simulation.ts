/**
 * stop-simulation.ts
 * Used to stop a simulation.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError, logInfo } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface StopSimulationParams {
  chatId: string;
}

export interface StopSimulationResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
}

export async function stopSimulation(
  chatId: string
): Promise<StopSimulationResponse> {
  try {
    logInfo(`Stopping simulation for chat ${chatId}`, {
      chatId,
    });

    const formData = new FormData();
    formData.append("chat_id", chatId);

    const response = await fetch(`${getApiUrl()}/simulations/stop`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        `Failed to stop simulation: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
    logInfo(`Simulation stopped successfully`, {
      chatId,
      success: result.success,
    });

    return {
      success: result.success || true,
      message: result.message || "Simulation stopped successfully",
      status: result.status || "success",
    };
  } catch (error) {
    const errorMessage = `Error stopping simulation for chat ${chatId}: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
