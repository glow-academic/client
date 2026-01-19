-- Update standard descriptions for rubric grid cells
-- Converted to PostgreSQL function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- Returns descriptions as array of composite types (not JSONB)
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_update_standard_descriptions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_update_standard_descriptions_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_update_standard_descriptions_v4_%'
           OR typname LIKE 'q_update_standard_descriptions_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_update_standard_descriptions_v4_description AS (
    standard_group_id uuid,
    standard_id uuid,
    description text
);

-- Return type for descriptions array
CREATE TYPE types.q_update_standard_descriptions_v4_description AS (
    standard_group_id uuid,
    standard_id uuid,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_update_standard_descriptions_v4(
    rubric_id uuid,
    descriptions types.i_update_standard_descriptions_v4_description[],
    profile_id uuid,
    group_id uuid DEFAULT NULL
)
RETURNS TABLE (
    updated_count int,
    group_id uuid,
    trace_id text,
    descriptions types.q_update_standard_descriptions_v4_description[]
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT rubric_id AS rubric_id, descriptions AS descriptions, profile_id AS profile_id, group_id AS group_id
),
create_group_if_needed AS (
    -- Create new group if group_id is NULL
    INSERT INTO groups (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM params p
    WHERE p.group_id IS NULL
    RETURNING id as group_id, trace_id
),
group_data AS (
    -- Use existing group if provided, otherwise use newly created group
    SELECT 
        COALESCE(
            (SELECT g.id FROM groups g CROSS JOIN params p WHERE g.id = p.group_id),
            (SELECT cg.group_id FROM create_group_if_needed cg)
        ) as group_id,
        COALESCE(
            (SELECT g.trace_id FROM groups g CROSS JOIN params p WHERE g.id = p.group_id),
            (SELECT cg.trace_id FROM create_group_if_needed cg)
        ) as trace_id
),
descriptions_data AS (
    -- Unnest descriptions array (composite type array)
    SELECT 
        (unnest(descriptions)).standard_group_id,
        (unnest(descriptions)).standard_id,
        (unnest(descriptions)).description
    FROM (SELECT descriptions FROM params) as d
),
updated_standards AS (
    UPDATE standards_resource s
    SET description = dd.description
    FROM descriptions_data dd
    WHERE s.id = dd.standard_id
      AND s.standard_group_id = dd.standard_group_id
      AND EXISTS (
          SELECT 1 FROM rubric_standard_groups rsg
          WHERE rsg.standard_group_id = s.standard_group_id
          AND rsg.rubric_id = (SELECT rubric_id FROM params)
          AND rsg.active = true
      )
    RETURNING s.standard_group_id, s.id as standard_id, (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1)
)
SELECT 
    COUNT(*)::int as updated_count,
    (SELECT group_id FROM group_data LIMIT 1) as group_id,
    (SELECT trace_id FROM group_data LIMIT 1) as trace_id,
    -- Return descriptions as array of composite types (not JSONB)
    COALESCE(
        ARRAY_AGG(
            (us.standard_group_id, us.standard_id, us.description)::types.q_update_standard_descriptions_v4_description
            ORDER BY us.standard_group_id, us.standard_id
        ),
        ARRAY[]::types.q_update_standard_descriptions_v4_description[]
    ) as descriptions
FROM updated_standards us
$$;