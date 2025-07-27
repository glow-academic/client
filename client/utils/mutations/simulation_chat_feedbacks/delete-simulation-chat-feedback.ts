// utils/mutations/simulation_chat_feedbacks/delete-simulation-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulationChatFeedback(id: string) {
  try {
    const result = await db
      .delete(simulationChatFeedbacks)
      .where(eq(simulationChatFeedbacks.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error deleting simulationChatFeedback:", error);
    throw error;
  }
}
