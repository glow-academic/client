# Cypress End-to-End Test Suite

## Overview

This directory contains comprehensive end-to-end tests for the Glow application, testing the full stack from client UI to server API to database operations.

## Test Implementation Status

### ✅ Completed Tests

#### Authentication (auth.cy.ts)
- **Status**: Fully implemented and working
- **Coverage**: Login/logout flows, guest access, Microsoft OAuth, error handling
- **Features**: 
  - Guest authentication flow
  - Microsoft login button interactions
  - Authentication state management
  - Logout functionality
  - Navigation and redirects
  - Error handling and accessibility

#### Agents (agents.cy.ts) 
- **Status**: Fully implemented
- **Coverage**: Complete CRUD operations with database verification
- **Features**:
  - Create agents via UI with database verification
  - Read agents from both UI and API
  - Update agents with change verification
  - Delete agents with removal verification
  - Agent query testing functionality
  - Validation error handling
  - Constraint violation handling

#### Scenarios (scenarios.cy.ts)
- **Status**: Fully implemented  
- **Coverage**: CRUD operations + AI functionality
- **Features**:
  - Create scenarios with agent associations
  - Read scenarios from UI and API
  - Update scenarios with verification
  - Delete scenarios with verification
  - AI scenario generation from prompts
  - Test query functionality on scenarios
  - Validation and constraint error handling

#### Chat (chat.cy.ts)
- **Status**: Fully implemented
- **Coverage**: Complete simulation and chat flow
- **Features**:
  - Start solo chats with database verification
  - Send messages with API interaction testing
  - End chats with completion verification
  - Read chat history and message display
  - Multi-user chat operations
  - Error handling for chat operations

### 🚧 Partially Implemented Tests

#### Classes (classes.cy.ts)
- **Status**: Template only
- **TODO**: Implement CRUD operations for class management
- **Features needed**: Create (ZIP/manual), read, update, delete classes

#### Documents (documents.cy.ts)
- **Status**: Template only  
- **TODO**: Implement file upload testing (TUS protocol)
- **Features needed**: Upload, read, update, delete documents

#### Simulations (simulations.cy.ts)
- **Status**: Template only
- **TODO**: Implement simulation management
- **Features needed**: Create, read, update, delete simulations

#### Users (users.cy.ts)
- **Status**: Template only
- **TODO**: Implement user management
- **Features needed**: Create (manual/CSV), read, update, delete users

#### Rubrics (rubrics.cy.ts)
- **Status**: Template only
- **TODO**: Implement rubric management
- **Features needed**: Create, read, update, delete rubrics

#### Evaluations (evals.cy.ts)
- **Status**: Template only
- **TODO**: Implement evaluation system testing
- **Features needed**: Create, run, stop, delete evaluations

#### Logs (logs.cy.ts)
- **Status**: Template only
- **TODO**: Implement log viewing and creation
- **Features needed**: Create, read logs

## Running Tests

### Using the Test Runner Script (Recommended)

We provide a convenient test runner script that makes it easy to run specific tests:

```bash
cd database

# Show available tests and options
./test-runner.sh --help

# Show test implementation status
./test-runner.sh --status

# Run specific tests
./test-runner.sh auth                    # Run auth tests headless
./test-runner.sh agents --headed         # Run agents tests with browser visible
./test-runner.sh scenarios --open        # Open scenarios tests in interactive mode
./test-runner.sh chat                    # Run chat tests headless
./test-runner.sh all                     # Run all tests
```

### Direct Yarn Commands

You can also run tests directly with yarn:

```bash
cd database

# Run all tests
yarn test

# Run specific test files
yarn test:cypress --spec "cypress/e2e/auth.cy.ts"
yarn test:cypress --spec "cypress/e2e/agents.cy.ts"
yarn test:cypress --spec "cypress/e2e/scenarios.cy.ts"
yarn test:cypress --spec "cypress/e2e/chat.cy.ts"

# Run tests in interactive mode
yarn test:cypress:open

# Run multiple specific tests
yarn test:cypress --spec "cypress/e2e/{auth,agents,scenarios}.cy.ts"
```

## Test Architecture

### Database Integration
- Tests use direct database queries via `cy.task('dbQuery')` for setup and verification
- Each test creates its own test data to ensure isolation
- Database records are verified after UI operations

### API Testing
- Tests intercept and verify API calls using `cy.intercept()`
- Both successful responses and error conditions are tested
- API response data is validated

### UI Testing
- Tests use flexible selectors to work with various UI implementations
- Graceful fallbacks for different button/input naming conventions
- Comprehensive error handling for missing UI elements

### Test Data Management
- Dynamic test data with timestamps to avoid conflicts
- Proper cleanup and isolation between tests
- Realistic test scenarios that mirror actual usage

## Configuration

### Environment Variables
- `CYPRESS_baseUrl`: Client application URL (default: http://localhost:3000)
- `CYPRESS_apiUrl`: Server API URL (default: http://localhost:8000)
- Database connection configured via environment variables

### Cypress Configuration
- Located in `cypress.config.ts`
- Includes database tasks for direct DB operations
- Custom commands defined in `cypress/support/commands.ts`

## Best Practices

### Test Structure
1. **Setup**: Create necessary test data via database
2. **Action**: Perform UI operations
3. **Verification**: Check both UI state and database state
4. **Cleanup**: Tests are isolated, no explicit cleanup needed

### Error Handling
- Tests gracefully handle missing UI elements
- Fallback strategies for different implementations
- Comprehensive error scenario testing

### Performance
- Tests use appropriate waits and timeouts
- Database operations are optimized
- Parallel execution supported

## Debugging

### Common Issues
1. **Database Connection**: Ensure database is running and accessible
2. **Service Dependencies**: Client and server must be running
3. **Test Data**: Check database for conflicting test data
4. **Timeouts**: Increase timeouts for slower environments

### Debug Commands
```bash
# Check database health
yarn test:cypress --spec "cypress/e2e/auth.cy.ts" --headed

# Run with browser visible
yarn test:cypress:open

# Check database directly
cd database && yarn connect
```

## Future Enhancements

### Planned Features
1. **Performance Testing**: Add load testing for chat operations
2. **Mobile Testing**: Add mobile-specific test scenarios  
3. **Integration Testing**: Cross-browser compatibility tests
4. **API Documentation**: Auto-generate API docs from test interactions

### Test Coverage Goals
- [ ] Complete all CRUD operations for remaining entities
- [ ] File upload/download testing
- [ ] Real-time chat testing with WebSockets
- [ ] Evaluation system end-to-end flows
- [ ] Analytics and reporting functionality

## Contributing

When adding new tests:
1. Follow the established pattern of database setup → UI action → verification
2. Use flexible selectors that work across different UI implementations
3. Include both positive and negative test cases
4. Document any new custom commands or utilities
5. Ensure tests are isolated and don't depend on external state