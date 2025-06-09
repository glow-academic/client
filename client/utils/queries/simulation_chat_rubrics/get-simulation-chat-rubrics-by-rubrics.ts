// utils/queries/simulation_chat_rubrics/get-simulation-chat-rubrics-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatRubrics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationChatRubricsByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(simulationChatRubrics).where(inArray(simulationChatRubrics.rubricId, rubricIds));
  } catch (error) {
    console.error("Error fetching simulation_chat_rubrics by rubrics:", error);
    throw error;
  }
}
