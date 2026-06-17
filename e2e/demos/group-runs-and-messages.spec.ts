import { expect, type Page } from "@playwright/test";

import { test } from "../fixtures";
import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: full-page READ-ONLY tour of a pricing GROUP's runs + messages.
// A pricing group (analytics/pricing/{groupId} -> Group.tsx) stacks one run at
// a time — a "Run N of M" header with that run's cost/token totals and
// model/agent/profile metadata, a scrollable message transcript, four
// view-mode toggles (system prompt / developer prompt / tool calls / previous
// context), and a pagination footer to step through every run. This demo tours
// all of it: scroll the metadata + transcript, flip each toggle on then back
// off, then page Next -> Last -> First -> back through the runs. Every beat is
// a reversible view-mode change — nothing is ever submitted or mutated.
//
// Resolution gotcha (why this isn't a plain page.goto): the route's groupId is
// a real entity id, and the Group component returns null unless that group
// actually carries runs. We API-resolve via /system/groups, prefer the group
// with the MOST runs (so the "Run N of M" pager has somewhere to go), and
// test.skip if the instance has no run-bearing group at all. After navigation
// we hard-gate the loading skeleton (settleLoaded) so no shimmer frame lands in
// the clip, and anchor on the always-present "Run 1 of N" header.

const TOPIC = "group-runs-and-messages";
const API_BASE = process.env["INTERNAL_API_BASE"] || "http://localhost:8000";

type GroupRow = {
  group_id: string | null;
  run_count?: number | null;
  group_name?: string | null;
};

/** Resolve a pricing group that has runs, preferring the one with the most
 *  runs so the run-pager is exercised. Probes /system/groups (the same source
 *  the pricing list page reads); returns undefined when no run-bearing group
 *  exists so the caller can skip. */
async function resolveGroupWithRuns(
  request: import("@playwright/test").APIRequestContext,
): Promise<string | undefined> {
  const auth = { Authorization: `Bearer ${process.env["GLOW_RECORD_TOKEN"] ?? ""}` };
  // NOTE: /system/groups is 0-indexed — page 1 is the *second* page (empty
  // here, since all groups fit on page 0), which silently skipped this demo.
  const res = await request.post(`${API_BASE}/system/groups`, {
    headers: auth,
    data: { page: 0, page_size: 100, sort_by: "run_count", sort_order: "desc" },
  });
  if (!res.ok()) return undefined;
  const body = (await res.json()) as Record<string, unknown>;
  const rows = ((body["data"] as GroupRow[]) ?? []).filter(
    (g): g is GroupRow & { group_id: string } =>
      typeof g.group_id === "string" && (g.run_count ?? 0) >= 1,
  );
  rows.sort((a, b) => (b.run_count ?? 0) - (a.run_count ?? 0));
  return rows[0]?.group_id;
}

/** Flip a Group view-mode Switch on (reveal), hold so the changed transcript
 *  reads, then flip it back off so the next beat starts clean. The Switch is a
 *  Radix button[role=switch] wired to a Label via htmlFor=id; we resolve it by
 *  that id. No-op when the toggle is absent (e.g. "previous context" only
 *  renders past the first run). Fully non-destructive — view state only. */
async function flipToggle(
  page: Page,
  id: string,
  hold: () => Promise<void>,
): Promise<void> {
  const sw = page.locator(`#${id}`).first();
  if (!(await sw.isVisible().catch(() => false))) return;
  await sw.scrollIntoViewIfNeeded().catch(() => undefined);
  await sw.click({ timeout: 5_000 }).catch(() => undefined);
  await hold();
  // Toggle back to the default so toggles compose cleanly.
  await page.locator(`#${id}`).first().click({ timeout: 5_000 }).catch(() => undefined);
  await pauseForDemo(700);
}

/** Click a run-pager button by its sr-only label, then settle the swapped-in
 *  run. No-op when absent (single-run group has no footer) or disabled. */
async function pageRun(page: Page, srLabel: RegExp, hold: () => Promise<void>): Promise<void> {
  const btn = page.getByRole("button", { name: srLabel }).first();
  if (!(await btn.isVisible().catch(() => false))) return;
  if (await btn.isDisabled().catch(() => false)) return;
  await btn.scrollIntoViewIfNeeded().catch(() => undefined);
  await btn.click({ timeout: 5_000 }).catch(() => undefined);
  await hold();
}

test.describe("demo: group runs and messages", () => {
  test("tour a pricing group's runs, token totals, and message transcript", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);

    const groupId = await resolveGroupWithRuns(request);
    test.skip(typeof groupId !== "string", "no pricing group with runs to feature");

    await page.goto(`/analytics/pricing/${groupId as string}`);
    await expectAuthenticated(page);

    // ONE hard page-ready assertion: the run header ("Run 1 of N") is present
    // for any group that carries runs. Everything after this is guarded.
    const runHeading = page.getByRole("heading", { name: /Run\s+\d+\s+of\s+\d+/i }).first();
    await expect(runHeading).toBeVisible({ timeout: 45_000 });
    // Hard skeleton gate so no loading shimmer frame is recorded.
    await settleLoaded(page);

    // ---- 1. The run header: token totals + model/agent/profile metadata ----
    await runHeading.scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseForDemo(1_000);
    await scrollToText(page, /Cost|Input Tokens|Output Tokens|Cached Tokens/i);
    await scrollToText(page, /Model:|Agent:|Profile:|Created:/i);
    await pauseForDemo(900);

    // ---- 2. Scroll the message transcript ----
    await scrollToText(page, /message|content|No messages/i).catch(() => undefined);
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 420);
      await pauseForDemo(700);
    }

    // ---- 3. View-mode toggles: reveal each, then restore ----
    // System prompt — surfaces the run's hidden system message.
    await flipToggle(page, "show-system-prompt", async () => {
      await scrollToText(page, /system|prompt|instruction/i).catch(() => undefined);
      await pauseForDemo(1_000);
    });
    // Developer prompt — surfaces the developer-role message.
    await flipToggle(page, "show-developer-prompt", async () => {
      await scrollToText(page, /developer|prompt/i).catch(() => undefined);
      await pauseForDemo(900);
    });
    // Tool calls — toggles the tool-call bubbles in the transcript.
    await flipToggle(page, "show-tool-calls", async () => {
      await scrollToText(page, /tool|call|message/i).catch(() => undefined);
      await pauseForDemo(900);
    });

    // ---- 4. Page through the runs (Next -> Last -> First -> Previous) ----
    await pageRun(page, /go to next run/i, async () => {
      await settleLoaded(page);
      // "Previous context" toggle only renders past the first run — exercise it.
      await flipToggle(page, "show-previous-context", async () => {
        await scrollToText(page, /Previous context|message/i).catch(() => undefined);
        await pauseForDemo(900);
      });
      await scrollToText(page, /Run\s+\d+\s+of\s+\d+/i).catch(() => undefined);
    });
    await pageRun(page, /go to last run/i, async () => {
      await settleLoaded(page);
      await scrollToText(page, /Cost|Input Tokens|message/i).catch(() => undefined);
    });
    await pageRun(page, /go to first run/i, async () => {
      await settleLoaded(page);
      await scrollToText(page, /Run\s+1\s+of\s+\d+/i).catch(() => undefined);
    });

    // ---- Final beat back on the opening run so the clip ends substantive ----
    await runHeading.scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseForDemo(900);

    await saveDemoVideo(page, TOPIC);
  });
});
