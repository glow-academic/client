# Mock Generation System

This directory contains scripts for automatically generating comprehensive mock data for testing your client applications.

## Overview

The mock generation system creates realistic test data that mirrors your database schema, including:
- **Meaningful mock data** with realistic names, descriptions, and relationships
- **Proper foreign key relationships** between entities
- **Enum value handling** with correct enum types
- **Automatic query and mutation mocking** for all your client utilities

## Generated Files

The system generates three main files in `client/mocks/`:

### 1. `schema.ts`
Contains mock data for all database tables with:
- Realistic entity names (e.g., "Math Tutor Agent", "Algebra Problem Solving")
- Proper relationships between entities
- Correct enum values
- Multiple records for key entities to test relationships

### 2. `queries.ts`
Automatically mocks all query functions in `client/utils/queries/` with:
- Vitest mock functions that return appropriate mock data
- Proper return types (arrays for getAll*, single objects for get*)
- Automatic imports of mock schema data

### 3. `mutations.ts`
Automatically mocks all mutation functions in `client/utils/mutations/` with:
- Vitest mock functions for create, update, delete operations
- Exported mock functions for easy testing
- Consistent return values based on operation type

## Usage

### Basic Generation
```bash
# Generate mocks from current database schema
cd database
node scripts/generate-mocks.js
```

### Integrated Workflow
```bash
# Generate queries, mutations, AND mocks in one command
node scripts/generate-queries-mutations.js --with-mocks
```

### Using in Tests
```typescript
// Import mocks (automatically applies vi.mock calls)
import '@/mocks/queries';
import '@/mocks/mutations';
import * as mockSchema from '@/mocks/schema';

// Your queries and mutations are now automatically mocked
const agents = getAllAgents(); // Returns mockSchema.agents
const newAgent = createAgent(data); // Returns mockSchema.agents[0]
```

## Mock Data Quality

The generated mocks include:

### Meaningful Content
- **Agents**: "Math Tutor Agent", "Science Helper Bot", "Writing Assistant"
- **Scenarios**: "Algebra Problem Solving", "Chemistry Lab Safety"
- **Classes**: "Algebra I" (MATH101), "General Chemistry" (CHEM101)
- **Rubrics**: "Math Problem Solving Rubric", "Science Lab Rubric"

### Proper Relationships
- Simulations reference actual scenario and rubric IDs
- Profiles are linked to classes
- Foreign keys properly reference parent entities
- Array fields contain actual related entity IDs

### Realistic Data Types
- UUIDs in proper format
- Timestamps in ISO format
- Enums use actual enum values from schema
- Numbers in appropriate ranges (scores 0-100, years 2024, etc.)

## Configuration

The mock generation is configurable through the script:

### Entity Counts
- Most tables: 1 record
- Key entities (agents, scenarios, rubrics, classes, cohorts, simulations): 2 records
- Provides enough variety for relationship testing

### Meaningful Names
The script includes context-aware naming for:
- Educational content (math, science, writing)
- Academic terms (fall, spring, summer)
- User roles (admin, instructor, ta)
- Document types (homework, lab, quiz)

### Foreign Key Mapping
Automatic relationship setup between:
- Agents ↔ Scenarios
- Scenarios ↔ Simulations
- Rubrics ↔ Evaluations
- Classes ↔ Schedules, Topics, Documents
- Users ↔ Profiles ↔ Cohorts

## Testing

A verification test is included at `client/__tests__/mocks/mock-verification.test.ts` that validates:
- Mock data structure and content
- Query/mutation function mocking
- Data quality and relationships
- Proper TypeScript types

Run the verification:
```bash
cd client
yarn test __tests__/mocks/mock-verification.test.ts
```

## Integration with Development Workflow

### After Schema Changes
1. Update your database schema
2. Run `node scripts/generate-queries-mutations.js --with-mocks`
3. Your tests automatically have updated mocks

### Benefits
- **No manual mock maintenance** - automatically stays in sync with schema
- **Realistic test data** - better than generic placeholder data
- **Proper relationships** - test complex scenarios with linked entities
- **Type safety** - mocks use the same types as your real data
- **Fast test execution** - no database calls, pure JavaScript mocks

## Customization

To customize the mock generation:

### Adding New Meaningful Names
Edit the `generateMeaningfulText()` function in `generate-mocks.js` to add context-specific names for your domain.

### Adjusting Entity Counts
Modify the `recordCount` logic in `generateMockData()` to create more or fewer records per table.

### Custom Field Values
Update the field generation logic in `generateMockData()` to create domain-specific values for your fields.

## Troubleshooting

### Mocks Not Working
1. Ensure you're importing the mock files: `import '@/mocks/queries';`
2. Check that your test setup includes vitest configuration
3. Verify the mock files exist in `client/mocks/`

### Missing Relationships
1. Check that foreign key mappings in `setupForeignKeyRelationships()` include your fields
2. Ensure the referenced tables have mock data generated
3. Verify field names follow the `*Id` or `*Ids` convention

### Outdated Mock Data
1. Re-run the mock generation after schema changes
2. Check that the database schema file is up to date
3. Consider using the integrated workflow with `--with-mocks`

## Example Output

```typescript
// Generated schema.ts excerpt
export const agents = [
  {
    "id": "kguu9o1n-et7b-f9gk-t565-320vd8kqze3",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.53,
    "createdAt": "2025-06-19T01:10:39.445Z"
  },
  // ... more agents
];

// Generated queries.ts excerpt
vi.mock('@/utils/queries/agents/get-all-agents', () => ({
  getAllAgents: vi.fn(() => mockSchema.agents || []),
}));

// Generated mutations.ts excerpt
export const createAgentMock = vi.fn(() => mockSchema.agents?.[0] || {});
vi.mock('@/utils/mutations/agents/create-agent', () => ({ 
  createAgent: createAgentMock 
}));
```

This system ensures your tests have realistic, consistent, and up-to-date mock data without any manual maintenance! 