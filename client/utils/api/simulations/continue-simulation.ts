/**
 * continue-simulation.ts
 * Used to continue a simulation.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError, logInfo } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface ContinueSimulationParams {
  chatId: string;
  attemptId: string;
}

export interface ContinueSimulationResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  chat_id?: string;
  simulation_grade_id?: string;
  completed?: boolean;
}

export async function continueSimulation(
  chatId: string,
  attemptId: string
): Promise<ContinueSimulationResponse> {
  try {
    logInfo(
      `Continuing simulation for chat ${chatId} and attempt ${attemptId}`,
      {
        chatId,
        attemptId,
      }
    );

    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("attempt_id", attemptId);

    const response = await fetch(`${getApiUrl()}/simulations/continue`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        `Failed to continue simulation: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
    logInfo(`Simulation continued successfully`, {
      chatId,
      attemptId,
      nextChatId: result.chat_id,
      completed: result.completed,
    });

    return {
      success: true,
      message: result.message || "Simulation continued successfully",
      status: result.status || "success",
      chat_id: result.chat_id,
      simulation_grade_id: result.simulation_grade_id,
      completed: result.completed,
    };
  } catch (error) {
    const errorMessage = `Error continuing simulation for chat ${chatId}: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
