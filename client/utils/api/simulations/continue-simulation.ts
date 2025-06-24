/**
 * continue-simulation.ts
 * Used to continue a simulation.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiUrl } from "../../../lib/utils";

export async function continueSimulation(chatId: string, attemptId: string) {
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("attempt_id", attemptId);

  const response = await fetch(`${getApiUrl()}/simulations/continue`, {
    method: "POST",
    body: formData,
  });
  return response;
}