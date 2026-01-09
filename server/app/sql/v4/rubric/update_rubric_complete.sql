-- Update rubric with departments, standard groups, and standards in a single transaction
-- Converted to function with input composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_update_rubric_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_rubric_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE (drop dependent types first)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop standard_group first (depends on standard)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname = 'i_update_rubric_v4_standard_group'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
    -- Then drop standard
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname = 'i_update_rubric_v4_standard'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types (reuse create types - same structure)
-- Note: If i_create_rubric_v4 types already exist, we can reuse them
-- But for clarity, we'll create update-specific ones
CREATE TYPE types.i_update_rubric_v4_standard AS (
    name text,
    description text,
    points int
);

CREATE TYPE types.i_update_rubric_v4_standard_group AS (
    name text,
    short_name text,
    description text,
    points int,
    pass_points int,
    position int,
    active boolean,
    standards types.i_update_rubric_v4_standard[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_update_rubric_v4(
    rubric_id uuid,
    name text,
    description text,
    active boolean,
    points int,
    pass_points int,
    profile_id uuid,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    standard_groups types.i_update_rubric_v4_standard_group[] DEFAULT ARRAY[]::types.i_update_rubric_v4_standard_group[],
    rubric_domain_id uuid DEFAULT NULL
)
RETURNS TABLE (
    rubric_id uuid,
    rubric_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        rubric_id AS rubric_id,
        name AS name,
        COALESCE(NULLIF(description, ''), '') AS description,
        active AS active,
        points AS points,
        pass_points AS pass_points,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(standard_groups, ARRAY[]::types.i_update_rubric_v4_standard_group[]) AS standard_groups,
        rubric_domain_id AS rubric_domain_id,
        profile_id AS profile_id
),
user_profile AS (
    SELECT
        p.role,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
object_current_departments AS (
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM rubric_departments
    WHERE rubric_id = (SELECT rubric_id FROM params) AND active = true
),
user_departments AS (
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM profile_departments
    WHERE profile_id = (SELECT profile_id FROM params) AND active = true
),
validate_update_permissions AS (
    SELECT validate_department_update_permissions(
        up.role::text,
        ocd.department_ids,
        ud.department_ids
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN object_current_departments ocd
    CROSS JOIN user_departments ud
),
actor_profile AS (
    SELECT
        x.profile_id,
        up.actor_name
    FROM params x
    CROSS JOIN user_profile up
),
get_or_create_name AS (
    -- Get or create name in names table
    INSERT INTO names (name, created_at, updated_at)
    SELECT x.name, NOW(), NOW()
    FROM params x
    WHERE x.name IS NOT NULL AND x.name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name as name_value
),
get_or_create_description AS (
    -- Get or create description in descriptions table
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT x.description, NOW(), NOW()
    FROM params x
    WHERE x.description IS NOT NULL AND x.description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
get_active_flag AS (
    -- Get the active flag ID
    SELECT id as flag_id
    FROM flags
    WHERE name = 'active'
    LIMIT 1
),
get_or_create_points AS (
    -- Get or create points in points table
    INSERT INTO points (value, created_at, updated_at)
    SELECT DISTINCT x.points, NOW(), NOW()
    FROM params x
    WHERE x.points IS NOT NULL
    ON CONFLICT (value) DO UPDATE SET updated_at = NOW()
    RETURNING id as point_id, value as point_value
),
get_or_create_pass_points AS (
    -- Get or create pass_points in points table
    INSERT INTO points (value, created_at, updated_at)
    SELECT DISTINCT x.pass_points, NOW(), NOW()
    FROM params x
    WHERE x.pass_points IS NOT NULL
    ON CONFLICT (value) DO UPDATE SET updated_at = NOW()
    RETURNING id as pass_point_id, value as pass_point_value
),
update_rubric AS (
    UPDATE rubrics r SET
        rubric_domain_id = x.rubric_domain_id,
        updated_at = NOW()
    FROM params x
    WHERE r.id = x.rubric_id
    RETURNING r.id as rubric_id
),
update_rubric_name AS (
    -- Update rubric name (delete old, insert new)
    DELETE FROM rubric_names
    WHERE rubric_id = (SELECT rubric_id FROM update_rubric LIMIT 1)
    RETURNING rubric_id
),
link_rubric_name AS (
    -- Link new name to rubric
    INSERT INTO rubric_names (rubric_id, name_id, created_at, updated_at)
    SELECT ur.rubric_id, gocn.name_id, NOW(), NOW()
    FROM update_rubric ur
    CROSS JOIN get_or_create_name gocn
    WHERE gocn.name_id IS NOT NULL
),
update_rubric_description AS (
    -- Update rubric description (delete old, insert new if provided)
    DELETE FROM rubric_descriptions
    WHERE rubric_id = (SELECT rubric_id FROM update_rubric LIMIT 1)
    RETURNING rubric_id
),
link_rubric_description AS (
    -- Link new description to rubric (if provided)
    INSERT INTO rubric_descriptions (rubric_id, description_id, created_at, updated_at)
    SELECT ur.rubric_id, gocd.description_id, NOW(), NOW()
    FROM update_rubric ur
    CROSS JOIN get_or_create_description gocd
    WHERE gocd.description_id IS NOT NULL
),
update_rubric_active_flag AS (
    -- Update active flag
    INSERT INTO rubric_flags (rubric_id, flag_id, type, value, created_at, updated_at)
    SELECT ur.rubric_id, gaf.flag_id, 'active'::type_rubric_flags, p.active, NOW(), NOW()
    FROM update_rubric ur
    CROSS JOIN get_active_flag gaf
    CROSS JOIN params p
    ON CONFLICT (rubric_id, flag_id, type) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
),
update_rubric_points AS (
    -- Update points (delete old, insert new)
    DELETE FROM rubric_points
    WHERE rubric_id = (SELECT rubric_id FROM update_rubric LIMIT 1) AND type = 'total'::type_rubric_points
    RETURNING rubric_id
),
link_rubric_points AS (
    -- Link new points to rubric
    INSERT INTO rubric_points (rubric_id, point_id, type, created_at, updated_at)
    SELECT ur.rubric_id, gocp.point_id, 'total'::type_rubric_points, NOW(), NOW()
    FROM update_rubric ur
    CROSS JOIN get_or_create_points gocp
    WHERE gocp.point_id IS NOT NULL
    ON CONFLICT (rubric_id, point_id, type) DO UPDATE SET updated_at = NOW()
),
update_rubric_pass_points AS (
    -- Update pass_points (delete old, insert new)
    DELETE FROM rubric_points
    WHERE rubric_id = (SELECT rubric_id FROM update_rubric LIMIT 1) AND type = 'pass'::type_rubric_points
    RETURNING rubric_id
),
link_rubric_pass_points AS (
    -- Link new pass_points to rubric
    INSERT INTO rubric_points (rubric_id, point_id, type, created_at, updated_at)
    SELECT ur.rubric_id, gocpp.pass_point_id, 'pass'::type_rubric_points, NOW(), NOW()
    FROM update_rubric ur
    CROSS JOIN get_or_create_pass_points gocpp
    WHERE gocpp.pass_point_id IS NOT NULL
    ON CONFLICT (rubric_id, point_id, type) DO UPDATE SET updated_at = NOW()
),
rubric_with_name AS (
    -- Get rubric_id and name for RETURNING clause
    SELECT ur.rubric_id, COALESCE(gocn.name_value, (SELECT n.name FROM rubric_names rn JOIN names n ON rn.name_id = n.id WHERE rn.rubric_id = ur.rubric_id LIMIT 1)) as rubric_name
    FROM update_rubric ur
    LEFT JOIN get_or_create_name gocn ON true
),
replace_departments AS (
    UPDATE rubric_departments 
    SET active = false, updated_at = NOW()
    WHERE rubric_id = (SELECT rubric_id FROM params) AND active = true
),
link_departments AS (
    INSERT INTO rubric_departments (rubric_id, department_id, active, created_at, updated_at)
    SELECT 
        x.rubric_id,
        dept_id,
        true,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.department_ids) as dept_id
    WHERE array_length(x.department_ids, 1) > 0
    ON CONFLICT (rubric_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
-- Deactivate existing standard_group links instead of deleting standard_groups
deactivate_rubric_standard_groups AS (
    UPDATE rubric_standard_groups 
    SET active = false, updated_at = NOW()
    WHERE rubric_id = (SELECT rubric_id FROM params) AND active = true
),
standard_groups_unnested AS (
    SELECT 
        x.rubric_id,
        (ROW_NUMBER() OVER (PARTITION BY x.rubric_id ORDER BY ordinality))::int as group_order,
        sg.name,
        COALESCE(NULLIF(sg.short_name, ''), NULL)::text as short_name,
        COALESCE(NULLIF(sg.description, ''), NULL)::text as description,
        sg.points,
        sg.pass_points,
        COALESCE(sg.position, (ROW_NUMBER() OVER (PARTITION BY x.rubric_id ORDER BY ordinality)))::int as position,
        COALESCE(sg.active, true)::boolean as active,
        sg.standards
    FROM params x
    CROSS JOIN UNNEST(x.standard_groups) WITH ORDINALITY as sg
    WHERE array_length(x.standard_groups, 1) > 0
),
-- Create placeholder calls for API-updated standard_groups (not created via tool)
placeholder_calls AS (
    INSERT INTO calls (external_call_id, tool_id, run_id, template_id, arguments_raw, completed, created_at, updated_at)
    SELECT 
        'api_update_rubric_' || sgu.rubric_id::text || '_sg_' || sgu.group_order::text,
        NULL,
        NULL,
        NULL,
        '',
        TRUE,
        NOW(),
        NOW()
    FROM standard_groups_unnested sgu
    RETURNING id, external_call_id
),
calls_with_order AS (
    SELECT 
        ptc.id as tool_call_id,
        (ROW_NUMBER() OVER (ORDER BY ptc.id))::int as rn
    FROM placeholder_calls ptc
),
new_standard_groups AS (
    INSERT INTO standard_groups (
        name,
        short_name,
        description,
        points,
        pass_points,
        active
    )
    SELECT 
        sgu.name,
        sgu.short_name,
        sgu.description,
        sgu.points,
        sgu.pass_points,
        sgu.active
    FROM standard_groups_unnested sgu
    JOIN calls_with_order tcwo ON tcwo.rn = sgu.group_order
    RETURNING id, name, short_name, description, points, pass_points, active
),
link_rubric_standard_groups AS (
    INSERT INTO rubric_standard_groups (rubric_id, standard_group_id, position, active, created_at, updated_at)
    SELECT 
        sgu.rubric_id,
        nsg.id as standard_group_id,
        sgu.position,
        sgu.active,
        NOW(),
        NOW()
    FROM new_standard_groups nsg
    JOIN standard_groups_unnested sgu ON 
        sgu.name = nsg.name 
        AND COALESCE(sgu.short_name, '') = COALESCE(nsg.short_name, '')
        AND COALESCE(sgu.description, '') = COALESCE(nsg.description, '')
        AND sgu.points = nsg.points
        AND sgu.pass_points = nsg.pass_points
    ORDER BY sgu.group_order
    ON CONFLICT (rubric_id, standard_group_id) DO UPDATE SET
        position = EXCLUDED.position,
        active = EXCLUDED.active,
        updated_at = NOW()
),
standard_groups_with_order AS (
    SELECT DISTINCT ON (nsg.id)
        nsg.id as standard_group_id,
        sgu.standards
    FROM new_standard_groups nsg
    JOIN standard_groups_unnested sgu ON 
        sgu.name = nsg.name 
        AND COALESCE(sgu.short_name, '') = COALESCE(nsg.short_name, '')
        AND COALESCE(sgu.description, '') = COALESCE(nsg.description, '')
        AND sgu.points = nsg.points
        AND sgu.pass_points = nsg.pass_points
    ORDER BY nsg.id, sgu.group_order
),
standards_unnested AS (
    SELECT 
        sgwo.standard_group_id,
        std.name,
        COALESCE(NULLIF(std.description, ''), NULL)::text as description,
        std.points
    FROM standard_groups_with_order sgwo
    CROSS JOIN UNNEST(sgwo.standards) as std
    WHERE array_length(sgwo.standards, 1) > 0
),
new_standards AS (
    INSERT INTO standards (
        standard_group_id,
        name,
        description,
        points
    )
    SELECT 
        standard_group_id,
        name,
        description,
        points
    FROM standards_unnested
    RETURNING id
)
SELECT rwn.rubric_id, rwn.rubric_name, ap.actor_name::text as actor_name
FROM rubric_with_name rwn
CROSS JOIN actor_profile ap
$$;