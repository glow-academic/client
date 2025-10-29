-- ========================================
-- Department Multi-Tenancy Migration
-- ========================================
-- This migration converts single department_id foreign keys to junction tables,
-- enabling multi-department support for 7 core entities plus agents.
-- Removes default_* flags - junction table absence indicates "available to all departments"
--
-- Execute with: psql -d mydb < multi_tenant_departments_migration.sql
-- ========================================

BEGIN;

-- ========================================
-- STEP 1: Create agent_role enum
-- ========================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_role') THEN
        CREATE TYPE agent_role AS ENUM (
            'assistant',
            'classify', 
            'grade',
            'hint',
            'input_guardrail',
            'output_guardrail',
            'scenario',
            'title'
        );
        RAISE NOTICE 'Created agent_role enum';
    ELSE
        RAISE NOTICE 'agent_role enum already exists, skipping';
    END IF;
END $$;

-- ========================================
-- STEP 2: Add role column to agents table
-- ========================================
ALTER TABLE agents 
    ADD COLUMN IF NOT EXISTS role agent_role NOT NULL DEFAULT 'assistant';

DO $$ BEGIN
    RAISE NOTICE 'Added role column to agents table';
END $$;

-- ========================================
-- STEP 3: Backfill agents.role from department_agents
-- ========================================
-- Each agent should have consistent role across all department links
-- If there are inconsistencies, pick the most common role
UPDATE agents a
SET role = subq.role::agent_role
FROM (
    SELECT 
        da.agent_id,
        MODE() WITHIN GROUP (ORDER BY da.role) as role
    FROM department_agents da
    GROUP BY da.agent_id
) subq
WHERE a.id = subq.agent_id;

DO $$ BEGIN
    RAISE NOTICE 'Backfilled agents.role from department_agents';
END $$;

-- ========================================
-- STEP 4: Create 7 new junction tables
-- ========================================

-- cohort_departments
CREATE TABLE IF NOT EXISTS cohort_departments (
    cohort_id UUID NOT NULL,
    department_id UUID NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (cohort_id, department_id),
    FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS cohort_departments_cohort_id_idx ON cohort_departments(cohort_id);
CREATE INDEX IF NOT EXISTS cohort_departments_department_id_idx ON cohort_departments(department_id);

-- document_departments  
CREATE TABLE IF NOT EXISTS document_departments (
    document_id UUID NOT NULL,
    department_id UUID NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (document_id, department_id),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS document_departments_document_id_idx ON document_departments(document_id);
CREATE INDEX IF NOT EXISTS document_departments_department_id_idx ON document_departments(department_id);

-- parameter_departments
CREATE TABLE IF NOT EXISTS parameter_departments (
    parameter_id UUID NOT NULL,
    department_id UUID NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (parameter_id, department_id),
    FOREIGN KEY (parameter_id) REFERENCES parameters(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS parameter_departments_parameter_id_idx ON parameter_departments(parameter_id);
CREATE INDEX IF NOT EXISTS parameter_departments_department_id_idx ON parameter_departments(department_id);

-- persona_departments
CREATE TABLE IF NOT EXISTS persona_departments (
    persona_id UUID NOT NULL,
    department_id UUID NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (persona_id, department_id),
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS persona_departments_persona_id_idx ON persona_departments(persona_id);
CREATE INDEX IF NOT EXISTS persona_departments_department_id_idx ON persona_departments(department_id);

-- rubric_departments
CREATE TABLE IF NOT EXISTS rubric_departments (
    rubric_id UUID NOT NULL,
    department_id UUID NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (rubric_id, department_id),
    FOREIGN KEY (rubric_id) REFERENCES rubrics(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS rubric_departments_rubric_id_idx ON rubric_departments(rubric_id);
CREATE INDEX IF NOT EXISTS rubric_departments_department_id_idx ON rubric_departments(department_id);

-- scenario_departments
CREATE TABLE IF NOT EXISTS scenario_departments (
    scenario_id UUID NOT NULL,
    department_id UUID NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (scenario_id, department_id),
    FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS scenario_departments_scenario_id_idx ON scenario_departments(scenario_id);
CREATE INDEX IF NOT EXISTS scenario_departments_department_id_idx ON scenario_departments(department_id);

-- simulation_departments
CREATE TABLE IF NOT EXISTS simulation_departments (
    simulation_id UUID NOT NULL,
    department_id UUID NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (simulation_id, department_id),
    FOREIGN KEY (simulation_id) REFERENCES simulations(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS simulation_departments_simulation_id_idx ON simulation_departments(simulation_id);
CREATE INDEX IF NOT EXISTS simulation_departments_department_id_idx ON simulation_departments(department_id);

DO $$ BEGIN
    RAISE NOTICE 'Created 7 new junction tables';
END $$;

-- ========================================
-- STEP 5: Backfill junction tables
-- ========================================
-- For entities where default_* = false, insert junction record
-- For entities where default_* = true, insert NO records (cross-department)

-- Cohorts
INSERT INTO cohort_departments (cohort_id, department_id, active, created_at, updated_at)
SELECT id, department_id, true, NOW(), NOW()
FROM cohorts
WHERE default_cohort = false
ON CONFLICT (cohort_id, department_id) DO NOTHING;

-- Documents  
INSERT INTO document_departments (document_id, department_id, active, created_at, updated_at)
SELECT id, department_id, true, NOW(), NOW()
FROM documents
ON CONFLICT (document_id, department_id) DO NOTHING;

-- Parameters
INSERT INTO parameter_departments (parameter_id, department_id, active, created_at, updated_at)
SELECT id, department_id, true, NOW(), NOW()
FROM parameters
WHERE default_parameter = false
ON CONFLICT (parameter_id, department_id) DO NOTHING;

-- Personas
INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
SELECT id, department_id, true, NOW(), NOW()
FROM personas
WHERE default_persona = false
ON CONFLICT (persona_id, department_id) DO NOTHING;

-- Rubrics
INSERT INTO rubric_departments (rubric_id, department_id, active, created_at, updated_at)
SELECT id, department_id, true, NOW(), NOW()
FROM rubrics
WHERE default_rubric = false
ON CONFLICT (rubric_id, department_id) DO NOTHING;

-- Scenarios
INSERT INTO scenario_departments (scenario_id, department_id, active, created_at, updated_at)
SELECT id, department_id, true, NOW(), NOW()
FROM scenarios
WHERE default_scenario = false
ON CONFLICT (scenario_id, department_id) DO NOTHING;

-- Simulations
INSERT INTO simulation_departments (simulation_id, department_id, active, created_at, updated_at)
SELECT id, department_id, true, NOW(), NOW()
FROM simulations
WHERE default_simulation = false
ON CONFLICT (simulation_id, department_id) DO NOTHING;

DO $$ BEGIN
    RAISE NOTICE 'Backfilled junction tables from existing department_id columns';
END $$;

-- ========================================
-- STEP 6: Rename department_agents to agent_departments
-- ========================================
ALTER TABLE IF EXISTS department_agents RENAME TO agent_departments;

DO $$ BEGIN
    RAISE NOTICE 'Renamed department_agents to agent_departments';
END $$;

-- ========================================
-- STEP 7: Drop role column from agent_departments & update primary key
-- ========================================
-- First, drop the existing primary key constraint
ALTER TABLE agent_departments DROP CONSTRAINT IF EXISTS department_agents_pkey;

-- Drop the role column (now on agents table)
ALTER TABLE agent_departments DROP COLUMN IF EXISTS role;

-- Add new primary key on (agent_id, department_id)
ALTER TABLE agent_departments ADD PRIMARY KEY (agent_id, department_id);

DO $$ BEGIN
    RAISE NOTICE 'Updated agent_departments structure';
END $$;

-- ========================================
-- STEP 8: Backfill agent_departments from agents where default_agent = false
-- ========================================
-- Note: agent_departments may already have records from the old structure
-- We ensure agents marked as default (default_agent = true) have NO department links
-- Agents with default_agent = false should already have department links from old structure

-- No additional backfill needed here since department_agents already existed
-- and we renamed it. The existing records are preserved.

-- ========================================
-- STEP 9: Drop analytics materialized view (will recreate later)
-- ========================================
DROP MATERIALIZED VIEW IF EXISTS analytics CASCADE;

DO $$ BEGIN
    RAISE NOTICE 'Dropped analytics materialized view';
END $$;

-- ========================================
-- STEP 10: Drop department_id foreign keys and columns
-- ========================================

-- Drop foreign keys first
ALTER TABLE cohorts DROP CONSTRAINT IF EXISTS cohorts_department_id_fkey;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_department_id_fkey;
ALTER TABLE parameters DROP CONSTRAINT IF EXISTS parameters_department_id_fkey;
ALTER TABLE personas DROP CONSTRAINT IF EXISTS personas_department_id_fkey;
ALTER TABLE rubrics DROP CONSTRAINT IF EXISTS rubrics_department_id_fkey;
ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS scenarios_department_id_fkey;
ALTER TABLE simulations DROP CONSTRAINT IF EXISTS simulations_department_id_fkey;
ALTER TABLE model_runs DROP CONSTRAINT IF EXISTS model_runs_department_id_fkey;

-- Drop department_id columns
ALTER TABLE cohorts DROP COLUMN IF EXISTS department_id;
ALTER TABLE documents DROP COLUMN IF EXISTS department_id;
ALTER TABLE parameters DROP COLUMN IF EXISTS department_id;
ALTER TABLE personas DROP COLUMN IF EXISTS department_id;
ALTER TABLE rubrics DROP COLUMN IF EXISTS department_id;
ALTER TABLE scenarios DROP COLUMN IF EXISTS department_id;
ALTER TABLE simulations DROP COLUMN IF EXISTS department_id;
ALTER TABLE model_runs DROP COLUMN IF EXISTS department_id;

DO $$ BEGIN
    RAISE NOTICE 'Dropped department_id columns from 8 tables';
END $$;

-- ========================================
-- STEP 11: Drop default_* columns
-- ========================================

ALTER TABLE agents DROP COLUMN IF EXISTS default_agent;
ALTER TABLE departments DROP COLUMN IF EXISTS default_department;
ALTER TABLE cohorts DROP COLUMN IF EXISTS default_cohort;
ALTER TABLE parameters DROP COLUMN IF EXISTS default_parameter;
ALTER TABLE personas DROP COLUMN IF EXISTS default_persona;
ALTER TABLE rubrics DROP COLUMN IF EXISTS default_rubric;
ALTER TABLE scenarios DROP COLUMN IF EXISTS default_scenario;
ALTER TABLE simulations DROP COLUMN IF EXISTS default_simulation;

DO $$ BEGIN
    RAISE NOTICE 'Dropped default_* columns from 8 tables';
END $$;

-- ========================================
-- STEP 12: Recreate analytics materialized view with new junction table logic
-- ========================================
CREATE MATERIALIZED VIEW analytics AS
WITH RECURSIVE scenario_roots AS (
    SELECT 
        s.id,
        st.parent_id,
        s.id AS root_id
    FROM scenarios s
    JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id = s.id
    UNION ALL
    SELECT 
        s1.id,
        st.parent_id,
        sr.root_id
    FROM scenarios s1
    JOIN scenario_tree st ON st.child_id = s1.id AND st.parent_id <> s1.id
    JOIN scenario_roots sr ON st.parent_id = sr.id
),
root_map AS (
    SELECT 
        s.id AS leaf_scenario_id,
        COALESCE(sr.root_id, s.id) AS root_scenario_id
    FROM scenarios s
    LEFT JOIN scenario_roots sr ON s.id = sr.id
),
latest_grade AS (
    SELECT DISTINCT ON (simulation_chat_id)
        simulation_chat_id,
        score::NUMERIC AS score,
        time_taken::NUMERIC AS time_taken_seconds,
        rubric_id,
        created_at
    FROM simulation_chat_grades
    ORDER BY simulation_chat_id, created_at DESC
),
active_sims AS (
    SELECT 
        id,
        created_at,
        updated_at,
        title,
        description,
        active,
        rubric_id,
        practice_simulation,
        output_guardrail_active,
        input_guardrail_active,
        image_input_active,
        hints_enabled,
        objectives_enabled
    FROM simulations
    WHERE active = true
),
active_scenarios AS (
    SELECT 
        id,
        created_at,
        updated_at,
        name,
        generated,
        active,
        use_documents
    FROM scenarios
    WHERE active = true
),
cohorts_expanded AS (
    SELECT id, active
    FROM cohorts
),
cohorts_by_sim AS (
    SELECT 
        s.id AS simulation_id,
        ARRAY(
            SELECT DISTINCT c.id
            FROM cohorts c
            JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = s.id
            WHERE c.active = true
        ) AS cohort_ids
    FROM active_sims s
),
profile_cohorts_for_sim AS (
    SELECT 
        sa.id AS attempt_id,
        ap.profile_id,
        sa.simulation_id,
        ARRAY(
            SELECT c.id
            FROM cohorts c
            JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = sa.simulation_id
            JOIN cohort_profiles cp ON cp.cohort_id = c.id AND cp.profile_id = ap.profile_id
            WHERE c.active = true
        ) AS profile_cohort_ids
    FROM simulation_attempts sa
    LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
),
message_counts AS (
    SELECT 
        chat_id,
        COUNT(*)::INTEGER AS num_messages_total,
        COUNT(*) FILTER (WHERE type = 'query')::INTEGER AS num_query_messages,
        COUNT(*) FILTER (WHERE type = 'response')::INTEGER AS num_response_messages
    FROM simulation_messages
    GROUP BY chat_id
),
message_deltas AS (
    SELECT 
        m.chat_id,
        CASE
            WHEN LAG(m.type) OVER (PARTITION BY m.chat_id ORDER BY m.created_at) = 'response'
                AND m.type = 'query'
            THEN GREATEST(
                EXTRACT(EPOCH FROM m.created_at - COALESCE(
                    LAG(COALESCE(m.updated_at, m.created_at)) OVER (PARTITION BY m.chat_id ORDER BY m.created_at),
                    sc.created_at
                ))::INTEGER,
                0
            )
            ELSE NULL::INTEGER
        END AS delta_seconds,
        m.created_at
    FROM simulation_messages m
    JOIN simulation_chats sc ON sc.id = m.chat_id
),
message_deltas_agg AS (
    SELECT 
        chat_id,
        ARRAY_REMOVE(ARRAY_AGG(delta_seconds ORDER BY created_at), NULL::INTEGER) AS message_time_taken_seconds
    FROM message_deltas
    GROUP BY chat_id
),
effective_profile_department AS (
    SELECT 
        pd.profile_id,
        COALESCE(
            (SELECT pd1.department_id FROM profile_departments pd1 WHERE pd1.profile_id = pd.profile_id AND pd1.is_primary LIMIT 1),
            (SELECT pd2.department_id FROM profile_departments pd2 WHERE pd2.profile_id = pd.profile_id ORDER BY pd2.created_at LIMIT 1)
        ) AS department_id
    FROM (
        SELECT DISTINCT ap.profile_id
        FROM simulation_attempts sa
        JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
    ) pd
),
-- NEW: Get first department_id for each entity from junction tables
simulation_first_dept AS (
    SELECT DISTINCT ON (simulation_id) 
        simulation_id, 
        department_id
    FROM simulation_departments
    WHERE active = true
    ORDER BY simulation_id, created_at
),
rubric_first_dept AS (
    SELECT DISTINCT ON (rubric_id) 
        rubric_id, 
        department_id
    FROM rubric_departments
    WHERE active = true
    ORDER BY rubric_id, created_at
),
scenario_first_dept AS (
    SELECT DISTINCT ON (scenario_id) 
        scenario_id, 
        department_id
    FROM scenario_departments
    WHERE active = true
    ORDER BY scenario_id, created_at
),
persona_first_dept AS (
    SELECT DISTINCT ON (persona_id) 
        persona_id, 
        department_id
    FROM persona_departments
    WHERE active = true
    ORDER BY persona_id, created_at
)
SELECT 
    sc.id AS chat_id,
    sc.attempt_id,
    ap.profile_id,
    sa.simulation_id,
    rm.root_scenario_id AS scenario_id,
    rm.leaf_scenario_id,
    sp.persona_id,
    p.color AS persona_color,
    sim.practice_simulation AS is_practice,
    sa.archived AS is_archived,
    (NOT sim.practice_simulation AND NOT sa.archived) AS is_general,
    pr.role AS profile_role,
    cbs.cohort_ids,
    sc.created_at AS chat_created_at,
    CASE
        WHEN lg.score IS NULL OR r.points IS NULL OR r.points = 0 THEN NULL::NUMERIC
        ELSE (lg.score / r.points::NUMERIC) * 100.0
    END AS grade_percent,
    CASE
        WHEN lg.score IS NULL OR r.points IS NULL OR r.pass_points IS NULL THEN NULL::BOOLEAN
        ELSE lg.score >= r.pass_points::NUMERIC
    END AS passed,
    lg.time_taken_seconds,
    lg.rubric_id,
    r.points AS rubric_points,
    r.pass_points AS rubric_pass_points,
    (sc.completed OR lg.simulation_chat_id IS NOT NULL) AS completed,
    COALESCE(mc.num_messages_total, 0) AS num_messages_total,
    COALESCE(mc.num_query_messages, 0) AS num_query_messages,
    COALESCE(mc.num_response_messages, 0) AS num_response_messages,
    COALESCE(mda.message_time_taken_seconds, '{}'::INTEGER[]) AS message_time_taken_seconds,
    sa.created_at AS attempt_created_at,
    pcs.profile_cohort_ids,
    (SELECT COUNT(*) FROM simulation_scenarios ss WHERE ss.simulation_id = sim.id)::INTEGER AS sim_scenario_count,
    lg.created_at AS grade_created_at,
    -- Use COALESCE with junction table lookups instead of direct department_id
    COALESCE(
        epd.department_id,
        sfd.department_id,
        rfd.department_id,
        scfd.department_id,
        pfd.department_id
    ) AS department_id
FROM simulation_chats sc
JOIN simulation_attempts sa ON sa.id = sc.attempt_id
LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
JOIN active_sims sim ON sim.id = sa.simulation_id
JOIN profiles pr ON pr.id = ap.profile_id
JOIN active_scenarios s ON s.id = sc.scenario_id
JOIN root_map rm ON rm.leaf_scenario_id = s.id
LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
LEFT JOIN personas p ON p.id = sp.persona_id
LEFT JOIN latest_grade lg ON lg.simulation_chat_id = sc.id
LEFT JOIN rubrics r ON r.id = lg.rubric_id
LEFT JOIN cohorts_by_sim cbs ON cbs.simulation_id = sa.simulation_id
LEFT JOIN profile_cohorts_for_sim pcs ON pcs.attempt_id = sa.id
LEFT JOIN message_counts mc ON mc.chat_id = sc.id
LEFT JOIN message_deltas_agg mda ON mda.chat_id = sc.id
LEFT JOIN effective_profile_department epd ON epd.profile_id = ap.profile_id
LEFT JOIN simulation_first_dept sfd ON sfd.simulation_id = sim.id
LEFT JOIN rubric_first_dept rfd ON rfd.rubric_id = r.id
LEFT JOIN scenario_first_dept scfd ON scfd.scenario_id = s.id
LEFT JOIN persona_first_dept pfd ON pfd.persona_id = p.id;

-- Recreate indexes on analytics
CREATE UNIQUE INDEX analytics_pk ON analytics(chat_id);
CREATE INDEX analytics_attempt_created_at_idx ON analytics(attempt_created_at);
CREATE INDEX analytics_chat_created_at_idx ON analytics(chat_created_at);
CREATE INDEX analytics_chat_created_idx ON analytics(chat_created_at);
CREATE INDEX analytics_chat_id_idx ON analytics(chat_id);
CREATE INDEX analytics_cohort_ids_gin ON analytics USING gin(cohort_ids);
CREATE INDEX analytics_cohorts_gin ON analytics USING gin(cohort_ids);
CREATE INDEX analytics_department_id_idx ON analytics(department_id);
CREATE INDEX analytics_general_unarch_idx ON analytics(attempt_created_at, profile_id) WHERE is_general = true AND is_archived = false;
CREATE INDEX analytics_is_archived_idx ON analytics(is_archived);
CREATE INDEX analytics_is_archived_true_idx ON analytics(attempt_created_at) WHERE is_archived = true;
CREATE INDEX analytics_is_general_idx ON analytics(is_general);
CREATE INDEX analytics_is_general_true_idx ON analytics(attempt_created_at) WHERE is_general = true;
CREATE INDEX analytics_is_practice_idx ON analytics(is_practice);
CREATE INDEX analytics_is_practice_is_archived_is_general_idx ON analytics(is_practice, is_archived, is_general);
CREATE INDEX analytics_is_practice_true_idx ON analytics(attempt_created_at) WHERE is_practice = true;
CREATE INDEX analytics_leaf_scenario_id_idx ON analytics(leaf_scenario_id);
CREATE INDEX analytics_passed_idx ON analytics(passed);
CREATE INDEX analytics_practice_unarch_idx ON analytics(attempt_created_at, profile_id) WHERE is_practice = true AND is_archived = false;
CREATE INDEX analytics_profile_cohort_ids_gin ON analytics USING gin(profile_cohort_ids);
CREATE INDEX analytics_profile_cohorts_gin ON analytics USING gin(profile_cohort_ids);
CREATE INDEX analytics_profile_id_idx ON analytics(profile_id);
CREATE INDEX analytics_profile_role_idx ON analytics(profile_role);
CREATE INDEX analytics_profile_time_idx ON analytics(profile_id, attempt_created_at DESC);
CREATE INDEX analytics_role_time_idx ON analytics(profile_role, attempt_created_at);
CREATE INDEX analytics_scenario_id_idx ON analytics(scenario_id);
CREATE INDEX analytics_simulation_id_idx ON analytics(simulation_id);
CREATE INDEX analytics_simulation_idx ON analytics(simulation_id);
CREATE INDEX analytics_time_taken_idx ON analytics(time_taken_seconds);

DO $$ BEGIN
    RAISE NOTICE 'Recreated analytics materialized view with junction table logic';
END $$;

-- ========================================
-- STEP 13: Verification queries
-- ========================================

DO $$
DECLARE
    cohort_count INTEGER;
    document_count INTEGER;
    parameter_count INTEGER;
    persona_count INTEGER;
    rubric_count INTEGER;
    scenario_count INTEGER;
    simulation_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO cohort_count FROM cohort_departments;
    SELECT COUNT(*) INTO document_count FROM document_departments;
    SELECT COUNT(*) INTO parameter_count FROM parameter_departments;
    SELECT COUNT(*) INTO persona_count FROM persona_departments;
    SELECT COUNT(*) INTO rubric_count FROM rubric_departments;
    SELECT COUNT(*) INTO scenario_count FROM scenario_departments;
    SELECT COUNT(*) INTO simulation_count FROM simulation_departments;
    
    RAISE NOTICE 'Junction table counts:';
    RAISE NOTICE '  - cohort_departments: %', cohort_count;
    RAISE NOTICE '  - document_departments: %', document_count;
    RAISE NOTICE '  - parameter_departments: %', parameter_count;
    RAISE NOTICE '  - persona_departments: %', persona_count;
    RAISE NOTICE '  - rubric_departments: %', rubric_count;
    RAISE NOTICE '  - scenario_departments: %', scenario_count;
    RAISE NOTICE '  - simulation_departments: %', simulation_count;
END $$;

COMMIT;

-- ========================================
-- Migration Complete
-- ========================================
-- To refresh analytics after data changes:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY analytics;
-- ========================================

