# GLOW Testing Guide

This guide explains the simplified and streamlined testing setup for the GLOW application. The tests are designed to be minimal, reliable, and avoid unnecessary external API calls.

## Overview

The testing suite has been simplified to focus on core functionality:

1. **Authentication** - Login, guest access, admin access
2. **Quiz Functionality** - Quiz creation, starting, and navigation
3. **Chat Functionality** - Chat creation, messaging, and completion
4. **UI/UX** - Navigation, responsive design, error handling

## Key Improvements

### ✅ API Mocking
- All external API calls are mocked using `cy.intercept()`
- No OpenAI API calls during testing
- Consistent, predictable responses
- Faster test execution

### ✅ Simplified Database
- Minimal test data in `database/init.sql`
- Essential profiles: Aggressive, Happy, Confused
- One test class: CS 180
- One test quiz: "CS 180 Practice Quiz"
- Clean, focused data structure

### ✅ Focused Test Cases
- Two main test files: `login.cy.ts` and `simplified-tests.cy.ts`
- Each test is independent and self-contained
- Proper cleanup with `cy.clearAllStorage()`
- Timestamp-based usernames to avoid conflicts

## File Structure

```
client/cypress/
├── e2e/
│   ├── login.cy.ts              # Authentication tests
│   └── simplified-tests.cy.ts   # Main functionality tests
├── support/
│   ├── commands.ts              # Custom Cypress commands
│   └── e2e.ts                   # Support file and type definitions
├── scripts/
│   └── run-tests.sh             # Test runner script
└── README.md                    # Detailed testing documentation
```

## Running Tests

### Option 1: Using the Test Runner Script (Recommended)

The script automatically starts all necessary services:

```bash
# From the client directory
npm run test:e2e              # Opens Cypress Test Runner
npm run test:e2e:headless     # Runs tests in headless mode

# Or directly:
./cypress/scripts/run-tests.sh           # Interactive mode
./cypress/scripts/run-tests.sh --headless # Headless mode
./cypress/scripts/run-tests.sh --spec login.cy.ts # Specific test
```

### Option 2: Manual Setup

If you prefer to manage services manually:

1. **Start the database:**
   ```bash
   cd database
   bash run.sh --clean
   ```

2. **Start the backend:**
   ```bash
   cd server
   make run
   ```

3. **Start the frontend:**
   ```bash
   cd client
   npm run dev
   ```

4. **Run tests:**
   ```bash
   npm run cypress:open    # Interactive mode
   npm run cypress:run     # Headless mode
   ```

## Test Files Explained

### `login.cy.ts` - Authentication Tests

Tests the core authentication functionality:

- ✅ Guest access with localStorage verification
- ✅ User registration and login
- ✅ Admin login
- ✅ Form element validation

### `simplified-tests.cy.ts` - Main Functionality Tests

Comprehensive tests for core features:

**Authentication:**
- User, admin, and guest login flows

**Quiz Functionality:**
- Quiz visibility for enrolled students
- Quiz starting with API mocking
- Quiz page navigation and timer
- Error handling for failed operations

**Chat Functionality:**
- Chat creation with different profiles
- Initial message selection (button-based)
- Custom message sending and receiving
- Chat completion and ending
- Error handling

**UI/Navigation:**
- Responsive design testing
- Navigation elements
- Proper content display

## API Mocking Details

All API endpoints are mocked to provide consistent responses:

```javascript
// Quiz start response
{
  message: 'Quiz started',
  quiz_id: 'test-quiz-id',
  chat_ids: ['chat-1', 'chat-2'],
  total_chats: 2
}

// Chat creation response
{
  message: 'Chat started',
  chat_id: 'test-chat-id'
}

// Streaming chat message response
'data: {"text": "Hello! I understand..."}\n\ndata: {"done": true}\n\n'
```

## Database Schema

The simplified database includes only essential data:

### Core Tables
- `profiles` - 3 chat personalities (Aggressive, Happy, Confused)
- `scenarios` - 3 basic chat scenarios
- `classes` - 1 test class (CS 180)
- `quizzes` - 1 test quiz
- `users` - 1 admin user for testing
- `templates` - 3 quiz templates

### Test Data
- **CS 180 Practice Quiz** - 15-minute quiz for testing
- **Three Profiles** - Aggressive, Happy, Confused personalities
- **Essential Scenarios** - NullPointer, File I/O, Constructors

## Custom Commands

Available Cypress commands for common operations:

```javascript
cy.loginAsUser(username, password)     // Login as regular user
cy.loginAsAdmin(username, password)    // Login as admin
cy.accessAsGuest()                     // Access as guest
cy.clearAllStorage()                   // Clear browser storage
cy.task('assignUserToClass', {         // Assign user to class
  username, 
  classId: '44444444-1111-1111-1111-111111111111'
})
```

## Test Patterns

### User Creation
```javascript
const username = `test_user_${Date.now()}`
const password = 'testpass123'
cy.loginAsUser(username, password)
```

### API Mocking
```javascript
cy.intercept('POST', '**/quiz/start', {
  statusCode: 200,
  body: { message: 'Quiz started', quiz_id: 'test-id' }
}).as('startQuiz')
```

### Conditional Testing
```javascript
cy.get('body').then(($body) => {
  if ($body.text().includes('Quiz')) {
    // Test quiz functionality
  } else {
    // Handle no quiz case
  }
})
```

## Troubleshooting

### Common Issues

1. **Service Connection Errors**
   - Ensure all services are running (database, backend, frontend)
   - Check port availability (3000, 8000, 5432)
   - Use the test runner script for automatic service management

2. **Test Timing Issues**
   - Increase timeout values in assertions
   - Add appropriate `cy.wait()` calls
   - Use `cy.intercept()` to control API timing

3. **Database Issues**
   - Restart database with `bash run.sh --clean`
   - Verify test data exists in database
   - Check `assignUserToClass` task functionality

4. **Element Not Found**
   - Verify `data-testid` attributes exist
   - Check CSS selectors match DOM structure
   - Use conditional logic for dynamic content

### Debug Tips

1. **Use Cypress Test Runner** - `npm run cypress:open` for visual debugging
2. **Add Debug Logs** - Use `cy.log()` for debugging information
3. **Screenshots** - Automatic screenshots on test failure
4. **Browser Console** - Check for JavaScript errors
5. **Network Tab** - Monitor API calls and responses

## Best Practices

### Writing Tests
1. Keep tests focused and minimal
2. Use descriptive test names
3. Include proper cleanup in `beforeEach()`
4. Mock external dependencies
5. Use timestamp-based usernames

### Maintaining Tests
1. Update mocks when API changes
2. Keep database schema minimal
3. Regular cleanup of test artifacts
4. Monitor test execution time
5. Update documentation with changes

## Environment Requirements

- **Node.js** - v18 or higher
- **PostgreSQL** - Running on port 5432
- **Frontend** - Next.js dev server on port 3000
- **Backend** - FastAPI server on port 8000

## Contributing

When adding new tests:

1. Follow existing patterns and structure
2. Use API mocking for external services
3. Include both success and error scenarios
4. Add appropriate documentation
5. Test on different screen sizes
6. Ensure tests are independent and can run in any order

## Migration from Old Tests

The old complex test files have been replaced with:

- `login.cy.ts` - Simplified authentication tests
- `simplified-tests.cy.ts` - Comprehensive functionality tests

Key changes:
- Removed redundant test cases
- Added comprehensive API mocking
- Simplified database schema
- Improved error handling
- Better test organization

This new structure provides better reliability, faster execution, and easier maintenance while covering all essential functionality. 