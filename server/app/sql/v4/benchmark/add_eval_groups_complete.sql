-- Add eval groups with rubric_grade_agents per group
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_add_eval_groups_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_add_eval_groups_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop in reverse dependency order: parent types first, then child types
DO $$
DECLARE
    r RECORD;
BEGIN
    -- First drop parent types (those that depend on other types)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_add_eval_groups_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
          AND typname = 'i_add_eval_groups_v4_group'  -- Parent type that depends on rubric_grade_agent
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
    -- Then drop child types
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_add_eval_groups_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
          AND typname != 'i_add_eval_groups_v4_group'  -- Child types
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Create composite types
CREATE TYPE types.i_add_eval_groups_v4_rubric_grade_agent AS (
    rubric_id uuid,
    grade_agent_id uuid
);

CREATE TYPE types.i_add_eval_groups_v4_group AS (
    group_id uuid,
    rubric_grade_agents types.i_add_eval_groups_v4_rubric_grade_agent[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_add_eval_groups_v4(
    eval_id uuid,
    groups types.i_add_eval_groups_v4_group[],
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
        COALESCE(groups, ARRAY[]::types.i_add_eval_groups_v4_group[]) AS groups,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = profile_artifact.id 
         LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = profile_artifact.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = profile_artifact.id AND pn2.type = 'last' LIMIT 1), 'System') as actor_name
    FROM params x
    JOIN profile_artifact ON profile_artifact.id = x.profile_id
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
-- Link rubrics directly to groups (no rubric_grade_agents needed)
link_group_rubrics AS (
    INSERT INTO eval_groups_rubrics (eval_id, group_id, rubric_id, created_at, updated_at, generated, mcp, active)
    SELECT DISTINCT
        p.eval_id,
        (g).group_id,
        (rga).rubric_id,
        NOW(),
        NOW(),
        false,
        false,
        true
    FROM params p
    CROSS JOIN UNNEST(p.groups) AS g
    CROSS JOIN UNNEST((g).rubric_grade_agents) AS rga
    WHERE (g).group_id IS NOT NULL
      AND (rga).rubric_id IS NOT NULL
    ON CONFLICT (eval_id, group_id, rubric_id) DO UPDATE SET
        updated_at = NOW()
)
SELECT 
    p.eval_id,
    up.actor_name::text as actor_name
FROM params p
CROSS JOIN user_profile up
$$;