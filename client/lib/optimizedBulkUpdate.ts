import { db as drizzleDb } from "@/utils/drizzle/db";
import { HttpError } from "@/utils/HttpError";
import { eq, inArray, sql } from "drizzle-orm";

// Generic optimized bulk update utilities
export class OptimizedBulkUpdate {
  private static readonly BATCH_SIZE = 1000; // Process in chunks to avoid memory issues

  /**
   * Optimized bulk update using transactions and batching
   * For updates where each record has different field values
   */
  static async updateManyWithTransaction<T extends { id: string }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any,
    updates: Array<{ id: string } & Record<string, unknown>>,
    entityName: string
  ): Promise<T[]> {
    const db = await this.getDb();

    if (!Array.isArray(updates) || updates.length === 0) return [];

    // Process in batches to avoid memory issues
    const results: T[] = [];
    for (let i = 0; i < updates.length; i += this.BATCH_SIZE) {
      const batch = updates.slice(i, i + this.BATCH_SIZE);

      const batchResults = await db.transaction(async (tx) => {
        const batchPromises = batch.map(async (update) => {
          const { id, ...patch } = update;
          const rows = await tx
            .update(table)
            .set(patch)
            .where(eq(table.id, id))
            .returning();

          if (!rows[0]) {
            throw HttpError.notFound(`${entityName} with id ${id} not found`);
          }
          return rows[0] as T;
        });

        return Promise.all(batchPromises);
      });

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * SQL-based bulk update for same-field updates
   * Much more efficient when updating the same field(s) for multiple records
   */
  static async updateManyWithSQL<T extends { id: string }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any,
    updates: Array<{ id: string } & Record<string, unknown>>,
    entityName: string
  ): Promise<T[]> {
    const db = await this.getDb();

    if (!Array.isArray(updates) || updates.length === 0) return [];

    // Group updates by field combinations for SQL optimization
    const fieldGroups = new Map<
      string,
      Array<{ id: string; values: Record<string, unknown> }>
    >();

    updates.forEach((update) => {
      const { id, ...fields } = update;
      const fieldKey = Object.keys(fields).sort().join(",");

      if (!fieldGroups.has(fieldKey)) {
        fieldGroups.set(fieldKey, []);
      }
      fieldGroups.get(fieldKey)!.push({ id, values: fields });
    });

    const results: T[] = [];

    for (const [, group] of fieldGroups) {
      if (group.length === 1) {
        // Single update - use regular update
        const firstGroup = group[0];
        if (!firstGroup) continue;

        const { id, values } = firstGroup;
        const rows = await db
          .update(table)
          .set(values)
          .where(eq(table.id, id))
          .returning();

        if (!rows[0]) {
          throw HttpError.notFound(`${entityName} with id ${id} not found`);
        }
        results.push(rows[0] as T);
      } else {
        // Multiple updates with same fields - use SQL CASE WHEN
        const ids = group.map((item) => item.id);
        const firstItem = group[0];
        if (!firstItem) continue;

        const fields = Object.keys(firstItem.values);

        // Build CASE WHEN statements for each field
        const caseStatements = fields
          .map((field) => {
            const cases = group
              .map(
                (item) => `WHEN id = '${item.id}' THEN '${item.values[field]}'`
              )
              .join(" ");
            return `${field} = CASE ${cases} ELSE ${field} END`;
          })
          .join(", ");

        const rows = await db
          .update(table)
          .set(sql.raw(caseStatements))
          .where(inArray(table.id, ids))
          .returning();

        results.push(...(rows as T[]));
      }
    }

    return results;
  }

  /**
   * Hybrid approach - use SQL for same-field updates, transactions for mixed updates
   */
  static async updateManyOptimized<T extends { id: string }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any,
    updates: Array<{ id: string } & Record<string, unknown>>,
    entityName: string
  ): Promise<T[]> {
    if (!Array.isArray(updates) || updates.length === 0) return [];

    // Check if all updates have the same field structure
    const firstUpdate = updates[0];
    if (!firstUpdate) return [];

    const firstFields = Object.keys(firstUpdate)
      .filter((k) => k !== "id")
      .sort();
    const allSameFields = updates.every((update) => {
      const fields = Object.keys(update)
        .filter((k) => k !== "id")
        .sort();
      return JSON.stringify(fields) === JSON.stringify(firstFields);
    });

    if (allSameFields && updates.length > 5) {
      // Use SQL-based approach for same-field updates with multiple records
      return this.updateManyWithSQL(table, updates, entityName);
    } else {
      // Use transaction-based approach for mixed updates
      return this.updateManyWithTransaction(table, updates, entityName);
    }
  }

  private static async getDb() {
    return drizzleDb;
  }
}
