import { expect, type Page } from "@playwright/test";

import { test } from "../fixtures";
import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: an intro overview of how a graded practice-attempt review works.
// A completed+graded attempt opens on its RUBRIC SCORECARD by default (the
// server sets show_results so AttemptChat auto-swaps to RubricView). We tour
// the scorecard (the annotated grade), flip to the conversation transcript via
// the rubric view-toggle and scroll it, then exercise the Objectives +
// Documents header toggles, ending back on the scorecard. Read-only
// throughout: every header control is a reversible view-mode swap, nothing is
// sent/confirmed, the chat input is never used.
//
// Resolution gotcha (mirrors annotated-example-overview): the top-scored
// attempts can have an EMPTY transcript (0 messages) so MessagesView never
// mounts and a naive `attempt-messages-container` assertion fails. We anchor on
// the always-present header `timer` pill and resolve the best-scored attempt
// that actually HAS a conversation so the transcript toggle reveals real
// content.

const API_BASE = process.env["INTERNAL_API_BASE"] || "http://localhost:8000";

/** Resolve a graded, viewable attempt that actually has a transcript
 *  (entries.attempt_message); falls back to the top-scored one. */
async function resolveRichAttempt(
  request: import("@playwright/test").APIRequestContext,
): Promise<string | undefined> {
  const auth = { Authorization: `Bearer ${process.env["GLOW_RECORD_TOKEN"] ?? ""}` };
  const res = await request.post(`${API_BASE}/attempt/search`, { headers: auth, data: {} });
  const body = res.ok() ? ((await res.json()) as Record<string, unknown>) : {};
  const rows = (body["data"] as Array<Record<string, unknown>>) ?? [];
  const viewable = rows
    .filter((r) => r["show_view"] && typeof r["score"] === "number")
    .sort((a, b) => (b["score"] as number) - (a["score"] as number));
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

/** Click an icon-only header toggle (resolved by its lucide svg class — the
 *  buttons are icon+tooltip with no accessible name), hold, then toggle back. */
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
  await page.locator(sel).first().click({ timeout: 5_000 }).catch(() => undefined);
  await demoPause();
  return true;
}

test.describe("demo: how-it-works overview", () => {
  test("intro: how a graded attempt review works (scorecard + conversation)", async ({
    page,
    demo,
    request,
  }) => {
    test.setTimeout(120_000);
    const demoPause = () => demo.pause(900);

    const id = await resolveRichAttempt(request);
    test.skip(typeof id !== "string", "no completed+viewable attempt to feature");

    // Live chat websocket → networkidle never settles; DOM-only navigation.
    await page.goto(`/attempt/${id as string}`, { waitUntil: "domcontentloaded" });
    await expectAuthenticated(page);

    // ONE hard page-ready assertion: header `timer` pill renders for any
    // attempt view; anchor on it alone (a message-bearing attempt also mounts
    // the transcript container, so an `.or()` over both would multi-match under
    // strict mode). Everything after is guarded.
    const timer = page.getByTestId("timer").first();
    await expect(timer).toBeVisible({ timeout: 45_000 });
    await demo.pause(2_500);

    // ---- 1. Completed badge + pass/fail score pill + the scorecard ----
    await scrollToText(page, /complete|passed|failed|score/i).catch(() => undefined);
    if (await timer.isVisible().catch(() => false)) {
      await timer.hover().catch(() => undefined);
      await demoPause();
    }
    for (let i = 0; i < 2; i++) {
      await page.mouse.wheel(0, 420);
      await pauseForDemo(750);
    }
    await scrollToText(page, /standard|points|criteria|feedback/i).catch(() => undefined);
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
        await scrollToText(page, /assistant|reply|feedback/i).catch(() => undefined);
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

    // ---- 4. Documents toggle (reference material) ----
    await toggleByIcon(
      page,
      "lucide-file-text",
      async () => {
        await scrollToText(page, /document|context|reference/i).catch(() => undefined);
        await demoPause();
      },
      demoPause,
    );

    // ---- End back on the scorecard so the clip closes substantive ----
    await scrollToText(page, /score|standard|passed/i).catch(() => undefined);
    await pauseForDemo(900);

    await saveDemoVideo(page, "how-it-works-overview");
  });
});
