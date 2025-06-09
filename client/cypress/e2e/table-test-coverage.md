# Database Table Test Coverage Report

Generated on: 2025-06-09T00:21:25.711Z

## Summary
- **Total Tables**: 21
- **Tests Created**: 0
- **Tests Updated**: 0
- **Tests Skipped** (already implemented): 21

## Table Coverage

| Table Name | Export Name | Test File | Status |
|------------|-------------|-----------|--------|
| users | users | users.cy.ts | ✅ Implemented |
| classes | classes | classes.cy.ts | ✅ Implemented |
| topics | topics | topics.cy.ts | ✅ Implemented |
| schedules | schedules | schedules.cy.ts | ✅ Implemented |
| events | events | events.cy.ts | ✅ Implemented |
| documents | documents | documents.cy.ts | ✅ Implemented |
| rubrics | rubrics | rubrics.cy.ts | ✅ Implemented |
| standard_groups | standardGroups | standard-groups.cy.ts | ✅ Implemented |
| agents | agents | agents.cy.ts | ✅ Implemented |
| standards | standards | standards.cy.ts | ✅ Implemented |
| rubric_grades | rubricGrades | rubric-grades.cy.ts | ✅ Implemented |
| standard_grades | standardGrades | standard-grades.cy.ts | ✅ Implemented |
| scenarios | scenarios | scenarios.cy.ts | ✅ Implemented |
| simulations | simulations | simulations.cy.ts | ✅ Implemented |
| attempts | attempts | attempts.cy.ts | ✅ Implemented |
| simulation_chats | simulationChats | simulation-chats.cy.ts | ✅ Implemented |
| simulation_messages | simulationMessages | simulation-messages.cy.ts | ✅ Implemented |
| evals | evals | evals.cy.ts | ✅ Implemented |
| eval_runs | evalRuns | eval-runs.cy.ts | ✅ Implemented |
| eval_chats | evalChats | eval-chats.cy.ts | ✅ Implemented |
| eval_messages | evalMessages | eval-messages.cy.ts | ✅ Implemented |

## Next Steps

1. **Review failing tests**: All generated tests include failing assertions to ensure they're implemented
2. **Implement CRUD operations**: Add actual database operation tests for each table
3. **Add API endpoint tests**: Test your API routes for each table
4. **Test UI integration**: Ensure UI components work with database operations
5. **Add error handling**: Test edge cases and error scenarios

## Running Tests

```bash
# Run all table tests
npm run test:tables

# Run specific table test
npm run cypress:run -- --spec "cypress/e2e/users.cy.ts"

# Open Cypress UI for specific table
npm run cypress:open -- --e2e --spec "cypress/e2e/users.cy.ts"
```

## Core Tests

The following core test files are maintained separately:
