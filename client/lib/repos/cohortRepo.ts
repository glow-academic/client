
import { createInsertSchema } from "drizzle-zod";
import { eq } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type Cohort = typeof cohorts.$inferSelect;
export type CohortCreate = typeof cohorts.$inferInsert;
export type CohortUpdate = Partial<CohortCreate>;

// Schemas derived from Drizzle table
export const CohortCreateSchema = createInsertSchema(cohorts);
export const CohortUpdateSchema = CohortCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const cohortRepo = {
  async create(payload: CohortCreate) {
    const db = await getDb();
    const rows = await db.insert(cohorts).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(cohorts).orderBy(cohorts.createdAt ?? cohorts.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db.select().from(cohorts).where(eq(cohorts.id, id)).limit(1);
    if (!rows[0]) throw HttpError.notFound("Cohort with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: CohortUpdate) {
    const db = await getDb();
    const rows = await db.update(cohorts).set(patch).where(eq(cohorts.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("Cohort with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db.delete(cohorts).where(eq(cohorts.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("Cohort with id " + id + " not found");
  },


};