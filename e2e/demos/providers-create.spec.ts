// # coverage: NON-DESTRUCTIVE full-page tour of the provider NEW form
// (/intelligence/providers/new). Types into the Name field (pressSequentially
// so the typing shows on camera) and the Description, then scrolls top->bottom
// through EVERY step section the GenericForm renders for a provider — Basic
// (name + value + description + flags + departments), Endpoint, and Key —
// holding ~1s on each so its title + controls read. Reveals the Departments
// and Key pickers (open the combobox → type into its "Search..." box so the
// list visibly narrows → Escape, nothing selected), and scrolls the submit row
// into view. Every beat past the one page-ready assertion is guarded
// (isVisible().catch / scrollToText no-op on an absent target) and strictly
// non-destructive: the form is NEVER submitted (the "Create Provider" button is
// never clicked), no API key is ever typed (the Key step is reveal-only — the
// picker is open-then-Escape), and every picker is open-then-Escape.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "providers-create";

// The step sections the provider form renders, top->bottom. Each entry is
// { stepId, heading } so we can scroll the section's card into frame and hold
// on its title. These are the exact step ids the Provider GenericForm wires
// (basic / endpoint / key), so each scroll lands on a real, mounted card.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /^basic$/i },
  { stepId: "endpoint", heading: /^endpoint$/i },
  { stepId: "key", heading: /^key$/i },
];

// Open a resource combobox picker (the shared GenericPicker trigger renders
// role="combobox" aria-label="Select item"), type into its "Search..." box so
// the option list visibly narrows, then dismiss with Escape. NON-DESTRUCTIVE:
// nothing is ever selected. Guarded throughout so an absent/empty picker is a
// clean no-op. `nth` lets us target a specific picker on the page.
async function tourPicker(
  picker: import("@playwright/test").Locator,
  query: string,
): Promise<void> {
  if (!(await picker.isVisible().catch(() => false))) return;
  await picker.scrollIntoViewIfNeeded().catch(() => undefined);
  await picker.click().catch(() => undefined);
  await pauseForDemo(1_100);
  const search = picker.page().getByPlaceholder(/search/i).first();
  if (await search.isVisible().catch(() => false)) {
    await search.pressSequentially(query, { delay: 55 }).catch(() => undefined);
    await pauseForDemo(1_200);
  }
  await picker.page().keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(800);
}

test.describe("demo: providers create", () => {
  test("tours the provider new-form sections, endpoint + key, and pickers", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/intelligence/providers/new");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the GenericForm root. Keep exactly one.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Wait out any loading skeleton so the populated form — not the shimmer —
    // opens the clip, then hold a beat on the rendered form.
    await settleLoaded(page);

    // BEAT 1 — type into the provider Name field (placeholder "e.g., OpenAI")
    // so the typing shows on camera (pressSequentially with a delay). Authoring
    // a name is the heart of building a provider. Guarded so an absent field is
    // a clean no-op. NOT a mutation — autosave drafts are reversible and the
    // form is never submitted.
    const nameInput = page.getByPlaceholder(/e\.g\.,?\s*openai/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Acme Inference", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // BEAT 2 — fill the Description so the Basic section reads as a real,
    // in-progress provider. Typed (pressSequentially) so it shows. Guarded.
    const descInput = page.getByPlaceholder(/enter description/i).first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await descInput.click().catch(() => undefined);
      await descInput
        .pressSequentially("Hosted inference provider for tutoring models.", { delay: 18 })
        .catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // BEAT 3 — open the Departments picker inside the Basic step to reveal the
    // scoping options, narrow them by typing in the search box, then Escape
    // WITHOUT selecting (reversible, nothing committed). The first combobox on
    // the page is the Departments picker (Values renders a free-text input, not
    // a combobox, in new mode). Guarded.
    const deptPicker = page.getByRole("combobox", { name: /select item/i }).first();
    await tourPicker(deptPicker, "dep");

    // BEAT 4 — scroll top->bottom through EVERY rendered step section (Basic →
    // Endpoint → Key), holding ~1s on each so its title + controls read. Each
    // scroll is a guarded no-op for a section that isn't mounted.
    for (const { stepId, heading } of STEP_SECTIONS) {
      const section = page.getByTestId(`artifact-form-step-${stepId}`).first();
      if (await section.isVisible().catch(() => false)) {
        await section.scrollIntoViewIfNeeded().catch(() => undefined);
        await scrollToText(page, heading);
        await pauseForDemo(1_100);
      }
    }

    // BEAT 5 — type into the Endpoint URL field (placeholder "Enter endpoint
    // URL") so the Endpoint section reads as configured. Typed so it shows.
    // Guarded. Reversible draft text, never submitted.
    const endpointInput = page.getByPlaceholder(/enter endpoint url/i).first();
    if (await endpointInput.isVisible().catch(() => false)) {
      await endpointInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await endpointInput.click().catch(() => undefined);
      await endpointInput
        .pressSequentially("https://api.acme.example/v1", { delay: 30 })
        .catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // BEAT 6 — reveal the Key picker (the Key step's combobox) so the
    // credential-selection affordance registers on frame. NON-DESTRUCTIVE and
    // SECURITY-SAFE: we never type a real API key — we only open the picker,
    // type a harmless query into its search box to show the list narrow, then
    // Escape WITHOUT selecting or revealing any key. The Key combobox is the
    // last combobox on the page (it lives in the final step). Guarded.
    const keyPicker = page.getByRole("combobox", { name: /select item/i }).last();
    await tourPicker(keyPicker, "key");

    // BEAT 7 — scroll the submit row into view so the "Create Provider" button
    // reads on camera, then HOLD without clicking. Strictly non-destructive:
    // the button is only brought into frame, never pressed. Guarded.
    const submit = page.getByTestId("artifact-form-submit").first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_400);
    }

    // End held on the top of the populated form (Basic) so the clip closes on
    // substantive, in-progress provider content.
    const top = page.getByTestId("artifact-form-step-basic").first();
    if (await top.isVisible().catch(() => false)) {
      await top.scrollIntoViewIfNeeded().catch(() => undefined);
      await scrollToText(page, /^basic$/i);
      await pauseForDemo(1_200);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
