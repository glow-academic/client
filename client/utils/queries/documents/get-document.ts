// utils/queries/documents/get-document.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getDocument(id: string) {
  try {
    const result = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching document:", error);
    throw error;
  }
}
