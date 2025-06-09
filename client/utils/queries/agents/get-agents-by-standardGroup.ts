// utils/queries/agents/get-agents-by-standardGroup.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { agents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAgentsByStandardGroup(standardGroupId: string) {
  try {
    return await db.select().from(agents).where(eq(agents.standardGroupId, standardGroupId));
  } catch (error) {
    console.error("Error fetching agents by standardGroup:", error);
    throw error;
  }
}
