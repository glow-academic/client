// Per-resource create factories — build a COMPLETE, valid entity via the API.
//
// A thin wrapper over the backend create contract. `apiCreate` (support/setup.ts)
// seeds `{ name }`; a factory here adds the fields the *edit form* re-validates,
// so the created entity is actually editable (not just creatable). Raw fields
// are passed literally (a persona's color/icon, a model's value); relation
// fields are resolved to a real id from existing seed data via `resolveAnyId`.
//
// A factory therefore lights up only when its seed dependency exists: a rubric
// needs a seed department (there is one — "University"); a model needs a seed
// provider (none yet → model stays name-only until one is seeded). That's by
// design — coverage grows with the dataset, no client-side seeding.
//
// Not yet covered (need backend/seed changes, see e2e-form-determinism-gotchas):
//   agents   — prompt_id required, no seed prompts + no /prompt/create
//   evals    — model_rubric_ids has no standalone resolve endpoint
//   providers— CreateProviderItem has no `value` field to satisfy the edit form
//   settings — color_ids required but there's no /color/search to resolve one
//   profiles — name-only per schema; skip cause under investigation

import { type APIRequestContext } from "@playwright/test";

import { DOMAINS } from "../actions/domains";

const API_BASE = process.env["INTERNAL_API_BASE"] || "http://localhost:8000";
const TOKEN = process.env["GLOW_RECORD_TOKEN"] ?? "";
const authHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${TOKEN}`,
});

/** First existing entity id of a kind, via its search endpoint — for resolving
 *  a relation (e.g. a department for a rubric). Null when the kind has no rows
 *  (the factory then omits that field). */
export async function resolveAnyId(
  request: APIRequestContext,
  kind: string,
): Promise<string | null> {
  const spec = DOMAINS[kind];
  if (!spec) return null;
  try {
    const res = await request.post(`${API_BASE}${spec.api.search}`, {
      headers: authHeaders(),
      data: {},
    });
    if (!res.ok()) return null;
    const body = (await res.json()) as Record<string, unknown>;
    const rows =
      (body[spec.api.listKey] as Array<Record<string, unknown>>) ?? [];
    const id = rows[0]?.[spec.api.idKey];
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/** Builds the create-item fields *beyond* `name` for a complete, editable
 *  entity. Async because some resolve relation ids from seed data. */
export type Factory = (
  request: APIRequestContext,
) => Promise<Record<string, unknown>>;

export const FACTORIES: Record<string, Factory> = {
  // All-raw: the item creates color/icon/instructions resources on the fly.
  persona: async () => ({
    color: "#4F46E5",
    icon: "user",
    instructions: "Stay in character as a curious, friendly student.",
  }),

  // Needs ≥1 department; a seed one ("University") exists.
  rubric: async (request) => {
    const departmentId = await resolveAnyId(request, "department");
    return departmentId ? { department_ids: [departmentId] } : {};
  },

  // value is raw; provider_id resolves a seed provider (none yet → omitted,
  // model stays name-only until a provider is seeded).
  model: async (request) => {
    const providerId = await resolveAnyId(request, "provider");
    return {
      value: `demo-model-${Date.now()}`,
      ...(providerId ? { provider_id: providerId } : {}),
    };
  },

  // Needs ≥1 scenario; scenario_ids resolves a seed scenario.
  simulation: async (request) => {
    const scenarioId = await resolveAnyId(request, "scenario");
    return scenarioId ? { scenario_ids: [scenarioId] } : {};
  },

  // value is raw and the create accepts it, BUT it doesn't resolve into a
  // `value_id` — so the edit form's required "Value *" field loads empty and
  // edit-submit fails. Kept so the create body is correct; provider edit is
  // gated on the backend resolving a raw value → value_id (the same
  // create-doesn't-produce-the-resource-id gap below).
  provider: async () => ({ value: `demo-provider-${Date.now()}` }),
};

// SYSTEMIC BACKEND GAP surfaced by these factories: the create API accepts a
// reference (a relation id, a raw value/color) but does NOT populate the
// resource id the *edit form re-validates*, so a factory-built entity fails on
// edit. Concretely:
//   • rubric→department_ids, (and model→provider_id, simulation→scenario_ids):
//     the create rejects the artifact id with a junction FK error — the
//     `*_junction` wants a `*_resource` id that `/x/search` doesn't expose
//     (same gap as field→conditional-parameters, parameter→fields).
//   • provider `value` (raw) → no `value_id` resolved.
//   • settings color_ids (no /color/search), agents prompt_id (no seed prompts,
//     no /prompt/create), evals model_rubric_ids (no resolve endpoint).
// Only persona's factory works today (color/icon/instructions are raw fields
// the create genuinely resolves on the fly). The rest need backend resolution.
