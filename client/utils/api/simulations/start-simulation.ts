/**
 * start-simulation.ts
 * Used to start a simulation.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError, logInfo } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface StartSimulationParams {
  simulationId: string;
  profileId?: string;
}

export interface StartSimulationResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  attempt_id?: string;
  chat_id?: string;
}

export async function startSimulation(
  params: StartSimulationParams
): Promise<StartSimulationResponse> {
  try {
    logInfo(`Starting simulation ${params.simulationId}`, {
      simulationId: params.simulationId,
      profileId: params.profileId,
    });

    const formData = new FormData();
    formData.append("simulation_id", params.simulationId);
    formData.append("profile_id", params.profileId || "");

    const response = await fetch(`${getApiUrl()}/simulations/start`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        `Failed to start simulation: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
    logInfo(`Simulation started successfully`, {
      simulationId: params.simulationId,
      attemptId: result.attempt_id,
      chatId: result.chat_id,
    });

    return {
      success: true,
      message: result.message || "Simulation started successfully",
      status: result.status || "success",
      attempt_id: result.attempt_id,
      chat_id: result.chat_id,
    };
  } catch (error) {
    const errorMessage = `Error starting simulation ${params.simulationId}: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
