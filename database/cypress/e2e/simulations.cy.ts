/// <reference types="cypress" />

describe("Simulations – CRUD workflow", () => {
  const stamp  = Date.now();
  const titleA = `Cypress Simulation ${stamp}`;
  const titleB = `${titleA} (edited)`;

  /* each test starts clean – isolation may still be true */
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.loginAsAdmin();                 // mocked session + role flag
  });

  /* ──────────────────────────  CREATE  ────────────────────────── */
  it("creates a new simulation", () => {
    cy.visit("/create/simulations/new");

    /* Title + Time-limit */
    cy.get("#title").type(titleA);
    cy.get("#timeLimit").clear().type("25");

    /* Rubric – pick explicit 1st item */
    cy.contains("label", /^rubric$/i)
      .parent()
      .find('[data-slot="select-trigger"]')
      .click();
    cy.get('[data-slot="select-item"]').first().click();

    /* Add *one* scenario if list exists */
    cy.contains("label", /^scenarios$/i)      // section header
      .parent()
      .find('[data-slot="select-trigger"]')
      .first()
      .click();
    cy.get('[data-slot="select-item"]').first().click();   // 1st scenario

    /* Submit */
    cy.contains("button", /^create simulation$/i).click();

    /* redirected playground URL e.g. /create/simulations/s/<id>  */
    cy.location("pathname").should("match", /\/create\/simulations\/s\/.+/);
    cy.contains(titleA).should("be.visible");

    /* list page shows the new card */
    cy.visit("/simulations");
    cy.contains(titleA, { timeout: 20_000 }).should("be.visible");
  });

  /* ─────────────────────────── EDIT  ──────────────────────────── */
  it("edits the simulation", () => {
    cy.visit("/simulations");

    cy.contains(titleA)
      .closest('[data-slot="card"]')
      .find("button")            // 1st icon = ✏️
      .first()
      .click();

    cy.url().should("match", /\/create\/simulations\/s\/.+/);

    /* change Title and Time-limit */
    cy.get("#title").clear().type(titleB);
    cy.get("#timeLimit").clear().type("40");

    /* change Rubric – pick *last* item for variety */
    cy.contains("label", /^rubric$/i)
      .parent()
      .find('[data-slot="select-trigger"]')
      .click();
    cy.get('[data-slot="select-item"]').last().click();

    cy.contains("button", /^update simulation$/i).click();

    /* ensure save finished */
    cy.location("pathname").should("match", /\/create\/simulations\/s\/.+/);

    cy.visit("/simulations");
    cy.contains(titleB, { timeout: 20_000 }).should("be.visible");
  });

  /* ──────────────────────────  DELETE  ────────────────────────── */
  it("deletes the simulation", () => {
    cy.visit("/simulations");

    cy.contains(titleB)
      .closest('[data-slot="card"]')
      .find("button")          // 2nd icon = 🗑️
      .eq(1)
      .click();

    cy.get('[data-slot="alert-dialog-content"]').should("be.visible");
    cy.get('[data-slot="alert-dialog-action"]').contains("Delete").click();

    cy.contains(titleB, { timeout: 20_000 }).should("not.exist");
  });
});
