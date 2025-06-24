/**
 * start-simulation.ts
 * Used to start a simulation.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface StartSimulationParams {
  simulationId: string;
  profileId: string | undefined;
}

export interface StartSimulationResponse {
  success: boolean;
  message: string;
  attempt_id: string;
}

export async function startSimulation(params: StartSimulationParams): Promise<StartSimulationResponse> {
    try {
        const formData = new FormData();
        formData.append("simulation_id", params.simulationId);

        if (params.profileId) {
            formData.append("profile_id", params.profileId);
        }

        const response = await fetch(`${getApiUrl()}/simulations/start`, {
            method: "POST",
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    } catch (error) {
        logError(`Error starting simulation: ${error}`);
        throw error;
    }
}