// utils/mutations/simulation_chat_feedbacks/delete-simulationChatFeedback.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatFeedbacks } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteSimulationChatFeedback(id: string) {
  try {
    const result = await db.delete(simulationChatFeedbacks).where(eq(simulationChatFeedbacks.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting simulationChatFeedback:", error);
    throw error;
  }
}
