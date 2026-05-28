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
  | { pickIn: string } // first option of the grid inside a picker testid (when a step has several pickers)
  | { pickInSticky: string } // like pickIn, but re-picks until the selection persists (fragile picks, e.g. eval model-rubric)
  | { toggle: string } // first switch in that step
  | { expand: string } // open first group → select first field
  | { flag: string } // toggle a feature flag by type (reveals conditional steps)
  | { upload: { step: string; file: string } } // upload a file into a step
  | { fillSubmit: string } // fill a field then press Enter (commits creatable inputs, e.g. an email)
  // Add a free-text resource via a step's "create new" sub-form (e.g. a
  // document's Texts): reveal the textarea, type the field's value, confirm.
  | { addText: { step: string; field: string } }
  // Add a tool argument via the Arguments editor ("Add Argument" → type the
  // given name; field_type defaults to "string", so a named arg is valid).
  | { addArgument: string }
  // Type a system prompt into the agent's Monaco editor in the `prompt` step
  // (a creatable — typing resolves a prompt_id on draft save). The literal text
  // is the prompt body.
  | { addPrompt: string }
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
  /** List container testid (default `{plural}-grid`; tables use `{plural}-table`). */
  gridTestId?: string;
  /** Row testid (default `{singular}-card`; tables use `{plural}-row`). A
   *  RegExp matches cards whose testid embeds the row id, e.g. fields render
   *  `field-card-{id}` → `/^field-card-/`. */
  cardTestId?: string | RegExp;
  /** Search input testid (default `{plural}-search`; provider uses the legacy
   *  `input-search-providers`). */
  searchTestId?: string;
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
          // Best-effort: a conditional section may not be on screen (or got
          // re-seeded away). Skip rather than hang; reconcile catches any
          // required field the backend then reports missing.
          if (await this.form.fillIfPresent(step.field, value)) {
            filled.add(step.field);
          }
        }
      } else if ("picker" in step) {
        await this.form.pickFirst(step.picker);
        if (step.confirm) confirmable.push(step.picker);
      } else if ("multiSelect" in step) {
        await this.form.multiSelectFirst(step.multiSelect);
      } else if ("pickIn" in step) {
        await this.form.pickInFirst(step.pickIn);
      } else if ("pickInSticky" in step) {
        await this.form.pickInUntilSelected(step.pickInSticky);
      } else if ("toggle" in step) {
        await this.form.toggleFirst(step.toggle);
      } else if ("expand" in step) {
        await this.form.expandSelectFirst(step.expand);
      } else if ("flag" in step) {
        await this.form.toggleFlag(step.flag);
      } else if ("upload" in step) {
        await this.form.uploadFile(step.upload.step, step.upload.file);
      } else if ("fillSubmit" in step) {
        const value = input[step.fillSubmit] as string | undefined;
        if (value !== undefined) await this.form.fillThenEnter(step.fillSubmit, value);
      } else if ("addText" in step) {
        const value = input[step.addText.field] as string | undefined;
        if (value !== undefined) {
          await this.form.addText(step.addText.step, value);
          // Mark filled: after "Create" the sub-form collapses, so the
          // order-agnostic fill below must not try to type into it again.
          filled.add(step.addText.field);
        }
      } else if ("addArgument" in step) {
        await this.form.addArgument(step.addArgument);
      } else if ("addPrompt" in step) {
        await this.form.addPrompt(step.addPrompt);
      } else if ("settle" in step) {
        await this.form.waitForDraftSaved();
      }
    }
    // Fill any provided fields not listed in createOrder (order-agnostic).
    // Bounded (fillIfPresent): an optional creatable whose input isn't on
    // screen must be skipped, not block — reconcile re-applies any required
    // field the backend then reports missing.
    for (const [field, value] of Object.entries(input)) {
      if (!filled.has(field)) await this.form.fillIfPresent(field, value);
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
      if (value !== undefined) await this.form.fillIfPresent(step.field, value);
    } else if ("picker" in step) {
      await this.form.pickFirst(step.picker);
    } else if ("pickIn" in step) {
      await this.form.pickInFirst(step.pickIn);
    } else if ("pickInSticky" in step) {
      await this.form.pickInUntilSelected(step.pickInSticky);
    } else if ("addPrompt" in step) {
      await this.form.addPrompt(step.addPrompt);
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
      // Full per-step settles (same as persona): each waits for the draft to
      // persist before the next interaction so a re-seed can't clobber it.
      contextual: {
        query: "?mode=contextual",
        createOrder: [
          { field: "name" },
          { settle: true }, // draft created; form anchors
          { field: "description" },
          { settle: true },
          { multiSelect: "basic" }, // departments
          { settle: true },
          { toggle: "basic" }, // active switch
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
          // Upload treated as a black box: attach via setInputFiles.
          { upload: { step: "context", file: "e2e/fixtures/sample.png" } },
          { settle: true },
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
          { toggle: "basic" }, // active switch
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
          // Upload treated as a black box: attach via setInputFiles.
          { upload: { step: "video", file: "e2e/fixtures/sample.mp4" } },
          { settle: true },
          { field: "question" },
          { settle: true },
        ],
      },
    },
  },

  cohort: {
    singular: "cohort",
    plural: "cohorts",
    listPath: "/training/cohorts",
    newPath: "/training/cohorts/new",
    fields: {
      name: { placeholder: /spring 2024 cohort/i },
      description: { placeholder: /detailed description of the cohort/i },
    },
    // Only the name is required. Simulations + profiles are optional
    // cross-entity enrichments (best-effort multiSelect, scoped to their step).
    // Form vertical order: Basic (name, description, departments, active) →
    // Simulations → Profiles.
    createOrder: [
      { field: "name" },
      { settle: true }, // draft created; form anchors
      { field: "description" },
      { settle: true },
      { multiSelect: "basic" }, // departments
      { settle: true },
      { toggle: "basic" }, // active switch
      { settle: true },
      { multiSelect: "simulations" }, // pick a simulation if any exist
      { settle: true },
      { multiSelect: "profiles" }, // pick a profile if any exist
      { settle: true },
    ],
    reconcile: [{ error: /cohort name is required/i, redo: { field: "name" } }],
    createdSignal: /cohort created successfully/i,
    api: {
      search: "/cohort/search",
      delete: "/cohort/delete",
      idKey: "cohort_id",
      listKey: "cohorts",
      deleteBody: (ids) => ({ cohort_ids: ids, accept: true }),
    },
  },

  simulation: {
    singular: "simulation",
    plural: "simulations",
    listPath: "/training/simulations",
    newPath: "/training/simulations/new",
    fields: {
      name: { placeholder: /simulation name/i },
      description: { placeholder: /enter description/i },
    },
    // Required: name, ≥1 scenario, ≥1 scenario rubric (cross-entity — seed
    // data provides scenarios + rubrics). The Scenarios step holds several
    // pickers, so scenario + rubric are scoped by picker testid (pickIn); the
    // rubric picker only appears once a scenario is selected. Departments and
    // flags are optional best-effort. Vertical order: Basic (name, desc,
    // departments, flags) → Scenarios (scenario, then its rubric).
    createOrder: [
      { field: "name" },
      { settle: true }, // draft created; form anchors
      { field: "description" },
      { settle: true },
      { multiSelect: "basic" }, // departments
      { settle: true },
      { toggle: "basic" }, // flags
      { settle: true },
      { pickIn: "picker-scenarios" }, // select a scenario → rubric picker appears
      { settle: true },
      { pickIn: "picker-scenario-rubrics" }, // select its rubric
      { settle: true },
    ],
    reconcile: [
      { error: /simulation name is required/i, redo: { field: "name" } },
      { error: /scenarios are required/i, redo: { pickIn: "picker-scenarios" } },
      { error: /scenario rubrics are required/i, redo: { pickIn: "picker-scenario-rubrics" } },
    ],
    createdSignal: /simulation created successfully/i,
    api: {
      search: "/simulation/search",
      delete: "/simulation/delete",
      idKey: "simulation_id",
      listKey: "simulations",
      deleteBody: (ids) => ({ simulation_ids: ids, accept: true }),
    },
  },

  document: {
    singular: "document",
    plural: "documents",
    listPath: "/management/documents",
    newPath: "/management/documents/new",
    gridTestId: "documents-table", // table surface, not a card grid
    cardTestId: "documents-row",
    fields: {
      name: { placeholder: /course syllabus/i },
      description: { testId: "input-document-description" },
      text: { placeholder: /enter text content/i },
    },
    // Full-fill: Basic (name, description, departments, active) → Fields
    // (parameter fields) → Files (upload) → Images (upload) → Texts (text
    // content). Only name is required; the rest are best-effort sections.
    createOrder: [
      { field: "name" },
      { settle: true },
      { field: "description" },
      { settle: true },
      { multiSelect: "basic" }, // departments
      { settle: true },
      { toggle: "basic" }, // active switch
      { settle: true },
      { expand: "fields" }, // ParameterFields (open group → select field)
      { settle: true },
      { upload: { step: "uploads", file: "e2e/fixtures/sample.txt" } },
      { settle: true },
      { upload: { step: "images", file: "e2e/fixtures/sample.png" } },
      { settle: true },
      // Texts is a creatable sub-form ("Add new text" → textarea → "Create"),
      // not a plain field — addText reveals it, types, and confirms.
      { addText: { step: "texts", field: "text" } },
      { settle: true },
    ],
    reconcile: [{ error: /document name is required/i, redo: { field: "name" } }],
    createdSignal: /document created successfully/i,
    api: {
      search: "/document/search",
      delete: "/document/delete",
      idKey: "document_id",
      listKey: "documents",
      deleteBody: (ids) => ({ document_ids: ids, accept: true }),
    },
  },

  profile: {
    singular: "profile",
    plural: "profiles",
    listPath: "/management/profiles",
    newPath: "/management/profiles/new",
    gridTestId: "profiles-table",
    cardTestId: "profiles-row",
    fields: {
      name: { placeholder: /jane doe/i },
      email: { placeholder: /type primary email/i },
    },
    // Basic (name, departments, active) → Roles (multiSelect). Only name is
    // required.
    // NOTE: the Contact/email section is omitted — adding a new email leaves
    // `new_emails` unresolved and the form's submit-time flushAllAndSave isn't
    // resolving it (it blocks with "resolve new emails before submitting" — a
    // backend draft-resolution gap). The `email` field + `fillSubmit` step are
    // kept ready; re-add `{ fillSubmit: "email" }, { settle: true }` after name
    // once the backend resolves new emails on draft save.
    createOrder: [
      { field: "name" },
      { settle: true },
      { multiSelect: "basic" }, // departments
      { settle: true },
      { toggle: "basic" }, // active switch
      { settle: true },
      { multiSelect: "roles" }, // pick a role
      { settle: true },
    ],

    reconcile: [{ error: /profile name is required/i, redo: { field: "name" } }],
    createdSignal: /profile created successfully/i,
    api: {
      search: "/profile/search",
      delete: "/profile/delete",
      idKey: "profile_id",
      listKey: "profiles",
      deleteBody: (ids) => ({ profile_ids: ids, accept: true }),
    },
  },

  parameter: {
    singular: "parameter",
    plural: "parameters",
    listPath: "/management/parameters",
    newPath: "/management/parameters/new",
    // Card grid: `parameters-grid` / `parameter-card` (defaults match).
    fields: {
      name: { placeholder: /student age/i },
      description: { placeholder: /brief description/i },
    },
    // Vertical order: Basic (name, description, departments, active) → Fields
    // (a parameter groups fields; multiSelect picks one if seed data has any).
    // Only the name is required; departments/active/fields are best-effort.
    createOrder: [
      { field: "name" },
      { settle: true }, // creatable name resolves; draft anchors
      { field: "description" },
      { settle: true },
      { multiSelect: "basic" }, // departments
      { settle: true },
      { toggle: "basic" }, // active switch
      { settle: true },
      // NOTE: the "include fields" pick is omitted. Selecting one 500s on
      // submit with a FK violation — the picker's option ids aren't backed by
      // rows in `fields_resource` (same backend gap as a field's Conditional
      // Parameters). Re-add `{ multiSelect: "fields" }` once the backend
      // resolves field ids on save.
    ],
    reconcile: [{ error: /parameter name is required/i, redo: { field: "name" } }],
    createdSignal: /parameter created successfully/i,
    api: {
      search: "/parameter/search",
      delete: "/parameter/delete",
      idKey: "parameter_id",
      listKey: "parameters",
      deleteBody: (ids) => ({ parameter_ids: ids, all: false }),
    },
  },

  field: {
    singular: "field",
    plural: "fields",
    listPath: "/management/fields",
    newPath: "/management/fields/new",
    // Card grid: `fields-grid` / `field-card-{id}` — the card testid embeds the
    // row id, so match it with a RegExp prefix.
    cardTestId: /^field-card-/,
    fields: {
      name: { placeholder: /learning style/i },
      description: { placeholder: /brief description/i },
    },
    // Vertical order: Basic (name, description, departments, active) →
    // Conditional Parameters (parameters shown when this field is selected;
    // best-effort multiSelect). Only the name is required.
    createOrder: [
      { field: "name" },
      { settle: true }, // creatable name resolves; draft anchors
      { field: "description" },
      { settle: true },
      { multiSelect: "basic" }, // departments
      { settle: true },
      { toggle: "basic" }, // active switch
      { settle: true },
      // NOTE: the Conditional Parameters section is omitted. Selecting one
      // makes submit 500 with a FK violation — the picker's option ids aren't
      // backed by rows in `conditional_parameters_resource` (a backend seed/
      // data-integrity gap). Re-add `{ multiSelect: "conditional" }` once the
      // backend resolves conditional-parameter ids on save.
    ],
    reconcile: [{ error: /field name is required/i, redo: { field: "name" } }],
    createdSignal: /field created successfully/i,
    api: {
      search: "/field/search",
      delete: "/field/delete",
      idKey: "field_id",
      listKey: "fields",
      deleteBody: (ids) => ({ field_ids: ids, all: false }),
    },
  },

  agent: {
    singular: "agent",
    plural: "agents",
    listPath: "/intelligence/agents",
    newPath: "/intelligence/agents/new",
    // Card grid: `agents-grid` / `agent-card` (defaults match).
    fields: {
      name: { placeholder: /customer support agent/i },
      description: { testId: "input-agent-description" },
    },
    // Required to submit: name, description, a model, and a prompt. Picking a
    // model reveals the model-capability steps (temperature/reasoning/voice),
    // so it settles before they're filled. Tools, qualities, rubrics,
    // instructions and the capability steps are best-effort enrichments —
    // multiSelect exercises them when seed data + the model expose them and
    // skips cleanly otherwise. Vertical order matches the form.
    createOrder: [
      { field: "name" },
      { settle: true }, // creatable name resolves; draft anchors
      { field: "description" },
      { settle: true },
      { multiSelect: "basic" }, // departments
      { settle: true },
      { toggle: "basic" }, // active switch
      { settle: true },
      { multiSelect: "tools" }, // tools (best-effort)
      { settle: true },
      { picker: "model" }, // REQUIRED — selecting reveals capability steps
      { settle: true },
      { multiSelect: "temperature" }, // capability step (best-effort)
      { settle: true },
      { multiSelect: "reasoning" }, // capability step (best-effort)
      { settle: true },
      { multiSelect: "voice" }, // capability step (best-effort)
      { settle: true },
      { multiSelect: "qualities" }, // best-effort
      { settle: true },
      { multiSelect: "rubrics" }, // best-effort
      { settle: true },
      { multiSelect: "instructions" }, // creatable picker — pick existing if any
      { settle: true },
      // REQUIRED system prompt — a Monaco editor (creatable); typing resolves a
      // prompt_id. There are no seed prompts to pick, so we author one.
      {
        addPrompt:
          "You are a calm, helpful tier-1 customer support agent. Greet the customer, identify their issue, and resolve it or escalate with a clear summary.",
      },
      { settle: true },
    ],
    // NOTE: the spec is skipped — agents are blocked on prompt_id resolution
    // (no seed prompts to select; typing prompt content doesn't resolve an id).
    // No prompt reconcile: re-running addPrompt only appends to the editor.
    reconcile: [
      { error: /agent name is required/i, redo: { field: "name" } },
      { error: /agent description is required/i, redo: { field: "description" } },
      { error: /model (selection )?is required/i, redo: { picker: "model" } },
    ],
    createdSignal: /agent created successfully/i,
    api: {
      search: "/agent/search",
      delete: "/agent/delete",
      idKey: "agent_id",
      listKey: "agents",
      deleteBody: (ids) => ({ agent_ids: ids, all: false }),
    },
  },

  model: {
    singular: "model",
    plural: "models",
    listPath: "/intelligence/models",
    newPath: "/intelligence/models/new",
    // Card grid: `models-grid` / `model-card` (defaults match). Name and value
    // placeholders both contain "gpt-4", so anchor the name locator.
    fields: {
      name: { placeholder: /^e\.g\., gpt-4$/i },
      description: { placeholder: /enter a brief description/i },
      value: { placeholder: /model value identifier/i },
    },
    // Required to submit: name, value, and a provider. The rich sections
    // (modalities, temperature, pricing, reasoning, voices, qualities) are each
    // gated behind a feature flag AND a selected modality — so we flip each
    // flag on (shared Flags → `#flag-{type}`) to reveal the section, then fill
    // it best-effort. `model_active` is flipped as the canonical active switch.
    // Every reveal/fill is best-effort: if a flag or section isn't present it
    // skips, leaving the required path (name, value, departments, provider).
    createOrder: [
      { field: "name" },
      { settle: true }, // creatable name resolves; draft anchors
      { field: "description" },
      { settle: true },
      { field: "value" }, // REQUIRED model value (creatable)
      { settle: true },
      { multiSelect: "basic" }, // departments
      { settle: true },
      { flag: "model_active" }, // active switch (precise — basic has many flags)
      { settle: true },
      { picker: "provider" }, // REQUIRED provider
      { settle: true },
      { flag: "model_modalities_enabled" }, // reveal Modalities
      { settle: true },
      { multiSelect: "modalities" }, // pick an input modality (required when shown)
      { settle: true },
      { flag: "model_temperature_enabled" },
      { settle: true },
      { multiSelect: "temperature" },
      { settle: true },
      { flag: "model_reasoning_levels_enabled" },
      { settle: true },
      { multiSelect: "reasoning" },
      { settle: true },
      { flag: "model_voices_enabled" },
      { settle: true },
      { multiSelect: "voices" },
      { settle: true },
      { flag: "model_qualities_enabled" },
      { settle: true },
      { multiSelect: "qualities" },
      { settle: true },
    ],
    reconcile: [
      { error: /model name is required/i, redo: { field: "name" } },
      { error: /model value is required/i, redo: { field: "value" } },
      { error: /provider is required/i, redo: { picker: "provider" } },
    ],
    createdSignal: /model created successfully/i,
    api: {
      search: "/model/search",
      delete: "/model/delete",
      idKey: "model_id",
      listKey: "models",
      deleteBody: (ids) => ({ model_ids: ids, all: false }),
    },
  },

  tool: {
    singular: "tool",
    plural: "tools",
    listPath: "/intelligence/tools",
    newPath: "/intelligence/tools/new",
    // Card grid: `tools-grid` / `tool-card` (defaults match).
    fields: {
      name: { placeholder: /calculator/i },
      description: { placeholder: /enter description/i },
    },
    // Only the name is required. Vertical order: Basic (name, description,
    // departments, active) → Arguments (creatable editor: add one named arg)
    // → Permissions (multiSelect) → Instructions (single-select). Everything
    // past the name is best-effort.
    createOrder: [
      { field: "name" },
      { settle: true }, // creatable name resolves; draft anchors
      { field: "description" },
      { settle: true },
      { multiSelect: "basic" }, // departments
      { settle: true },
      { toggle: "basic" }, // active switch (tool_active)
      { settle: true },
      { addArgument: "operand" }, // Arguments editor — one named argument
      { settle: true },
      { multiSelect: "permissions" }, // permissions (best-effort)
      { settle: true },
      { multiSelect: "instructions" }, // instructions resource (best-effort)
      { settle: true },
    ],
    reconcile: [{ error: /tool name is required/i, redo: { field: "name" } }],
    createdSignal: /tool created successfully/i,
    api: {
      search: "/tool/search",
      delete: "/tool/delete",
      idKey: "tool_id",
      listKey: "tools",
      deleteBody: (ids) => ({ tool_ids: ids, all: false }),
    },
  },

  provider: {
    singular: "provider",
    plural: "providers",
    listPath: "/intelligence/providers",
    newPath: "/intelligence/providers/new",
    // Provider's library predates the standard testids: the grid testid was
    // added to Providers.tsx, but the search box keeps its legacy id.
    searchTestId: "input-search-providers",
    fields: {
      name: { placeholder: /openai/i },
      value: { placeholder: /enter value/i },
      description: { placeholder: /enter description/i },
      endpoint: { placeholder: /enter endpoint url/i },
    },
    // Required: name + value. Vertical order: Basic (name, value, description,
    // departments, active) → Endpoint (freeform URL) → Key (omitted — an
    // optional pre-encrypted credential picker, awkward to demo). The toast is
    // "Provider created" (no "successfully").
    createOrder: [
      { field: "name" },
      { settle: true }, // creatable name resolves; draft anchors
      { field: "value" }, // REQUIRED — provider value/variant (creatable)
      { settle: true },
      { field: "description" },
      { settle: true },
      { multiSelect: "basic" }, // departments
      { settle: true },
      { toggle: "basic" }, // active switch (provider_active)
      { settle: true },
      { field: "endpoint" }, // API endpoint URL (best-effort)
      { settle: true },
    ],
    reconcile: [
      { error: /name is required/i, redo: { field: "name" } },
      { error: /value is required/i, redo: { field: "value" } },
    ],
    createdSignal: /provider created/i,
    api: {
      search: "/provider/search",
      delete: "/provider/delete",
      idKey: "provider_id",
      listKey: "providers",
      deleteBody: (ids) => ({ provider_ids: ids, all: false }),
    },
  },

  auth: {
    singular: "auth",
    plural: "auths",
    listPath: "/platform/auth",
    newPath: "/platform/auth/new",
    // Card grid: `auth-card` (default matches). The grid testid was added to
    // Auths.tsx. The auth library has NO free-text search (only picker
    // filters), so its spec opens and asserts directly — no `search()`.
    fields: {
      name: { placeholder: /production api key/i },
      description: { placeholder: /enter description/i },
    },
    // Only the name is required (protocols/slugs/items are NOT enforced at
    // create). Vertical order: Basic (name, description, departments, active)
    // → Protocols → Slugs → Auth Items. Protocols/slugs/items are best-effort
    // multiSelects (pick an existing option if the catalog has any).
    createOrder: [
      { field: "name" },
      { settle: true }, // creatable name resolves; draft anchors
      { field: "description" },
      { settle: true },
      { multiSelect: "basic" }, // departments
      { settle: true },
      { toggle: "basic" }, // active switch (auth_active)
      { settle: true },
      { multiSelect: "protocols" }, // pick a protocol if any exist
      { settle: true },
      { multiSelect: "slugs" }, // pick a slug if any exist
      { settle: true },
      { multiSelect: "items" }, // pick an auth item if any exist
      { settle: true },
    ],
    reconcile: [{ error: /auth name is required/i, redo: { field: "name" } }],
    createdSignal: /auth created successfully/i,
    api: {
      search: "/auth/search",
      delete: "/auth/delete",
      idKey: "auth_id",
      listKey: "auths",
      deleteBody: (ids) => ({ auth_ids: ids, all: false }),
    },
  },

  eval: {
    singular: "eval",
    plural: "evals",
    listPath: "/platform/evals",
    newPath: "/platform/evals/new",
    // Card grid: `evals-grid` / `eval-card` (defaults match; both exist).
    fields: {
      name: { placeholder: /eval name/i },
      description: { placeholder: /enter description/i },
    },
    // Required: name AND at least one model rubric. The Models step holds
    // several grids (Models, ModelFlags, ModelPositions, ModelRubrics); the
    // rubric grid only appears once a model is selected — so scope the two
    // picks by inner testid (added to Models.tsx / ModelRubrics.tsx). Flags
    // and departments are best-effort (shown only if their catalogs exist).
    createOrder: [
      { field: "name" },
      { settle: true }, // creatable name resolves; draft anchors
      { field: "description" },
      { settle: true },
      { multiSelect: "basic" }, // departments (best-effort)
      { settle: true },
      { toggle: "basic" }, // active/first flag (best-effort)
      { settle: true },
      { pickIn: "picker-models" }, // select a model → reveals its rubric grid
      { settle: true },
      // The model-rubric is fragile: `ModelRubrics` freezes the pick locally
      // (its `isDirtyRef`), but a draft re-seed re-mounts it and reverts the
      // selection (the server returns no model_rubric_resources). So pick it
      // LAST and go straight to submit — NO settle here — so the local
      // `model_rubric_ids` reaches submit before any re-seed can clear it.
      { pickInSticky: "picker-model-rubrics" }, // REQUIRED model rubric (no settle after)
    ],
    reconcile: [
      { error: /name is required/i, redo: { field: "name" } },
      {
        error: /model rubrics? (is|are) required/i,
        redo: { pickInSticky: "picker-model-rubrics" },
      },
    ],
    createdSignal: /eval created successfully/i,
    api: {
      search: "/eval/search",
      delete: "/eval/delete",
      idKey: "eval_id",
      listKey: "evals",
      deleteBody: (ids) => ({ eval_ids: ids, all: false }),
    },
  },

  department: {
    singular: "department",
    plural: "departments",
    listPath: "/platform/departments",
    newPath: "/platform/departments/new",
    // Card grid: `departments-grid` / `department-card` (defaults match).
    fields: {
      name: { placeholder: /customer success/i },
      description: { placeholder: /enter description/i },
    },
    // Only the name is required. A Department has NO departments sub-select (it
    // *is* a department), so there's no `multiSelect: "basic"` here — just the
    // active flag. Vertical order: Basic (name, description, active) →
    // Settings (best-effort multiSelect).
    createOrder: [
      { field: "name" },
      { settle: true }, // creatable name resolves; draft anchors
      { field: "description" },
      { settle: true },
      { toggle: "basic" }, // active switch (department_active)
      { settle: true },
      { multiSelect: "settings" }, // applicable settings (best-effort)
      { settle: true },
    ],
    reconcile: [
      { error: /department name is required/i, redo: { field: "name" } },
    ],
    createdSignal: /department created successfully/i,
    api: {
      search: "/department/search",
      delete: "/department/delete",
      idKey: "department_id",
      listKey: "departments",
      deleteBody: (ids) => ({ department_ids: ids, all: false }),
    },
  },

  rubric: {
    singular: "rubric",
    plural: "rubrics",
    listPath: "/platform/rubrics",
    newPath: "/platform/rubrics/new",
    // Card grid: `rubrics-grid` / `rubric-card` (defaults match).
    fields: {
      name: { placeholder: /sales call rubric/i },
      description: { placeholder: /enter description/i },
      passPoints: { placeholder: /e\.g\. 16/i },
    },
    // Required: name AND at least one department. Vertical order: Basic (name,
    // description, departments [required], active, pass points) → Standard
    // Groups → Standards. Departments is a required single pick (picker, so the
    // reconcile net can re-apply it); pass points + standard groups are
    // best-effort. The Standards step is a free-text level×group grid editor —
    // optional at submit, so it's left untouched (filling it generically is
    // brittle; the rubric creates cleanly without it).
    createOrder: [
      { field: "name" },
      { settle: true }, // creatable name resolves; draft anchors
      { field: "description" },
      { settle: true },
      { picker: "basic" }, // department (REQUIRED — first option in basic)
      { settle: true },
      { toggle: "basic" }, // active switch (rubric_active)
      { settle: true },
      { field: "passPoints" }, // pass threshold (best-effort numeric)
      { settle: true },
      { multiSelect: "standard_groups" }, // a standard group (best-effort)
      { settle: true },
    ],
    reconcile: [
      { error: /rubric name is required/i, redo: { field: "name" } },
      { error: /department is required/i, redo: { picker: "basic" } },
    ],
    createdSignal: /rubric created successfully/i,
    api: {
      search: "/rubric/search",
      delete: "/rubric/delete",
      idKey: "rubric_id",
      listKey: "rubrics",
      deleteBody: (ids) => ({ rubric_ids: ids, all: false }),
    },
  },

  setting: {
    singular: "setting",
    plural: "settings",
    listPath: "/settings",
    newPath: "/settings/new",
    // Card grid: `settings-grid` / `setting-card` (defaults match).
    fields: {
      name: { placeholder: /university settings/i },
      description: { placeholder: /enter description/i },
    },
    // Required: name AND at least one color. Vertical order: Basic (name,
    // description, departments, active) → Color (required, single pick — same
    // hex-backed Colors picker as persona, so it exposes no `data-selected`;
    // reconcile re-applies it on a "color is required" submit error) → Logins,
    // Systems, MCP, Providers, Auths (best-effort pickers). Thresholds is a
    // numeric-config step (no option grid) and is left untouched. The toast is
    // "Setting created" (no "successfully").
    createOrder: [
      { field: "name" },
      { settle: true }, // creatable name resolves; draft anchors
      { field: "description" },
      { settle: true },
      { multiSelect: "basic" }, // departments
      { settle: true },
      { toggle: "basic" }, // active switch (setting_active)
      { settle: true },
      { picker: "color" }, // REQUIRED — at least one color
      { settle: true },
      { multiSelect: "logins" }, // login buttons (best-effort)
      { settle: true },
      { multiSelect: "systems" }, // agent routing (best-effort)
      { settle: true },
      { multiSelect: "mcp" }, // MCP agent (best-effort)
      { settle: true },
      { multiSelect: "provider" }, // providers (best-effort)
      { settle: true },
      { multiSelect: "auth" }, // auths (best-effort)
      { settle: true },
    ],
    reconcile: [
      { error: /name is required/i, redo: { field: "name" } },
      { error: /color is required/i, redo: { picker: "color" } },
    ],
    createdSignal: /setting created/i,
    api: {
      search: "/setting/search",
      delete: "/setting/delete",
      idKey: "setting_id",
      listKey: "settings",
      deleteBody: (ids) => ({ setting_ids: ids, all: false }),
    },
  },
};
