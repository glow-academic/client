// Shared CRUD demo flows — the de facto, engine-backed recordings.
//
// These wrap the real DomainFacade engine (the same one the correctness specs
// in e2e/specs/* use): mutating flows actually submit + verify + reap, so a
// demo that "creates" proves creation works (and fails loudly on a domain the
// backend can't yet create — that's the honest signal, not a fill-only mime).
//
// Per-slot demo specs (e2e/demos/{domain}-{verb}.spec.ts) are thin wrappers
// that call these with their domain key, so each doc slot has one canonical,
// correctly-named ({plural}-{verb}) recording. Read-only flows (overview,
// search, draft-to-autosave) don't persist; create/bulk do.

import { expect } from "@playwright/test";

import { test } from "../fixtures";

import { DOMAINS, DomainFacade, type CreateInput } from "../actions/domains";
import { apiCreate, resolveId } from "../support/setup";
import { saveDemoVideo } from "./demo-video";

// The subset of the fixture each flow needs. Specs pass the whole fixture arg.
interface DemoCtx {
  page: import("@playwright/test").Page;
  demo: import("../demo/DemoDriver").DemoDriver;
  registry: import("../support/registry").Registry;
  request: import("@playwright/test").APIRequestContext;
  runId: string;
}

function facadeFor(ctx: DemoCtx, key: string) {
  const spec = DOMAINS[key];
  if (!spec) throw new Error(`Unknown domain "${key}"`);
  return { spec, facade: new DomainFacade(ctx.page, ctx.demo, spec, ctx.registry) };
}

/** Browse the populated library (read-only). Skips when the library is empty. */
export async function overviewDemo(ctx: DemoCtx, key: string): Promise<void> {
  const { spec, facade } = facadeFor(ctx, key);
  test.skip(
    !(await facade.library.openIfPopulated()),
    `${spec.plural} library is empty (no seed data to browse)`,
  );
  await facade.library.browse();
  await saveDemoVideo(ctx.page, `${spec.plural}-overview`);
}

/** Search the library by a token of a real card name (read-only). */
export async function searchDemo(ctx: DemoCtx, key: string): Promise<void> {
  const { spec, facade } = facadeFor(ctx, key);
  test.skip(
    !(await facade.library.openIfPopulated()),
    `${spec.plural} library is empty`,
  );
  test.skip(!(await facade.library.hasSearch()), `${spec.plural} has no search`);
  const name = await facade.library.firstCardName();
  test.skip(!name, `${spec.plural} library is empty`);
  await facade.search(name!.split(/\s+/)[0]!);
  await facade.library.browse();
  await saveDemoVideo(ctx.page, `${spec.plural}-search`);
}

/** Type a name on the new form and let autosave anchor the draft (draftId in
 *  the URL), then open the Drafts picker. No persist beyond the draft. */
export async function draftDemo(ctx: DemoCtx, key: string): Promise<void> {
  const { spec, facade } = facadeFor(ctx, key);
  await facade.form.openNew();
  test.skip(
    !(await facade.form.fillIfPresent("name", `Draft ${spec.singular} ${ctx.runId}`)),
    `${spec.singular} has no fillable name on the new form`,
  );
  await facade.form.waitForDraftSaved();
  test.skip(!(await facade.form.currentDraftId()), `${spec.singular} draft did not anchor`);
  await facade.form.openDraftsPicker().catch(() => undefined);
  await saveDemoVideo(ctx.page, `${spec.plural}-draft`);
}

/** Create the artifact for real (submit + verify + reap), closing on the
 *  populated library. Fails loudly on a domain the backend can't yet create. */
export async function createDemo(
  ctx: DemoCtx,
  key: string,
  input: CreateInput,
  variant?: string,
): Promise<void> {
  const { spec, facade } = facadeFor(ctx, key);
  await facade.open();
  await facade.create(input, variant);
  await facade.open();
  await facade.search(input.name);
  await facade.library.expectVisible(input.name);
  await saveDemoVideo(ctx.page, `${spec.plural}-create${variant ? `-${variant}` : ""}`);
}

/** Seed one row via the factory, open its edit page, change the description,
 *  submit, and assert the "updated" toast. Reaped by name. */
export async function editDemo(ctx: DemoCtx, key: string): Promise<void> {
  const { spec, facade } = facadeFor(ctx, key);
  const name = `Edit ${spec.singular} ${ctx.runId}`;
  test.skip(!(await apiCreate(ctx.request, key, name)), `${spec.singular} not API-creatable`);
  ctx.registry.track({ kind: key, name });
  const id = await resolveId(ctx.request, key, name);
  test.skip(!id, `could not resolve the created ${spec.singular}`);
  await facade.form.openEdit(`${spec.listPath}/${id}`);
  test.skip(
    !(await facade.form.fillIfPresent("description", `Edited by e2e ${ctx.runId}.`)),
    `${spec.singular} has no editable description`,
  );
  await facade.form.waitForDraftSaved();
  await facade.form.submit();
  await expect(ctx.page.getByText(/updated/i).first()).toBeVisible({ timeout: 45_000 });
  await saveDemoVideo(ctx.page, `${spec.plural}-edit`);
}

/** Seed two rows via the factory, select them, and bulk-delete for real
 *  (toolbar → dialog → confirm → verify gone). Skips if it can't seed two. */
export async function bulkDeleteDemo(ctx: DemoCtx, key: string): Promise<void> {
  const { spec, facade } = facadeFor(ctx, key);
  const names = [`Bulk ${spec.singular} A ${ctx.runId}`, `Bulk ${spec.singular} B ${ctx.runId}`];
  const ids: string[] = [];
  for (const name of names) {
    if (!(await apiCreate(ctx.request, key, name))) break;
    ctx.registry.track({ kind: key, name });
    const id = await resolveId(ctx.request, key, name);
    if (id) ids.push(id);
  }
  test.skip(ids.length < 2, `could not seed two ${spec.plural}`);
  await facade.library.openSelected(ids);
  await facade.library.bulkDelete();
  await facade.open();
  await facade.search(names[0]!);
  await expect(facade.card(names[0]!)).toHaveCount(0);
  await saveDemoVideo(ctx.page, `${spec.plural}-bulk`);
}
