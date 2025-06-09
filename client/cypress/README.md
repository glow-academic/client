# Automated Database Table Testing System

This directory contains an automated Cypress testing system that generates comprehensive test files for every table in your database schema. The system ensures that all database tables are properly tested and automatically updates tests when your schema changes.

## 🚀 Features

- **Automatic Test Generation**: Generates Cypress test files for every table in your Drizzle schema
- **Schema-Aware Testing**: Analyzes your schema to create specific tests for fields, constraints, and relationships
- **Failing Tests by Default**: All generated tests fail until implemented, ensuring you know what needs to be done
- **Schema Change Detection**: Automatically detects when your schema changes and updates tests accordingly
- **Comprehensive Coverage**: Tests CRUD operations, API endpoints, UI integration, and error handling
- **Foreign Key Testing**: Validates relationships between tables
- **Constraint Validation**: Tests unique constraints, required fields, and enum values
- **Watch Mode**: Continuously monitors schema changes during development

## 📁 Directory Structure

```
cypress/
├── e2e/                          # Test files
│   ├── core-*.cy.ts             # Core application tests (maintained separately)
│   ├── *.cy.ts                  # Auto-generated table tests
│   └── table-test-coverage.md   # Coverage report
├── scripts/                      # Automation scripts
│   ├── generate-table-tests.js  # Basic test generator
│   ├── advanced-test-generator.js # Advanced schema-aware generator
│   └── watch-schema-changes.js  # Schema change monitor
├── fixtures/                     # Test data
├── support/                      # Cypress support files
└── README.md                     # This file
```

## 🛠️ Available Commands

### Basic Commands

```bash
# Start development server with automatic test generation
npm run dev

# Generate basic test files for all tables
npm run test:tables:generate

# Generate advanced test files with schema analysis
npm run test:tables:advanced

# Run all table tests
npm run test:tables

# Open Cypress UI for table tests
npm run test:tables:open
```

### Schema Monitoring

```bash
# Check for schema changes and update tests if needed
npm run test:tables:check

# Watch schema file continuously for changes
npm run test:tables:watch
```

### Core Tests (Separate from table tests)

```bash
# Run comprehensive core tests
npm run test:core

# Run authentication tests
npm run test:login

# Run chat functionality tests
npm run test:chat

# Run management interface tests
npm run test:management

# Run navigation tests
npm run test:navigation
```

## 📊 Test Generation Process

### 1. Schema Analysis

The system analyzes your `drizzle/schema.ts` file to extract:

- **Tables**: All `pgTable` definitions
- **Fields**: Column types, constraints, and properties
- **Enums**: Enum definitions and their values
- **Relationships**: Foreign key constraints
- **Constraints**: Unique constraints, required fields

### 2. Test Template Generation

For each table, the system generates tests for:

#### Database Schema Validation
- UUID primary key generation
- Automatic timestamp setting
- Required field enforcement
- Unique constraint validation
- Enum value validation

#### Foreign Key Relationships
- Constraint maintenance
- Cascade behavior testing
- Reference integrity

#### CRUD Operations
- Create records with proper validation
- Read records and verify data
- Update records and check changes
- Delete records and verify removal

#### API Endpoints
- GET requests for data retrieval
- POST requests for record creation
- PUT/PATCH requests for updates
- DELETE requests for removal

#### Error Handling
- Validation error scenarios
- Constraint violation handling
- Edge case testing

### 3. Failing Tests Strategy

All generated tests include failing assertions like:
```javascript
cy.wrap(null).should('not.exist', 'IMPLEMENT: users creation test');
```

This ensures that:
- You know exactly which tests need implementation
- Tests fail until you write actual test logic
- No false positives in your test suite

## 🔧 Configuration

### Schema Path
The system reads your schema from: `drizzle/schema.ts`

### Test File Naming
Tables are converted to test files using this pattern:
- `users` → `users.cy.ts`
- `user_profiles` → `user-profiles.cy.ts`
- `simulation_chats` → `simulation-chats.cy.ts`

### Core Test Exclusion
Files starting with `core-` are maintained separately and not auto-generated.

## 📈 Coverage Reporting

The system generates a coverage report at `cypress/e2e/table-test-coverage.md` showing:

- Total number of tables
- Test files created/updated/skipped
- Implementation status for each table
- Next steps and recommendations

## 🔄 Schema Change Detection

### Automatic Detection
When you run `npm run dev`, the system:
1. Checks if the schema file has been modified
2. Compares current tables with cached version
3. Generates tests for new tables
4. Removes tests for deleted tables
5. Updates the coverage report

### Manual Checking
```bash
# Check for changes (exits with code 1 if changes detected)
npm run test:tables:check

# Force regeneration regardless of modification time
node cypress/scripts/watch-schema-changes.js force
```

### Watch Mode
```bash
# Continuously monitor schema file
npm run test:tables:watch
```

This will:
- Monitor `drizzle/schema.ts` for changes
- Automatically regenerate tests when changes are detected
- Show real-time updates in the console

## 🎯 Implementation Guide

### 1. Start with Generated Tests
Run the test generator to create failing tests for all tables:
```bash
npm run test:tables:advanced
```

### 2. Review Coverage Report
Check `cypress/e2e/table-test-coverage.md` to see what needs implementation.

### 3. Implement Tests Gradually
For each table, replace the failing assertions with actual test logic:

```javascript
// Before (generated)
cy.wrap(null).should('not.exist', 'IMPLEMENT: users creation test');

// After (implemented)
cy.request('POST', '/api/users', {
  name: 'Test User',
  email: 'test@example.com'
}).then((response) => {
  expect(response.status).to.eq(201);
  expect(response.body).to.have.property('id');
});
```

### 4. Use Schema Information
Each test file includes detailed schema information in comments:

```javascript
/*
 * Table Schema Reference for users:
 * Export name: users
 * 
 * Fields:
 * - id: uuid (required) (primary key)
 * - name: text (required)
 * - email: text (required) (unique)
 * - role: enum (admin|user|guest)
 * 
 * Constraints:
 * - unique: users_email_key on email
 * 
 * Foreign Key Relationships:
 * - profile_id -> profiles.id (cascade)
 */
```

## 🚨 Best Practices

### 1. Keep Core Tests Separate
Don't modify files starting with `core-` as they're maintained separately.

### 2. Implement Tests Incrementally
Start with the most critical tables and work your way through.

### 3. Use Real API Endpoints
Test against your actual API endpoints, not mock data.

### 4. Test Edge Cases
Include tests for validation errors, constraint violations, and edge cases.

### 5. Monitor Schema Changes
Use watch mode during active development to catch schema changes immediately.

## 🔍 Troubleshooting

### Tests Not Generating
- Check that `drizzle/schema.ts` exists and is readable
- Ensure your schema uses the expected `pgTable` format
- Run with verbose logging: `node cypress/scripts/generate-table-tests.js`

### Schema Changes Not Detected
- Check file permissions on the schema file
- Clear the cache: `rm cypress/.schema-cache.json`
- Force regeneration: `npm run test:tables:check`

### Tests Failing Unexpectedly
- Remember that generated tests are designed to fail until implemented
- Check the test file comments for schema information
- Verify your API endpoints match the expected patterns

## 📚 Examples

### Basic Table Test Implementation
```javascript
describe('users Table Tests', () => {
  it('should create users records', () => {
    const userData = {
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user'
    };
    
    cy.request('POST', '/api/users', userData).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body).to.have.property('id');
      expect(response.body.name).to.eq(userData.name);
    });
  });
});
```

### Foreign Key Relationship Test
```javascript
it('should maintain foreign key constraint: posts_user_id_fkey', () => {
  // Create a user first
  cy.request('POST', '/api/users', { name: 'Test User' })
    .then((userResponse) => {
      const userId = userResponse.body.id;
      
      // Create a post with valid user_id
      return cy.request('POST', '/api/posts', {
        title: 'Test Post',
        user_id: userId
      });
    })
    .then((postResponse) => {
      expect(postResponse.status).to.eq(201);
    });
});
```

## 🤝 Contributing

When adding new tables to your schema:
1. The system will automatically detect them on next `npm run dev`
2. Implement the generated tests
3. Update this README if you add new features to the testing system

## 📝 Notes

- This system is designed to work with Drizzle ORM and PostgreSQL
- Test files are generated based on your current schema
- The system preserves existing implemented tests
- Core application tests are maintained separately from table tests 