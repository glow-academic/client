// utils/queries/rubrics/get-all-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubrics } from "@/drizzle/schema";

export async function getAllRubrics() {
  try {
    return await db.select().from(rubrics);
  } catch (error) {
    console.error("Error fetching all rubrics:", error);
    throw error;
  }
}
