# GLOW Cypress Test Suite

This directory contains streamlined, page-based Cypress tests for the GLOW application. The tests are organized by page/feature and focus on core functionality rather than implementation details.

## Test Structure

### Page-Based Tests (`/e2e/pages/`)

Each page has its own test file focusing on:
- Core functionality
- User interactions
- Access control
- Responsive design

#### Core Test Files:
- `core-auth.cy.ts` - Login/logout functionality
- `core-chat.cy.ts` - Chat creation, messaging, and ending sessions
- `core-management.cy.ts` - CRUD operations for profiles, scenarios, templates, users, and classes
- `core-navigation.cy.ts` - UI navigation and role switching
- `core-comprehensive.cy.ts` - Complete end-to-end workflows

### Custom Commands (`/support/commands.ts`)

Reusable commands for common actions:
- `cy.loginAsUser()` - Login as regular user
- `cy.loginAsAdmin()` - Login as admin
- `cy.loginAsGuest()` - Continue as guest
- `cy.setupApiMocks()` - Setup API mocks
- `cy.navigateToPage(page)` - Navigate to specific page
- `cy.startChat(profileName)` - Start chat with profile
- `cy.sendMessage(message)` - Send chat message

## Test Philosophy

### Robust & Maintainable
- Tests focus on user actions, not implementation details
- Uses data-testid attributes where possible
- Graceful fallbacks for UI changes
- Minimal, focused assertions

### Page-Centric Organization
- Each page has dedicated test file
- Tests cover core functionality per page
- Access control testing for each user type
- Responsive design validation

### User Journey Testing
- Complete user flows from login to task completion
- Admin workflows
- Guest user limitations
- Error handling scenarios

## Running Tests

### Quick Start (Recommended)

```bash
# 1. Check if all services are running
npm run test:setup -- -c

# 2. If services aren't running, start them in separate terminals:
# Terminal 1: cd ../database && bash run.sh --clean
# Terminal 2: cd ../server && make run  
# Terminal 3: yarn run dev

# 3. Run tests (will check services automatically)
npm run test:e2e

# 4. Or run specific tests
npm run test:login      # Authentication tests
npm run test:chat       # Chat functionality tests
npm run test:management # Management CRUD tests
npm run test:navigation # Navigation and role switching
npm run test:core       # Comprehensive test suite
```

### Alternative Methods

```bash
# Run tests with automatic frontend startup
npm run test:dev        # Starts frontend + runs tests
npm run test:dev:open   # Starts frontend + opens Cypress GUI

# Run tests headless (assumes services running)
npm run test:e2e:headless

# Open Cypress GUI
npm run cypress:open

# Run specific test file directly
npx cypress run --spec "cypress/e2e/core-auth.cy.ts"
```

### Service Management

```bash
# Check service status
npm run test:setup -- -c

# Get help with setup
npm run test:setup -- -h
```

## Test Data

Tests use dynamic test data with timestamps to avoid conflicts:
- Usernames: `test_user_${Date.now()}`
- Admin users: `admin_${Date.now()}`
- API responses are mocked for consistency

## Best Practices

1. **Use Custom Commands**: Leverage reusable commands for common actions
2. **Data Test IDs**: Prefer `[data-testid="element"]` selectors
3. **Graceful Assertions**: Use conditional logic for UI variations
4. **Mock APIs**: Use consistent API mocks for reliable tests
5. **Page Focus**: Keep tests focused on single page functionality
6. **User Perspective**: Test from user's point of view, not code structure

## Maintenance

When adding new pages or features:
1. Create new page test file in `/e2e/pages/`
2. Add custom commands for new actions
3. Update API mocks as needed
4. Add to comprehensive test suite if part of main user flow

## Troubleshooting

### Common Issues

**"Cypress failed to verify that your server is running"**
- Make sure your frontend is running: `yarn run dev`
- Check if it's accessible at http://localhost:3000
- Use the setup script: `npm run test:setup -- -c`

**Tests failing due to missing elements**
- Tests use flexible selectors that adapt to UI changes
- If elements are missing, check if the page loaded correctly
- Use `npm run test:dev:open` to debug interactively

**API-related test failures**
- Tests use mocked APIs by default
- Make sure `cy.setupApiMocks()` is called in beforeEach
- Check if backend is running for integration tests

**Database connection issues**
- Start database first: `cd ../database && bash run.sh --clean`
- Check if PostgreSQL is running on port 5432

### Quick Fix Commands

```bash
# Install missing dependencies
yarn install

# Reset everything and start fresh
npm run test:setup -- -c

# Run a simple test to verify setup
npm run test:login
```

## Legacy Tests

Original test files were simplified into focused core tests for:
- Better organization
- Easier maintenance
- Clearer test intent
- Reduced duplication 