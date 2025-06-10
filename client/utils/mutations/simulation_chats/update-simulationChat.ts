// utils/mutations/simulation_chats/update-simulationChat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

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
    console.error("Error updating simulationChat:", error);
    throw error;
  }
}
