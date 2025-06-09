// utils/queries/simulation_chat_rubrics/get-simulation-chat-rubrics-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatRubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatRubricsByRubric(rubricId: string) {
  try {
    return await db.select().from(simulationChatRubrics).where(eq(simulationChatRubrics.rubricId, rubricId));
  } catch (error) {
    console.error("Error fetching simulation_chat_rubrics by rubric:", error);
    throw error;
  }
}
