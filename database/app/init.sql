-- Master Database Initialization Script
-- This script orchestrates the execution of all modular SQL files
-- in the correct order based on dependencies

-- Enable the gen_random_uuid() function (needed by all modules)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- EXECUTION ORDER BASED ON DEPENDENCIES
-- ============================================================================

-- 1. Independent tables (no foreign key dependencies)
\i app/departments/init.sql
\i seed/cs/departments.sql

\i app/users/init.sql
\i seed/cs/users.sql

\i app/models/init.sql
\i seed/cs/models.sql

\i app/documents/init.sql
\i seed/cs/documents.sql

\i app/rubrics/init.sql
\i seed/cs/rubrics.sql

\i app/system/init.sql
\i seed/cs/system.sql

-- 2. Assistant tables
\i app/assistants/init.sql
\i seed/cs/assistants.sql

-- 3. Personas and Agents
\i app/personas/init.sql
\i seed/cs/personas.sql

\i app/agents/init.sql
\i seed/cs/agents.sql

-- 4. Tables that depend on agents (scenarios references agents)
\i app/scenarios/init.sql
\i seed/cs/scenarios.sql

-- 5. Tables that depend on multiple previous tables
\i app/simulations/init.sql
\i seed/cs/simulations.sql

-- 6. Tables that depend on multiple previous tables
\i app/cohorts/init.sql
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