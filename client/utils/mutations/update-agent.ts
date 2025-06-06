"use server";
import { agents } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function updateAgent(id: string, name?: string, subtitle?: string, description?: string, prompt?: string, threshold?: number) {
  try {
    await db
      .update(agents)
      .set({ name, subtitle, description, prompt, threshold: threshold || 50 })
      .where(eq(agents.id, id));
    return { success: true, error: "" };
  } catch (error) {
    return { success: false, error: "Failed to update agent" };
  }
}
