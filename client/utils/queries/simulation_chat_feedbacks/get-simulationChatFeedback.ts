// utils/queries/simulation_chat_feedbacks/get-simulationChatFeedback.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatFeedbacks } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatFeedback(id: string) {
  try {
    const result = await db
      .select()
      .from(simulationChatFeedbacks)
      .where(eq(simulationChatFeedbacks.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching simulationChatFeedback:", error);
    throw error;
  }
}
