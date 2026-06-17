// TOPIC: chat-grade
// coverage: opens a real GRADED attempt and tours its grading — the rubric
// scorecard (score / passed / criteria / feedback) a completed chat attempt opens
// on by default, then flips to the graded conversation transcript and back. The
// prior version sat on the /practice list and never opened a graded attempt, so it
// showed an empty Practice page (the data exists: 19 graded attempts on-instance).
//
// Resolution (mirrors annotated-example-excellent): /attempt/search → filter
// viewable+scored → probe /attempt/get for one that actually HAS a transcript so
// the conversation toggle reveals real content. Read-only / NON-DESTRUCTIVE: every
// beat is a reversible view-mode swap; nothing is submitted. Anchors on the always-
// present header `timer` pill; test.skip if the instance has no graded attempt.

import { expect, type Page } from "@playwright/test";

import { test } from "../fixtures";
import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "chat-grade";
const API_BASE = process.env["INTERNAL_API_BASE"] || "http://localhost:8000";

async function resolveGradedAttempt(
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

async function toggleByIcon(page: Page, iconClass: string, hold: () => Promise<void>): Promise<void> {
  const sel = `button:has(> svg.${iconClass})`;
  const btn = page.locator(sel).first();
  if (!(await btn.isVisible().catch(() => false))) return;
  await btn.scrollIntoViewIfNeeded().catch(() => undefined);
  await pauseForDemo(700);
  await btn.click({ timeout: 5_000 }).catch(() => undefined);
  await hold();
  await page.locator(sel).first().click({ timeout: 5_000 }).catch(() => undefined);
  await pauseForDemo(700);
}

test.describe("demo: chat grade", () => {
  test("tour a graded attempt's rubric scorecard and graded transcript", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);

    const id = await resolveGradedAttempt(request);
    test.skip(typeof id !== "string", "no graded, viewable attempt to feature");

    // Attempt review opens a live chat websocket → networkidle never settles.
    await page.goto(`/attempt/${id as string}`, { waitUntil: "domcontentloaded" });
    await expectAuthenticated(page);

    // ONE page-ready anchor: the header `timer` pill (present in any attempt view).
    const timer = page.getByTestId("timer").first();
    await expect(timer).toBeVisible({ timeout: 45_000 });
    await pauseForDemo(2_000);

    // ---- 1. The grade: tour the default rubric scorecard ----
    await scrollToText(page, /score|passed|rubric|standard/i).catch(() => undefined);
    await timer.hover().catch(() => undefined); // Passed (score) tooltip
    await pauseForDemo(900);
    for (let i = 0; i < 2; i++) {
      await page.mouse.wheel(0, 420);
      await pauseForDemo(750);
    }
    await scrollToText(page, /feedback|criteria|points|standard/i).catch(() => undefined);
    await pauseForDemo(900);

    // ---- 2. Flip to the graded conversation transcript, then back ----
    await toggleByIcon(page, "lucide-table", async () => {
      const tx = page.getByTestId("attempt-messages-container").first();
      await tx.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
      for (let i = 0; i < 2; i++) {
        await page.mouse.wheel(0, 480);
        await pauseForDemo(750);
      }
      await scrollToText(page, /feedback|reply|assistant/i).catch(() => undefined);
    });

    // ---- Final beat back on the scorecard ----
    await scrollToText(page, /score|standard|passed/i).catch(() => undefined);
    await pauseForDemo(900);

    await saveDemoVideo(page, TOPIC);
  });
});
