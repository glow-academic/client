// utils/mutations/simulation_chats/delete-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulationChat(id: string) {
  try {
    const result = await db
      .delete(simulationChats)
      .where(eq(simulationChats.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error deleting simulationChat:", error);
    throw error;
  }
}
