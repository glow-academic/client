// # coverage: NON-DESTRUCTIVE full-page FORM-TOUR of the document NEW form
// (/management/documents/new). Types into the document Name field
// (pressSequentially so the typing shows on camera) then CLEARS it, types a
// Description into the Basic textarea then CLEARS it, and scrolls top->bottom
// through EVERY step section the Document GenericForm renders — Basic
// (name + description + departments + flags), Fields (parameter-field picker),
// Files (the upload dropzone), Images, and Texts — holding ~1s on each so its
// title + controls read. Reveals the read-only pickers it can without
// committing: the Files combobox is open-then-Escape (its "Search..." list is
// revealed, narrowed, then dismissed with NOTHING selected), and a Fields
// parameter-group is expanded to reveal its options then collapsed again. The
// upload dropzone is REVEAL-ONLY — it is scrolled into frame and held but NEVER
// clicked (a click opens the OS file picker) and NO file is ever chosen or
// uploaded. The submit row is scrolled into view and held but the
// "Create Document" button is NEVER clicked. Every beat past the one page-ready
// assertion is guarded (isVisible().catch / scrollToText no-op on an absent
// target) and strictly non-destructive: the form is never submitted, and any
// text typed into the Name / Description is cleared before the clip ends so no
// draft content is left committed.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "documents-create";

// The step sections the document form renders, top->bottom. Each entry is
// { stepId, heading } so we can scroll the section's card into frame and hold
// on its title. These are the exact step ids the Document GenericForm wires
// (basic / fields / uploads / images / texts), so each scroll lands on a real,
// mounted card.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /basic information/i },
  { stepId: "fields", heading: /^fields$/i },
  { stepId: "uploads", heading: /^files$/i },
  { stepId: "images", heading: /^images$/i },
  { stepId: "texts", heading: /^texts$/i },
];

test.describe("demo: documents create", () => {
  test("tours the document new-form sections, dropzone, and pickers", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/management/documents/new");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the GenericForm root. Keep exactly one.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Wait out any loading skeleton so the populated form — not the shimmer —
    // opens the clip, then hold a beat on the rendered form.
    await settleLoaded(page);

    // BEAT 1 — type into the document Name field (placeholder
    // "e.g., Course Syllabus") so the typing shows on camera (pressSequentially
    // with a delay), then CLEAR it. Authoring a name is the heart of building a
    // document. Guarded so an absent field is a clean no-op. NON-DESTRUCTIVE —
    // the typed text is cleared and the form is never submitted.
    const nameInput = page.getByPlaceholder(/e\.g\.,?\s*course syllabus/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Course Syllabus", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_200);
      await nameInput.fill("").catch(() => undefined);
      await pauseForDemo(500);
    }

    // BEAT 2 — type into the Basic Description textarea (placeholder
    // "Document description and purpose") so the Basic section reads as a real,
    // in-progress document, then CLEAR it. Typed (pressSequentially) so it
    // shows. Guarded + reversible.
    const descInput = page.getByPlaceholder(/document description and purpose/i).first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await descInput.click().catch(() => undefined);
      await descInput
        .pressSequentially("Syllabus and reference material for the course.", { delay: 18 })
        .catch(() => undefined);
      await pauseForDemo(1_200);
      await descInput.fill("").catch(() => undefined);
      await pauseForDemo(500);
    }

    // BEAT 3 — reveal the Departments scoping affordance in the Basic step. It
    // renders as an inline SelectableGrid of department cards (not a combobox),
    // so we scroll the first option card into frame and hold — REVEAL-ONLY, we
    // never click a card (a click would toggle a draft selection). Guarded.
    const deptCard = page.getByTestId("selectable-option").first();
    if (await deptCard.isVisible().catch(() => false)) {
      await deptCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // BEAT 4 — scroll top->bottom through EVERY rendered step section (Basic →
    // Fields → Files → Images → Texts), holding ~1s on each so its title +
    // controls read. After any in-page scroll the form is already settled, but
    // re-settle defensively so no transient frame is captured. Each scroll is a
    // guarded no-op for a section that isn't mounted.
    for (const { stepId, heading } of STEP_SECTIONS) {
      const section = page.getByTestId(`artifact-form-step-${stepId}`).first();
      if (await section.isVisible().catch(() => false)) {
        await section.scrollIntoViewIfNeeded().catch(() => undefined);
        await scrollToText(page, heading);
        await pauseForDemo(1_100);
      }
    }

    // BEAT 5 — expand a Fields parameter-group to reveal its field options on
    // camera, hold so they read, then collapse it again. Expanding a group only
    // lazy-loads its options (a read, not a mutation); we never click a field
    // option card. Guarded so an absent group is a clean no-op.
    const fieldGroup = page.getByTestId("parameter-group-toggle").first();
    if (await fieldGroup.isVisible().catch(() => false)) {
      await fieldGroup.scrollIntoViewIfNeeded().catch(() => undefined);
      await fieldGroup.click().catch(() => undefined);
      await pauseForDemo(1_300);
      // Collapse again so nothing is left expanded — purely a view toggle.
      await fieldGroup.click().catch(() => undefined);
      await pauseForDemo(600);
    }

    // BEAT 6 — reveal the Files upload dropzone so the upload affordance
    // registers on frame. REVEAL-ONLY: we scroll it into view and hold, but
    // NEVER click it (a click opens the OS file picker) and NO file is ever
    // chosen or uploaded. Guarded.
    const dropzone = page.getByText(/drag & drop files here, or click to select/i).first();
    if (await dropzone.isVisible().catch(() => false)) {
      await dropzone.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_300);
    }

    // BEAT 7 — open the Files existing-file picker (the shared GenericPicker
    // trigger renders role="combobox" aria-label="Select item") to reveal the
    // selectable-files list, type a harmless query into its "Search..." box so
    // the list visibly narrows, then dismiss with Escape WITHOUT selecting
    // anything. NON-DESTRUCTIVE + guarded — an absent/empty picker (no existing
    // files) is a clean no-op.
    const filePicker = page.getByRole("combobox", { name: /select item/i }).first();
    if (await filePicker.isVisible().catch(() => false)) {
      await filePicker.scrollIntoViewIfNeeded().catch(() => undefined);
      await filePicker.click().catch(() => undefined);
      await pauseForDemo(1_100);
      const search = page.getByPlaceholder(/search/i).first();
      if (await search.isVisible().catch(() => false)) {
        await search.pressSequentially("doc", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_200);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 8 — scroll the submit row into view so the "Create Document" button
    // reads on camera, then HOLD without clicking. Strictly non-destructive:
    // the button is only brought into frame, never pressed. Guarded.
    const submit = page.getByTestId("artifact-form-submit").first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_400);
    }

    // End held on the top of the form (Basic) so the clip closes on the
    // primary document-building content.
    const top = page.getByTestId("artifact-form-step-basic").first();
    if (await top.isVisible().catch(() => false)) {
      await top.scrollIntoViewIfNeeded().catch(() => undefined);
      await scrollToText(page, /basic information/i);
      await pauseForDemo(1_200);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
