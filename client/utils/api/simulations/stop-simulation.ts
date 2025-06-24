/**
 * stop-simulation.ts
 * Used to stop a simulation.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiUrl } from "../../../lib/utils";

export async function stopSimulation(chatId: string) {
  const formData = new FormData();
  formData.append("chat_id", chatId);

  const response = await fetch(`${getApiUrl()}/simulations/stop`, {
    method: "POST",
    body: formData,
  });
  return response;
}
