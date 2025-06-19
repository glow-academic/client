// utils/queries/components/get-component.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { components } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getComponent(id: string) {
  try {
    const result = await db.select().from(components).where(eq(components.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching component:", error);
    throw error;
  }
}
