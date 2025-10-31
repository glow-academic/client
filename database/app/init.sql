-- Master Database Initialization Script
-- This script orchestrates the execution of all modular SQL files
-- in the correct order based on dependencies

-- Enable the gen_random_uuid() function (needed by all modules)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- EXECUTION ORDER BASED ON DEPENDENCIES
-- ============================================================================

-- 1. Independent tables (no foreign key dependencies)
-- Note: departments table created without agent columns first
\i app/departments/init.sql

\i app/users/init.sql

\i app/models/init.sql

\i app/documents/init.sql

\i app/rubrics/init.sql

\i app/system/init.sql

-- 2. Assistant tables
\i app/assistants/init.sql

-- 3. Personas and Agents
\i app/personas/init.sql

\i app/agents/init.sql

-- 4. Tables that depend on agents (scenarios/parameters - must exist before seed data)
-- Note: Parameters table is created here and needed by department seed data
\i app/scenarios/init.sql

-- 5. Seed base data for junction table dependencies
-- Import shared models (generated at seed/ level)
\i seed/models.sql

-- Import shared personas (cross-department, prompts linked separately)
\i seed/personas.sql

-- Import department-specific seed data (alphabetical order)
-- Note: Each department has its own folder with seed files
\i seed/cs/departments.sql
\i seed/cs/users.sql
\i seed/cs/documents.sql
\i seed/cs/rubrics.sql
\i seed/cs/system.sql
\i seed/cs/assistants.sql
\i seed/cs/agents.sql
\i seed/cs/prompts.sql

\i seed/biol/departments.sql
\i seed/biol/users.sql
\i seed/biol/documents.sql
\i seed/biol/parameters.sql
\i seed/biol/agents.sql
\i seed/biol/prompts.sql

\i seed/chem/departments.sql
\i seed/chem/users.sql
\i seed/chem/documents.sql
\i seed/chem/parameters.sql
\i seed/chem/agents.sql
\i seed/chem/prompts.sql

\i seed/eaps/departments.sql
\i seed/eaps/users.sql
\i seed/eaps/documents.sql
\i seed/eaps/parameters.sql
\i seed/eaps/agents.sql
\i seed/eaps/prompts.sql

\i seed/ma/departments.sql
\i seed/ma/users.sql
\i seed/ma/documents.sql
\i seed/ma/parameters.sql
\i seed/ma/agents.sql
\i seed/ma/prompts.sql

\i seed/phys/departments.sql
\i seed/phys/users.sql
\i seed/phys/documents.sql
\i seed/phys/parameters.sql
\i seed/phys/agents.sql
\i seed/phys/prompts.sql

\i seed/stat/departments.sql
\i seed/stat/users.sql
\i seed/stat/documents.sql
\i seed/stat/parameters.sql
\i seed/stat/agents.sql
\i seed/stat/prompts.sql

-- 6. Tables that depend on multiple previous tables
-- Note: simulation_scenarios, simulation_tags, and tag junction tables defined here
\i app/simulations/init.sql

-- 7. Tables that depend on multiple previous tables
-- Note: cohort_profiles, cohort_simulations junction tables defined here
\i app/cohorts/init.sql

-- 8. Seed data for scenarios, simulations, and cohorts (after junction tables exist)
-- Import CS-specific scenarios, simulations, and cohorts
\i seed/cs/scenarios.sql
\i seed/cs/simulations.sql
\i seed/cs/cohorts.sql

-- Note: Other departments can add their own scenarios/simulations/cohorts as needed

-- 8. Create materialized view
\i app/analytics/init.sql

-- 9. Audit tables, after seed data has been inserted
\i app/audit/init.sql

\i seed/init.sql

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully!';
    RAISE NOTICE 'All modules loaded in dependency order.';
END $$;