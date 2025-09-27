
import { createInsertSchema } from "drizzle-zod";
import { eq } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { migrations } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type Migration = typeof migrations.$inferSelect;
export type MigrationCreate = typeof migrations.$inferInsert;
export type MigrationUpdate = Partial<MigrationCreate>;

// Schemas derived from Drizzle table
export const MigrationCreateSchema = createInsertSchema(migrations);
export const MigrationUpdateSchema = MigrationCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const migrationRepo = {
  async create(payload: MigrationCreate) {
    const db = await getDb();
    const rows = await db.insert(migrations).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(migrations).orderBy(migrations.createdAt ?? migrations.id);
  },
  async find(id: number) {
    const db = await getDb();
    const rows = await db.select().from(migrations).where(eq(migrations.id, id)).limit(1);
    if (!rows[0]) throw HttpError.notFound("Migration with id " + id + " not found");
    return rows[0];
  },

  async update(id: number, patch: MigrationUpdate) {
    const db = await getDb();
    const rows = await db.update(migrations).set(patch).where(eq(migrations.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("Migration with id " + id + " not found");
    return rows[0];
  },

  async remove(id: number) {
    const db = await getDb();
    const rows = await db.delete(migrations).where(eq(migrations.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("Migration with id " + id + " not found");
  },


};