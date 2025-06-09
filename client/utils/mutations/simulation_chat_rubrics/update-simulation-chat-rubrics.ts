// utils/mutations/simulation_chat_rubrics/update-simulation-chat-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatRubrics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateSimulationChatRubrics(ids: string[], data: Partial<typeof simulationChatRubrics.$inferInsert>) {
  try {
    return await db.update(simulationChatRubrics).set(data).where(inArray(simulationChatRubrics.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple simulation_chat_rubrics:", error);
    throw error;
  }
}
