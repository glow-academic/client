// utils/queries/rubrics/get-rubrics-by-ids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubrics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getRubricsByIds(idIds: string[]) {
  try {
    return await db.select().from(rubrics).where(inArray(rubrics.id, idIds));
  } catch (error) {
    console.error("Error fetching rubrics by ids:", error);
    throw error;
  }
}
