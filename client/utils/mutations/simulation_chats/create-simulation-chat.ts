// utils/mutations/simulation_chats/create-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSimulationChat(data: typeof simulationChats.$inferInsert) {
  try {
    const result = await db.insert(simulationChats).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating simulationChat:", error);
    throw error;
  }
}
