// utils/queries/documents/get-document.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getDocument(id: string) {
  try {
    const result = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching document:", error);
    throw error;
  }
}
