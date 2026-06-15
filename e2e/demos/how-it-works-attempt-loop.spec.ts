import { expect, type Page } from "@playwright/test";

import { test } from "../fixtures";
import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: full-page tour of a graded attempt that EMPHASIZES the
// multi-turn conversation loop. A completed+graded attempt opens on its rubric
// scorecard by default (the server sets show_results, so AttemptChat auto-swaps
// to RubricView), so we flip to the conversation transcript EARLY via the
// rubric Table view-toggle (button:has(> svg.lucide-table)) and scroll the
// student<->assistant back-and-forth thread top->bottom — that loop is the
// headline of this how-it-works clip. We then flip back to the annotated
// scorecard and exercise the Objectives (lucide-list-checks) / Documents
// (lucide-file-text) header toggles. Read-only throughout: every header control
// is a reversible view-mode swap, nothing is ever submitted, and every beat
// past the one page-ready assertion no-ops when its target is absent.
//
// Resolution gotcha (why this isn't a one-line attemptDemo): the top-scored
// attempts on the demo instance can have an EMPTY transcript (0 messages), so
// the live MessagesView container never mounts and a naive
// `attempt-messages-container` assertion fails. We anchor on the always-present
// header `timer` pill, and resolve the best-scored attempt that actually HAS a
// conversation so the transcript toggle reveals the real back-and-forth.

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

test.describe("demo: how-it-works attempt loop", () => {
  test("tour the multi-turn conversation and its scorecard", async ({
    page,
    demo,
    request,
  }) => {
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

    // ---- 1. The conversation LOOP (headline): flip to the transcript early ----
    // The graded attempt opens on the rubric scorecard, so the Table toggle
    // swaps RubricView -> MessagesView. We scroll the student<->assistant
    // back-and-forth top->bottom so the multi-turn loop reads in full.
    const sawTranscript = await toggleByIcon(
      page,
      "lucide-table",
      async () => {
        const tx = page.getByTestId("attempt-messages-container").first();
        await tx.scrollIntoViewIfNeeded().catch(() => undefined);
        await demoPause();
        // Walk the thread top->bottom, holding ~1s per scroll so each turn reads.
        for (let i = 0; i < 4; i++) {
          await page.mouse.wheel(0, 480);
          await pauseForDemo(900);
        }
        await scrollToText(page, /reply|assistant|user|response|message/i).catch(
          () => undefined,
        );
        await pauseForDemo(900);
      },
      demoPause,
    );
    // Fallback if no Table toggle (e.g. attempt without a rubric): the
    // transcript may already be on screen — still tour it.
    if (!sawTranscript) {
      const tx = page.getByTestId("attempt-messages-container").first();
      if (await tx.isVisible().catch(() => false)) {
        await tx.scrollIntoViewIfNeeded().catch(() => undefined);
        for (let i = 0; i < 3; i++) {
          await page.mouse.wheel(0, 480);
          await pauseForDemo(900);
        }
      }
    }

    // ---- 2. Back on the annotated grade: tour the rubric scorecard ----
    await scrollToText(page, /score|passed|standard|rubric/i).catch(() => undefined);
    if (await timer.isVisible().catch(() => false)) {
      await timer.hover().catch(() => undefined); // reveals the Passed (score) tooltip
      await demoPause();
    }
    for (let i = 0; i < 2; i++) {
      await page.mouse.wheel(0, 420);
      await pauseForDemo(750);
    }
    await scrollToText(page, /feedback|criteria|points|standard/i).catch(() => undefined);
    await pauseForDemo(900);

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

    await saveDemoVideo(page, "how-it-works-attempt-loop");
  });
});
