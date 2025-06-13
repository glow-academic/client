// utils/queries/standards/get-standard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getStandard(id: string) {
  try {
    const result = await db.select().from(standards).where(eq(standards.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching standard:", error);
    throw error;
  }
}
