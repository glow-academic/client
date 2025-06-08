// utils/queries/get-documents.ts
"use server";
import { documents } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function getDocuments(classId: string) {
  const fetchedDocuments = await db.select().from(documents).where(eq(documents.classId, classId));
  return fetchedDocuments;
}
