import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "../fixtures";
import { resolveAnyId } from "../support/factories";
import { expectAuthenticated, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: full-page tour of a real seeded SCENARIO's detail/edit page.
//
// The scenario detail route renders one long, scrollable artifact form
// (`data-testid="artifact-form"`) built from stacked StepCards — there is no
// wizard pagination, every section is on the page at once. So a faithful
// coverage tour walks the card stack top->bottom (Basic Information →
// Personas → Documents → Parameters, plus the conditional Context / Video
// cards when the scenario's flags enable them), holding ~1s on each so the
// configured content reads, then exercises the per-card read-only affordances:
// the Contextual/Assessment mode toggle (HOVER only — clicking it mutates the
// in-memory flag selection, so we never click it), the section search boxes
// (type → let the URL-backed re-query react → clear), and the filter popover
// ("Show selected only", opened then dismissed with Escape — never Applied).
//
// HARD RULES honored: NON-DESTRUCTIVE throughout — no field is edited, no
// Save/Back is clicked, the search inputs are always cleared back to empty, and
// the filter popover is dismissed without committing. There is exactly ONE
// page-ready assertion (the `artifact-form`); every beat after it is guarded by
// an isVisible().catch(()=>false) probe (or a guarded helper) so a section the
// scenario lacks is skipped, not failed. We waitOutSkeleton() right after the
// form is ready so no loading-shimmer frame is recorded.

const TOPIC = "how-it-works-scenario-design";

const demoPause = (ms = 900) => pauseForDemo(ms);

/** Scroll a step card into view and hold so its configured content reads.
 *  No-ops (returns false) when the card is absent — Context / Video only
 *  render when the scenario's flags enable them. */
async function tourStep(page: Page, stepId: string): Promise<boolean> {
  const card = page.getByTestId(`artifact-form-step-${stepId}`).first();
  if (!(await card.isVisible().catch(() => false))) return false;
  await card.scrollIntoViewIfNeeded().catch(() => undefined);
  await demoPause();
  return true;
}

/** Type into a section's search box (so the typing shows on camera), let the
 *  URL-backed re-query react, then clear it back to empty. Fully read-only:
 *  search is a view filter, nothing is mutated. Guarded — no-ops when the
 *  card has no search input. */
async function exerciseSearch(page: Page, stepId: string, query: string): Promise<void> {
  const card = page.getByTestId(`artifact-form-step-${stepId}`).first();
  if (!(await card.isVisible().catch(() => false))) return;
  const input = card.locator('input[type="text"]').first();
  if (!(await input.isVisible().catch(() => false))) return;
  await input.scrollIntoViewIfNeeded().catch(() => undefined);
  await input.click({ timeout: 5_000 }).catch(() => undefined);
  await input.pressSequentially(query, { delay: 55 }).catch(() => undefined);
  await demoPause();
  // Clear it so the section returns to its full, unfiltered state.
  await input.fill("").catch(() => undefined);
  await demoPause(700);
}

/** Open a section's filter popover (the Filter icon), reveal the
 *  "Show selected only" checkbox, then dismiss with Escape WITHOUT clicking
 *  Apply — a committed filter would re-query, so we read the options and back
 *  out. Guarded — no-ops when the card has no filter trigger. */
async function peekFilter(page: Page, stepId: string): Promise<void> {
  const card = page.getByTestId(`artifact-form-step-${stepId}`).first();
  if (!(await card.isVisible().catch(() => false))) return;
  const trigger: Locator = card.locator("button:has(> svg.lucide-filter)").first();
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click({ timeout: 5_000 }).catch(() => undefined);
  // The "Show selected only" option lives in the popover content.
  await page
    .getByText(/show selected only/i)
    .first()
    .waitFor({ state: "visible", timeout: 5_000 })
    .catch(() => undefined);
  await demoPause();
  await page.keyboard.press("Escape").catch(() => undefined);
  await demoPause(700);
}

test.describe("demo: how-it-works scenario design", () => {
  test("tour a seeded scenario's full configuration", async ({ page, request }) => {
    test.setTimeout(120_000);

    // Resolve a real seeded scenario from /scenario/search (highest-fidelity:
    // an already-configured row, not a blank draft).
    const id = await resolveAnyId(request, "scenario");
    test.skip(!id, "no seed scenario to open");

    await page.goto(`/training/scenarios/${id}`);
    await expectAuthenticated(page);

    // ONE hard page-ready assertion: the artifact form rendered. Everything
    // after this is guarded so a section the scenario lacks is skipped, not
    // failed.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 45_000 });
    // Trim the loading shimmer so the opening frames are the populated form.
    await waitOutSkeleton(page);
    await demoPause(1_200);

    // ---- 1. Tour the card stack top -> bottom ----
    // Basic Information leads (name / description / departments / flags + the
    // Contextual/Assessment mode toggle).
    await tourStep(page, "basic");

    // The mode toggle is a read-only view switch in principle, but clicking it
    // drops the hidden-mode flag ids from in-memory state — so we only HOVER it
    // to surface it on camera, never click (non-destructive).
    const modeToggle = page.getByRole("radiogroup", { name: /scenario mode/i }).first();
    if (await modeToggle.isVisible().catch(() => false)) {
      await modeToggle.scrollIntoViewIfNeeded().catch(() => undefined);
      await modeToggle.hover().catch(() => undefined);
      await demoPause();
    }

    // Personas → Documents → Parameters are always present.
    await tourStep(page, "personas");
    await tourStep(page, "documents");
    await tourStep(page, "parameters");

    // Context (problem statement / objectives / images) and Video & Questions
    // only render when the scenario's flags enable them — guarded, so they're
    // toured when present and silently skipped otherwise.
    await tourStep(page, "context");
    await tourStep(page, "video");

    // ---- 2. Exercise the section search boxes (type → react → clear) ----
    await exerciseSearch(page, "personas", "student");
    await exerciseSearch(page, "parameters", "tone");

    // ---- 3. Peek a filter popover ("Show selected only"), dismiss with Esc ----
    await peekFilter(page, "personas");

    // ---- 4. Final beat back at the top so the clip ends on the headline ----
    await page.mouse.wheel(0, -4000);
    await tourStep(page, "basic");
    await demoPause();

    await saveDemoVideo(page, TOPIC);
  });
});
