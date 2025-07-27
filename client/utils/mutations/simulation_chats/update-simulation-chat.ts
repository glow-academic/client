// utils/mutations/simulation_chats/update-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSimulationChat(
  id: string,
  data: Partial<typeof simulationChats.$inferInsert>,
) {
  try {
    const result = await db
      .update(simulationChats)
      .set(data)
      .where(eq(simulationChats.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error updating simulationChat:", error);
    throw error;
  }
}
