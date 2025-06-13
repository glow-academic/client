// utils/queries/classes/get-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { classes } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getClass(id: string) {
  try {
    const result = await db.select().from(classes).where(eq(classes.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching class:", error);
    throw error;
  }
}
