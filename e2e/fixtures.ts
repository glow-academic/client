// Test fixtures — the seam where the layers meet a spec.
//
// Import `test` + `expect` from here instead of "@playwright/test" and a
// spec receives ready-to-use domain facades plus the self-cleaning
// machinery, all backend-agnostic:
//
//   - `runId`    a short unique tag for collision-free entity names
//   - `demo`     the pacing driver
//   - `registry` collects created entities; auto-reaps them after the
//                test (pass OR fail) via the backend API
//   - `personas` the prose facade for the personas domain
//
// There is deliberately NO seed fixture: the client never builds world
// state. Browse-heavy specs assume the connected backend already holds a
// representative dataset; write specs create exactly what they need and
// clean it up.

import { test as base } from "@playwright/test";

import { DOMAINS, DomainFacade } from "./actions/domains";
import { DemoDriver } from "./demo/DemoDriver";
import { Registry } from "./support/registry";
import { reap } from "./support/teardown";

interface Fixtures {
  runId: string;
  demo: DemoDriver;
  registry: Registry;
  personas: DomainFacade;
  scenarios: DomainFacade;
  cohorts: DomainFacade;
  simulations: DomainFacade;
  documents: DomainFacade;
  profiles: DomainFacade;
  parameters: DomainFacade;
  fields: DomainFacade;
  agents: DomainFacade;
  models: DomainFacade;
  tools: DomainFacade;
  providers: DomainFacade;
  auths: DomainFacade;
  evals: DomainFacade;
  departments: DomainFacade;
  rubrics: DomainFacade;
  settings: DomainFacade;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  runId: async ({}, use) => {
    await use(Math.random().toString(36).slice(2, 8));
  },

  demo: async ({ page }, use) => {
    await use(new DemoDriver(page));
  },

  registry: async ({ request }, use) => {
    const registry = new Registry();
    await use(registry);
    // Runs after the test body, even on failure.
    await reap(request, registry.drain());
  },

  personas: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["persona"]!, registry));
  },

  scenarios: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["scenario"]!, registry));
  },

  cohorts: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["cohort"]!, registry));
  },

  simulations: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["simulation"]!, registry));
  },

  documents: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["document"]!, registry));
  },

  profiles: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["profile"]!, registry));
  },

  parameters: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["parameter"]!, registry));
  },

  fields: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["field"]!, registry));
  },

  agents: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["agent"]!, registry));
  },

  models: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["model"]!, registry));
  },

  tools: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["tool"]!, registry));
  },

  providers: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["provider"]!, registry));
  },

  auths: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["auth"]!, registry));
  },

  evals: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["eval"]!, registry));
  },

  departments: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["department"]!, registry));
  },

  rubrics: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["rubric"]!, registry));
  },

  settings: async ({ page, demo, registry }, use) => {
    await use(new DomainFacade(page, demo, DOMAINS["setting"]!, registry));
  },
});

export { expect } from "@playwright/test";
