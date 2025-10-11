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

-- 4. Seed base data for junction table dependencies
\i seed/cs/departments.sql
\i seed/cs/users.sql
\i seed/cs/models.sql
\i seed/cs/documents.sql
\i seed/cs/rubrics.sql
\i seed/cs/system.sql
\i seed/cs/assistants.sql
\i seed/cs/personas.sql
\i seed/cs/agents.sql

-- 5. Tables that depend on agents (scenarios references agents, junction tables defined)
-- Note: All junction tables (scenario_objectives, scenario_parameter_items, etc.) are now defined here
\i app/scenarios/init.sql

-- 6. Tables that depend on multiple previous tables
-- Note: simulation_scenarios, simulation_tags, and tag junction tables defined here
\i app/simulations/init.sql

-- 7. Tables that depend on multiple previous tables
-- Note: cohort_profiles, cohort_simulations junction tables defined here
\i app/cohorts/init.sql

-- 8. Seed data for scenarios, simulations, and cohorts (after junction tables exist)
\i seed/cs/scenarios.sql
\i seed/cs/simulations.sql
\i seed/cs/cohorts.sql

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