// utils/queries/documents/get-documents-by-class.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getDocumentsByClass(classIds: string[]) {
  try {
    return await db.select().from(documents).where(inArray(documents.classId, classIds));
  } catch (error) {
    logError("Error fetching documents by class:", error);
    throw error;
  }
}
