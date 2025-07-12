/// <reference types="cypress" />

describe("Classes End-to-End Tests", () => {
  // --- Test Variables ---
  const baseClassName = `Intro to Testing - ${Date.now()}`;
  const manualClassName = `${baseClassName} (Manual)`;
  const zipClassName = `${baseClassName} (ZIP)`;
  const updatedClassName = `${manualClassName} (Updated)`;

  beforeEach(() => {
    cy.task("db:cleanup");
    cy.intercept("POST", "/api/documents/course", {
      statusCode: 200,
      body: { status: "success", message: "Course information processed successfully!" },
    }).as("processCourse");
  });

  it("should create, read, update, and delete a class manually", () => {
    // --- 1. CREATE ---
    cy.log("--- STARTING MANUAL CREATE ---");
    cy.visit("/create/classes/new");
    cy.contains("h3", "Create Manually").click();

    cy.findByLabelText(/Class Name/i).type(manualClassName);
    cy.findByLabelText(/Class Code/i).type("MAN101");
    cy.findByLabelText(/Description/i).type("A test class created by Cypress.");
    cy.findByRole("button", { name: /Create Class/i }).click();

    // --- 2. READ ---
    cy.log("--- STARTING READ ---");
    cy.url().should("include", "/create/classes");

    // ✅ FIX: Directly find the article containing the unique class name.
    // This command retries until the element is found, solving the race condition
    // and verifying the correct card is present in a single step.
    cy.contains("article", manualClassName, { timeout: 10000 }).should("be.visible");
    cy.task("db:findClass", { name: manualClassName }).should("exist");

    // --- 3. UPDATE (and upload a single document) ---
    cy.log("--- STARTING UPDATE & SINGLE FILE UPLOAD ---");

    // ✅ REFACTOR: A much cleaner way to interact with a specific card.
    cy.contains("article", manualClassName).within(() => {
      cy.findByRole("button", { name: `Edit ${manualClassName}` }).click();
    });

    cy.findByLabelText(/Class Name/i).clear().type(updatedClassName);
    cy.findByTestId("file-input").selectFile("cypress/fixtures/test-document.pdf");
    cy.contains("p", "test-document.pdf").should("be.visible");
    cy.findByRole("button", { name: /Update Class/i }).click();

    cy.url().should("include", "/create/classes");
    cy.contains("article", updatedClassName).should("be.visible");
    cy.task("db:findClass", { name: updatedClassName }).should("exist");

    // --- 4. AI PROCESSING ---
    cy.log("--- STARTING AI PROCESSING TEST ---");
    cy.contains("article", updatedClassName).within(() => {
      cy.findByRole("button", { name: `Edit ${updatedClassName}` }).click();
    });

    cy.findByRole("button", { name: /Process Course/i }).click();
    cy.findByRole("dialog").within(() => {
      cy.findByRole("button", { name: "Process Course" }).click();
    });
    cy.wait("@processCourse");
    cy.contains("Course information processed successfully!").should("be.visible");

    // --- 5. DELETE ---
    cy.log("--- STARTING DELETE ---");
    cy.visit("/create/classes");
    cy.contains("article", updatedClassName).within(() => {
      cy.findByRole("button", { name: `Delete ${updatedClassName}` }).click();
    });

    cy.findByRole("alertdialog").within(() => {
      cy.findByRole("button", { name: "Delete" }).click();
    });

    cy.contains("article", updatedClassName).should("not.exist");
    cy.task("db:findClass", { name: updatedClassName }).should("not.exist");
  });

  // --- Test 2: ZIP Upload Workflow ---
  it("should create a new class by uploading a ZIP file", () => {
    cy.visit("/create/classes/new");
    cy.get('input[type="file"]').first().selectFile(
      {
        contents: "cypress/fixtures/test-archive.zip",
        fileName: `${zipClassName}.zip`,
        mimeType: "application/zip",
      },
      { force: true }
    );
    
    cy.url({ timeout: 20000 }).should("include", "/create/classes/new/c/");
    cy.contains("Processing complete!").should("be.visible");

    cy.visit("/create/classes");
    cy.contains("article", zipClassName, { timeout: 10000 }).should("be.visible");
    cy.task("db:findClass", { name: zipClassName }).should("exist");
  });
});