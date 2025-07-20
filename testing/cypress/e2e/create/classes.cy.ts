/// <reference types="cypress" />

describe("Classes End-to-End Tests", () => {
  // --- Test Variables ---
  const baseClassName = `Intro to Testing - ${Date.now()}`;
  const manualClassName = `${baseClassName} (Manual)`;
  const zipClassName = `test-archive`;
  const updatedClassName = `${manualClassName} (Updated)`;

  beforeEach(() => {
    cy.task("db:cleanup");
  });

  it("should create, read, update, and delete a class manually", () => {
    // --- 1. CREATE ---
    cy.log("--- STARTING MANUAL CREATE ---");
    cy.visit("/classes/new");
    cy.contains("h3", "Create Manually").click();

    cy.findByLabelText(/Class Name/i).type(manualClassName);
    cy.findByLabelText(/Class Code/i).type("MAN101");
    cy.findByLabelText(/Description/i).type("A test class created by Cypress.");
    cy.findByRole("button", { name: /Create Class/i }).click();

    // --- 2. READ ---
    cy.log("--- STARTING READ ---");
    cy.location("pathname", { timeout: 20_000 }).should(
      "match",
      /\/classes(\/)?$/
    );
    cy.findByRole("article", { name: manualClassName }).should("be.visible");
    cy.task("db:findClass", { name: manualClassName }).should("exist");

    // --- 3. UPDATE (and upload a single document) ---
    cy.log("--- STARTING UPDATE & SINGLE FILE UPLOAD ---");

    cy.findByRole("article", { name: manualClassName })
      .findByTestId(/^edit-/)
      .click();

    cy.findByLabelText(/Class Name/i)
      .clear()
      .type(updatedClassName);
    cy.findByTestId("file-input").selectFile(
      "cypress/fixtures/test-document.pdf",
      { force: true }
    );
    cy.contains("p", "test-document.pdf").should("be.visible");
    cy.findByRole("button", { name: /Update Class/i }).click();

    cy.location("pathname", { timeout: 20_000 }).should(
      "match",
      /\/classes(\/)?$/
    );
    cy.findByRole("article", { name: updatedClassName }).should("be.visible");
    cy.task("db:findClass", { name: updatedClassName }).should("exist");

    // --- 4. AI PROCESSING ---
    cy.log("--- STARTING AI PROCESSING TEST ---");
    cy.findByRole("article", { name: updatedClassName })
      .findByTestId(/^edit-/)
      .click();

    cy.findByRole("button", { name: /Process Course/i }).click();
    cy.findByRole("dialog").within(() => {
      cy.findByRole("button", { name: "Process Course" }).click();
    });
    cy.contains("Course information processed successfully!").should(
      "be.visible"
    );

    // --- 5. DELETE ---
    cy.log("--- STARTING DELETE ---");
    cy.visit("/classes");
    cy.findByRole("article", { name: updatedClassName })
      .findByTestId(/^delete-/)
      .click();

    cy.findByRole("alertdialog").within(() => {
      cy.findByRole("button", { name: "Delete" }).click();
    });

    cy.contains("article", updatedClassName).should("not.exist");
    cy.task("db:findClass", { name: updatedClassName }).should("not.exist");
  });

  // --- Test 2: ZIP Upload Workflow ---
  it("should create a new class by uploading a ZIP file", () => {
    /* unchanged except you can delete the intercept wait
       because we want the real ZIP upload now */
    cy.visit("/classes/new");
    cy.findByTestId("file-input").selectFile(
      `cypress/fixtures/${zipClassName}.zip`,
      { force: true }
    );

    cy.location("pathname").should(
      "match",
      /\/create\/classes\/new\/c\/[^/]+$/ // uuid present
    );
    cy.contains("Processing complete!").should("be.visible");

    cy.visit("/classes");
    cy.findByRole("article", { name: zipClassName }).should("be.visible");
    cy.task("db:findClass", { name: zipClassName }).should("exist");

    // --- 2. DELETE ---
    cy.log("--- STARTING DELETE ---");
    cy.visit("/classes");
    cy.findByRole("article", { name: zipClassName })
      .findByTestId(/^delete-/)
      .click();

    cy.findByRole("alertdialog").within(() => {
      cy.findByRole("button", { name: "Delete" }).click();
    });

    cy.contains("article", zipClassName).should("not.exist");
    cy.task("db:findClass", { name: zipClassName }).should("not.exist");
  });
});
