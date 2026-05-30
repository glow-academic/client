// API setup — create entities directly via the backend, for test setup.
//
// The mirror image of teardown (support/teardown.ts): where teardown reaps
// by name, this *seeds* a single fresh entity through the documented create
// endpoint — fast, reliable, and not dependent on the UI create flow working.
// It's the "make sure something exists to act on" half of edit / bulk specs.
//
// The create item accepts a raw ``name`` (the backend creates the underlying
// name resource on the fly — see CreatePersonaItem.name in the schema), so a
// minimal create is just ``{ [plural]: [{ name }] }``. Pass ``extra`` for any
// other raw fields a domain needs (e.g. a model's ``value``). Auth + base URL
// match teardown: the CLI's real token (GLOW_RECORD_TOKEN) as a Bearer against INTERNAL_API_BASE.

import { type APIRequestContext } from "@playwright/test";

import { DOMAINS } from "../actions/domains";
import { FACTORIES } from "./factories";

const API_BASE = process.env["INTERNAL_API_BASE"] || "http://localhost:8000";
const TOKEN = process.env["GLOW_RECORD_TOKEN"] ?? "";
const authHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${TOKEN}`,
});

/**
 * Create one entity via ``/{singular}/create`` (path derived from the domain's
 * search endpoint). The item is ``{ name, ...factory, ...extra }`` — a
 * per-resource factory (support/factories.ts) supplies the fields the edit form
 * re-validates (a model's value, a rubric's department, …); ``extra`` lets a
 * caller override or add more. Returns true on a 2xx. The caller should
 * ``registry.track({ kind, name })`` so teardown reaps it. Best-effort: never
 * throws (returns false), so callers skip cleanly when a domain still can't be
 * fully seeded (e.g. a relation with no seed rows).
 */
export async function apiCreate(
  request: APIRequestContext,
  kind: string,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const spec = DOMAINS[kind];
  if (!spec) return false;
  const createPath = spec.api.search.replace(/\/search$/, "/create");
  const factory = FACTORIES[kind];
  const built = factory ? await factory(request) : {};
  try {
    const res = await request.post(`${API_BASE}${createPath}`, {
      headers: authHeaders(),
      data: { [spec.api.listKey]: [{ name, ...built, ...extra }] },
    });
    return res.ok();
  } catch {
    return false;
  }
}

/**
 * Resolve a unique name to its id via the domain's search endpoint — the same
 * resolution teardown uses. Null if not found (e.g. a dormant create that
 * search doesn't surface, or eventual-consistency lag).
 */
export async function resolveId(
  request: APIRequestContext,
  kind: string,
  name: string,
): Promise<string | null> {
  const spec = DOMAINS[kind];
  if (!spec) return null;
  try {
    const res = await request.post(`${API_BASE}${spec.api.search}`, {
      headers: authHeaders(),
      data: { search: name },
    });
    if (!res.ok()) return null;
    const body = (await res.json()) as Record<string, unknown>;
    const rows =
      (body[spec.api.listKey] as Array<Record<string, unknown>>) ?? [];
    const row = rows.find((r) => r["name"] === name);
    const id = row?.[spec.api.idKey];
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}
