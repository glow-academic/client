// utils/queries/rubrics/get-rubrics-by-id.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getRubricsById(idId: string) {
  try {
    return await db.select().from(rubrics).where(eq(rubrics.id, idId));
  } catch (error) {
    console.error("Error fetching rubrics by id:", error);
    throw error;
  }
}
