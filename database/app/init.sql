-- Master Database Initialization Script
-- This script orchestrates the execution of all modular SQL files
-- in the correct order based on dependencies

-- Enable the gen_random_uuid() function (needed by all modules)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- EXECUTION ORDER BASED ON DEPENDENCIES
-- ============================================================================

-- 1. Independent tables (no foreign key dependencies)
\i /docker-entrypoint-initdb.d/app/classes/init.sql
\i /docker-entrypoint-initdb.d/app/models/init.sql
\i /docker-entrypoint-initdb.d/app/users/init.sql
\i /docker-entrypoint-initdb.d/app/rubrics/init.sql
\i /docker-entrypoint-initdb.d/app/logs/init.sql

-- 2. Agents
\i /docker-entrypoint-initdb.d/app/agents/init.sql

-- 3. Tables that depend on agents (scenarios references agents)
\i /docker-entrypoint-initdb.d/app/scenarios/init.sql

-- 4. Tables that depend on multiple previous tables
\i /docker-entrypoint-initdb.d/app/simulations/init.sql

-- 5. Evaluation system (depends on rubrics)
\i /docker-entrypoint-initdb.d/app/evals/init.sql

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully!';
    RAISE NOTICE 'All modules loaded in dependency order.';
END $$;