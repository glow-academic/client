import { expect, type Page } from "@playwright/test";

import { test } from "../fixtures";
import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: full-page tour of a graded attempt's RUBRIC SCORECARD.
// A completed+graded attempt opens on its rubric scorecard by default (the
// server sets show_results, so AttemptChat auto-swaps to RubricView) — that
// annotated, per-standard grade IS the headline of "how it works: rubric". We
// linger on the scorecard and scroll the standards / points / feedback rows
// thoroughly, hover the score+timer pill, then briefly flip to the conversation
// transcript via the rubric Table view-toggle and back, and exercise the
// Objectives / Documents header toggles. Read-only throughout: every header
// control is a reversible view-mode swap, nothing is ever submitted, and every
// beat past the one page-ready assertion no-ops when its target is absent.
//
// Resolution gotcha (why this isn't a one-line attemptDemo): the top-scored
// attempts on the demo instance can have an EMPTY transcript (0 messages), so
// the live MessagesView container never mounts and a naive
// `attempt-messages-container` assertion fails. We anchor on the always-present
// header `timer` pill, and resolve the best-scored attempt that actually HAS a
// conversation so the transcript toggle reveals real content.

const API_BASE = process.env["INTERNAL_API_BASE"] || "http://localhost:8000";

/** Resolve a graded, viewable attempt that actually has a conversation
 *  transcript (entries.attempt_message). Probes the top viewable attempts via
 *  /attempt/get; falls back to the top-scored one so we still record a
 *  substantive scorecard even if none carry messages. */
async function resolveRichAttempt(
  request: import("@playwright/test").APIRequestContext,
  pick: "best" | "worst",
): Promise<string | undefined> {
  const auth = { Authorization: `Bearer ${process.env["GLOW_RECORD_TOKEN"] ?? ""}` };
  const res = await request.post(`${API_BASE}/attempt/search`, { headers: auth, data: {} });
  const body = res.ok() ? ((await res.json()) as Record<string, unknown>) : {};
  const rows = (body["data"] as Array<Record<string, unknown>>) ?? [];
  const viewable = rows
    .filter((r) => r["show_view"] && typeof r["score"] === "number")
    .sort((a, b) =>
      pick === "worst"
        ? (a["score"] as number) - (b["score"] as number)
        : (b["score"] as number) - (a["score"] as number),
    );
  for (const r of viewable.slice(0, 8)) {
    const id = r["attempt_id"] as string;
    const g = await request.post(`${API_BASE}/attempt/get`, {
      headers: { ...auth, "X-Bypass-Cache": "1" },
      data: { attempt_id: id },
    });
    if (!g.ok()) continue;
    const gd = (await g.json()) as Record<string, unknown>;
    const entries = (gd["entries"] as Record<string, unknown>) ?? {};
    const msgs = (entries["attempt_message"] as unknown[]) ?? [];
    if (Array.isArray(msgs) && msgs.length > 0) return id;
  }
  return viewable[0]?.["attempt_id"] as string | undefined;
}

/** Click an icon-only header toggle (resolved by its lucide svg class, since the
 *  buttons carry only an icon + a tooltip — no accessible name), hold so the
 *  swapped-in view reads, then toggle it back. Fully non-destructive. */
async function toggleByIcon(
  page: Page,
  iconClass: string,
  hold: () => Promise<void>,
  demoPause: () => Promise<void>,
): Promise<boolean> {
  const sel = `button:has(> svg.${iconClass})`;
  const btn = page.locator(sel).first();
  if (!(await btn.isVisible().catch(() => false))) return false;
  await btn.scrollIntoViewIfNeeded().catch(() => undefined);
  await demoPause();
  await btn.click({ timeout: 5_000 }).catch(() => undefined);
  await hold();
  // Toggle back so the next beat starts from the default scorecard.
  await page.locator(sel).first().click({ timeout: 5_000 }).catch(() => undefined);
  await demoPause();
  return true;
}

test.describe("demo: how-it-works rubric", () => {
  test("tour a graded attempt's rubric scorecard", async ({ page, demo, request }) => {
    test.setTimeout(120_000);
    const demoPause = () => demo.pause(900);

    const id = await resolveRichAttempt(request, "best");
    test.skip(typeof id !== "string", "no completed+viewable attempt to feature");

    // The attempt-review page opens a live chat websocket, so networkidle never
    // settles — wait for DOM only, then let the SSR review render.
    await page.goto(`/attempt/${id as string}`, { waitUntil: "domcontentloaded" });
    await expectAuthenticated(page);

    // ONE hard page-ready assertion: the header `timer` pill is present for any
    // rendered attempt regardless of which view (scorecard / transcript) is
    // active. Everything after this is guarded.
    const timer = page.getByTestId("timer").first();
    await expect(timer).toBeVisible({ timeout: 45_000 });
    await demo.pause(2_500);

    // ---- 1. The annotated grade: tour the default rubric scorecard ----
    // Linger on the standards / points / feedback rows — this scorecard is the
    // whole point of the "how it works: rubric" clip.
    await scrollToText(page, /score|passed|standard|rubric/i).catch(() => undefined);
    if (await timer.isVisible().catch(() => false)) {
      await timer.hover().catch(() => undefined); // reveals the Passed (score) tooltip
      await demoPause();
    }
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 420);
      await pauseForDemo(800);
    }
    await scrollToText(page, /feedback|criteria|points|standard/i).catch(() => undefined);
    await pauseForDemo(900);
    // Scroll back to the top of the scorecard so the score header reads again.
    await page.mouse.wheel(0, -1200);
    await scrollToText(page, /score|passed|standard/i).catch(() => undefined);
    await pauseForDemo(900);

    // ---- 2. Flip to the conversation transcript (rubric Table toggle) ----
    await toggleByIcon(
      page,
      "lucide-table",
      async () => {
        const tx = page.getByTestId("attempt-messages-container").first();
        await tx.scrollIntoViewIfNeeded().catch(() => undefined);
        await demoPause();
        for (let i = 0; i < 3; i++) {
          await page.mouse.wheel(0, 480);
          await pauseForDemo(750);
        }
        await scrollToText(page, /feedback|reply|assistant|standard/i).catch(() => undefined);
      },
      demoPause,
    );

    // ---- 3. Objectives toggle (the scenario's learning goals) ----
    await toggleByIcon(
      page,
      "lucide-list-checks",
      async () => {
        await scrollToText(page, /objective/i).catch(() => undefined);
        await demoPause();
      },
      demoPause,
    );

    // ---- 4. Documents toggle (any reference material attached) ----
    await toggleByIcon(
      page,
      "lucide-file-text",
      async () => {
        await scrollToText(page, /document|context|reference/i).catch(() => undefined);
        await demoPause();
      },
      demoPause,
    );

    // ---- Final beat back on the scorecard so the clip ends substantive ----
    await scrollToText(page, /score|standard|passed/i).catch(() => undefined);
    await pauseForDemo(900);

    await saveDemoVideo(page, "how-it-works-rubric");
  });
});
