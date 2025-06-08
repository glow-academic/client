"use server";
import { documents, documentType } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

type DocumentType = (typeof documentType.enumValues)[number];

export async function updateDocument(id: string, name?: string, filePath?: string, mimeType?: string,classId?: string, type?: DocumentType, classified?: boolean) {
  try {
    const updatedDocument = await db
      .update(documents)
      .set({
        name,
        type,
        classId,
        filePath,
        mimeType,
        classified,
      })
      .where(eq(documents.id, id))
      .returning();

    if (updatedDocument.length === 0) {
      return { success: false, error: "Document not found" };
    }

    return { success: true, document: updatedDocument[0], error: "" };
  } catch (error) {
    console.error("Error updating document:", error);
    return { success: false, error: "Failed to update document" };
  }
} 