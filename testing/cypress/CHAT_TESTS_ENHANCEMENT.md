cd# Chat Tests Enhancement Summary

## Overview
The chat end-to-end tests have been enhanced with specific details about routes, data-test-ids, component interactions, and proper test structure based on the codebase analysis.

## Enhanced Test Categories

### 1. Practice Chat Functionality
- **Guest users**: Login via `data-testid="guest-login-button"`, navigate to `/practice`, start simulations via `data-testid^="start-simulation-"`, send messages via textarea with placeholder "Type your message..."
- **TA users**: Mock session with role "ta", navigate to `/home`, then `/practice`
- **Instructional users**: Mock session with role "instructional", navigate to `/analytics/dashboard`, then `/practice`

### 2. Home Chat Functionality (Assigned Simulations)
- **TA users**: Access assigned simulations via `data-testid="simulation-card"`, continue incomplete simulations via `data-testid="simulation-history"`
- **History viewing**: Click on attempts via `data-testid^="attempt-"`, verify chat history and grading info

### 3. Assistant Chat Functionality
- **Access control**: Only instructional, admin, and superadmin users can access assistant chat
- **Navigation**: Click `button[title="Need Help?"]` to open assistant widget
- **Chat interaction**: Use textarea with placeholder "Start a conversation..."

### 4. Chat Message Functionality
- **Real-time messaging**: Send messages and verify responses appear
- **Message states**: Verify send/stop button states during message sending
- **Error handling**: Test network errors and reconnection

### 5. Chat History and Persistence
- **Page refresh**: Verify chat history persists across page reloads
- **Completed simulations**: View history via `data-testid="simulation-history"`
- **Session management**: Ensure current session unaffected when viewing history

### 6. Chat Export Functionality
- **TA export**: Export to Brightspace via `data-testid="export-brightspace-button"`
- **Instructional export**: Export TA data via analytics reports
- **Guest restrictions**: Verify no export options available

### 7. Chat Error Handling
- **Simulation start failures**: Intercept API calls and verify error messages
- **Message sending failures**: Test server errors and retry functionality
- **WebSocket disconnection**: Test reconnection handling

### 8. Chat Accessibility
- **Keyboard navigation**: Test tab navigation and focus management
- **ARIA labels**: Verify proper accessibility attributes
- **Screen reader support**: Test loading state announcements

## Required Data-Test-IDs

The following data-test-ids need to be added to components to support the enhanced tests:

### Chat Components
```typescript
// AttemptMessages.tsx
data-testid="chat-messages" // For the main chat messages container
data-testid="loading-announcement" // For screen reader announcements

// AttemptInput.tsx
data-testid="chat-input" // For the main chat input textarea

// ChatWidget.tsx
data-testid="assistant-widget" // For the assistant chat widget
data-testid="assistant-messages" // For assistant message container

// ChatDialog.tsx
data-testid="assistant-dialog" // For the expanded assistant dialog
```

### Error and Status Components
```typescript
// Error handling components
data-testid="error-message" // For error message displays
data-testid="error-toast" // For toast error messages
data-testid="reconnect-button" // For reconnection buttons
data-testid="reconnect-indicator" // For connection status indicators
data-testid="connection-status" // For WebSocket connection status
data-testid="retry-button" // For retry functionality
```

### Export Components
```typescript
// Export functionality
data-testid="export-brightspace-button" // For Brightspace export
data-testid="export-csv-button" // For CSV export
data-testid="ta-selector" // For TA selection in reports
data-testid="ta-option" // For individual TA options
```

### History Components
```typescript
// Simulation history
data-testid="simulation-history" // For the history container
data-testid^="attempt-" // For individual attempt items (already exists)
```

## Authentication Patterns

### Guest Authentication
```typescript
cy.visit("/");
cy.get('[data-testid="guest-login-button"]').click();
cy.url().should("include", "/practice");
```

### Role-Based Authentication
```typescript
// TA users
cy.mockSession({ role: "ta" });
cy.visit("/home");

// Instructional users
cy.mockSession({ role: "instructional" });
cy.visit("/analytics/dashboard");

// Admin users
cy.mockSession({ role: "admin" });
cy.visit("/analytics/dashboard");

// Superadmin users
cy.mockSession({ role: "superadmin" });
cy.visit("/analytics/dashboard");
```

## Route Patterns

### Practice Routes
- `/practice` - Practice page with simulation cards
- `/practice/a/[attemptId]` - Individual practice attempt

### Home Routes
- `/home` - TA home page with assigned simulations
- `/home/a/[attemptId]` - Individual home attempt

### Analytics Routes
- `/analytics/dashboard` - Analytics dashboard
- `/analytics/reports` - Reports page for exports

## Component Interaction Patterns

### Starting Simulations
```typescript
cy.get('[data-testid^="start-simulation-"]').first().click();
cy.url().should("include", "/practice/a/"); // or /home/a/
```

### Sending Messages
```typescript
cy.get('textarea[placeholder="Type your message..."]').type("Message{enter}");
```

### Ending Chats
```typescript
cy.get('[data-tour-end-chat]').click();
```

### Assistant Chat
```typescript
cy.get('button[title="Need Help?"]').click();
cy.get('[data-testid="assistant-widget"]').should("be.visible");
cy.get('textarea[placeholder="Start a conversation..."]').type("Message{enter}");
```

## Error Handling Patterns

### API Interception
```typescript
cy.intercept("POST", "/api/simulations/start", { 
  statusCode: 500, 
  body: { error: "Simulation start failed" } 
});
```

### WebSocket Disconnection
```typescript
cy.intercept("GET", "/api/socket.io/*", { forceNetworkError: true });
```

## Accessibility Testing Patterns

### Keyboard Navigation
```typescript
cy.get("body").type("{tab}");
cy.focused().should("have.attr", "placeholder", "Type your message...");
```

### ARIA Attributes
```typescript
cy.get('textarea[placeholder="Type your message..."]').should("have.attr", "aria-label");
cy.get('[data-testid="chat-messages"]').should("have.attr", "role", "log");
```

## Implementation Notes

1. **Data-test-ids**: All components referenced in tests need the specified data-test-ids added
2. **Mock sessions**: The `cy.mockSession()` command needs to be implemented for role-based testing
3. **File downloads**: Export tests expect files to be downloaded to `cypress/downloads/`
4. **Error handling**: Components need proper error states and messages for testing
5. **Accessibility**: Components need proper ARIA labels and keyboard navigation support

## Next Steps

1. Add the required data-test-ids to all referenced components
2. Implement the `cy.mockSession()` command for role-based authentication
3. Ensure all error states and messages are properly implemented
4. Add proper accessibility attributes to all chat components
5. Implement export functionality with proper data-test-ids
6. Test the enhanced tests to ensure they work with the actual implementation 