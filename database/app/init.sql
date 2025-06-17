-- Master Database Initialization Script
-- This script orchestrates the execution of all modular SQL files
-- in the correct order based on dependencies

-- Enable the gen_random_uuid() function (needed by all modules)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- EXECUTION ORDER BASED ON DEPENDENCIES
-- ============================================================================

-- 1. Independent tables (no foreign key dependencies)
\i init/classes/init.sql
\i init/users/init.sql
\i init/agents/init.sql
\i init/rubrics/init.sql
\i init/logs/init.sql

-- 2. Tables that depend on agents (scenarios references agents)
\i init/scenarios/init.sql

-- 3. Tables that depend on multiple previous tables
\i init/simulations/init.sql

-- 4. Evaluation system (depends on rubrics)
\i init/evals/init.sql

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully!';
    RAISE NOTICE 'All modules loaded in dependency order.';
END $$;