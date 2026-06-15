import { expect } from "@playwright/test";

import { test } from "../fixtures";
import { DOMAINS } from "../actions/domains";
import { resolveAnyId } from "../support/factories";
import { expectAuthenticated, settleLoaded, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// coverage: tour a real seed persona's full edit form top->bottom — every
// step section (Basic / Parameters / Color / Icon / Personality), the
// instructions + example dialogue that teach voice, then exercise the
// non-mutating affordances (Drafts picker open + search + Escape, a parameter
// group expand/collapse). All beats past the one page-ready assertion are
// guarded so a section the seed persona lacks is skipped, not failed. Strictly
// read-only: open-then-Escape, never submit/confirm.

const TOPIC = "patterns-persona-realism";

/** A guarded scroll-and-hold on a section heading. No-ops if absent. */
async function holdOnText(
  page: import("@playwright/test").Page,
  text: string | RegExp,
): Promise<void> {
  const target = page.getByText(text).first();
  if (await target.isVisible().catch(() => false)) {
    await target.scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseForDemo(1_000);
  }
}

/** A guarded scroll-and-hold on a step section by its stable testid. */
async function holdOnStep(
  page: import("@playwright/test").Page,
  stepId: string,
): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`).first();
  if (await step.isVisible().catch(() => false)) {
    await step.scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseForDemo(1_000);
  }
}

test.describe("demo: patterns persona realism", () => {
  test("tour a persona's instructions and examples", async ({ page, request }) => {
    test.setTimeout(120_000);

    // Resolve a real, already-configured seed persona to feature.
    const spec = DOMAINS["persona"]!;
    const id = await resolveAnyId(request, "persona");
    test.skip(!id, "no seed persona to open");

    await page.goto(`${spec.listPath}/${id}`);
    await expectAuthenticated(page);

    // ── The ONE page-ready assertion ──────────────────────────────────
    // The edit page renders the persona as a stacked step-form; wait for the
    // form shell, then settle out the load skeleton so no shimmer frame is
    // recorded before the tour begins.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // ── Tour every step section, top -> bottom (~1s hold each) ─────────
    // basic = name/description/departments/flags, parameters, color, icon,
    // content = instructions/examples/voices. Each guarded so a step the seed
    // lacks is skipped.
    for (const stepId of ["basic", "parameters", "color", "icon", "content"]) {
      await holdOnStep(page, stepId);
    }

    // Linger on the persona-realism content: the description, the instructions
    // that drive behavior, and the example dialogue + voices that teach voice.
    await holdOnText(page, /description/i);
    await holdOnText(page, /instructions/i);
    await holdOnText(page, /example|message/i);
    await holdOnText(page, /voice|personality/i);

    // ── Drafts picker: open, reveal, type-to-filter, clear, dismiss ────
    // Read-only — opening the dropdown and searching never mutates the
    // persona. Guarded end-to-end.
    const draftsTrigger = page.getByTestId("draft-picker-trigger").first();
    if (await draftsTrigger.isVisible().catch(() => false)) {
      await draftsTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await draftsTrigger.click().catch(() => undefined);
      await pauseForDemo(900);

      const draftSearch = page.getByTestId("draft-search").first();
      if (await draftSearch.isVisible().catch(() => false)) {
        await draftSearch.click().catch(() => undefined);
        await draftSearch.pressSequentially("persona", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(900);
        await draftSearch.fill("").catch(() => undefined);
        await pauseForDemo(600);
      }
      // Dismiss without committing any draft switch.
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    // ── Parameters: expand a group, hold, collapse again (non-mutating) ─
    // The group toggle re-queries the group's fields (a view-only expand);
    // open it to reveal, then collapse to leave the form as we found it.
    const paramToggle = page.getByTestId("parameter-group-toggle").first();
    if (await paramToggle.isVisible().catch(() => false)) {
      await paramToggle.scrollIntoViewIfNeeded().catch(() => undefined);
      await paramToggle.click().catch(() => undefined);
      await pauseForDemo(1_000);
      await paramToggle.click().catch(() => undefined);
      await pauseForDemo(700);
    }

    // End on the personality content so the clip closes substantive.
    await scrollToText(page, /instructions/i).catch(() => undefined);

    await saveDemoVideo(page, TOPIC);
  });
});
