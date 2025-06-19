// utils/mutations/components/create-component.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { components } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createComponent(data: typeof components.$inferInsert) {
  try {
    const result = await db.insert(components).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating component:", error);
    throw error;
  }
}
