-- Add eval groups with rubric_grade_agents per group
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_add_eval_groups_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_add_eval_groups_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_add_eval_groups_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Create composite types
CREATE TYPE types.i_add_eval_groups_v3_rubric_grade_agent AS (
    rubric_id uuid,
    grade_text_agent_id uuid
);

CREATE TYPE types.i_add_eval_groups_v3_group AS (
    group_id uuid,
    rubric_grade_agents types.i_add_eval_groups_v3_rubric_grade_agent[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_add_eval_groups_v3(
    eval_id uuid,
    groups types.i_add_eval_groups_v3_group[],
    profile_id uuid
)
RETURNS TABLE (
    eval_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        eval_id AS eval_id,
        COALESCE(groups, ARRAY[]::types.i_add_eval_groups_v3_group[]) AS groups,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        role,
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
-- Create eval_groups entries
link_groups AS (
    INSERT INTO eval_groups (eval_id, group_id, created_at, updated_at)
    SELECT 
        p.eval_id,
        (g).group_id,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN UNNEST(p.groups) AS g
    WHERE (g).group_id IS NOT NULL
    ON CONFLICT (eval_id, group_id) DO UPDATE SET
        updated_at = NOW()
),
-- Create/find rubric_grade_agents entries
create_rubric_grade_agents AS (
    INSERT INTO rubric_grade_agents (rubric_id, grade_text_agent_id, created_at, updated_at)
    SELECT DISTINCT
        (rga).rubric_id,
        (rga).grade_text_agent_id,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.groups) AS g
    CROSS JOIN UNNEST((g).rubric_grade_agents) AS rga
    WHERE (rga).rubric_id IS NOT NULL 
      AND (rga).grade_text_agent_id IS NOT NULL
    ON CONFLICT (rubric_id, grade_text_agent_id) DO UPDATE SET
        updated_at = NOW()
    RETURNING id as rubric_grade_agent_id, rubric_id, grade_text_agent_id
),
-- Link rubric_grade_agents to groups
link_group_rubric_grade_agents AS (
    INSERT INTO eval_groups_rubric_grade_agents (eval_id, group_id, rubric_grade_agent_id, created_at, updated_at)
    SELECT DISTINCT
        p.eval_id,
        (g).group_id,
        crga.rubric_grade_agent_id,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN UNNEST(p.groups) AS g
    CROSS JOIN UNNEST((g).rubric_grade_agents) AS rga
    JOIN create_rubric_grade_agents crga ON crga.rubric_id = (rga).rubric_id 
        AND crga.grade_text_agent_id = (rga).grade_text_agent_id
    WHERE (g).group_id IS NOT NULL
      AND (rga).rubric_id IS NOT NULL 
      AND (rga).grade_text_agent_id IS NOT NULL
    ON CONFLICT (eval_id, group_id, rubric_grade_agent_id) DO NOTHING
)
SELECT 
    p.eval_id,
    up.actor_name::text as actor_name
FROM params p
CROSS JOIN user_profile up
$$;

COMMIT;

