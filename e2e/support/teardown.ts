// API teardown — reaps entities a test created, via the backend contract.
//
// This is the "self-cleaning" half of the determinism story. It talks to
// the backend's documented REST API directly (NOT the client UI, NOT a
// DB), authenticating with the CLI's real token (GLOW_RECORD_TOKEN — the
// same token `glow record` adopts a browser session from). Because it only
// uses the API contract, swapping the backend out requires zero changes
// here.
//
// Flow per tracked entity: resolve its unique name -> id(s) via the
// domain's search endpoint, then delete by id. Best-effort: teardown must
// never fail a test, so every error is swallowed.

import { type APIRequestContext } from "@playwright/test";

import { DOMAINS } from "../actions/domains";
import type { TrackedEntity } from "./registry";

const API_BASE = process.env["INTERNAL_API_BASE"] || "http://localhost:8000";
const TOKEN = process.env["GLOW_RECORD_TOKEN"] ?? "";

export async function reap(
  request: APIRequestContext,
  entities: TrackedEntity[],
): Promise<void> {
  // Bearer identity only. The backend does not enforce X-Api-Key, so
  // teardown stays minimal and backend-agnostic.
  if (process.env["NO_TEARDOWN"]) return; // debug: leave entities for inspection
  const headers = { Authorization: `Bearer ${TOKEN}` };

  for (const entity of entities) {
    const spec = DOMAINS[entity.kind];
    if (!spec) continue;

    try {
      const found = await request.post(`${API_BASE}${spec.api.search}`, {
        headers,
        data: { search: entity.name },
      });
      if (!found.ok()) continue;

      const body = (await found.json()) as Record<string, unknown>;
      const rows = (body[spec.api.listKey] as Array<Record<string, unknown>>) ?? [];
      const ids = rows
        .filter((row) => row["name"] === entity.name)
        .map((row) => row[spec.api.idKey])
        .filter((id): id is string => typeof id === "string");
      if (ids.length === 0) continue;

      const deleteData = spec.api.deleteBody
        ? spec.api.deleteBody(ids)
        : { ids, all: false, accept: true };
      await request.post(`${API_BASE}${spec.api.delete}`, {
        headers,
        data: deleteData,
      });
    } catch {
      // Cleanup is best-effort — never let it fail the test.
    }
  }
}
