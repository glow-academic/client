-- Master Database Initialization Script
-- This script orchestrates the execution of all modular SQL files
-- in the correct order based on dependencies

-- Enable the gen_random_uuid() function (needed by all modules)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- EXECUTION ORDER BASED ON DEPENDENCIES
-- ============================================================================

-- 1. Independent tables (no foreign key dependencies)
\i app/classes/init.sql
\i app/models/init.sql
\i app/users/init.sql
\i app/rubrics/init.sql
\i app/logs/init.sql

-- 2. Chat tables
\i app/chat/init.sql

-- 3. Analytics tables
\i app/analytics/init.sql

-- 4. Agents
\i app/agents/init.sql

-- 5. Tables that depend on agents (scenarios references agents)
\i app/scenarios/init.sql

-- 6. Tables that depend on multiple previous tables
\i app/simulations/init.sql

-- 7. Evaluation system (depends on rubrics)
\i app/evals/init.sql

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully!';
    RAISE NOTICE 'All modules loaded in dependency order.';
END $$;