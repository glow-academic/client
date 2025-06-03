# GLOW Cypress Testing Suite

This directory contains modular, focused end-to-end tests for the GLOW application. The tests are designed to be minimal, reliable, and avoid unnecessary API calls to external services like OpenAI.

## Test Structure

### Core Test Files

1. **`login.cy.ts`** - Basic authentication tests
   - Guest access
   - User registration and login
   - Admin login
   - Form validation

2. **`auth.cy.ts`** - Comprehensive authentication tests
   - User authentication flows
   - Guest user restrictions
   - Authentication form validation

3. **`quiz.cy.ts`** - Quiz functionality tests
   - Quiz access and visibility
   - Quiz starting process
   - Quiz page elements and navigation
   - Error handling for quiz operations

4. **`chat.cy.ts`** - Chat functionality tests
   - Chat creation with different profiles
   - Message sending and receiving
   - Chat completion and rubric display
   - Guest chat access
   - Error handling for chat operations

5. **`ui-navigation.cy.ts`** - UI and navigation tests
   - Navigation elements
   - Responsive design testing
   - Profile and quiz card display
   - Interactive elements
   - Loading and error states
   - Accessibility features

## Key Features

### Modular Design
- Each test file focuses on a specific area of functionality
- Tests are independent and can be run separately
- Clear separation of concerns for easier maintenance

### API Mocking
All tests use `cy.intercept()` to mock API responses, preventing:
- Unnecessary calls to OpenAI API
- External service dependencies
- Flaky tests due to network issues
- Rate limiting issues

### Database Integration
Tests use the simplified `init.sql` which includes:
- Essential profiles (Aggressive, Happy, Confused)
- CS 180 test class
- Practice quiz for testing
- Minimal test data for reliable testing

### Test Data
- Uses timestamp-based usernames to avoid conflicts
- Automatically assigns users to CS 180 class for quiz testing
- Includes proper cleanup with `cy.clearAllStorage()`

## Running Tests

### Prerequisites
1. Ensure the database is running with the simplified `init.sql`
2. Start the Next.js development server (`npm run dev`)
3. Ensure the FastAPI server is running

### Commands

```bash
# Run all tests in headless mode
npm run cypress:run

# Open Cypress Test Runner
npm run cypress:open

# Run specific test file
npx cypress run --spec "cypress/e2e/auth.cy.ts"
npx cypress run --spec "cypress/e2e/quiz.cy.ts"
npx cypress run --spec "cypress/e2e/chat.cy.ts"
npx cypress run --spec "cypress/e2e/ui-navigation.cy.ts"

# Run multiple specific files
npx cypress run --spec "cypress/e2e/{auth,quiz}.cy.ts"
```

### Using the Test Runner Script

```bash
# From the client directory
./cypress/scripts/run-tests.sh           # Interactive mode
./cypress/scripts/run-tests.sh --headless # Headless mode
./cypress/scripts/run-tests.sh --spec auth.cy.ts # Specific test
```

### Environment Setup

The tests expect:
- Frontend running on `http://localhost:3000`
- Database accessible for the `assignUserToClass` task
- Proper CORS configuration for API calls

## Test Coverage by File

### `auth.cy.ts` - Authentication
- ✅ User registration and login
- ✅ Admin login with elevated permissions
- ✅ Guest access with limited functionality
- ✅ Form validation and error handling
- ✅ Guest user restrictions and capabilities

### `quiz.cy.ts` - Quiz Functionality
- ✅ Quiz visibility for enrolled students
- ✅ Quiz starting process with API mocking
- ✅ Quiz page navigation and timer
- ✅ Quiz elements display (timer, chat counter, sidebar)
- ✅ Error handling for failed quiz starts

### `chat.cy.ts` - Chat Functionality
- ✅ Chat creation with different profiles (Shuffle, Happy, Aggressive, Confused)
- ✅ Initial message selection (button-based)
- ✅ Custom message sending and receiving
- ✅ Chat completion and ending with rubric
- ✅ Guest chat access and limitations
- ✅ Error handling for failed chat operations

### `ui-navigation.cy.ts` - UI and Navigation
- ✅ Responsive design testing (desktop, tablet, mobile)
- ✅ Navigation elements (sidebar, header, main content)
- ✅ Profile and quiz card display
- ✅ Interactive elements and hover effects
- ✅ Loading and error state handling
- ✅ Accessibility features

## API Mocking Details

### Mocked Endpoints

1. **`POST /quiz/start`** - Returns mock quiz start response
2. **`POST /chat/new`** - Returns mock chat creation response  
3. **`POST /chat/message`** - Returns mock streaming chat response
4. **`POST /chat/end`** - Returns mock chat completion with rubric
5. **`GET /quiz/**`** - Returns mock quiz data
6. **`GET /quiz-chats/**`** - Returns mock quiz chat list
7. **`GET /chat/**`** - Returns mock chat data
8. **`GET /messages/**`** - Returns mock message history

### Mock Response Format

```javascript
// Quiz start response
{
  message: 'Quiz started',
  quiz_id: 'test-quiz-id',
  chat_ids: ['chat-1', 'chat-2'],
  total_chats: 2
}

// Chat message response (streaming)
'data: {"text": "Hello! I understand..."}\n\ndata: {"done": true}\n\n'

// Chat end response with rubric
{
  message: 'Chat ended successfully',
  rubric: {
    score: 18,
    passed: true,
    adaptability: 4,
    listening: 5,
    objectives: 4,
    time_management: 4
  }
}
```

## Custom Commands

Available custom Cypress commands:

- `cy.loginAsUser(username, password)` - Login as regular user
- `cy.loginAsAdmin(username, password)` - Login as admin  
- `cy.accessAsGuest()` - Access as guest
- `cy.clearAllStorage()` - Clear all browser storage
- `cy.task('assignUserToClass', {username, classId})` - Assign user to class via database

## Database Schema

The simplified database includes:

### Essential Tables
- `profiles` - Chat personality profiles
- `scenarios` - Chat scenarios for different situations
- `classes` - Course information (CS 180 for testing)
- `quizzes` - Test quiz data
- `users` - User accounts
- `templates` - Quiz generation templates

### Test Data
- 3 core profiles: Aggressive, Happy, Confused
- 1 test class: CS 180 Problem Solving and OOP
- 1 test quiz: "CS 180 Practice Quiz" (15 minutes)
- 1 admin user for testing

## Troubleshooting

### Common Issues

1. **Tests failing due to timing**
   - Increase timeout values in test assertions
   - Add appropriate `cy.wait()` calls after navigation

2. **Database connection issues**
   - Verify PostgreSQL is running
   - Check database credentials in `cypress.config.ts`
   - Ensure `assignUserToClass` task is working

3. **API mocking not working**
   - Check that `cy.intercept()` calls are before the actions that trigger them
   - Verify API endpoint URLs match the actual application

4. **Element not found errors**
   - Check that `data-testid` attributes exist in components
   - Verify selectors match the actual DOM structure
   - Use `cy.get('body').then(($body) => {...})` for conditional logic

### Debug Tips

1. Use `cy.log()` to add debug information
2. Add `cy.screenshot()` for visual debugging
3. Use `cy.pause()` to stop test execution for inspection
4. Check browser console for JavaScript errors
5. Run specific test files to isolate issues

## Contributing

When adding new tests:

1. Choose the appropriate test file based on functionality
2. Keep tests focused and minimal
3. Use API mocking to avoid external dependencies
4. Include proper cleanup in `beforeEach()`
5. Use descriptive test names and comments
6. Follow the existing pattern of user creation with timestamps

### Adding New Test Files

If you need to add a new test file:

1. Create the file in `cypress/e2e/` with a descriptive name
2. Follow the existing structure with `describe` blocks
3. Include proper `beforeEach()` setup
4. Add API mocking as needed
5. Update this README with the new file information

## Performance

The modular structure provides several benefits:

- **Faster Development** - Run only the tests you're working on
- **Parallel Execution** - Different test files can run in parallel
- **Easier Debugging** - Isolate issues to specific functionality areas
- **Better Maintenance** - Changes to one area don't affect other tests
- **Clearer Organization** - Easy to find and understand test coverage 