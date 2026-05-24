// Domain descriptors + the prose facade.
//
// A DomainSpec is the *only* per-domain code in the whole stack: routes,
// field locators, which picker steps are required for a valid create, the
// "it worked" signal, and the backend endpoints teardown uses to reap.
// The generic Library + ArtifactForm engines read everything else off it.
//
// `DomainFacade` is what tests actually hold — it composes the engines so
// a spec reads like prose:
//
//     await personas.open();
//     await personas.create({ name, instructions: "…" });
//     await expect(personas.card(name)).toBeVisible();
//
// Adding the next domain (rubrics, agents, …) is a new entry in DOMAINS,
// not new logic.

import { expect, type Page } from "@playwright/test";

import { DemoDriver } from "../demo/DemoDriver";
import type { Registry } from "../support/registry";
import { ArtifactForm } from "./artifact-form";
import { Library } from "./library";

export interface FieldLocator {
  testId?: string;
  placeholder?: string | RegExp;
  label?: string | RegExp;
}

/**
 * One step of a create flow, in the form's vertical (top-to-bottom) order —
 * either filling a named field or choosing a picker. Ordering this to match
 * the on-screen layout keeps the recording scrolling smoothly downward
 * instead of jumping between distant sections.
 */
export type CreateStep =
  | { field: string }
  | {
      /** Required single-select grid in artifact-form-step-{picker}. */
      picker: string;
      /**
       * True when the selection is fragile — transient form state that
       * exposes `data-selected` (e.g. icon). create() re-asserts it before
       * submit so a draft re-seed can't silently drop it. Leave false for
       * pickers backed by durable state like color (by hex).
       */
      confirm?: boolean;
    }
  // The following enrich the artifact but aren't required to create it, so
  // they're best-effort — they exercise the code path when data exists and
  // skip cleanly when it doesn't. Each value is the step id to scope within.
  | { multiSelect: string } // first option of the grid in that step
  | { toggle: string } // first switch in that step
  | { expand: string } // open first group → select first field
  | { flag: string } // toggle a feature flag by type (reveals conditional steps)
  | { upload: { step: string; file: string } } // upload a file into a step
  // Wait (deterministically) for the draft to persist — the `draftId`
  // landing in the URL. Place it once after the first inputs so the draft is
  // created and the form anchors to it; later re-seeds then restore values
  // instead of clearing them.
  | { settle: true };

export interface DomainSpec {
  /** Singular noun: card aria-labels, registry kind, teardown lookup. */
  singular: string;
  /** Plural slug used in testids + the list route, e.g. "personas". */
  plural: string;
  listPath: string;
  newPath: string;
  /** Friendly field name -> how to locate its input on the form. */
  fields: Record<string, FieldLocator>;
  /** The create flow in the form's vertical order (fields + pickers).
   *  Optional when `variants` supplies mode-specific flows instead. */
  createOrder?: CreateStep[];
  /**
   * Mode variants — e.g. a scenario's "contextual" vs "assessment" form.
   * Each appends a query to the new-form URL and supplies its own create
   * flow. `create(input, variant)` selects one.
   */
  variants?: Record<string, { query?: string; createOrder: CreateStep[] }>;
  /**
   * Recovery rules for submit-time validation errors. When a required value
   * is wiped by a mid-flow re-seed, the backend rejects with a specific
   * "… is required" message; if that error is showing, re-run `redo`. This
   * is how an undetectable selection like color (no DOM `data-selected`)
   * gets re-applied — gated on the form actually reporting it missing.
   */
  reconcile?: Array<{ error: RegExp; redo: CreateStep }>;
  /** Text (toast/redirect) proving a create succeeded. */
  createdSignal: RegExp;
  /** Backend contract used by resolve-by-name teardown (NOT client routes). */
  api: {
    search: string; // e.g. "/persona/search"
    delete: string; // e.g. "/persona/delete"
    idKey: string; // row id field, e.g. "persona_id"
    listKey: string; // response array field, e.g. "personas"
    /** Build the delete request body from resolved ids. Domains differ
     *  (persona uses `ids`, scenario uses `scenario_ids`). */
    deleteBody?: (ids: string[]) => Record<string, unknown>;
  };
}

/** What a `.create()` accepts: a required `name` plus any other fields. */
export type CreateInput = { name: string } & Record<string, string>;

export class DomainFacade {
  readonly library: Library;
  readonly form: ArtifactForm;

  constructor(
    private readonly page: Page,
    demo: DemoDriver,
    readonly spec: DomainSpec,
    private readonly registry: Registry,
  ) {
    this.library = new Library(page, demo, spec);
    this.form = new ArtifactForm(page, demo, spec);
  }

  open(): Promise<void> {
    return this.library.open();
  }
  search(query: string): Promise<void> {
    return this.library.search(query);
  }
  card(name: string) {
    return this.library.card(name);
  }

  /**
   * Create an artifact through the UI form. Fills every provided field,
   * chooses the required pickers, submits, and asserts success. The entity
   * is tracked for teardown *before* submit so a failed submit still reaps.
   */
  async create(input: CreateInput, variant?: string): Promise<void> {
    const v = variant ? this.spec.variants?.[variant] : undefined;
    const order = v?.createOrder ?? this.spec.createOrder;
    if (!order) {
      throw new Error(
        `No createOrder for ${this.spec.singular}${variant ? ` variant "${variant}"` : ""}`,
      );
    }
    await this.form.openNew(this.spec.newPath + (v?.query ?? ""));

    // Walk the form top-to-bottom: fill fields and pick pickers in the
    // order they appear on screen, so the recording scrolls smoothly down.
    const confirmable: string[] = [];
    const filled = new Set<string>();
    for (const step of order) {
      if ("field" in step) {
        const value = input[step.field] as string | undefined;
        if (value !== undefined) {
          await this.form.fill(step.field, value);
          filled.add(step.field);
        }
      } else if ("picker" in step) {
        await this.form.pickFirst(step.picker);
        if (step.confirm) confirmable.push(step.picker);
      } else if ("multiSelect" in step) {
        await this.form.multiSelectFirst(step.multiSelect);
      } else if ("toggle" in step) {
        await this.form.toggleFirst(step.toggle);
      } else if ("expand" in step) {
        await this.form.expandSelectFirst(step.expand);
      } else if ("flag" in step) {
        await this.form.toggleFlag(step.flag);
      } else if ("upload" in step) {
        await this.form.uploadFile(step.upload.step, step.upload.file);
      } else if ("settle" in step) {
        await this.form.waitForDraftSaved();
      }
    }
    // Fill any provided fields not listed in createOrder (order-agnostic).
    for (const [field, value] of Object.entries(input)) {
      if (!filled.has(field)) await this.form.fill(field, value);
    }

    // Track before submit so a failed attempt still gets cleaned up.
    this.registry.track({ kind: this.spec.singular, name: input.name });

    const success = this.page.getByText(this.spec.createdSignal);
    // A mid-flow re-seed (notably the parameters expand) can reset the form,
    // wiping values set earlier — name set before parameters, or a fragile
    // pick. Before each submit, re-apply only the fields that came back empty
    // (so a survived value is never re-typed on camera) and re-pick fragile
    // selections, then submit immediately. A validation-failed submit creates
    // nothing, so retrying is safe.
    await expect(async () => {
      if (await success.isVisible().catch(() => false)) return;
      // Proactive: silently restore any text field / fragile pick that came
      // back empty (no on-camera re-typing of a value that survived).
      for (const [field, value] of Object.entries(input)) {
        await this.form.fillIfEmpty(field, value);
      }
      for (const picker of confirmable) await this.form.ensurePicked(picker);
      // Reactive: re-apply whatever the previous submit reported as missing
      // (covers color, which has no DOM marker to detect proactively).
      for (const { error, redo } of this.spec.reconcile ?? []) {
        const showing = await this.page
          .getByText(error)
          .first()
          .isVisible()
          .catch(() => false);
        if (showing) await this.applyStep(redo, input);
      }
      await this.form.submit();
      await expect(success).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 45_000 });
  }

  /** Re-run a single create step (used by reconcile). */
  private async applyStep(step: CreateStep, input: CreateInput): Promise<void> {
    if ("field" in step) {
      const value = input[step.field] as string | undefined;
      if (value !== undefined) await this.form.fill(step.field, value);
    } else if ("picker" in step) {
      await this.form.pickFirst(step.picker);
    }
  }
}

// ---- The registry of known domains -------------------------------------
// Keyed by singular so teardown can look up endpoints from a TrackedEntity.

export const DOMAINS: Record<string, DomainSpec> = {
  persona: {
    singular: "persona",
    plural: "personas",
    listPath: "/training/personas",
    newPath: "/training/personas/new",
    fields: {
      name: { placeholder: /enthusiastic student/i },
      description: { testId: "input-persona-description" },
      instructions: { testId: "input-instructions" },
      example: { placeholder: /message 1/i },
    },
    // Form vertical order: Basic (name, description, departments, flags) →
    // Parameters → Color → Icon → Personality (instructions, voices).
    // The multiSelect/toggle/expand steps are optional enrichments — they
    // exercise those widgets when the backend has data and skip otherwise.
    // Vertical order, matching the form: Basic (name, description,
    // departments, flags) → Parameters → Color → Icon → Personality
    // (instructions, examples, voices). Autosave is on; a settle after each
    // value-setting step waits for that draft save to persist (draftId in the
    // URL on the first one) before the next interaction — so no in-flight
    // re-seed can reset a just-made pick/toggle. That keeps the recording
    // smooth (no flicker) and is deterministic, not a fixed delay.
    createOrder: [
      { field: "name" },
      { settle: true }, // first change → "Draft created"; draftId anchors the form
      { field: "description" },
      { settle: true },
      { multiSelect: "basic" }, // departments
      { settle: true },
      { toggle: "basic" }, // flags
      { settle: true },
      { expand: "parameters" }, // parameter fields (open → select; self-settles)
      { picker: "color" },
      { settle: true },
      { picker: "icon", confirm: true },
      { settle: true },
      { field: "instructions" },
      { settle: true },
      { field: "example" }, // example message
      { settle: true },
      { multiSelect: "content" }, // voices
      { settle: true },
    ],
    // If the parameters re-seed wiped a required value, the form says so at
    // submit — re-apply exactly that and retry.
    reconcile: [
      { error: /name is required/i, redo: { field: "name" } },
      { error: /color is required/i, redo: { picker: "color" } },
      { error: /icon is required/i, redo: { picker: "icon" } },
      { error: /instructions? (is|are) required/i, redo: { field: "instructions" } },
    ],
    createdSignal: /persona created successfully/i,
    api: {
      search: "/persona/search",
      delete: "/persona/delete",
      idKey: "persona_id",
      listKey: "personas",
    },
  },

  scenario: {
    singular: "scenario",
    plural: "scenarios",
    listPath: "/training/scenarios",
    newPath: "/training/scenarios/new",
    fields: {
      name: { placeholder: /customer support escalation/i },
      description: { placeholder: /describe the scenario/i },
      problemStatement: { placeholder: /define the core problem/i },
      objective: { placeholder: /learning objective 1/i },
      question: { placeholder: /question 1/i },
    },
    // Only the name is enforced on submit; everything else is optional but we
    // fill it for full coverage. The mode is a URL param that also controls
    // which feature flags are available.
    reconcile: [{ error: /scenario name is required/i, redo: { field: "name" } }],
    createdSignal: /scenario created successfully/i,
    api: {
      search: "/scenario/search",
      delete: "/scenario/delete",
      idKey: "scenario_id",
      listKey: "scenarios",
      deleteBody: (ids) => ({ scenario_ids: ids, accept: true }),
    },
    variants: {
      // Contextual scenario: enable problem statement, objectives, and image
      // context. Steps: Basic (name, description, departments, flags) →
      // Personas → Documents → Parameters → Context (image, problem, objectives).
      contextual: {
        query: "?mode=contextual",
        createOrder: [
          { field: "name" },
          { settle: true }, // draft created; form anchors
          { field: "description" },
          { settle: true },
          { multiSelect: "basic" }, // departments
          { settle: true },
          { flag: "problem_statement_enabled" },
          { settle: true },
          { flag: "objectives_enabled" },
          { settle: true },
          { flag: "images_enabled" },
          { settle: true },
          { multiSelect: "personas" },
          { settle: true },
          { multiSelect: "documents" },
          { settle: true },
          { expand: "parameters" },
          // NOTE: image upload step previously omitted because the FE
          // was calling /v5/scenarios/upload (which 404'd). The FE now
          // posts to /scenario/image_upload via the canonical
          // server-action → backend path. Safe to re-enable:
          //   { upload: { step: "context", file: "e2e/fixtures/sample.png" } }
          { field: "problemStatement" },
          { settle: true },
          { field: "objective" },
          { settle: true },
        ],
      },
      // Assessment scenario: enable video + questions. Steps: Basic → Personas
      // → Documents → Parameters → Video & Questions (video upload, questions).
      assessment: {
        query: "?mode=assessment",
        createOrder: [
          { field: "name" },
          { settle: true },
          { field: "description" },
          { settle: true },
          { multiSelect: "basic" }, // departments
          { settle: true },
          { flag: "video_enabled" },
          { settle: true },
          { flag: "questions_enabled" },
          { settle: true },
          { multiSelect: "personas" },
          { settle: true },
          { multiSelect: "documents" },
          { settle: true },
          { expand: "parameters" },
          // NOTE: video upload previously omitted because the FE was
          // calling /v5/scenarios/upload (which 404'd). The FE now posts
          // to /scenario/video_upload via the canonical server-action →
          // backend path. Safe to re-enable a video upload step here.
          { field: "question" },
          { settle: true },
        ],
      },
    },
  },
};
