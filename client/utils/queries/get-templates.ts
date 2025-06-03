// utils/queries/get-templates.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { templates } from "@/drizzle/schema";

export async function getTemplates() {
  const fetchedTemplates = await db.select().from(templates);
  return fetchedTemplates;
}
