/**
 * create-simulation-message.ts
 * Used to create a message in a simulation.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiUrl } from "../../../lib/utils";

export async function createSimulationMessage(chatId: string, message: string) {
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("message", message);

  const response = await fetch(`${getApiUrl()}/simulations/message`, {
    method: "POST",
    body: formData,
  });
  return response;
}
