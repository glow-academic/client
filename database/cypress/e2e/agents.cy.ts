/// <reference types="cypress" />

describe("Agents - CRUD workflow", () => {
  const stamp = Date.now();
  const nameA = `Cypress Agent ${stamp}`;
  const descA = `Created at ${stamp}`;
  const nameB = `${nameA} (edited)`;

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.loginAsAdmin(); // mocked session + effectiveRole flag
    cy.visit("/management/agents");
  });

  /* ──────────────────────────  CREATE  ────────────────────────── */
  it("creates a new agent", () => {
    cy.contains("Create Agent").click();

    /* fill every required field */
    cy.get("#name").type(nameA);
    cy.get("#subtitle").type("E2E Assistant");
    cy.get("#description").type(descA);
    cy.get("#systemPrompt").type("You are a helpful testing agent.");

    /* select Agent Type → Teaching Assistant */
    cy.contains("label", /agent type/i)
      .parent()
      .find('[data-slot="select-trigger"]') // Radix Select trigger
      .click();
    cy.get('[data-slot="select-item"]').contains("Teaching Assistant").click();

    /* move Temperature slider roughly to 70 % */
    cy.get('[data-testid="temperature-slider"]').click("right");

    cy.contains("button", /^create agent$/i).click();

    cy.location("pathname").should("eq", "/management/agents");
    cy.contains(nameA, { timeout: 20_000 }).should("be.visible");
  });

  /* ─────────────────────────── EDIT  ──────────────────────────── */
  it("edits the agent", () => {
    /* open edit screen via first icon on the card */
    cy.contains(nameA)
      .closest('[data-slot="card"]')
      .find("button") // first icon = Edit
      .first()
      .click();

    cy.url().should("match", /\/agents\/a\/.+/);

    cy.get("#name").clear().type(nameB);
    cy.get("#description").clear().type(`${descA} – edited`);
    cy.contains("button", /^update agent$/i).click();

    cy.url().should("include", "/management/agents");
    cy.contains(nameB, { timeout: 20_000 }).should("be.visible");
  });

  /* ──────────────────────────  DELETE  ────────────────────────── */
  it("deletes the agent", () => {
    cy.contains(nameB)
      .closest('[data-slot="card"]')
      .find("button")
      .eq(1) // second icon = Trash
      .click();

    // Wait for the delete confirmation dialog to be visible
    cy.get('[data-slot="alert-dialog-content"]').should("be.visible");

    // Click the delete button using the specific data-slot selector
    cy.get('[data-slot="alert-dialog-action"]').contains("Delete").click();

    cy.contains(nameB, { timeout: 20_000 }).should("not.exist");
  });
});
