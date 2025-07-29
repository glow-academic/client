/// <reference types="cypress" />

describe("Chat End-to-End Tests", () => {
  beforeEach(() => {
    cy.clearAllStorage();
  });

  describe("Practice Chat Functionality", () => {
    it.skip("should allow guest users to start and participate in practice chats", () => {
      // Login as guest using data-testid="guest-login-button"
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.url().should("include", "/practice");

      // Navigate to practice page and verify practice simulations are visible
      cy.visit("/practice");
      cy.get('[data-testid="permanent-simulation-card"]').should("be.visible");

      // Start a practice simulation by clicking the start button
      cy.get('[data-testid^="start-simulation-"]').first().click();

      // Wait for simulation to start and navigate to attempt page
      cy.url().should("include", "/practice/a/");

      // Send a message using the chat input (textarea with placeholder "Type your message...")
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Hello, this is a test message{enter}"
      );

      // Verify message appears in chat and response is received
      cy.get('[data-testid="scroll-to-bottom-button"]').should("be.visible");

      // End the chat by clicking the end session button
      cy.get("[data-tour-end-chat]").click();

      // Verify completion and redirect back to practice page
      cy.url().should("include", "/practice");
    });

    it.skip("should allow TA users to start and participate in practice chats", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Navigate to practice page
      cy.visit("/practice");
      cy.get('[data-testid="permanent-simulation-card"]').should("be.visible");

      // Start a practice simulation
      cy.get('[data-testid^="start-simulation-"]').first().click();
      cy.url().should("include", "/practice/a/");

      // Send multiple messages and verify responses
      cy.get('textarea[placeholder="Type your message..."]').type(
        "First message{enter}"
      );
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Second message{enter}"
      );

      // Verify chat history is maintained
      cy.get('[data-testid="scroll-to-bottom-button"]').should("be.visible");

      // End the chat and verify completion
      cy.get("[data-tour-end-chat]").click();
      cy.url().should("include", "/practice");
    });

    it.skip("should allow instructional users to start and participate in practice chats", () => {
      // Login as instructional using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/analytics/dashboard");

      // Navigate to practice page
      cy.visit("/practice");
      cy.get('[data-testid="permanent-simulation-card"]').should("be.visible");

      // Start a practice simulation
      cy.get('[data-testid^="start-simulation-"]').first().click();
      cy.url().should("include", "/practice/a/");

      // Send messages and verify responses
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Test message{enter}"
      );

      // End the chat and verify completion
      cy.get("[data-tour-end-chat]").click();
      cy.url().should("include", "/practice");
    });
  });

  describe("Home Chat Functionality (Assigned Simulations)", () => {
    it.skip("should allow TA users to start assigned simulations from home page", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Verify assigned simulations are visible (simulation cards with data-testid="simulation-card")
      cy.get('[data-testid="simulation-card"]').should("be.visible");

      // Start an assigned simulation by clicking the start button
      cy.get('[data-testid^="start-simulation-"]').first().click();
      cy.url().should("include", "/home/a/");

      // Send messages and verify responses
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Hello from home simulation{enter}"
      );

      // End the chat and verify completion
      cy.get("[data-tour-end-chat]").click();
      cy.url().should("include", "/home");
    });

    it.skip("should allow TA users to continue incomplete simulations", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Find an incomplete simulation in the history section
      cy.get('[data-testid="simulation-history"]').should("be.visible");
      cy.get('[data-testid="simulation-history"]')
        .find('[data-testid^="attempt-"]')
        .first()
        .click();

      // Continue the simulation (should navigate to attempt page)
      cy.url().should("include", "/home/a/");

      // Send additional messages
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Continuing the conversation{enter}"
      );

      // End the chat and verify completion
      cy.get("[data-tour-end-chat]").click();
      cy.url().should("include", "/home");
    });

    it.skip("should show simulation history for TA users", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Verify history section shows completed simulations
      cy.get('[data-testid="simulation-history"]').should("be.visible");

      // Click on a completed simulation
      cy.get('[data-testid="simulation-history"]')
        .find('[data-testid^="attempt-"]')
        .first()
        .click();

      // Verify chat history is displayed
      cy.get('[data-testid="scroll-to-bottom-button"]').should("be.visible");

      // Verify rubric and grading information is shown
      cy.get('[data-testid="timer"]').should("be.visible");
    });
  });

  describe("Assistant Chat Functionality", () => {
    it.skip("should allow instructional users to start assistant chats", () => {
      // Login as instructional using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/analytics/dashboard");

      // Navigate to assistant chat by clicking the chat fab button
      cy.get('button[title="Need Help?"]').click();

      // Start a new conversation (assistant widget should open)
      cy.get('[data-testid="assistant-widget"]').should("be.visible");

      // Send a message and verify response
      cy.get('textarea[placeholder="Start a conversation..."]').type(
        "How can I help my TAs?{enter}"
      );

      // Verify assistant provides helpful information
      cy.get('[data-testid="assistant-messages"]').should("contain", "help");
    });

    it.skip("should allow admin users to start assistant chats", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Navigate to assistant chat
      cy.get('button[title="Need Help?"]').click();

      // Start a new conversation
      cy.get('[data-testid="assistant-widget"]').should("be.visible");

      // Ask about analytics data
      cy.get('textarea[placeholder="Start a conversation..."]').type(
        "Show me analytics data{enter}"
      );

      // Verify assistant provides appropriate responses
      cy.get('[data-testid="assistant-messages"]').should("be.visible");
    });

    it.skip("should allow superadmin users to start assistant chats", () => {
      // Login as superadmin using mock session
      cy.mockSession({ role: "superadmin" });
      cy.visit("/analytics/dashboard");

      // Navigate to assistant chat
      cy.get('button[title="Need Help?"]').click();

      // Start a new conversation
      cy.get('[data-testid="assistant-widget"]').should("be.visible");

      // Ask about system management
      cy.get('textarea[placeholder="Start a conversation..."]').type(
        "System management help{enter}"
      );

      // Verify assistant provides appropriate responses
      cy.get('[data-testid="assistant-messages"]').should("be.visible");
    });

    it.skip("should prevent TA users from accessing assistant chat", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Try to navigate to assistant chat - should not be available
      cy.get('button[title="Need Help?"]').should("not.exist");

      // Verify access is denied by checking that chat components are not rendered
      cy.get('[data-testid="assistant-widget"]').should("not.exist");
    });

    it.skip("should prevent guest users from accessing assistant chat", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");

      // Try to navigate to assistant chat - should not be available
      cy.get('button[title="Need Help?"]').should("not.exist");

      // Verify access is denied
      cy.get('[data-testid="assistant-widget"]').should("not.exist");
    });
  });

  describe("Chat Message Functionality", () => {
    it.skip("should send and receive messages in real-time", () => {
      // Start a simulation chat (login as guest for simplicity)
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");
      cy.get('[data-testid^="start-simulation-"]').first().click();

      // Send a message
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Real-time test message{enter}"
      );

      // Verify message appears in chat
      cy.get('[data-testid="scroll-to-bottom-button"]').should("be.visible");

      // Verify assistant response is received
      cy.get('[data-testid="chat-messages"]').should(
        "contain",
        "Real-time test message"
      );

      // Verify real-time updates work
      cy.get('[data-testid="chat-messages"]').should(
        "not.contain",
        "Sending..."
      );
    });

    it.skip("should handle message sending states correctly", () => {
      // Start a simulation chat
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");
      cy.get('[data-testid^="start-simulation-"]').first().click();

      // Send a message
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Test sending state{enter}"
      );

      // Verify "Sending..." state is shown (button should show stop icon)
      cy.get('button[type="submit"]').should("contain", "Square"); // Stop icon

      // Verify send button is disabled during sending
      cy.get('button[type="submit"]').should("be.disabled");

      // Verify message completes and state resets
      cy.get('button[type="submit"]').should("contain", "Send"); // Send icon
      cy.get('button[type="submit"]').should("not.be.disabled");
    });

    it.skip("should allow stopping message generation", () => {
      // Start a simulation chat
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");
      cy.get('[data-testid^="start-simulation-"]').first().click();

      // Send a message
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Long message to stop{enter}"
      );

      // Click stop button while response is generating
      cy.get('button[type="submit"]').click(); // This should be the stop button

      // Verify message generation stops
      cy.get('button[type="submit"]').should("contain", "Send"); // Back to send icon

      // Verify UI state resets correctly
      cy.get('textarea[placeholder="Type your message..."]').should(
        "be.enabled"
      );
    });

    it.skip("should handle network errors gracefully", () => {
      // Simulate network disconnect by intercepting WebSocket
      cy.intercept("GET", "/api/socket.io/*", { forceNetworkError: true });

      // Start a simulation chat
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");
      cy.get('[data-testid^="start-simulation-"]').first().click();

      // Try to send a message
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Network error test{enter}"
      );

      // Verify appropriate error message
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "WebSocket not connected"
      );

      // Verify reconnection handling
      cy.get('[data-testid="reconnect-button"]').should("be.visible");
    });
  });

  describe("Chat History and Persistence", () => {
    it.skip("should maintain chat history across page refreshes", () => {
      // Start a simulation chat
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");
      cy.get('[data-testid^="start-simulation-"]').first().click();

      // Send several messages
      cy.get('textarea[placeholder="Type your message..."]').type(
        "First message{enter}"
      );
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Second message{enter}"
      );
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Third message{enter}"
      );

      // Refresh the page
      cy.reload();

      // Verify chat history is preserved
      cy.get('[data-testid="chat-messages"]').should(
        "contain",
        "First message"
      );
      cy.get('[data-testid="chat-messages"]').should(
        "contain",
        "Second message"
      );
      cy.get('[data-testid="chat-messages"]').should(
        "contain",
        "Third message"
      );

      // Verify can continue the conversation
      cy.get('textarea[placeholder="Type your message..."]').should(
        "be.enabled"
      );
    });

    it.skip("should show chat history for completed simulations", () => {
      // Complete a simulation (login as TA to access home page)
      cy.mockSession({ role: "ta" });
      cy.visit("/home");
      cy.get('[data-testid^="start-simulation-"]').first().click();
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Complete this simulation{enter}"
      );
      cy.get("[data-tour-end-chat]").click();

      // Navigate to history
      cy.get('[data-testid="simulation-history"]').should("be.visible");

      // Click on completed simulation
      cy.get('[data-testid="simulation-history"]')
        .find('[data-testid^="attempt-"]')
        .first()
        .click();

      // Verify full chat history is displayed
      cy.get('[data-testid="chat-messages"]').should(
        "contain",
        "Complete this simulation"
      );

      // Verify grading information is shown
      cy.get('[data-testid="timer"]').should("be.visible");
    });

    it.skip("should allow viewing chat history without affecting current session", () => {
      // Start a new simulation
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");
      cy.get('[data-testid^="start-simulation-"]').first().click();

      // Send a message in current session
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Current session message{enter}"
      );

      // Navigate to history to view previous chat (if available)
      cy.get('[data-testid="simulation-history"]').click();

      // Return to current simulation
      cy.go("back");

      // Verify current session is unaffected
      cy.get('[data-testid="chat-messages"]').should(
        "contain",
        "Current session message"
      );
      cy.get('textarea[placeholder="Type your message..."]').should(
        "be.enabled"
      );
    });
  });

  describe("Chat Export Functionality", () => {
    it.skip("should allow TA users to export chat data to Brightspace", () => {
      // Login as TA
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Complete a simulation
      cy.get('[data-testid^="start-simulation-"]').first().click();
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Export test message{enter}"
      );
      cy.get("[data-tour-end-chat]").click();

      // Navigate to export options (should be available in history view)
      cy.get('[data-testid="simulation-history"]')
        .find('[data-testid^="attempt-"]')
        .first()
        .click();
      cy.get('[data-testid="export-brightspace-button"]').click();

      // Export chat data to Brightspace format
      cy.get('[data-testid="export-csv-button"]').click();

      // Verify CSV file is downloaded
      cy.readFile("cypress/downloads/simulation-export.csv").should("exist");

      // Verify file contains correct data
      cy.readFile("cypress/downloads/simulation-export.csv").should(
        "contain",
        "Export test message"
      );
    });

    it.skip("should allow instructional users to export TA chat data", () => {
      // Login as instructional
      cy.mockSession({ role: "instructional" });
      cy.visit("/analytics/dashboard");

      // Navigate to analytics/reports
      cy.visit("/analytics/reports");

      // Select a TA's data
      cy.get('[data-testid="ta-selector"]').click();
      cy.get('[data-testid="ta-option"]').first().click();

      // Export to Brightspace format
      cy.get('[data-testid="export-brightspace-button"]').click();

      // Verify CSV file is downloaded
      cy.readFile("cypress/downloads/ta-export.csv").should("exist");

      // Verify file contains correct data
      cy.readFile("cypress/downloads/ta-export.csv").should(
        "contain",
        "TA Data"
      );
    });

    it.skip("should prevent guest users from exporting chat data", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");

      // Complete a simulation
      cy.get('[data-testid^="start-simulation-"]').first().click();
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Guest message{enter}"
      );
      cy.get("[data-tour-end-chat]").click();

      // Verify no export options are available
      cy.get('[data-testid="export-brightspace-button"]').should("not.exist");
      cy.get('[data-testid="export-csv-button"]').should("not.exist");
    });
  });

  describe("Chat Error Handling", () => {
    it.skip("should handle simulation start failures gracefully", () => {
      // Try to start a simulation with invalid data by intercepting the API
      cy.intercept("POST", "/api/simulations/start", {
        statusCode: 500,
        body: { error: "Simulation start failed" },
      });

      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");

      // Try to start simulation
      cy.get('[data-testid^="start-simulation-"]').first().click();

      // Verify appropriate error message
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to start simulation"
      );

      // Verify UI state resets correctly
      cy.get('[data-testid^="start-simulation-"]').first().should("be.enabled");
    });

    it.skip("should handle message sending failures gracefully", () => {
      // Simulate server error by intercepting message API
      cy.intercept("POST", "/api/simulation/message", {
        statusCode: 500,
        body: { error: "Message failed" },
      });

      // Start a simulation chat
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");
      cy.get('[data-testid^="start-simulation-"]').first().click();

      // Try to send a message
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Failed message{enter}"
      );

      // Verify error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to send message"
      );

      // Verify retry functionality works
      cy.get('[data-testid="retry-button"]').click();
      cy.get('textarea[placeholder="Type your message..."]').should(
        "be.enabled"
      );
    });

    it.skip("should handle WebSocket disconnection gracefully", () => {
      // Start a chat
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");
      cy.get('[data-testid^="start-simulation-"]').first().click();

      // Simulate WebSocket disconnection
      cy.intercept("GET", "/api/socket.io/*", { forceNetworkError: true });

      // Try to send a message
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Disconnected message{enter}"
      );

      // Verify reconnection attempt
      cy.get('[data-testid="reconnect-indicator"]').should("be.visible");

      // Verify chat functionality resumes after reconnection
      cy.get('[data-testid="connection-status"]').should(
        "contain",
        "Connected"
      );
    });
  });

  describe("Chat Accessibility", () => {
    it.skip("should support keyboard navigation in chat interface", () => {
      // Start a simulation chat
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");
      cy.get('[data-testid^="start-simulation-"]').first().click();

      // Test tab navigation through chat elements
      cy.get("body").type("{tab}");
      cy.focused().should("have.attr", "placeholder", "Type your message...");

      // Test Enter key for sending messages
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Keyboard test{enter}"
      );
      cy.get('[data-testid="chat-messages"]').should(
        "contain",
        "Keyboard test"
      );

      // Test Escape key for stopping messages
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Stop this{enter}"
      );
      cy.get("body").type("{esc}");
      cy.get('button[type="submit"]').should("contain", "Send"); // Should stop and reset

      // Verify focus management works correctly
      cy.get('textarea[placeholder="Type your message..."]').should(
        "be.focused"
      );
    });

    it.skip("should provide appropriate ARIA labels and descriptions", () => {
      // Start a simulation chat
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");
      cy.get('[data-testid^="start-simulation-"]').first().click();

      // Verify chat input has proper labels
      cy.get('textarea[placeholder="Type your message..."]').should(
        "have.attr",
        "aria-label"
      );

      // Verify message elements have appropriate ARIA attributes
      cy.get('[data-testid="chat-messages"]').should(
        "have.attr",
        "role",
        "log"
      );

      // Verify loading states are announced to screen readers
      cy.get('textarea[placeholder="Type your message..."]').type(
        "Loading test{enter}"
      );
      cy.get('[data-testid="loading-announcement"]').should(
        "contain",
        "Sending message"
      );
    });
  });
});
