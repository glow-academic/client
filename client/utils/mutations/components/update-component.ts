// utils/mutations/components/update-component.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { components } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateComponent(id: string, data: Partial<typeof components.$inferInsert>) {
  try {
    const result = await db.update(components).set(data).where(eq(components.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating component:", error);
    throw error;
  }
}
