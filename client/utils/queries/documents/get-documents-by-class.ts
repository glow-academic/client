// utils/queries/documents/get-documents-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getDocumentsByClass(classId: string) {
  try {
    return await db.select().from(documents).where(eq(documents.classId, classId));
  } catch (error) {
    console.error("Error fetching documents by class:", error);
    throw error;
  }
}
