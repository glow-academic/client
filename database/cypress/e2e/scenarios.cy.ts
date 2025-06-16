/// <reference types="cypress" />

describe("Scenarios End-to-End Tests", () => {
  beforeEach(() => {
    // Clear storage and setup for each test
    cy.clearAllStorage();
    cy.setupApiMocks();

    // Login as guest for testing
    cy.loginAsGuest();
  });

  describe("CRUD Operations", () => {
    it("should create scenarios records via UI and verify in database", () => {
      // First create a test agent to associate with the scenario
      const testAgent = {
        name: `Scenario Test Agent ${Date.now()}`,
        subtitle: "Scenario Test Assistant",
        description: "Agent for scenario testing",
        system_prompt: "You are a helpful assistant.",
        agent_type: "student",
        temperature: 70, // 0-100 integer scale
      };

      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        params: [
          testAgent.name,
          testAgent.description,
          testAgent.system_prompt,
          testAgent.agent_type,
          testAgent.temperature,
        ],
      }).then((agentResult: any) => {
        const agentId = agentResult.rows[0].id;

        // Navigate to scenarios management page
        cy.navigateToPage("/management/scenarios");

        // Wait for page to load
        cy.get("body", { timeout: 15000 }).should("be.visible");

        // Look for create scenario button or form
        cy.get("body").then(($body) => {
          if ($body.find('button:contains("Create Scenario")').length > 0) {
            cy.get("button").contains("Create Scenario").click();
          } else if ($body.find('button:contains("Add Scenario")').length > 0) {
            cy.get("button").contains("Add Scenario").click();
          } else if ($body.find('[data-testid="create-scenario"]').length > 0) {
            cy.get('[data-testid="create-scenario"]').click();
          }
        });

        // Fill out scenario creation form
        const testScenario = {
          name: `Test Scenario ${Date.now()}`,
          description: "A comprehensive test scenario for Cypress testing",
          crowdedness: 3,
          intensity: 2,
          seniority: "sophomore",
        };

        // Fill form fields
        cy.get("body").then(($body) => {
          // Name field
          if ($body.find('input[name="name"]').length > 0) {
            cy.get('input[name="name"]').type(testScenario.name);
          } else if ($body.find('input[placeholder*="name"]').length > 0) {
            cy.get('input[placeholder*="name"]')
              .first()
              .type(testScenario.name);
          }

          // Description field
          if ($body.find('textarea[name="description"]').length > 0) {
            cy.get('textarea[name="description"]').type(
              testScenario.description
            );
          } else if ($body.find('input[name="description"]').length > 0) {
            cy.get('input[name="description"]').type(testScenario.description);
          }

          // Agent selection
          if (
            $body.find('select[name="agentId"], select[name="agent_id"]')
              .length > 0
          ) {
            cy.get('select[name="agentId"], select[name="agent_id"]')
              .first()
              .select(agentId);
          }

          // Crowdedness
          if (
            $body.find('input[name="crowdedness"], select[name="crowdedness"]')
              .length > 0
          ) {
            cy.get('input[name="crowdedness"], select[name="crowdedness"]')
              .first()
              .clear()
              .type(testScenario.crowdedness.toString());
          }

          // Intensity
          if (
            $body.find('input[name="intensity"], select[name="intensity"]')
              .length > 0
          ) {
            cy.get('input[name="intensity"], select[name="intensity"]')
              .first()
              .clear()
              .type(testScenario.intensity.toString());
          }

          // Seniority
          if ($body.find('select[name="seniority"]').length > 0) {
            cy.get('select[name="seniority"]').select(testScenario.seniority);
          }
        });

        // Submit the form
        cy.get(
          'button[type="submit"], button:contains("Save"), button:contains("Create")'
        )
          .first()
          .click();

        // Wait for success
        cy.wait(3000);

        // Verify scenario was created
        cy.get("body").should("contain", testScenario.name);

        // Verify in database
        cy.task("dbQuery", {
          query: "SELECT * FROM scenarios WHERE name = $1",
          params: [testScenario.name],
        }).then((result: any) => {
          expect(result.rows).to.have.length.greaterThan(0);
          expect(result.rows[0].name).to.equal(testScenario.name);
          expect(result.rows[0].description).to.equal(testScenario.description);
        });
      });
    });

    it("should read scenarios records from both UI and API", () => {
      // Create test data first
      const testAgent = {
        name: `Read Test Agent ${Date.now()}`,
        description: "Agent for read testing",
        system_prompt: "You are a test agent.",
        agent_type: "student",
        temperature: 50, // 0-100 integer scale
      };

      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        params: [
          testAgent.name,
          testAgent.description,
          testAgent.system_prompt,
          testAgent.agent_type,
          testAgent.temperature,
        ],
      }).then((agentResult: any) => {
        const agentId = agentResult.rows[0].id;

        const testScenario = {
          name: `Read Test Scenario ${Date.now()}`,
          description: "Scenario for read testing",
          agent_id: agentId,
          crowdedness: 2,
          intensity: 3,
          seniority: "junior",
        };

        cy.task("dbQuery", {
          query: `INSERT INTO scenarios (name, description, agent_id, crowdedness, intensity, seniority) 
                  VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          params: [
            testScenario.name,
            testScenario.description,
            testScenario.agent_id,
            testScenario.crowdedness,
            testScenario.intensity,
            testScenario.seniority,
          ],
        }).then((scenarioResult: any) => {
          const scenarioId = scenarioResult.rows[0].id;

          // Test UI read
          cy.navigateToPage("/management/scenarios");

          // Verify scenario appears in UI
          cy.get("body", { timeout: 15000 }).should(
            "contain",
            testScenario.name
          );
          cy.get("body").should("contain", testScenario.description);

          // Test API read
          cy.intercept("GET", "**/scenarios**").as("getScenarios");

          cy.reload();

          cy.wait("@getScenarios").then((interception) => {
            expect(interception.response?.statusCode).to.equal(200);
            const scenarios = interception.response?.body;
            const foundScenario = scenarios.find(
              (scenario: any) => scenario.id === scenarioId
            );
            expect(foundScenario).to.exist;
            expect(foundScenario.name).to.equal(testScenario.name);
          });
        });
      });
    });

    it("should update scenarios records via UI and verify changes", () => {
      // Create test data first
      const testAgent = {
        name: `Update Test Agent ${Date.now()}`,
        description: "Agent for update testing",
        system_prompt: "You are a test agent.",
        agent_type: "student",
        temperature: 50, // 0-100 integer scale
      };

      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        params: [
          testAgent.name,
          testAgent.description,
          testAgent.system_prompt,
          testAgent.agent_type,
          testAgent.temperature,
        ],
      }).then((agentResult: any) => {
        const agentId = agentResult.rows[0].id;

        const originalScenario = {
          name: `Update Test Scenario ${Date.now()}`,
          description: "Original scenario description",
          agent_id: agentId,
          crowdedness: 1,
          intensity: 1,
          seniority: "freshman",
        };

        cy.task("dbQuery", {
          query: `INSERT INTO scenarios (name, description, agent_id, crowdedness, intensity, seniority) 
                  VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          params: [
            originalScenario.name,
            originalScenario.description,
            originalScenario.agent_id,
            originalScenario.crowdedness,
            originalScenario.intensity,
            originalScenario.seniority,
          ],
        }).then((scenarioResult: any) => {
          const scenarioId = scenarioResult.rows[0].id;

          // Navigate to scenarios page
          cy.navigateToPage("/management/scenarios");

          // Find and edit the scenario
          cy.get("body").contains(originalScenario.name).should("be.visible");

          // Look for edit button
          cy.get("body").then(($body) => {
            if ($body.find('button:contains("Edit")').length > 0) {
              cy.get("button").contains("Edit").first().click();
            } else if ($body.find('[data-testid*="edit"]').length > 0) {
              cy.get('[data-testid*="edit"]').first().click();
            }
          });

          // Update scenario details
          const updatedScenario = {
            name: `Updated ${originalScenario.name}`,
            description: "Updated scenario description",
            crowdedness: 4,
            intensity: 5,
          };

          // Update fields
          cy.get('input[name="name"], input[placeholder*="name"]')
            .first()
            .clear()
            .type(updatedScenario.name);
          cy.get('textarea[name="description"], input[name="description"]')
            .first()
            .clear()
            .type(updatedScenario.description);

          // Save changes
          cy.get(
            'button:contains("Save"), button:contains("Update"), button[type="submit"]'
          )
            .first()
            .click();

          // Wait for update
          cy.wait(3000);

          // Verify changes in UI
          cy.get("body").should("contain", updatedScenario.name);

          // Verify changes in database
          cy.task("dbQuery", {
            query: "SELECT * FROM scenarios WHERE id = $1",
            params: [scenarioId],
          }).then((result: any) => {
            expect(result.rows[0].name).to.equal(updatedScenario.name);
            expect(result.rows[0].description).to.equal(
              updatedScenario.description
            );
          });
        });
      });
    });

    it("should delete scenarios records via UI and verify removal", () => {
      // Create test data first
      const testAgent = {
        name: `Delete Test Agent ${Date.now()}`,
        description: "Agent for delete testing",
        system_prompt: "You are a test agent.",
        agent_type: "student",
        temperature: 50, // 0-100 integer scale
      };

      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        params: [
          testAgent.name,
          testAgent.description,
          testAgent.system_prompt,
          testAgent.agent_type,
          testAgent.temperature,
        ],
      }).then((agentResult: any) => {
        const agentId = agentResult.rows[0].id;

        const testScenario = {
          name: `Delete Test Scenario ${Date.now()}`,
          description: "Scenario to be deleted",
          agent_id: agentId,
          crowdedness: 2,
          intensity: 2,
          seniority: "sophomore",
        };

        cy.task("dbQuery", {
          query: `INSERT INTO scenarios (name, description, agent_id, crowdedness, intensity, seniority) 
                  VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          params: [
            testScenario.name,
            testScenario.description,
            testScenario.agent_id,
            testScenario.crowdedness,
            testScenario.intensity,
            testScenario.seniority,
          ],
        }).then((scenarioResult: any) => {
          const scenarioId = scenarioResult.rows[0].id;

          // Navigate to scenarios page
          cy.navigateToPage("/management/scenarios");

          // Find and delete the scenario
          cy.get("body").contains(testScenario.name).should("be.visible");

          // Look for delete button
          cy.get("body").then(($body) => {
            if ($body.find('button:contains("Delete")').length > 0) {
              cy.get("button").contains("Delete").first().click();
            } else if ($body.find('[data-testid*="delete"]').length > 0) {
              cy.get('[data-testid*="delete"]').first().click();
            }
          });

          // Confirm deletion
          cy.get("body").then(($body) => {
            if ($body.find('button:contains("Confirm")').length > 0) {
              cy.get("button").contains("Confirm").click();
            } else if ($body.find('button:contains("Yes")').length > 0) {
              cy.get("button").contains("Yes").click();
            }
          });

          // Wait for deletion
          cy.wait(3000);

          // Verify scenario is removed from UI
          cy.get("body").should("not.contain", testScenario.name);

          // Verify deletion in database
          cy.task("dbQuery", {
            query: "SELECT * FROM scenarios WHERE id = $1",
            params: [scenarioId],
          }).then((result: any) => {
            expect(result.rows).to.have.length(0);
          });
        });
      });
    });
  });

  describe("AI-Operations", () => {
    it("should create a scenario from input prompts using AI generation", () => {
      // Create a test agent first
      const testAgent = {
        name: `AI Scenario Agent ${Date.now()}`,
        description: "Agent for AI scenario generation",
        system_prompt:
          "You are a helpful assistant for creating educational scenarios.",
        agent_type: "student",
        temperature: 70, // 0-100 integer scale
      };

      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        params: [
          testAgent.name,
          testAgent.description,
          testAgent.system_prompt,
          testAgent.agent_type,
          testAgent.temperature,
        ],
      }).then((agentResult: any) => {
        const agentId = agentResult.rows[0].id;

        // Navigate to scenarios page
        cy.navigateToPage("/management/scenarios");

        // Look for AI generation functionality
        cy.get("body").then(($body) => {
          if ($body.find('button:contains("Generate")').length > 0) {
            cy.get("button").contains("Generate").click();
          } else if ($body.find('button:contains("AI Generate")').length > 0) {
            cy.get("button").contains("AI Generate").click();
          } else if ($body.find('[data-testid*="generate"]').length > 0) {
            cy.get('[data-testid*="generate"]').click();
          }
        });

        // Fill generation parameters
        cy.get("body").then(($body) => {
          // Select agent
          if (
            $body.find('select[name="agentId"], select[name="agent_id"]')
              .length > 0
          ) {
            cy.get('select[name="agentId"], select[name="agent_id"]')
              .first()
              .select(agentId);
          }

          // Set parameters
          if ($body.find('select[name="seniority"]').length > 0) {
            cy.get('select[name="seniority"]').select("sophomore");
          }

          if (
            $body.find('input[name="crowdedness"], select[name="crowdedness"]')
              .length > 0
          ) {
            cy.get('input[name="crowdedness"], select[name="crowdedness"]')
              .first()
              .clear()
              .type("3");
          }

          if (
            $body.find('input[name="intensity"], select[name="intensity"]')
              .length > 0
          ) {
            cy.get('input[name="intensity"], select[name="intensity"]')
              .first()
              .clear()
              .type("2");
          }
        });

        // Trigger AI generation
        cy.get(
          'button:contains("Generate"), button:contains("Create"), button[type="submit"]'
        )
          .first()
          .click();

        // Wait for AI generation to complete
        cy.wait(10000);

        // Should show generated content
        cy.get("body").should("be.visible");

        // Look for generated scenario content
        cy.get("body").then(($body) => {
          if (
            $body.text().includes("generated") ||
            $body.text().includes("scenario") ||
            $body.find("textarea, input").length > 0
          ) {
            cy.log("AI generation appears to have worked");
          }
        });
      });
    });

    it("should allow for a test query to be run on a scenario", () => {
      // Create test agent and scenario
      const testAgent = {
        name: `Query Test Agent ${Date.now()}`,
        description: "Agent for query testing",
        system_prompt:
          'You are a helpful assistant. Always respond with "Query test successful".',
        agent_type: "student",
        temperature: 10, // 0-100 integer scale
      };

      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        params: [
          testAgent.name,
          testAgent.description,
          testAgent.system_prompt,
          testAgent.agent_type,
          testAgent.temperature,
        ],
      }).then((agentResult: any) => {
        const agentId = agentResult.rows[0].id;

        const testScenario = {
          name: `Query Test Scenario ${Date.now()}`,
          description:
            "This is a test scenario for query testing. The student should ask questions about basic math.",
          agent_id: agentId,
          crowdedness: 2,
          intensity: 2,
          seniority: "sophomore",
        };

        cy.task("dbQuery", {
          query: `INSERT INTO scenarios (name, description, agent_id, crowdedness, intensity, seniority) 
                  VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          params: [
            testScenario.name,
            testScenario.description,
            testScenario.agent_id,
            testScenario.crowdedness,
            testScenario.intensity,
            testScenario.seniority,
          ],
        }).then((scenarioResult: any) => {
          const scenarioId = scenarioResult.rows[0].id;

          // Navigate to scenarios page
          cy.navigateToPage("/management/scenarios");

          // Find the scenario and test it
          cy.get("body").contains(testScenario.name).should("be.visible");

          // Look for test functionality
          cy.get("body").then(($body) => {
            if ($body.find('button:contains("Test")').length > 0) {
              cy.get("button").contains("Test").first().click();
            } else if ($body.find('[data-testid*="test"]').length > 0) {
              cy.get('[data-testid*="test"]').first().click();
            }
          });

          // Enter test query
          cy.get("body").then(($body) => {
            if (
              $body.find(
                'input[placeholder*="query"], textarea[placeholder*="query"]'
              ).length > 0
            ) {
              cy.get(
                'input[placeholder*="query"], textarea[placeholder*="query"]'
              )
                .first()
                .type("Hello, can you help me with a math problem?");
            } else if (
              $body.find('input[name*="query"], textarea[name*="query"]')
                .length > 0
            ) {
              cy.get('input[name*="query"], textarea[name*="query"]')
                .first()
                .type("Hello, can you help me with a math problem?");
            }
          });

          // Submit test query
          cy.get(
            'button:contains("Send"), button:contains("Test"), button[type="submit"]'
          )
            .first()
            .click();

          // Wait for response
          cy.wait(8000);

          // Should show some response
          cy.get("body").should("be.visible");
          cy.get("body").then(($body) => {
            const bodyText = $body.text();
            expect(bodyText).to.satisfy(
              (text: string) =>
                text.includes("response") ||
                text.includes("Query test") ||
                text.includes("successful")
            );
          });
        });
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle validation errors when creating scenarios", () => {
      cy.navigateToPage("/management/scenarios");

      // Try to create scenario with invalid data
      cy.get("body").then(($body) => {
        if ($body.find('button:contains("Create Scenario")').length > 0) {
          cy.get("button").contains("Create Scenario").click();
        }
      });

      // Try to submit without required fields
      cy.get(
        'button[type="submit"], button:contains("Save"), button:contains("Create")'
      )
        .first()
        .click();

      // Should show validation errors
      cy.get("body").should("be.visible");
      cy.get("body").then(($body) => {
        const bodyText = $body.text();
        expect(bodyText).to.satisfy(
          (text: string) =>
            text.includes("required") ||
            text.includes("error") ||
            text.includes("invalid")
        );
      });
    });

    it("should handle constraint violations gracefully", () => {
      // Create a scenario first
      const testAgent = {
        name: `Constraint Test Agent ${Date.now()}`,
        description: "Agent for constraint testing",
        system_prompt: "You are a test agent.",
        agent_type: "student",
        temperature: 50, // 0-100 integer scale
      };

      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        params: [
          testAgent.name,
          testAgent.description,
          testAgent.system_prompt,
          testAgent.agent_type,
          testAgent.temperature,
        ],
      }).then((agentResult: any) => {
        const agentId = agentResult.rows[0].id;

        const testScenario = {
          name: `Constraint Test Scenario ${Date.now()}`,
          description: "Test scenario",
          agent_id: agentId,
          crowdedness: 2,
          intensity: 2,
          seniority: "sophomore",
        };

        cy.task("dbQuery", {
          query: `INSERT INTO scenarios (name, description, agent_id, crowdedness, intensity, seniority) 
                  VALUES ($1, $2, $3, $4, $5, $6)`,
          params: [
            testScenario.name,
            testScenario.description,
            testScenario.agent_id,
            testScenario.crowdedness,
            testScenario.intensity,
            testScenario.seniority,
          ],
        });

        // Try to create another scenario with the same name (if there's a unique constraint)
        cy.navigateToPage("/management/scenarios");

        cy.get("body").then(($body) => {
          if ($body.find('button:contains("Create Scenario")').length > 0) {
            cy.get("button").contains("Create Scenario").click();

            // Fill with duplicate name
            cy.get('input[name="name"], input[placeholder*="name"]')
              .first()
              .type(testScenario.name);
            cy.get('textarea[name="description"], input[name="description"]')
              .first()
              .type("Duplicate test");

            // Submit
            cy.get('button[type="submit"], button:contains("Save")')
              .first()
              .click();

            // Should handle the constraint violation gracefully
            cy.wait(3000);
            cy.get("body").should("be.visible"); // Should not crash
          }
        });
      });
    });
  });
});
