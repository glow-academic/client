## Database Initialization - Modular Structure

This directory contains modular SQL files for database initialization, organized by functional area.

### Execution Order (Based on Dependencies)

The master `init.sql` file orchestrates the execution of these modules in the correct dependency order:

1. **Independent tables** (no foreign key dependencies):
   - `classes/` - Class management, schedules, topics, events, documents
   - `users/` - User accounts and roles
   - `agents/` - AI agent definitions and personalities
   - `rubrics/` - Evaluation rubrics, standards, and grading system

2. **Dependent tables** (require agents):
   - `scenarios/` - Learning scenarios with agent assignments

3. **Complex dependencies** (require multiple previous tables):
   - `simulations/` - Simulation management, attempts, chats, and messages

4. **Evaluation system** (depends on rubrics):
   - `evals/` - Evaluation runs and automated assessment

### File Structure

```
init/
├── README.md           # This file
├── classes/init.sql    # Classes, schedules, topics, events, documents
├── users/init.sql      # User accounts and authentication
├── agents/init.sql     # AI agent personalities and configurations
├── rubrics/init.sql    # Evaluation rubrics and grading standards
├── scenarios/init.sql  # Learning scenarios and interactions
├── simulations/init.sql # Simulation management and chat data
└── evals/init.sql      # Evaluation system and automated assessment
```

### Key Changes from Monolithic Structure

- **Removed interactions table**: Scenarios now directly contain agent assignments and interaction parameters
- **Simplified relationships**: Direct references between scenarios and agents
- **Modular loading**: Each file can be developed and maintained independently
- **Dependency management**: Clear execution order prevents foreign key constraint errors

### Usage

The modular structure is automatically handled by the master `init.sql` file. Simply run:

```bash
./run.sh
```

Or in Docker environments, the `custom-entrypoint.sh` will automatically copy and execute all modules in the correct order.

