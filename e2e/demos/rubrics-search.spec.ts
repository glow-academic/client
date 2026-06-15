// # coverage: SEARCH-LED tour of /platform/rubrics — the CENTERPIECE is the
// rubric name search box. We read a REAL seeded rubric name off the first
// card's aria-label ("rubric card {name}"), take its leading token, type it
// char-by-char (pressSequentially, delay 55) so the typing shows, let the
// debounced server re-query narrow the card grid to matching results, hold on
// the narrowed grid, then CLEAR back to the full library. After that
// centerpiece we briefly tour the rest: the three faceted-filter popovers (Eval
// + Simulation + Department — open/reveal/type/Escape), the View column-
// visibility dropdown (open/reveal/Escape), and pagination Next/Prev. Every
// beat past the one page-ready assertion is GUARDED + NON-DESTRUCTIVE: search
// and filters are read-only view state reset to baseline, popovers/menus are
// open-then-Escape, pagination returns to the first page, and nothing is
// committed (no rubric deleted, duplicated, edited, or created; no filter
// applied; no row mutated). The search term is data-derived so it always
// matches the live seed.
import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "rubrics-search";

/** Derive a short, real, matching search token from the first card's name.
 *  Reads the aria-label ("rubric card {name}") the cards render, falls back to
 *  the card's text. Returns a leading word long enough to be meaningful (skips
 *  1-char tokens) so the grid actually narrows on it. Null when unreadable. */
async function firstRubricSearchTerm(
  page: import("@playwright/test").Page,
): Promise<string | null> {
  const first = page.getByTestId("rubric-card").first();
  if (!(await first.isVisible().catch(() => false))) return null;
  const label = (await first.getAttribute("aria-label").catch(() => "")) ?? "";
  const m = label.match(/rubric\s+card\s+(.+)/i);
  const name = (m?.[1] ?? "").trim();
  const source =
    name && !/^generating/i.test(name) && !/^unnamed/i.test(name) ? name : "";
  // Prefer the first token >= 3 chars (a real, narrowing prefix); else the
  // first token of any length; else nothing.
  const tokens = source.split(/\s+/).filter(Boolean);
  return tokens.find((t) => t.length >= 3) ?? tokens[0] ?? null;
}

test.describe("demo: rubrics search", () => {
  test("searches the rubric library by name (type → narrow → clear), then tours filters, view options, and pagination", async ({
    page,
  }) => {
    await page.goto("/platform/rubrics");
    await expectAuthenticated(page);
    // The loaded list renders `rubrics-grid` (the card container); the loading
    // state renders skeletons (detached once data lands). This is the single
    // real page-ready assertion — keep exactly one.
    await expect(page.getByTestId("rubrics-grid")).toBeVisible({ timeout: 30_000 });
    // Wait out the skeleton lead-in and hold a beat on the populated library so
    // no skeleton frame is recorded before the search.
    await settleLoaded(page);

    // Brief orient: hover the first card and scroll its metric row into frame so
    // the populated library reads before the search narrows it.
    await hoverFirstVisible(page, "rubric-card");
    await scrollToText(page, /total points|pass:/i);
    await pauseForDemo(900);

    // BEAT 1 (CENTERPIECE) — the rubric name search. Read a REAL token off the
    // first card so the query is guaranteed to match the live seed, type it
    // character-by-character so the typing shows, let the debounced (500ms)
    // server re-query narrow the grid to matching cards, hold on the narrowed
    // result, then CLEAR so the library returns to the full set. Reversible
    // read-only view state — nothing committed. Guarded: a library without a
    // search box (or unreadable card name) is a clean no-op.
    const search = page.getByTestId("rubrics-search").first();
    const term = await firstRubricSearchTerm(page);
    if (term && (await search.isVisible().catch(() => false))) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially(term, { delay: 55 }).catch(() => undefined);
      // Commit + wait out the debounce so the grid re-queries and re-renders the
      // narrowed set on frame (not a stale/skeleton frame).
      await search.press("Enter").catch(() => undefined);
      await settleLoaded(page);
      // Hold on the narrowed grid so the matching result reads.
      await scrollToText(page, /total points|pass:/i);
      await pauseForDemo(1_500);
      // Clear back to the full library so the clip returns to the full grid.
      await search.fill("").catch(() => undefined);
      await search.press("Enter").catch(() => undefined);
      await settleLoaded(page);
      await pauseForDemo(1_100);
    }

    // BEAT 2 — open the "Eval" faceted-filter popover to reveal the evals the
    // library can be scoped by, then dismiss with Escape WITHOUT selecting (no
    // committed filter). Guarded so a library without this filter no-ops.
    const evalFilter = page.getByRole("button", { name: /^Eval$/ }).first();
    if (await evalFilter.isVisible().catch(() => false)) {
      await evalFilter.click().catch(() => undefined);
      await pauseForDemo(1_200);
      const evalSearch = page.getByPlaceholder("Eval").first();
      if (await evalSearch.isVisible().catch(() => false)) {
        await evalSearch.pressSequentially("a", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_000);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 3 — open the "Simulation" faceted-filter popover (server-driven) to
    // reveal the activities the library can be narrowed to, type into its
    // CommandInput so the option list re-queries, then dismiss with Escape
    // without applying. Open + reveal + Escape only.
    const simFilter = page.getByRole("button", { name: /^Simulation$/ }).first();
    if (await simFilter.isVisible().catch(() => false)) {
      await simFilter.click().catch(() => undefined);
      await pauseForDemo(1_200);
      const simSearch = page.getByPlaceholder("Simulation").first();
      if (await simSearch.isVisible().catch(() => false)) {
        await simSearch.pressSequentially("a", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_000);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 4 — open the "Department" faceted-filter popover (server-driven) to
    // reveal the departments the library can be scoped by, then dismiss with
    // Escape without committing. Non-destructive reveal, nothing applied.
    const deptFilter = page.getByRole("button", { name: /^Department$/ }).first();
    if (await deptFilter.isVisible().catch(() => false)) {
      await deptFilter.click().catch(() => undefined);
      await pauseForDemo(1_200);
      const deptSearch = page.getByPlaceholder("Department").first();
      if (await deptSearch.isVisible().catch(() => false)) {
        await deptSearch.pressSequentially("a", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_000);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 5 — open the "View" column-visibility dropdown to reveal the
    // toggle-features list (which card sections show: points/pass summary,
    // description, the standards table), then dismiss. Read-only reveal: opened
    // + Escape, no feature actually toggled.
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewBtn.click().catch(() => undefined);
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 6 — page through the library: click Next (only if a next page
    // exists) so a fresh page of rubric cards loads, hold, then return with Prev
    // so the clip ends on the original page. Guarded — a single-page library
    // disables Next, so the whole beat no-ops cleanly.
    const next = page
      .getByRole("button", { name: /next page/i })
      .filter({ visible: true })
      .first();
    if (
      (await next.isVisible().catch(() => false)) &&
      (await next.isEnabled().catch(() => false))
    ) {
      await next.scrollIntoViewIfNeeded().catch(() => undefined);
      await next.click().catch(() => undefined);
      await settleLoaded(page);
      await pauseForDemo(1_000);
      const prev = page
        .getByRole("button", { name: /previous page/i })
        .filter({ visible: true })
        .first();
      if (
        (await prev.isVisible().catch(() => false)) &&
        (await prev.isEnabled().catch(() => false))
      ) {
        await prev.click().catch(() => undefined);
        await settleLoaded(page);
        await pauseForDemo(900);
      }
    }

    // End held on the populated rubric grid — substantive content on frame.
    await scrollToText(page, /total points|pass:/i);
    await pauseForDemo(1_100);

    await saveDemoVideo(page, TOPIC);
  });
});
