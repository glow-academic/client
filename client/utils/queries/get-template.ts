// utils/queries/get-template.ts
"use server";
import { eq } from "drizzle-orm";
import { templates } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getTemplate(templateId: string) {
  const template = await db
    .select()
    .from(templates)
    .where(eq(templates.id, templateId))
    .limit(1);
  return template[0] || null;
}
