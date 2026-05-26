// ArtifactForm — generic page object for the create/edit forms.
//
// Every GLOW artifact form is the same `GenericForm`: a `artifact-form`
// root, ordered `artifact-form-step-{id}` sections, and an
// `artifact-form-submit` button. Field inputs and required picker steps
// differ per domain, so those come from the DomainSpec (fields map +
// requiredPickers). Picker options carry a shared `selectable-option`
// testid (see components/common/forms/SelectableGrid.tsx).

import { expect, type Locator, type Page } from "@playwright/test";

import { DemoDriver } from "../demo/DemoDriver";
import type { DomainSpec, FieldLocator } from "./domains";

export class ArtifactForm {
  constructor(
    private readonly page: Page,
    private readonly demo: DemoDriver,
    private readonly spec: DomainSpec,
  ) {}

  private get root(): Locator {
    return this.page.getByTestId("artifact-form");
  }

  /** Navigate to the "new" route (or a variant path, e.g. ?mode=assessment)
   *  and wait for the form. */
  async openNew(path?: string): Promise<void> {
    await this.page.goto(path ?? this.spec.newPath);
    await expect(this.root).toBeVisible({ timeout: 30_000 });
    await this.demo.pause();
  }

  /** Open an existing artifact's edit page — the `[id]` route renders the same
   *  GenericForm in edit mode — and wait for the form. */
  async openEdit(path: string): Promise<void> {
    await this.page.goto(path);
    await expect(this.root).toBeVisible({ timeout: 30_000 });
    await this.demo.pause();
  }

  /** Toggle a feature flag by its type — the `#flag-{type}` switch. Used to
   *  reveal conditional steps (e.g. a scenario's Context or Video step). */
  async toggleFlag(flagType: string): Promise<void> {
    const sw = this.page.locator(`#flag-${flagType}`);
    if (!(await this.visibleSoon(sw))) return;
    await this.demo.scrollTo(sw);
    await this.demo.click(sw);
  }

  /** Upload a file into a step's (hidden) <input type=file> — images/video.
   *  setInputFiles works on hidden inputs, so no need to open a dialog. */
  async uploadFile(stepId: string, file: string): Promise<void> {
    const input = this.page
      .getByTestId(`artifact-form-step-${stepId}`)
      .locator('input[type="file"]')
      .first();
    if ((await input.count()) === 0) return;
    await input.setInputFiles(file);
    await this.demo.pause();
  }

  private locate(field: FieldLocator): Locator {
    if (field.testId) return this.page.getByTestId(field.testId);
    if (field.placeholder) return this.page.getByPlaceholder(field.placeholder);
    if (field.label) return this.page.getByLabel(field.label);
    throw new Error("FieldLocator must specify testId, placeholder, or label");
  }

  /** Fill a named field defined in the DomainSpec. */
  async fill(fieldName: string, value: string): Promise<void> {
    const field = this.spec.fields[fieldName];
    if (!field) {
      throw new Error(`Unknown field "${fieldName}" for ${this.spec.singular}`);
    }
    await this.demo.type(this.locate(field), value);
  }

  /**
   * Fill a field only if it's actually on screen. Conditional sections (e.g.
   * a scenario's Objectives, revealed by a flag) may not render — or may get
   * cleared by a draft re-seed — and a plain fill would then hang until the
   * test times out. Returns whether it filled. Best-effort by design.
   */
  async fillIfPresent(fieldName: string, value: string): Promise<boolean> {
    const field = this.spec.fields[fieldName];
    if (!field) return false;
    const locator = this.locate(field);
    if (!(await this.visibleSoon(locator, 4_000))) return false;
    await this.demo.type(locator, value);
    return true;
  }

  /**
   * Re-fill a field only if it's currently empty. Recovers a value a
   * mid-flow re-seed wiped (e.g. the name, cleared by the parameters expand)
   * without re-typing one that survived — so a clean run never re-types on
   * camera.
   */
  async fillIfEmpty(fieldName: string, value: string): Promise<void> {
    const field = this.spec.fields[fieldName];
    if (!field) return;
    const locator = this.locate(field);
    if (!(await this.visibleSoon(locator, 3_000))) return; // not on screen → skip
    const current = await locator.inputValue().catch(() => "");
    if (current.trim() === "") {
      await this.demo.type(locator, value);
    }
  }

  /**
   * Fill a field then press Enter to commit it. Some inputs are creatables
   * that only register on submit — e.g. a profile's email (Enter calls the
   * input's onSubmit / the "Add" handler). Best-effort: skips if absent.
   */
  async fillThenEnter(fieldName: string, value: string): Promise<void> {
    const field = this.spec.fields[fieldName];
    if (!field) return;
    const locator = this.locate(field);
    if (!(await this.visibleSoon(locator, 4_000))) return;
    await this.demo.type(locator, value);
    await locator.press("Enter");
    await this.demo.pause();
  }

  /**
   * Best-effort: add a free-text resource via a step's "create new" sub-form
   * (a document's Texts). The textarea is hidden until "Add new text" is
   * clicked, so a plain fill would hang; this reveals it, types, then clicks
   * "Create" (which collapses the sub-form again). Each locator is scoped to
   * the step and bounded, so it skips cleanly if the sub-form isn't present.
   */
  async addText(stepId: string, value: string): Promise<boolean> {
    const step = this.page.getByTestId(`artifact-form-step-${stepId}`);
    const addBtn = step.getByRole("button", { name: /add new/i });
    if (!(await this.visibleSoon(addBtn))) return false;
    await this.demo.scrollTo(addBtn);
    await this.demo.click(addBtn);
    const textarea = step.getByPlaceholder(/enter text content/i);
    if (!(await this.visibleSoon(textarea, 4_000))) return false;
    await this.demo.type(textarea, value);
    // "Create" commits the content (onTextContentCreate → pending_text_contents)
    // and collapses the sub-form. Scoped + anchored so it can't match the
    // form's own "Create Document" submit.
    const createBtn = step.getByRole("button", { name: /^create$/i });
    if (!(await this.visibleSoon(createBtn))) return false;
    await this.demo.click(createBtn);
    await this.demo.pause();
    return true;
  }

  /**
   * Best-effort: add a tool argument via the Arguments editor. Clicks "Add
   * Argument" to create a row, then types the name into it — field_type
   * defaults to "string", so a named arg is valid and the row autosaves (no
   * separate confirm). Scoped to the arguments step and bounded, so it skips
   * cleanly if the editor isn't present.
   */
  async addArgument(name: string): Promise<boolean> {
    const step = this.page.getByTestId("artifact-form-step-arguments");
    const addBtn = step.getByRole("button", { name: /add argument/i });
    if (!(await this.visibleSoon(addBtn))) return false;
    await this.demo.scrollTo(addBtn);
    await this.demo.click(addBtn);
    const nameInput = step.getByPlaceholder(/argument name/i).first();
    if (!(await this.visibleSoon(nameInput, 4_000))) return false;
    await this.demo.type(nameInput, name);
    await this.demo.pause();
    return true;
  }

  /**
   * Type a system prompt into the agent's `prompt` step. The editor is Monaco
   * (a code editor), so we focus the `.monaco-editor` surface and type via the
   * keyboard rather than filling an <input> — Monaco owns its own buffer.
   * Typing resolves a prompt_id on the next draft save. Bounded + best-effort
   * (Monaco loads lazily); returns whether it typed.
   */
  async addPrompt(text: string): Promise<boolean> {
    const step = this.page.getByTestId("artifact-form-step-prompt");
    const editor = step.locator(".monaco-editor").first();
    if (!(await this.visibleSoon(editor, 10_000))) return false;
    await this.demo.scrollTo(editor);
    await editor.click(); // focus Monaco's hidden input
    await this.page.keyboard.type(text, { delay: 12 });
    await this.demo.pause();
    return true;
  }

  /** Pick the first available option in a picker step (e.g. color, icon). */
  async pickFirst(stepId: string): Promise<void> {
    const step = this.page.getByTestId(`artifact-form-step-${stepId}`);
    await this.demo.scrollTo(step);
    const option = step.getByTestId("selectable-option").first();
    await expect(option).toBeVisible({ timeout: 30_000 });
    await this.demo.click(option);
  }

  /**
   * Re-pick the first option only if nothing in the step is currently
   * selected. Recovers a selection dropped by a draft re-seed. Only
   * meaningful for pickers that expose `data-selected` (e.g. icon); a
   * picker that tracks selection elsewhere (e.g. color, by hex) never
   * reports `data-selected`, so callers shouldn't ask it to "ensure".
   */
  async ensurePicked(stepId: string): Promise<void> {
    const step = this.page.getByTestId(`artifact-form-step-${stepId}`);
    const selected = step.locator(
      '[data-testid="selectable-option"][data-selected]',
    );
    if ((await selected.count()) === 0) {
      await this.demo.click(step.getByTestId("selectable-option").first());
    }
  }

  /**
   * Best-effort: choose the first option of a multi-select grid living
   * inside a step (e.g. departments in "basic", voices in "content").
   * These enrich the artifact but aren't required, so if the backend has
   * no options we simply skip rather than fail.
   */
  async multiSelectFirst(stepId: string): Promise<void> {
    const option = this.page
      .getByTestId(`artifact-form-step-${stepId}`)
      .getByTestId("selectable-option")
      .first();
    if (!(await this.visibleSoon(option))) return;
    await this.demo.scrollTo(option);
    await this.demo.click(option);
  }

  /**
   * Best-effort: choose the first option of a multi-select grid inside a
   * specific picker (by testid), for steps that contain several pickers —
   * e.g. a simulation's Scenarios vs ScenarioRubrics in one step.
   */
  async pickInFirst(testId: string): Promise<void> {
    const option = this.page
      .getByTestId(testId)
      .getByTestId("selectable-option")
      .first();
    if (!(await this.visibleSoon(option, 8_000))) return;
    await this.demo.scrollTo(option);
    await this.demo.click(option);
  }

  /** Best-effort: flip the first toggle (e.g. a flag) inside a step. */
  async toggleFirst(stepId: string): Promise<void> {
    const toggle = this.page
      .getByTestId(`artifact-form-step-${stepId}`)
      .getByRole("switch")
      .first();
    if (!(await this.visibleSoon(toggle))) return;
    await this.demo.scrollTo(toggle);
    await this.demo.click(toggle);
  }

  /**
   * Best-effort: the "open then select" flow — expand the first group in a
   * step (e.g. a parameter), wait for its options to load, then choose the
   * first field. Skips cleanly if the step has no groups/options.
   */
  async expandSelectFirst(stepId: string): Promise<void> {
    const step = this.page.getByTestId(`artifact-form-step-${stepId}`);
    const group = step.getByTestId("parameter-group-toggle").first();
    if (!(await this.visibleSoon(group))) return;
    await this.demo.scrollTo(group);
    await this.demo.click(group);
    const field = step.getByTestId("selectable-option").first();
    if (!(await this.visibleSoon(field, 8_000))) return;
    await this.demo.click(field);
    // Selecting drives a draft save; wait for it to persist (deterministic)
    // so its re-seed can't clobber picks made in later steps.
    await this.waitForDraftSaved();
  }

  /**
   * Wait for the draft autosave to persist — a deterministic state change,
   * not a fixed delay. On the first save the app creates the draft and writes
   * `draftId` to the URL (toast "Draft created"); once present the form is
   * anchored to that draft, so re-seeds restore values instead of clearing
   * them. We also wait for the "Saving…/Save Draft" indicator to clear, which
   * covers later saves (edits) that keep the same `draftId`. Bounded +
   * best-effort so it never hangs a run.
   */
  async waitForDraftSaved(): Promise<void> {
    const pending = this.page.getByRole("button", {
      name: /saving|save draft/i,
    });
    // A change registers a pending state; once it appears, wait for the
    // draft to be created (draftId in the URL) and the save to flush.
    await pending
      .first()
      .waitFor({ state: "visible", timeout: 3_000 })
      .catch(() => undefined);
    // Bounded: personas' draftId lands in ~1s, so a short wait is plenty;
    // forms where it never propagates (scenario) give up fast instead of
    // burning 15s per settle.
    await this.page
      .waitForURL(/[?&]draftId=/, { timeout: 5_000 })
      .catch(() => undefined);
    await expect(pending)
      .toHaveCount(0, { timeout: 6_000 })
      .catch(() => undefined);
    await this.demo.pause();
  }

  /** True if the locator becomes visible within a short window. */
  private async visibleSoon(locator: Locator, timeout = 3_000): Promise<boolean> {
    return locator
      .waitFor({ state: "visible", timeout })
      .then(() => true)
      .catch(() => false);
  }

  async submit(): Promise<void> {
    // Some forms render the submit button twice (responsive desktop/mobile
    // action bars, one hidden via CSS — e.g. profiles). Click the visible one.
    await this.demo.click(
      this.page.locator('[data-testid="artifact-form-submit"]:visible').first(),
    );
  }
}
