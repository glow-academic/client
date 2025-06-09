// utils/queries/documents/get-documents-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getDocumentsByClass(classIds: string[]) {
  try {
    return await db.select().from(documents).where(inArray(documents.class_id, classIds));
  } catch (error) {
    console.error("Error fetching documents by class:", error);
    throw error;
  }
}
