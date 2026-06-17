// TOPIC: chat-message
// coverage: opens a real attempt that HAS a conversation and tours the message
// transcript — the back-and-forth between the learner and the AI persona (user
// turns, assistant replies, any annotations). The prior version sat on the
// /practice list and only hovered a Start button, never showing a chat (the data
// exists: 28 chats / 5952 messages on-instance).
//
// Resolution mirrors chat-grade/annotated-example-excellent: /attempt/search →
// /attempt/get to find an attempt that actually carries attempt_message rows.
// A graded attempt opens on its scorecard, so we flip to the transcript via the
// rubric Table toggle (lucide-table) and scroll the conversation. Read-only /
// NON-DESTRUCTIVE — view-mode swaps + scrolling only; nothing is sent.

import { expect, type Page } from "@playwright/test";

import { test } from "../fixtures";
import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "chat-message";
const API_BASE = process.env["INTERNAL_API_BASE"] || "http://localhost:8000";

async function resolveAttemptWithMessages(
  request: import("@playwright/test").APIRequestContext,
): Promise<string | undefined> {
  const auth = { Authorization: `Bearer ${process.env["GLOW_RECORD_TOKEN"] ?? ""}` };
  const res = await request.post(`${API_BASE}/attempt/search`, { headers: auth, data: {} });
  const body = res.ok() ? ((await res.json()) as Record<string, unknown>) : {};
  const rows = (body["data"] as Array<Record<string, unknown>>) ?? [];
  const viewable = rows
    .filter((r) => r["show_view"])
    .sort((a, b) => ((b["score"] as number) ?? 0) - ((a["score"] as number) ?? 0));
  for (const r of viewable.slice(0, 10)) {
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

/** Flip a header view-mode toggle by its lucide icon; no-op if absent. */
async function clickIconToggle(page: Page, iconClass: string): Promise<void> {
  const btn = page.locator(`button:has(> svg.${iconClass})`).first();
  if (!(await btn.isVisible().catch(() => false))) return;
  await btn.scrollIntoViewIfNeeded().catch(() => undefined);
  await btn.click({ timeout: 5_000 }).catch(() => undefined);
}

test.describe("demo: chat message", () => {
  test("tour the conversation transcript of a real attempt", async ({ page, request }) => {
    test.setTimeout(120_000);

    const id = await resolveAttemptWithMessages(request);
    test.skip(typeof id !== "string", "no viewable attempt with a transcript to feature");

    await page.goto(`/attempt/${id as string}`, { waitUntil: "domcontentloaded" });
    await expectAuthenticated(page);

    const timer = page.getByTestId("timer").first();
    await expect(timer).toBeVisible({ timeout: 45_000 });
    await pauseForDemo(2_000);

    // A graded attempt opens on the scorecard — flip to the conversation
    // transcript (the message thread is the headline of this demo).
    await clickIconToggle(page, "lucide-table");
    await pauseForDemo(900);

    const transcript = page.getByTestId("attempt-messages-container").first();
    if (await transcript.isVisible().catch(() => false)) {
      await transcript.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // Tour the message thread — slow scroll through the user/assistant turns.
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 460);
      await pauseForDemo(750);
    }
    await scrollToText(page, /assistant|reply|feedback|message/i).catch(() => undefined);
    await pauseForDemo(900);

    await saveDemoVideo(page, TOPIC);
  });
});
