"use server";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";

type BulkArchiveAttemptsIn = InputOf<"/api/v3/attempts/bulk-archive", "post">;
type BulkArchiveAttemptsOut = OutputOf<"/api/v3/attempts/bulk-archive", "post">;

export async function bulkArchiveAttempts(
  input: BulkArchiveAttemptsIn
): Promise<BulkArchiveAttemptsOut> {
  return api.post("/attempts/bulk-archive", input);
}
