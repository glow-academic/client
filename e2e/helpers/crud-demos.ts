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
import { resolveAnyId } from "../support/factories";
import { expectAuthenticated, openGenerationPanel, scrollToText } from "./demo-page";
import { saveDemoVideo } from "./demo-video";
import { exerciseListView } from "./exercise-list";

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

/** Browse the populated library (read-only). Skips when the library is empty.
 *
 *  `afterBrowse` runs once the loaded grid is on screen and browsed — to
 *  exercise the list's interactive affordances — BEFORE the video is saved (the
 *  save closes the page, so any extra interaction has to happen first).
 *
 *  DEFAULT: when no `afterBrowse` is supplied, it defaults to
 *  `exerciseListView(page)` — the shared helper that drives search / faceted
 *  filter / card-View toggle / pagination / page-size, each step independently
 *  GUARDED (visible()/count() bail) so a control the page lacks is skipped, not
 *  failed. This makes every overviewDemo-based demo exercise the interactive
 *  paths on camera with no per-spec wiring. Non-list overviews (dashboard /
 *  health / home / generation / practice / session / pricing / reports) have no
 *  search box / filters / pagination, so all five steps skip cleanly there — the
 *  default is safe across the board.
 *
 *  A caller MAY still pass its own `afterBrowse` to override (e.g. tuned opts);
 *  the caller's hook WINS — it replaces the default rather than composing, so
 *  there's never a double-invocation. Pass `async () => {}` to opt out entirely. */
export async function overviewDemo(
  ctx: DemoCtx,
  key: string,
  afterBrowse: (page: DemoCtx["page"]) => Promise<void> = (page) => exerciseListView(page),
): Promise<void> {
  const { spec, facade } = facadeFor(ctx, key);
  test.skip(
    !(await facade.library.openIfPopulated()),
    `${spec.plural} library is empty (no seed data to browse)`,
  );
  await facade.library.browse();
  await afterBrowse(ctx.page);
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
  // Settle the list onto the new row BY NAME before the on-camera search. The
  // created artifact is searchable immediately (synchronous committed insert),
  // but the default list is paginated name-ascending and the run-scoped probe
  // name sorts to the alphabetical TAIL — so on a server-paginated page (tools)
  // it lands off page 1, and on a load-everything page (fields) a stale Redis
  // SSR snapshot can predate it. openUntilVisible navigates to a name-filtered
  // ``?search=`` (so the row is on page 1 regardless of sort/total) and is
  // cache-fresh (so it reads past the stale list cache), then the on-camera
  // search runs against a list that contains it.
  await facade.library.openUntilVisible(input.name);
  await facade.search(input.name);
  await facade.library.expectVisible(input.name);
  // Canonical doc-slot name: ALWAYS `{plural}-create`, never `-{variant}`. The
  // `variant` is an internal FORM-MODE selector (e.g. scenario's
  // `?mode=contextual` create flow), NOT a separate doc artifact — each domain
  // records exactly ONE create demo for its `{plural}-create` slot (scenarios
  // has the single contextual spec; there is no `scenarios-create-assessment`
  // recording). The old `-${variant}` suffix saved `scenarios-create-contextual.webm`,
  // which CLI polish — keyed to the canonical `{plural}-create` slot — couldn't
  // find ("no video"). Drop the suffix so the artifact name matches the slot.
  await saveDemoVideo(ctx.page, `${spec.plural}-create`);
}

/** Seed one row via the factory, open its edit page, change the description,
 *  submit, and assert the "updated" toast. Reaped by name.
 *
 *  WIZARD-AWARE: GenericForm renders every `artifact-form-step-{id}` section in
 *  ONE scrollable form (not a Next/Prev wizard), and `handleSubmit` runs all
 *  the per-step required-field validation BEFORE it posts `/{singular}/update`.
 *  So a multi-step domain with a required RELATION the API seed can't populate
 *  (a simulation's "Scenario Rubrics *", which the factory only seeds a bare
 *  scenario for) would `toast.error("… is required")` and `throw` on submit —
 *  no update ever posts, and the old single-field editDemo timed out waiting
 *  for an "updated" toast that could never appear (the observed simulations-edit
 *  failure). `facade.editFlow` REUSES the create path's selection-step appliers
 *  + reconcile-driven submit loop to satisfy those required relations on the
 *  edit form before submitting, then awaits the real "updated" toast. For
 *  name-only domains (cohort, field, parameter, scenario) there are no required
 *  selection steps to replay, so it collapses to the prior behaviour. */
export async function editDemo(ctx: DemoCtx, key: string): Promise<void> {
  const { spec, facade } = facadeFor(ctx, key);
  const name = `Edit ${spec.singular} ${ctx.runId}`;
  test.skip(!(await apiCreate(ctx.request, key, name)), `${spec.singular} not API-creatable`);
  ctx.registry.track({ kind: key, name });
  const id = await resolveId(ctx.request, key, name);
  test.skip(!id, `could not resolve the created ${spec.singular}`);
  // editFlow opens the edit page, changes the description, replays the required
  // selection steps, submits, and asserts the "updated" toast. Returns false
  // when the domain has no editable description (so we skip, as before).
  const edited = await facade.editFlow(`${spec.listPath}/${id}`, `Edited by e2e ${ctx.runId}.`);
  test.skip(!edited, `${spec.singular} has no editable description`);
  await saveDemoVideo(ctx.page, `${spec.plural}-edit`);
}

const API_BASE = process.env["INTERNAL_API_BASE"] || "http://localhost:8000";

/** Open a real, completed+graded attempt's detail page (resolved from
 *  /attempt/search, highest score, viewable) and tour the conversation +
 *  scorecard — read-only, no live run. The linchpin for how-it-works /
 *  annotated-example demos. */
export async function attemptDemo(
  ctx: DemoCtx,
  topic: string,
  scrollTexts: RegExp[],
  pick: "best" | "worst" | "median" = "best",
): Promise<void> {
  const res = await ctx.request.post(`${API_BASE}/attempt/search`, {
    headers: { Authorization: `Bearer ${process.env["GLOW_RECORD_TOKEN"] ?? ""}` },
    data: {},
  });
  const body = res.ok() ? ((await res.json()) as Record<string, unknown>) : {};
  const rows = (body["data"] as Array<Record<string, unknown>>) ?? [];
  // Always sort high→low so the pick index is well-defined.
  const viewable = rows
    .filter((r) => r["show_view"] && typeof r["score"] === "number")
    .sort((a, b) => (b["score"] as number) - (a["score"] as number));
  // AUDIT FIX: `how-it-works-attempt-loop` and `annotated-example-excellent`
  // both resolved `pick:"best"` → same attempt → duplicate footage. Selecting a
  // DIFFERENT attempt per demo de-dupes the clips:
  //   - "best"   → highest score (index 0)        — the excellent exemplar
  //   - "worst"  → lowest score  (last index)     — the struggling exemplar
  //   - "median" → the middle of the sorted list  — a typical, mid attempt
  // `median` uses floor(n/2), which for any n ≥ 2 is a DIFFERENT row than
  // best (index 0), so the two demos film distinct attempts whenever the seed
  // has more than one viewable attempt. With a single attempt every pick
  // collapses to it (unavoidable — there's only one real attempt to feature).
  const idx =
    pick === "worst"
      ? viewable.length - 1
      : pick === "median"
        ? Math.floor(viewable.length / 2)
        : 0;
  const id = viewable[idx]?.["attempt_id"];
  test.skip(typeof id !== "string", "no completed+viewable attempt to feature");
  // The attempt-review page opens a live chat websocket, so networkidle never
  // settles — wait for DOM only, then let the review render.
  await ctx.page.goto(`/attempt/${id}`, { waitUntil: "domcontentloaded" });
  await ctx.demo.pause(3000);
  for (const t of scrollTexts) await scrollToText(ctx.page, t).catch(() => undefined);
  await saveDemoVideo(ctx.page, topic);
}

/** Drive the AI generation panel for real: open it on the personas library,
 *  optionally enable safe mode (→ tool calls soft-staged for accept, the audit
 *  path), type instructions, hit Generate, and wait out the live run. Bounded
 *  so a slow model doesn't hang the test. Spends tokens. */
export async function genDemo(
  ctx: DemoCtx,
  topic: string,
  instructions: string,
  opts: { safeMode?: boolean } = {},
): Promise<void> {
  if (opts.safeMode) {
    // Safe mode is cookie-backed (read on panel mount) — set it before
    // navigating instead of fighting the tooltip-wrapped settings dropdown.
    await ctx.page
      .context()
      .addCookies([{ name: "glow.gp.safeMode", value: "1", url: "http://localhost:3000" }]);
  }
  await ctx.page.goto("/training/personas");
  await expectAuthenticated(ctx.page);
  await openGenerationPanel(ctx.page);

  // Start a clean chat so the only content on the panel after this run is what
  // THIS generation produced — makes the "did anything generate?" assertion
  // below honest (no pre-seeded historical bubbles to mistake for output).
  await ctx.page
    .getByRole("button", { name: /new chat/i })
    .first()
    .click({ timeout: 5_000 })
    .catch(() => undefined);

  // Fill the VISIBLE instructions input and submit via Enter — handleKeyDown
  // fires handleSend() on THIS instance, sidestepping the multi-instance button
  // mismatch (the panel mounts several copies; a clicked button can belong to a
  // different instance whose instructions are empty → disabled).
  const ta = ctx.page.locator('[placeholder="Instructions..."]:visible').first();
  await ta.fill(instructions);
  await ctx.demo.pause();
  const submittedAt = Date.now();
  await ta.press("Enter");

  // What proves a REAL generation ran (vs. an instant empty no-op when the
  // backend has no LLM provider key → dispatches=0 → an empty "completion"):
  // a substantive output artifact has to appear. In safe mode that's the
  // Accept control (a tool call got soft-staged). In a normal run it's an
  // assistant-attributed message bubble (`justify-start`) carrying the
  // generated text / tool output — distinct from the user's own instruction
  // bubble (`justify-end`), which always appears regardless.
  let produced = false;
  if (opts.safeMode) {
    // Safe mode soft-stages tool calls — the completion signal is the Accept
    // control appearing (the spinner-clear path may not fire). Wait for it,
    // then take the audit path. BOTH waits are explicitly bounded: an un-timed
    // .click() would otherwise wait the whole test timeout for actionability.
    const accept = ctx.page.getByRole("button", { name: /accept/i }).first();
    produced = await accept
      .waitFor({ state: "visible", timeout: 90_000 })
      .then(() => true)
      .catch(() => false);
    await ctx.demo.pause(1500);
    if (produced) await accept.click({ timeout: 15_000 }).catch(() => undefined);
    await ctx.demo.pause(1500);
  } else {
    // Normal run: wait for an assistant-side CONTENT bubble to appear — that
    // is the generated output streaming in. Distinctions that keep this
    // honest:
    //   - the instruction we typed renders in a `justify-end` (user) row, so
    //     it can't satisfy a `justify-start` (assistant) match;
    //   - the transient "generating" placeholder is a `justify-start` row too,
    //     but its inner div has NO `max-w-[85%]` (it's just a spinner) — every
    //     real content bubble / tool bubble / event pill carries `max-w-[85%]`.
    // So we require an assistant row holding a real `max-w-[85%]` content
    // bubble, which an empty no-op run (dispatches=0) never produces. Bounded
    // so a slow model fails at the timeout, not the whole test budget.
    const assistantBubble = ctx.page.locator('div.flex.justify-start .max-w-\\[85\\%\\]').first();
    produced = await assistantBubble
      .waitFor({ state: "visible", timeout: 90_000 })
      .then(() => true)
      .catch(() => false);
    // Then let the spinner clear so the clip ends on a settled, complete run.
    await ctx.page
      .locator('[data-testid="gp-generate"]:visible .animate-spin')
      .waitFor({ state: "detached", timeout: 90_000 })
      .catch(() => undefined);
    await ctx.demo.pause(2000);
  }

  for (const t of scrollTexts(opts.safeMode)) await scrollToText(ctx.page, t).catch(() => undefined);
  await saveDemoVideo(ctx.page, topic);

  // Fail loud. A run that produced no output artifact — or that "completed" in
  // under 3s (the empty no-op signature when there's no LLM key) — is a broken
  // generation backend, NOT a passing demo. Assert AFTER saving the video so
  // the (honest, broken) recording is still captured for QA.
  const elapsedMs = Date.now() - submittedAt;
  expect(
    produced,
    "generation produced no output (Accept control / assistant response never appeared) — the generation backend is broken (e.g. no LLM provider key)",
  ).toBe(true);
  expect(
    elapsedMs,
    `generation "completed" in ${elapsedMs}ms — an instant empty no-op, not a real run`,
  ).toBeGreaterThan(3_000);
}
function scrollTexts(safe?: boolean): RegExp[] {
  return safe
    ? [/accept|reject|pending|staged|review|tool/i]
    : [/generat|event|tool|message|response/i];
}

/** Open a test's detail page (resolved from /test/search, preferring one with
 *  invocations) and tour the invocation grid. Like attemptDemo, the page opens
 *  a live ws → domcontentloaded + tolerant scroll. */
export async function testDemo(
  ctx: DemoCtx,
  topic: string,
  scrollTexts: RegExp[],
): Promise<void> {
  const res = await ctx.request.post(`${API_BASE}/test/search`, {
    headers: { Authorization: `Bearer ${process.env["GLOW_RECORD_TOKEN"] ?? ""}` },
    data: {},
  });
  const body = res.ok() ? ((await res.json()) as Record<string, unknown>) : {};
  const rows = ((body["tests"] ?? body["data"]) as Array<Record<string, unknown>>) ?? [];
  const sorted = [...rows].sort(
    (a, b) => ((b["num_invocations"] as number) ?? 0) - ((a["num_invocations"] as number) ?? 0),
  );
  const id = sorted[0]?.["test_id"];
  test.skip(typeof id !== "string", "no test to feature");
  await ctx.page.goto(`/test/${id}`, { waitUntil: "domcontentloaded" });
  await ctx.demo.pause(3000);
  for (const t of scrollTexts) await scrollToText(ctx.page, t).catch(() => undefined);

  // FAIL-LOUD (asserted BEFORE saveDemoVideo): the tolerant
  // `scrollToText(...).catch()` tour above swallows a crashed page, so without
  // this the demo reports PASS while filming the error boundary (the same
  // silent-green class as the old draftDemo). When the route throws into
  // `app/error.tsx`, that card REPLACES the whole route subtree — including
  // `FullPageLayout`'s header/breadcrumb — so we assert the test-detail route
  // ACTUALLY rendered and that the error card is absent.
  //
  // CRITICAL ORDERING: `saveDemoVideo(ctx.page, …)` calls `page.close()`
  // (demo-video.ts) to finalize the recording. These route-signal assertions
  // MUST run against the OPEN page, so they precede the save — asserting after
  // it failed with "Target page … has been closed." (the dead-assertion bug
  // this rework fixes). This trades genDemo's assert-after-save ordering for
  // correctness: the page object is unusable once closed, so the signal has to
  // be read first. The video is still saved unconditionally below, so a
  // genuinely crashed route is both captured for QA AND fails loud here.
  //
  // The route renders via `FullPageLayout`, whose `PageHeader` emits a
  // breadcrumb `<nav aria-label="breadcrumb">` seeded with the test route's
  // fixed first crumb, "Benchmark" (page.tsx: breadcrumbs=[{ title:"Benchmark"
  // }, { title: entityName ?? "Test" }]). `app/error.tsx` renders NEITHER a
  // breadcrumb nor that crumb, so a present "Benchmark" breadcrumb is a
  // route-specific proof the real test-detail layout rendered — strictly
  // tighter than the generic `page-header` (which every FullPageLayout page
  // shares). Assert both directions:
  //   (+) the test-detail breadcrumb header actually rendered, and
  //   (-) we are NOT sitting on the error boundary.
  await expect(
    ctx.page
      .getByRole("navigation", { name: "breadcrumb" })
      .getByText("Benchmark", { exact: true }),
    "test detail page did not render its breadcrumb header — the route likely threw into the error boundary",
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    ctx.page.getByRole("heading", { name: "An error occurred" }),
    "test detail page rendered the error boundary — the route crashed instead of showing the invocation grid",
  ).toHaveCount(0);

  // Save the recording LAST: it closes the page (see ordering note above), so
  // every page-object assertion must already have run.
  await saveDemoVideo(ctx.page, topic);
}

/** Open an existing artifact's detail/edit page (resolved from seed data) and
 *  tour the named sections — for "pattern" demos that showcase a real, already-
 *  configured artifact (a persona's instructions, a rubric's standards). */
export async function detailDemo(
  ctx: DemoCtx,
  key: string,
  topic: string,
  scrollTexts: RegExp[],
): Promise<void> {
  const { spec, facade } = facadeFor(ctx, key);
  const id = await resolveAnyId(ctx.request, key);
  test.skip(!id, `no seed ${spec.singular} to open`);
  await facade.form.openEdit(`${spec.listPath}/${id}`);
  for (const t of scrollTexts) await scrollToText(ctx.page, t);
  await saveDemoVideo(ctx.page, topic);
}

/** Seed two rows via the factory, select them, and bulk-delete for real
 *  (toolbar → dialog → confirm → verify gone). Skips if it can't seed two. */
export async function bulkDeleteDemo(ctx: DemoCtx, key: string): Promise<void> {
  const { spec, facade } = facadeFor(ctx, key);
  // Both seeded names share this stem (they differ only in the A/B letter), so
  // a single ``?search=`` query pulls BOTH onto page 1 — see openSelected.
  const stem = `Bulk ${spec.singular}`;
  const names = [`${stem} A ${ctx.runId}`, `${stem} B ${ctx.runId}`];
  const ids: string[] = [];
  for (const name of names) {
    if (!(await apiCreate(ctx.request, key, name))) break;
    ctx.registry.track({ kind: key, name });
    const id = await resolveId(ctx.request, key, name);
    if (id) ids.push(id);
  }
  test.skip(ids.length < 2, `could not seed two ${spec.plural}`);
  await facade.library.openSelected(ids, stem);
  await facade.library.bulkDelete();
  await facade.open();
  await facade.search(names[0]!);
  await expect(facade.card(names[0]!)).toHaveCount(0);
  await saveDemoVideo(ctx.page, `${spec.plural}-bulk`);
}
