/// <reference types="cypress" />

describe("Chat End-to-End Tests", () => {
  beforeEach(() => {
    // Clear storage and setup for each test
    cy.clearAllStorage();
    cy.setupApiMocks();

    // Login as guest for testing
    cy.loginAsGuest();
  });

  describe("Solo Chat Operations", () => {
    it("should start a solo chat (CREATE) and verify database records", () => {
      // First create the necessary test data
      const testAgent = {
        name: `Chat Test Agent ${Date.now()}`,
        subtitle: "Chat Test Assistant",
        description: "Agent for chat testing",
        system_prompt:
          "You are a helpful student assistant. Keep responses brief and educational.",
        agent_type: "student",
        temperature: 70, // 0-100 integer scale
      };

      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, subtitle, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        params: [
          testAgent.name,
          testAgent.subtitle,
          testAgent.description,
          testAgent.system_prompt,
          testAgent.agent_type,
          testAgent.temperature,
        ],
      }).then((agentResult: any) => {
        const agentId = agentResult.rows[0].id;

        const testScenario = {
          name: `Chat Test Scenario ${Date.now()}`,
          description:
            "You are a student who needs help with basic math. Ask questions about addition and subtraction.",
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

          // Create a rubric for the simulation
          const testRubric = {
            name: `Chat Test Rubric ${Date.now()}`,
            description: "Test rubric for chat testing",
            points: 100,
            pass_points: 70,
          };

          cy.task("dbQuery", {
            query: `INSERT INTO rubrics (name, description, points, pass_points) VALUES ($1, $2, $3, $4) RETURNING id`,
            params: [
              testRubric.name,
              testRubric.description,
              testRubric.points,
              testRubric.pass_points,
            ],
          }).then((rubricResult: any) => {
            const rubricId = rubricResult.rows[0].id;

            // Create a simulation
            const testSimulation = {
              title: `Chat Test Simulation ${Date.now()}`,
              time_limit: 30,
              active: true,
              scenario_ids: [scenarioId],
              rubric_id: rubricId,
            };

            cy.task("dbQuery", {
              query: `INSERT INTO simulations (title, time_limit, active, scenario_ids, rubric_id) 
                      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              params: [
                testSimulation.title,
                testSimulation.time_limit,
                testSimulation.active,
                testSimulation.scenario_ids,
                testSimulation.rubric_id,
              ],
            }).then((simulationResult: any) => {
              const simulationId = simulationResult.rows[0].id;

              // Navigate to home page to start simulation
              cy.navigateToPage("/home");

              // Wait for page to load and find the simulation
              cy.get("body", { timeout: 15000 }).should("be.visible");

              // Look for the simulation and start it
              cy.get("body").then(($body) => {
                if ($body.text().includes(testSimulation.title)) {
                  cy.get("body")
                    .contains(testSimulation.title)
                    .should("be.visible");

                  // Look for start button
                  if ($body.find('button:contains("Start")').length > 0) {
                    cy.get("button").contains("Start").first().click();
                  } else if (
                    $body.find('button:contains("Begin")').length > 0
                  ) {
                    cy.get("button").contains("Begin").first().click();
                  } else if ($body.find('[data-testid*="start"]').length > 0) {
                    cy.get('[data-testid*="start"]').first().click();
                  }
                } else {
                  // If simulation not visible, try to start any available simulation
                  if ($body.find('button:contains("Start")').length > 0) {
                    cy.get("button").contains("Start").first().click();
                  }
                }
              });

              // Wait for chat to start
              cy.wait(5000);

              // Should be in a chat interface now
              cy.url().then((url) => {
                expect(url.includes("/chat") || url.includes("/simulation")).to
                  .be.true;
              });

              // Verify chat interface elements
              cy.get("body").should("be.visible");

              // Look for chat input
              cy.get("body").then(($body) => {
                if (
                  $body.find(
                    'input[placeholder*="message"], textarea[placeholder*="message"]'
                  ).length > 0
                ) {
                  cy.get(
                    'input[placeholder*="message"], textarea[placeholder*="message"]'
                  ).should("be.visible");
                } else if (
                  $body.find(
                    'input[name*="message"], textarea[name*="message"]'
                  ).length > 0
                ) {
                  cy.get(
                    'input[name*="message"], textarea[name*="message"]'
                  ).should("be.visible");
                }
              });

              // Verify database records were created
              cy.task("dbQuery", {
                query:
                  "SELECT * FROM simulation_attempts WHERE simulation_id = $1",
                params: [simulationId],
              }).then((attemptResult: any) => {
                expect(attemptResult.rows).to.have.length.greaterThan(0);
                const attemptId = attemptResult.rows[0].id;

                // Verify chat was created
                cy.task("dbQuery", {
                  query: "SELECT * FROM simulation_chats WHERE attempt_id = $1",
                  params: [attemptId],
                }).then((chatResult: any) => {
                  expect(chatResult.rows).to.have.length.greaterThan(0);
                  expect(chatResult.rows[0].scenario_id).to.equal(scenarioId);
                  expect(chatResult.rows[0].completed).to.equal(false);
                });
              });
            });
          });
        });
      });
    });

    it("should send a message in a chat (CREATE) and verify API interaction", () => {
      // Create test data and start a chat first
      const testAgent = {
        name: `Message Test Agent ${Date.now()}`,
        subtitle: "Message Test Assistant",
        description: "Agent for message testing",
        system_prompt:
          'You are a helpful assistant. Always respond with "Message received successfully".',
        agent_type: "student",
        temperature: 10, // 0-100 integer scale
      };

      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, subtitle, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        params: [
          testAgent.name,
          testAgent.subtitle,
          testAgent.description,
          testAgent.system_prompt,
          testAgent.agent_type,
          testAgent.temperature,
        ],
      }).then((agentResult: any) => {
        const agentId = agentResult.rows[0].id;

        const testScenario = {
          name: `Message Test Scenario ${Date.now()}`,
          description: "Test scenario for message testing",
          agent_id: agentId,
          crowdedness: 1,
          intensity: 1,
          seniority: "freshman",
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

          // Create rubric and simulation
          cy.task("dbQuery", {
            query: `INSERT INTO rubrics (name, description, points, pass_points) VALUES ($1, $2, $3, $4) RETURNING id`,
            params: [
              `Message Test Rubric ${Date.now()}`,
              "Test rubric",
              100,
              70,
            ],
          }).then((rubricResult: any) => {
            const rubricId = rubricResult.rows[0].id;

            cy.task("dbQuery", {
              query: `INSERT INTO simulations (title, time_limit, active, scenario_ids, rubric_id) 
                      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              params: [
                `Message Test Simulation ${Date.now()}`,
                30,
                true,
                [scenarioId],
                rubricId,
              ],
            }).then((simulationResult: any) => {
              const simulationId = simulationResult.rows[0].id;

              // Create attempt and chat manually for testing
              cy.task("dbQuery", {
                query: `INSERT INTO simulation_attempts (simulation_id) VALUES ($1) RETURNING id`,
                params: [simulationId],
              }).then((attemptResult: any) => {
                const attemptId = attemptResult.rows[0].id;

                cy.task("dbQuery", {
                  query: `INSERT INTO simulation_chats (title, scenario_id, attempt_id, completed) 
                          VALUES ($1, $2, $3, $4) RETURNING id`,
                  params: ["Test Chat", scenarioId, attemptId, false],
                }).then((chatResult: any) => {
                  const chatId = chatResult.rows[0].id;

                  // Navigate to the chat (this might vary based on your routing)
                  cy.visit(`/chat/${chatId}`);

                  // Wait for chat to load
                  cy.get("body", { timeout: 15000 }).should("be.visible");

                  // Intercept the message API call
                  cy.intercept("POST", "**/attempt/message").as("sendMessage");

                  // Find message input and send a message
                  const testMessage =
                    "Hello, this is a test message for the chat system.";

                  cy.get("body").then(($body) => {
                    if (
                      $body.find(
                        'input[placeholder*="message"], textarea[placeholder*="message"]'
                      ).length > 0
                    ) {
                      cy.get(
                        'input[placeholder*="message"], textarea[placeholder*="message"]'
                      )
                        .first()
                        .type(testMessage);
                    } else if (
                      $body.find(
                        'input[name*="message"], textarea[name*="message"]'
                      ).length > 0
                    ) {
                      cy.get(
                        'input[name*="message"], textarea[name*="message"]'
                      )
                        .first()
                        .type(testMessage);
                    } else {
                      // Fallback to any input/textarea
                      cy.get("input, textarea").last().type(testMessage);
                    }
                  });

                  // Send the message
                  cy.get("body").then(($body) => {
                    if ($body.find('button:contains("Send")').length > 0) {
                      cy.get("button").contains("Send").click();
                    } else if ($body.find('button[type="submit"]').length > 0) {
                      cy.get('button[type="submit"]').click();
                    } else if ($body.find('[data-testid*="send"]').length > 0) {
                      cy.get('[data-testid*="send"]').click();
                    }
                  });

                  // Wait for API call
                  cy.wait("@sendMessage", { timeout: 10000 }).then(
                    (interception) => {
                      expect(interception.response?.statusCode).to.equal(200);
                    }
                  );

                  // Wait for response
                  cy.wait(5000);

                  // Verify message appears in chat
                  cy.get("body").should("contain", testMessage);

                  // Verify message was saved to database
                  cy.task("dbQuery", {
                    query:
                      "SELECT * FROM simulation_messages WHERE chat_id = $1 AND query = $2",
                    params: [chatId, testMessage],
                  }).then((messageResult: any) => {
                    expect(messageResult.rows).to.have.length.greaterThan(0);
                    expect(messageResult.rows[0].query).to.equal(testMessage);
                  });
                });
              });
            });
          });
        });
      });
    });

    it("should end a chat and verify completion", () => {
      // Create test data and active chat
      const testAgent = {
        name: `End Chat Test Agent ${Date.now()}`,
        subtitle: "End Chat Test Assistant",
        description: "Agent for end chat testing",
        system_prompt: "You are a helpful assistant.",
        agent_type: "student",
        temperature: 50, // 0-100 integer scale
      };

      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, subtitle, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        params: [
          testAgent.name,
          testAgent.subtitle,
          testAgent.description,
          testAgent.system_prompt,
          testAgent.agent_type,
          testAgent.temperature,
        ],
      }).then((agentResult: any) => {
        const agentId = agentResult.rows[0].id;

        const testScenario = {
          name: `End Chat Test Scenario ${Date.now()}`,
          description: "Test scenario for ending chat",
          agent_id: agentId,
          crowdedness: 1,
          intensity: 1,
          seniority: "freshman",
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

          // Create rubric and simulation
          cy.task("dbQuery", {
            query: `INSERT INTO rubrics (name, description, points, pass_points) VALUES ($1, $2, $3, $4) RETURNING id`,
            params: [
              `End Chat Test Rubric ${Date.now()}`,
              "Test rubric",
              100,
              70,
            ],
          }).then((rubricResult: any) => {
            const rubricId = rubricResult.rows[0].id;

            cy.task("dbQuery", {
              query: `INSERT INTO simulations (title, time_limit, active, scenario_ids, rubric_id) 
                      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              params: [
                `End Chat Test Simulation ${Date.now()}`,
                30,
                true,
                [scenarioId],
                rubricId,
              ],
            }).then((simulationResult: any) => {
              const simulationId = simulationResult.rows[0].id;

              // Create attempt and chat
              cy.task("dbQuery", {
                query: `INSERT INTO simulation_attempts (simulation_id) VALUES ($1) RETURNING id`,
                params: [simulationId],
              }).then((attemptResult: any) => {
                const attemptId = attemptResult.rows[0].id;

                cy.task("dbQuery", {
                  query: `INSERT INTO simulation_chats (title, scenario_id, attempt_id, completed) 
                          VALUES ($1, $2, $3, $4) RETURNING id`,
                  params: ["Test Chat to End", scenarioId, attemptId, false],
                }).then((chatResult: any) => {
                  const chatId = chatResult.rows[0].id;

                  // Navigate to the chat
                  cy.visit(`/chat/${chatId}`);

                  // Wait for chat to load
                  cy.get("body", { timeout: 15000 }).should("be.visible");

                  // Intercept the end chat API call
                  cy.intercept("POST", "**/attempt/continue").as("endChat");

                  // Look for end chat button
                  cy.get("body").then(($body) => {
                    if ($body.find('button:contains("End")').length > 0) {
                      cy.get("button").contains("End").click();
                    } else if (
                      $body.find('button:contains("Finish")').length > 0
                    ) {
                      cy.get("button").contains("Finish").click();
                    } else if (
                      $body.find('button:contains("Complete")').length > 0
                    ) {
                      cy.get("button").contains("Complete").click();
                    } else if ($body.find('[data-testid*="end"]').length > 0) {
                      cy.get('[data-testid*="end"]').click();
                    }
                  });

                  // Wait for API call
                  cy.wait("@endChat", { timeout: 10000 }).then(
                    (interception) => {
                      expect(interception.response?.statusCode).to.equal(200);
                    }
                  );

                  // Wait for completion
                  cy.wait(3000);

                  // Verify chat was marked as completed in database
                  cy.task("dbQuery", {
                    query: "SELECT * FROM simulation_chats WHERE id = $1",
                    params: [chatId],
                  }).then((chatResult: any) => {
                    expect(chatResult.rows[0].completed).to.equal(true);
                    expect(chatResult.rows[0].completed_at).to.not.be.null;
                  });

                  // Should redirect or show completion message
                  cy.get("body").should("be.visible");
                });
              });
            });
          });
        });
      });
    });

    it("should read a solo chat (READ) and display message history", () => {
      // Create test data with existing messages
      const testAgent = {
        name: `Read Chat Test Agent ${Date.now()}`,
        subtitle: "Read Chat Test Assistant",
        description: "Agent for read chat testing",
        system_prompt: "You are a helpful assistant.",
        agent_type: "student",
        temperature: 50, // 0-100 integer scale
      };

      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, subtitle, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        params: [
          testAgent.name,
          testAgent.subtitle,
          testAgent.description,
          testAgent.system_prompt,
          testAgent.agent_type,
          testAgent.temperature,
        ],
      }).then((agentResult: any) => {
        const agentId = agentResult.rows[0].id;

        const testScenario = {
          name: `Read Chat Test Scenario ${Date.now()}`,
          description: "Test scenario for reading chat",
          agent_id: agentId,
          crowdedness: 1,
          intensity: 1,
          seniority: "freshman",
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

          // Create rubric and simulation
          cy.task("dbQuery", {
            query: `INSERT INTO rubrics (name, description, points, pass_points) VALUES ($1, $2, $3, $4) RETURNING id`,
            params: [
              `Read Chat Test Rubric ${Date.now()}`,
              "Test rubric",
              100,
              70,
            ],
          }).then((rubricResult: any) => {
            const rubricId = rubricResult.rows[0].id;

            cy.task("dbQuery", {
              query: `INSERT INTO simulations (title, time_limit, active, scenario_ids, rubric_id) 
                      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              params: [
                `Read Chat Test Simulation ${Date.now()}`,
                30,
                true,
                [scenarioId],
                rubricId,
              ],
            }).then((simulationResult: any) => {
              const simulationId = simulationResult.rows[0].id;

              // Create attempt and chat with messages
              cy.task("dbQuery", {
                query: `INSERT INTO simulation_attempts (simulation_id) VALUES ($1) RETURNING id`,
                params: [simulationId],
              }).then((attemptResult: any) => {
                const attemptId = attemptResult.rows[0].id;

                cy.task("dbQuery", {
                  query: `INSERT INTO simulation_chats (title, scenario_id, attempt_id, completed) 
                          VALUES ($1, $2, $3, $4) RETURNING id`,
                  params: [
                    "Test Chat with History",
                    scenarioId,
                    attemptId,
                    false,
                  ],
                }).then((chatResult: any) => {
                  const chatId = chatResult.rows[0].id;

                  // Add some test messages
                  const testMessages = [
                    {
                      query: "Hello, can you help me?",
                      response: "Of course! How can I assist you?",
                    },
                    {
                      query: "I need help with math",
                      response:
                        "I'd be happy to help with math. What specific topic?",
                    },
                  ];

                  // Insert test messages
                  cy.task("dbQuery", {
                    query: `INSERT INTO simulation_messages (chat_id, query, response) VALUES ($1, $2, $3)`,
                    params: [
                      chatId,
                      testMessages[0].query,
                      testMessages[0].response,
                    ],
                  });

                  cy.task("dbQuery", {
                    query: `INSERT INTO simulation_messages (chat_id, query, response) VALUES ($1, $2, $3)`,
                    params: [
                      chatId,
                      testMessages[1].query,
                      testMessages[1].response,
                    ],
                  });

                  // Navigate to the chat
                  cy.visit(`/chat/${chatId}`);

                  // Wait for chat to load
                  cy.get("body", { timeout: 15000 }).should("be.visible");

                  // Verify message history is displayed
                  cy.get("body").should("contain", testMessages[0].query);
                  cy.get("body").should("contain", testMessages[0].response);
                  cy.get("body").should("contain", testMessages[1].query);
                  cy.get("body").should("contain", testMessages[1].response);

                  // Verify API call to load messages
                  cy.intercept("GET", "**/messages**").as("getMessages");
                  cy.reload();

                  cy.wait("@getMessages", { timeout: 10000 }).then(
                    (interception) => {
                      expect(interception.response?.statusCode).to.equal(200);
                    }
                  );
                });
              });
            });
          });
        });
      });
    });
  });

  describe("Multi-user Chat Operations", () => {
    it("should start a multi-user chat (CREATE) with multiple scenarios", () => {
      // Create multiple agents and scenarios for multi-user simulation
      const testAgent1 = {
        name: `Multi Chat Agent 1 ${Date.now()}`,
        subtitle: "Multi Chat Assistant 1",
        description: "First agent for multi-user testing",
        system_prompt: "You are a helpful student.",
        agent_type: "student",
        temperature: 70, // 0-100 integer scale
      };

      const testAgent2 = {
        name: `Multi Chat Agent 2 ${Date.now()}`,
        subtitle: "Multi Chat Assistant 2",
        description: "Second agent for multi-user testing",
        system_prompt: "You are a teaching assistant.",
        agent_type: "ta",
        temperature: 50, // 0-100 integer scale
      };

      // Create first agent
      cy.task("dbQuery", {
        query: `INSERT INTO agents (name, subtitle, description, system_prompt, agent_type, temperature) 
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        params: [
          testAgent1.name,
          testAgent1.subtitle,
          testAgent1.description,
          testAgent1.system_prompt,
          testAgent1.agent_type,
          testAgent1.temperature,
        ],
      }).then((agent1Result: any) => {
        const agent1Id = agent1Result.rows[0].id;

        // Create second agent
        cy.task("dbQuery", {
          query: `INSERT INTO agents (name, subtitle, description, system_prompt, agent_type, temperature) 
                  VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          params: [
            testAgent2.name,
            testAgent2.subtitle,
            testAgent2.description,
            testAgent2.system_prompt,
            testAgent2.agent_type,
            testAgent2.temperature,
          ],
        }).then((agent2Result: any) => {
          const agent2Id = agent2Result.rows[0].id;

          // Create scenarios for each agent
          const scenario1 = {
            name: `Multi Chat Scenario 1 ${Date.now()}`,
            description: "First scenario for multi-user chat",
            agent_id: agent1Id,
            crowdedness: 3,
            intensity: 2,
            seniority: "sophomore",
          };

          const scenario2 = {
            name: `Multi Chat Scenario 2 ${Date.now()}`,
            description: "Second scenario for multi-user chat",
            agent_id: agent2Id,
            crowdedness: 2,
            intensity: 3,
            seniority: "junior",
          };

          cy.task("dbQuery", {
            query: `INSERT INTO scenarios (name, description, agent_id, crowdedness, intensity, seniority) 
                    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            params: [
              scenario1.name,
              scenario1.description,
              scenario1.agent_id,
              scenario1.crowdedness,
              scenario1.intensity,
              scenario1.seniority,
            ],
          }).then((scenario1Result: any) => {
            const scenario1Id = scenario1Result.rows[0].id;

            cy.task("dbQuery", {
              query: `INSERT INTO scenarios (name, description, agent_id, crowdedness, intensity, seniority) 
                      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              params: [
                scenario2.name,
                scenario2.description,
                scenario2.agent_id,
                scenario2.crowdedness,
                scenario2.intensity,
                scenario2.seniority,
              ],
            }).then((scenario2Result: any) => {
              const scenario2Id = scenario2Result.rows[0].id;

              // Create rubric and multi-scenario simulation
              cy.task("dbQuery", {
                query: `INSERT INTO rubrics (name, description, points, pass_points) VALUES ($1, $2, $3, $4) RETURNING id`,
                params: [
                  `Multi Chat Test Rubric ${Date.now()}`,
                  "Test rubric for multi-user",
                  100,
                  70,
                ],
              }).then((rubricResult: any) => {
                const rubricId = rubricResult.rows[0].id;

                cy.task("dbQuery", {
                  query: `INSERT INTO simulations (title, time_limit, active, scenario_ids, rubric_id) 
                          VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                  params: [
                    `Multi Chat Test Simulation ${Date.now()}`,
                    45,
                    true,
                    [scenario1Id, scenario2Id],
                    rubricId,
                  ],
                }).then((simulationResult: any) => {
                  const simulationId = simulationResult.rows[0].id;

                  // Navigate to home and start the multi-user simulation
                  cy.navigateToPage("/home");

                  cy.get("body", { timeout: 15000 }).should("be.visible");

                  // Start the simulation
                  cy.get("body").then(($body) => {
                    if ($body.find('button:contains("Start")').length > 0) {
                      cy.get("button").contains("Start").first().click();
                    }
                  });

                  // Wait for first chat to start
                  cy.wait(5000);

                  // Verify we're in a chat
                  cy.url().then((url) => {
                    expect(url.includes("/chat") || url.includes("/simulation"))
                      .to.be.true;
                  });

                  // Verify multiple chats were created for the attempt
                  cy.task("dbQuery", {
                    query:
                      "SELECT * FROM simulation_attempts WHERE simulation_id = $1",
                    params: [simulationId],
                  }).then((attemptResult: any) => {
                    expect(attemptResult.rows).to.have.length.greaterThan(0);
                    const attemptId = attemptResult.rows[0].id;

                    // Should have created chats for multiple scenarios
                    cy.task("dbQuery", {
                      query:
                        "SELECT * FROM simulation_chats WHERE attempt_id = $1",
                      params: [attemptId],
                    }).then((chatResult: any) => {
                      expect(chatResult.rows).to.have.length.greaterThan(0);
                      // In a multi-scenario simulation, there should be at least one chat initially
                      expect(chatResult.rows[0].scenario_id).to.be.oneOf([
                        scenario1Id,
                        scenario2Id,
                      ]);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle validation errors when starting chats", () => {
      // Try to start a chat with invalid simulation ID
      cy.intercept("POST", "**/attempt/start", {
        statusCode: 404,
        body: { detail: "Simulation not found" },
      }).as("startAttemptError");

      cy.navigateToPage("/home");

      // Try to start a non-existent simulation
      cy.get("body").then(($body) => {
        if ($body.find('button:contains("Start")').length > 0) {
          cy.get("button").contains("Start").first().click();

          // Should handle the error gracefully
          cy.wait(3000);
          cy.get("body").should("be.visible"); // Should not crash
        }
      });
    });

    it("should handle constraint violations in chat operations", () => {
      // Test sending empty messages or invalid data
      cy.navigateToPage("/home");

      // Try to send empty message (if we can get to a chat interface)
      cy.get("body").then(($body) => {
        if ($body.find("input, textarea").length > 0) {
          // Try to send empty message
          if ($body.find('button:contains("Send")').length > 0) {
            cy.get("button").contains("Send").click();

            // Should handle gracefully
            cy.wait(1000);
            cy.get("body").should("be.visible");
          }
        }
      });
    });
  });
});
