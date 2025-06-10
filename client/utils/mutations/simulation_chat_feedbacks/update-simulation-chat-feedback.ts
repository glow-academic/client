// utils/mutations/simulation_chat_feedbacks/update-simulation-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatFeedbacks } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateSimulationChatFeedback(id: string, data: Partial<typeof simulationChatFeedbacks.$inferInsert>) {
  try {
    const result = await db.update(simulationChatFeedbacks).set(data).where(eq(simulationChatFeedbacks.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating simulationChatFeedback:", error);
    throw error;
  }
}
