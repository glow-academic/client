// utils/mutations/simulation_chats/create-simulationChat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";

export async function createSimulationChat(
  data: typeof simulationChats.$inferInsert,
) {
  try {
    const result = await db.insert(simulationChats).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating simulationChat:", error);
    throw error;
  }
}
