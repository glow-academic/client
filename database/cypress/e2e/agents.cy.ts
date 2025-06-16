/// <reference types="cypress" />

describe("Agents End-to-End Tests", () => {
  beforeEach(() => {
    // Clear storage and setup for each test
    cy.clearAllStorage();
    cy.setupApiMocks();

    // Login as guest for testing
    cy.loginAsGuest();
  });

  describe("CRUD Operations", () => {
    it("should create agents records via UI and verify in database", () => {
      // Navigate to agents management page
      cy.navigateToPage("/management/agents");

      // Wait for page to load
      cy.get("body", { timeout: 15000 }).should("be.visible");

      // Look for create agent button or form
      cy.get("body").then(($body) => {
        if ($body.find('button:contains("Create Agent")').length > 0) {
          cy.get("button").contains("Create Agent").click();
        } else if ($body.find('button:contains("Add Agent")').length > 0) {
          cy.get("button").contains("Add Agent").click();
        } else if ($body.find('[data-testid="create-agent"]').length > 0) {
          cy.get('[data-testid="create-agent"]').click();
        } else {
          // Try to find any form inputs that might be for creating agents
          cy.get(
            'input[name*="name"], input[placeholder*="name"], input[placeholder*="Name"]'
          ).should("exist");
        }
      });

      // Fill out agent creation form
      const testAgent = {
        name: `Test Agent ${Date.now()}`,
        description: "A test agent for Cypress testing",
        systemPrompt: "You are a helpful test assistant.",
        agentType: "student",
        temperature: 0.7,
      };

      // Try different possible field names/selectors
      cy.get("body").then(($body) => {
        // Name field
        if ($body.find('input[name="name"]').length > 0) {
          cy.get('input[name="name"]').type(testAgent.name);
        } else if ($body.find('input[placeholder*="name"]').length > 0) {
          cy.get('input[placeholder*="name"]').first().type(testAgent.name);
        }

        // Description field
        if ($body.find('textarea[name="description"]').length > 0) {
          cy.get('textarea[name="description"]').type(testAgent.description);
        } else if ($body.find('input[name="description"]').length > 0) {
          cy.get('input[name="description"]').type(testAgent.description);
        } else if (
          $body.find('textarea[placeholder*="description"]').length > 0
        ) {
          cy.get('textarea[placeholder*="description"]')
            .first()
            .type(testAgent.description);
        }

        // System prompt field
        if ($body.find('textarea[name="systemPrompt"]').length > 0) {
          cy.get('textarea[name="systemPrompt"]').type(testAgent.systemPrompt);
        } else if ($body.find('textarea[name="system_prompt"]').length > 0) {
          cy.get('textarea[name="system_prompt"]').type(testAgent.systemPrompt);
        } else if ($body.find('textarea[placeholder*="prompt"]').length > 0) {
          cy.get('textarea[placeholder*="prompt"]')
            .first()
            .type(testAgent.systemPrompt);
        }
      });

      // Submit the form
      cy.get("body").then(($body) => {
        if ($body.find('button[type="submit"]').length > 0) {
          cy.get('button[type="submit"]').click();
        } else if ($body.find('button:contains("Save")').length > 0) {
          cy.get("button").contains("Save").click();
        } else if ($body.find('button:contains("Create")').length > 0) {
          cy.get("button").contains("Create").click();
        }
      });

      // Wait for success message or redirect
      cy.wait(3000);

      // Verify agent was created by checking if it appears in the list
      cy.get("body").should("contain", testAgent.name);

      // Verify in database using Cypress task
      cy.task("dbQuery", {
        query: "SELECT * FROM agents WHERE name = $1",
        params: [testAgent.name],
      }).then((result: any) => {
        expect(result.rows).to.have.length.greaterThan(0);
        expect(result.rows[0].name).to.equal(testAgent.name);
        expect(result.rows[0].description).to.equal(testAgent.description);
      });
    });

    it("should read agents records from both UI and API", () => {
      // First, ensure we have test data by creating an agent via database
      const testAgent = {
        name: `Read Test Agent ${Date.now()}`,
        description: "Agent for read testing",
        system_prompt: "You are a test agent.",
        agent_type: "student",
        temperature: 0.5,
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
      }).then((result: any) => {
        const agentId = result.rows[0].id;

        // Test UI read - navigate to agents page
        cy.navigateToPage("/management/agents");

        // Verify agent appears in the UI
        cy.get("body", { timeout: 15000 }).should("contain", testAgent.name);
        cy.get("body").should("contain", testAgent.description);

        // Test API read - intercept API call
        cy.intercept("GET", "**/agents**").as("getAgents");

        // Trigger API call by refreshing or navigating
        cy.reload();

        // Wait for API call and verify response
        cy.wait("@getAgents").then((interception) => {
          expect(interception.response?.statusCode).to.equal(200);
          const agents = interception.response?.body;
          const foundAgent = agents.find((agent: any) => agent.id === agentId);
          expect(foundAgent).to.exist;
          expect(foundAgent.name).to.equal(testAgent.name);
        });
      });
    });

    it("should update agents records via UI and verify changes", () => {
      // Create test agent first
      const originalAgent = {
        name: `Update Test Agent ${Date.now()}`,
        description: "Original description",
        system_prompt: "Original prompt",
        agent_type: "student",
        temperature: 0.5,
      };

      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        params: [
          originalAgent.name,
          originalAgent.description,
          originalAgent.system_prompt,
          originalAgent.agent_type,
          originalAgent.temperature,
        ],
      }).then((result: any) => {
        const agentId = result.rows[0].id;

        // Navigate to agents page
        cy.navigateToPage("/management/agents");

        // Find and click edit button for our agent
        cy.get("body").contains(originalAgent.name).should("be.visible");

        // Look for edit button near the agent
        cy.get("body").then(($body) => {
          if ($body.find('button:contains("Edit")').length > 0) {
            cy.get("button").contains("Edit").first().click();
          } else if ($body.find('[data-testid*="edit"]').length > 0) {
            cy.get('[data-testid*="edit"]').first().click();
          } else if (
            $body.find('button[title*="edit"], button[aria-label*="edit"]')
              .length > 0
          ) {
            cy.get('button[title*="edit"], button[aria-label*="edit"]')
              .first()
              .click();
          }
        });

        // Update the agent details
        const updatedAgent = {
          name: `Updated ${originalAgent.name}`,
          description: "Updated description",
          systemPrompt: "Updated system prompt",
        };

        // Clear and update name field
        cy.get('input[name="name"], input[placeholder*="name"]')
          .first()
          .clear()
          .type(updatedAgent.name);

        // Clear and update description
        cy.get(
          'textarea[name="description"], input[name="description"], textarea[placeholder*="description"]'
        )
          .first()
          .clear()
          .type(updatedAgent.description);

        // Save changes
        cy.get(
          'button:contains("Save"), button:contains("Update"), button[type="submit"]'
        )
          .first()
          .click();

        // Wait for update to complete
        cy.wait(3000);

        // Verify changes in UI
        cy.get("body").should("contain", updatedAgent.name);
        cy.get("body").should("contain", updatedAgent.description);

        // Verify changes in database
        cy.task("dbQuery", {
          query: "SELECT * FROM agents WHERE id = $1",
          params: [agentId],
        }).then((result: any) => {
          expect(result.rows[0].name).to.equal(updatedAgent.name);
          expect(result.rows[0].description).to.equal(updatedAgent.description);
        });
      });
    });

    it("should delete agents records via UI and verify removal", () => {
      // Create test agent first
      const testAgent = {
        name: `Delete Test Agent ${Date.now()}`,
        description: "Agent to be deleted",
        system_prompt: "Test prompt",
        agent_type: "student",
        temperature: 0.5,
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
      }).then((result: any) => {
        const agentId = result.rows[0].id;

        // Navigate to agents page
        cy.navigateToPage("/management/agents");

        // Find the agent and delete it
        cy.get("body").contains(testAgent.name).should("be.visible");

        // Look for delete button
        cy.get("body").then(($body) => {
          if ($body.find('button:contains("Delete")').length > 0) {
            cy.get("button").contains("Delete").first().click();
          } else if ($body.find('[data-testid*="delete"]').length > 0) {
            cy.get('[data-testid*="delete"]').first().click();
          } else if (
            $body.find('button[title*="delete"], button[aria-label*="delete"]')
              .length > 0
          ) {
            cy.get('button[title*="delete"], button[aria-label*="delete"]')
              .first()
              .click();
          }
        });

        // Confirm deletion if there's a confirmation dialog
        cy.get("body").then(($body) => {
          if ($body.find('button:contains("Confirm")').length > 0) {
            cy.get("button").contains("Confirm").click();
          } else if ($body.find('button:contains("Yes")').length > 0) {
            cy.get("button").contains("Yes").click();
          } else if ($body.find('button:contains("Delete")').length > 1) {
            cy.get("button").contains("Delete").last().click();
          }
        });

        // Wait for deletion to complete
        cy.wait(3000);

        // Verify agent is no longer in UI
        cy.get("body").should("not.contain", testAgent.name);

        // Verify agent is deleted from database
        cy.task("dbQuery", {
          query: "SELECT * FROM agents WHERE id = $1",
          params: [agentId],
        }).then((result: any) => {
          expect(result.rows).to.have.length(0);
        });
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle validation errors when creating agents", () => {
      cy.navigateToPage("/management/agents");

      // Try to create agent with invalid data
      cy.get("body").then(($body) => {
        if ($body.find('button:contains("Create Agent")').length > 0) {
          cy.get("button").contains("Create Agent").click();
        }
      });

      // Try to submit without required fields
      cy.get(
        'button[type="submit"], button:contains("Save"), button:contains("Create")'
      )
        .first()
        .click();

      // Should show validation errors
      cy.get("body")
        .should("contain.text", "required")
        .or("contain.text", "error")
        .or("contain.text", "invalid");
    });

    it("should handle constraint violations gracefully", () => {
      // Create an agent first
      const testAgent = {
        name: `Constraint Test Agent ${Date.now()}`,
        description: "Test agent",
        system_prompt: "Test prompt",
        agent_type: "student",
        temperature: 0.5,
      };

      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5)`,
        params: [
          testAgent.name,
          testAgent.description,
          testAgent.system_prompt,
          testAgent.agent_type,
          testAgent.temperature,
        ],
      });

      // Try to create another agent with the same name (if there's a unique constraint)
      cy.navigateToPage("/management/agents");

      cy.get("body").then(($body) => {
        if ($body.find('button:contains("Create Agent")').length > 0) {
          cy.get("button").contains("Create Agent").click();

          // Fill with duplicate name
          cy.get('input[name="name"], input[placeholder*="name"]')
            .first()
            .type(testAgent.name);
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

  describe("Agent Testing Functionality", () => {
    it("should allow testing agent queries", () => {
      // Create a test agent first
      const testAgent = {
        name: `Query Test Agent ${Date.now()}`,
        description: "Agent for query testing",
        system_prompt:
          'You are a helpful assistant. Always respond with "Test response successful".',
        agent_type: "student",
        temperature: 0.1,
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
      }).then((result: any) => {
        const agentId = result.rows[0].id;

        // Navigate to agents page
        cy.navigateToPage("/management/agents");

        // Look for test functionality
        cy.get("body").then(($body) => {
          if ($body.find('button:contains("Test")').length > 0) {
            cy.get("button").contains("Test").first().click();

            // Enter test query
            cy.get(
              'input[placeholder*="query"], textarea[placeholder*="query"], input[name*="query"]'
            )
              .first()
              .type("Hello, this is a test query");

            // Submit test
            cy.get(
              'button:contains("Send"), button:contains("Test"), button[type="submit"]'
            )
              .first()
              .click();

            // Wait for response
            cy.wait(5000);

            // Should show some response
            cy.get("body")
              .should("contain.text", "response")
              .or("contain.text", "Test response");
          }
        });
      });
    });
  });
});
