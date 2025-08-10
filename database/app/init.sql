-- Master Database Initialization Script
-- This script orchestrates the execution of all modular SQL files
-- in the correct order based on dependencies

-- Enable the gen_random_uuid() function (needed by all modules)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- EXECUTION ORDER BASED ON DEPENDENCIES
-- ============================================================================

-- 1. Independent tables (no foreign key dependencies)
\i app/users/init.sql
\i seed/default/users.sql

\i app/models/init.sql
\i seed/default/models.sql

\i app/documents/init.sql
\i seed/default/documents.sql

\i app/rubrics/init.sql
\i seed/default/rubrics.sql

\i app/system/init.sql
\i seed/default/system.sql

-- 2. Assistant tables
\i app/assistants/init.sql
\i seed/default/assistants.sql

-- 3. Agents
\i app/agents/init.sql
\i seed/default/agents.sql

-- 4. Tables that depend on agents (scenarios references agents)
\i app/scenarios/init.sql
\i seed/default/scenarios.sql

-- 5. Tables that depend on multiple previous tables
\i app/simulations/init.sql
\i seed/default/simulations.sql

-- 6. Tables that depend on multiple previous tables
\i app/cohorts/init.sql
\i seed/default/cohorts.sql

-- 7. Insert seed init file
\i seed/init.sql

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully!';
    RAISE NOTICE 'All modules loaded in dependency order.';
END $$;