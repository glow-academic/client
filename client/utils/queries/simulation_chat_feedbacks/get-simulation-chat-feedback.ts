// utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatFeedbacks } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationChatFeedback(id: string) {
  try {
    const result = await db.select().from(simulationChatFeedbacks).where(eq(simulationChatFeedbacks.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching simulationChatFeedback:", error);
    throw error;
  }
}
