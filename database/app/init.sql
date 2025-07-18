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
\i app/models/init.sql
\i app/classes/init.sql
\i app/rubrics/init.sql
\i app/logs/init.sql

-- 2. Assistant tables
\i app/assistants/init.sql

-- 3. Analytics tables
\i app/analytics/init.sql

-- 4. Agents
\i app/agents/init.sql

-- 5. Tables that depend on agents (scenarios references agents)
\i app/scenarios/init.sql

-- 6. Tables that depend on multiple previous tables
\i app/simulations/init.sql

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully!';
    RAISE NOTICE 'All modules loaded in dependency order.';
END $$;