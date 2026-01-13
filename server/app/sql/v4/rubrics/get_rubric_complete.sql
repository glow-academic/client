-- Unified get rubric function - handles both new (rubric_id = NULL) and detail (rubric_id provided)
-- Converted to function with composite types
-- Follows RETURN_STRUCTURE_GUIDELINES.md pattern
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_rubric_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_rubric_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_rubric_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_rubric_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_rubric_v4_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int,
    position int,
    active boolean,
    standard_ids uuid[]
);

CREATE TYPE types.q_get_rubric_v4_standard AS (
    standard_id uuid,
    name text,
    description text,
    points int
);

CREATE TYPE types.q_get_rubric_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_rubric_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_rubric_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean
);

CREATE TYPE types.q_get_rubric_v4_points_resource AS (
    id uuid,
    value int,
    generated boolean
);

CREATE TYPE types.q_get_rubric_v4_points_option AS (
    id uuid,
    value int,
    generated boolean
);

CREATE TYPE types.q_get_rubric_v4_standard_group_resource AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int,
    position int,
    active boolean,
    standard_ids uuid[],
    generated boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_rubric_v4(
    profile_id uuid,
    rubric_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    rubric_exists boolean,
    can_edit boolean,
    disabled_reason text,
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_rubric_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_rubric_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_rubric_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_rubric_v4_description_resource[],
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_rubric_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_rubric_v4_department[],
    -- Single-select resources: flag (active)
    active_flag_id uuid,
    flag_resource types.q_get_rubric_v4_flag_resource,
    show_flag boolean,
    flag_agent_id uuid,
    flag_required boolean,
    flags types.q_get_rubric_v4_flag_resource[],
    -- Single-select resources: total_points
    total_points_id uuid,
    total_points_resource types.q_get_rubric_v4_points_resource,
    show_points boolean,
    points_agent_id uuid,
    points_required boolean,
    points_suggestions uuid[],
    points types.q_get_rubric_v4_points_option[],
    -- Single-select resources: pass_points
    pass_points_id uuid,
    pass_points_resource types.q_get_rubric_v4_points_resource,
    show_pass_points boolean,
    pass_points_agent_id uuid,
    pass_points_required boolean,
    pass_points_suggestions uuid[],
    pass_points types.q_get_rubric_v4_points_option[],
    -- Multi-select resources: standard_groups
    standard_group_ids uuid[],
    standard_group_resources types.q_get_rubric_v4_standard_group_resource[],
    show_standard_groups boolean,
    standard_groups_agent_id uuid,
    standard_groups_required boolean,
    standard_group_suggestions uuid[],
    standard_groups types.q_get_rubric_v4_standard_group_resource[],
    -- Additional fields for compatibility
    standard_groups_legacy types.q_get_rubric_v4_standard_group[],
    standards types.q_get_rubric_v4_standard[],
    draft_version int,
    draft_standard_groups jsonb,
    draft_standards jsonb,
    draft_grid_cells jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        rubric_id AS rubric_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check rubric existence if rubric_id provided
rubric_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT rubric_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM rubric WHERE id = (SELECT rubric_id FROM params))::boolean
        END as rubric_exists
),
-- Draft data is now stored in draft_* junction tables, not in payload
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    LEFT JOIN drafts d ON d.id = x.draft_id AND d.profile_id = x.profile_id
    WHERE x.draft_id IS NOT NULL
    LIMIT 1
),
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT 
        COALESCE(
            d.group_id,
            (SELECT id FROM groups ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN drafts d ON d.id = x.draft_id
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
    WHERE TRUE
    LIMIT 1
),
user_profile AS (
    SELECT 
        p.role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Conditional: Get rubric department data only if rubric_id provided
rubric_departments_data AS (
    SELECT 
        rd.rubric_id,
        ARRAY_AGG(rd.department_id ORDER BY rd.created_at) as department_ids
    FROM params x
    JOIN rubric_departments rd ON rd.rubric_id = x.rubric_id AND rd.active = true
    WHERE x.rubric_id IS NOT NULL
    GROUP BY rd.rubric_id
),
-- Department mapping data (for departments array - only active departments user is linked to)
department_mapping_data AS (
    SELECT 
        d.department_id,
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions d2 ON dd.description_id = d2.id WHERE dd.department_id = d.department_id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN departments d ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.department_id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.department_id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
),
primary_department_id_data AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.is_primary = TRUE
    LIMIT 1
),
-- Active departments for user (departments with active flag that user is linked to)
active_departments_data AS (
    SELECT ARRAY_AGG(DISTINCT d.department_id) as department_ids
    FROM params x
    JOIN departments d ON EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.department_id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = true)
    WHERE EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.department_id AND pd.profile_id = x.profile_id AND pd.active = true)
),
-- Resource data CTEs - query from rubric_* tables or draft_* tables if draft_id provided
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dn.names_id FROM draft_names dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT rn.name_id FROM rubric_names rn WHERE rn.rubric_id = (SELECT rubric_id FROM params) LIMIT 1)
        ) as name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_rubric_v4_name_resource 
            FROM (
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 1 as priority
                FROM draft_names dn 
                JOIN names n ON dn.names_id = n.id 
                WHERE dn.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 2 as priority
                FROM rubric_names rn 
                JOIN names n ON rn.name_id = n.id 
                WHERE rn.rubric_id = (SELECT rubric_id FROM params)
            ) n
            ORDER BY priority
            LIMIT 1
        ) as name_resource
    FROM params
),
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dd.descriptions_id FROM draft_descriptions dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT rd.description_id FROM rubric_descriptions rd WHERE rd.rubric_id = (SELECT rubric_id FROM params) LIMIT 1)
        ) as description_id,
        (
            SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_rubric_v4_description_resource 
            FROM (
                SELECT d.id, d.description, COALESCE(d.generated, false) as generated, 1 as priority
                FROM draft_descriptions dd 
                JOIN descriptions d ON dd.descriptions_id = d.id 
                WHERE dd.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT d.id, d.description, COALESCE(d.generated, false) as generated, 2 as priority
                FROM rubric_descriptions rd 
                JOIN descriptions d ON rd.description_id = d.id 
                WHERE rd.rubric_id = (SELECT rubric_id FROM params)
            ) d
            ORDER BY priority
            LIMIT 1
        ) as draft_description_resource,
        (
            SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_rubric_v4_description_resource 
            FROM rubric_descriptions rd 
            JOIN descriptions d ON rd.description_id = d.id 
            WHERE rd.rubric_id = (SELECT rubric_id FROM params)
            LIMIT 1
        ) as rubric_description_resource
    FROM params
),
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM draft_flags df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT rf.flag_id FROM rubric_flags rf JOIN flags fl ON rf.flag_id = fl.id WHERE rf.rubric_id = (SELECT rubric_id FROM params) AND fl.name = 'active' AND rf.type = 'active'::type_rubric_flags AND rf.value = TRUE LIMIT 1)
        ) as active_flag_id,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_rubric_v4_flag_resource 
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 1 as priority
                FROM draft_flags df 
                JOIN flags f ON df.flags_id = f.id 
                WHERE df.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 2 as priority
                FROM rubric_flags rf 
                JOIN flags f ON rf.flag_id = f.id 
                JOIN flags fl ON rf.flag_id = fl.id 
                WHERE rf.rubric_id = (SELECT rubric_id FROM params) AND fl.name = 'active' AND rf.type = 'active'::type_rubric_flags AND rf.value = TRUE
            ) f
            ORDER BY priority
            LIMIT 1
        ) as draft_flag_resource,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_rubric_v4_flag_resource 
            FROM rubric_flags rf 
            JOIN flags f ON rf.flag_id = f.id 
            JOIN flags fl ON rf.flag_id = fl.id 
            WHERE rf.rubric_id = (SELECT rubric_id FROM params) AND fl.name = 'active' AND rf.type = 'active'::type_rubric_flags AND rf.value = TRUE
            LIMIT 1
        ) as rubric_flag_resource
    FROM params
),
-- Points resource data (for total_points)
total_points_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dp.points_id FROM draft_points dp WHERE dp.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT rp.point_id FROM rubric_points rp WHERE rp.rubric_id = (SELECT rubric_id FROM params) AND rp.type = 'total'::type_rubric_points LIMIT 1)
        ) as total_points_id,
        (
            SELECT ROW(p.id, p.value, COALESCE(p.generated, false))::types.q_get_rubric_v4_points_resource 
            FROM (
                SELECT p.id, p.value, COALESCE(p.generated, false) as generated, 1 as priority
                FROM draft_points dp 
                JOIN points p ON dp.points_id = p.id 
                WHERE dp.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT p.id, p.value, COALESCE(p.generated, false) as generated, 2 as priority
                FROM rubric_points rp 
                JOIN points p ON rp.point_id = p.id 
                WHERE rp.rubric_id = (SELECT rubric_id FROM params) AND rp.type = 'total'::type_rubric_points
            ) p
            ORDER BY priority
            LIMIT 1
        ) as total_points_resource
    FROM params
),
-- Points resource data (for pass_points)
pass_points_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dp.points_id FROM draft_points dp WHERE dp.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT rp.point_id FROM rubric_points rp WHERE rp.rubric_id = (SELECT rubric_id FROM params) AND rp.type = 'pass'::type_rubric_points LIMIT 1)
        ) as pass_points_id,
        (
            SELECT ROW(p.id, p.value, COALESCE(p.generated, false))::types.q_get_rubric_v4_points_resource 
            FROM (
                SELECT p.id, p.value, COALESCE(p.generated, false) as generated, 1 as priority
                FROM draft_points dp 
                JOIN points p ON dp.points_id = p.id 
                WHERE dp.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT p.id, p.value, COALESCE(p.generated, false) as generated, 2 as priority
                FROM rubric_points rp 
                JOIN points p ON rp.point_id = p.id 
                WHERE rp.rubric_id = (SELECT rubric_id FROM params) AND rp.type = 'pass'::type_rubric_points
            ) p
            ORDER BY priority
            LIMIT 1
        ) as pass_points_resource
    FROM params
),
-- Standard groups resource data
standard_group_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT rubric_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(rsg.standard_group_id ORDER BY rsg.position)
                 FROM rubric_standard_groups rsg
                 WHERE rsg.rubric_id = (SELECT rubric_id FROM params) AND rsg.active = true),
                ARRAY[]::uuid[]
            )
        END as standard_group_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Name suggestions: linked to rubrics OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(rn.name_id ORDER BY rn.created_at DESC)
             FROM (
                 SELECT DISTINCT rn.name_id, MAX(rn.created_at) as created_at
                 FROM rubric_names rn
                 JOIN names n ON n.id = rn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE rn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to rubrics (rubric_names junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       rn.generated = false
                       OR
                       (
                           rn.generated = true
                           AND n.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = n.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY rn.name_id
                 ORDER BY MAX(rn.created_at) DESC
                 LIMIT 20
             ) rn),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Description suggestions: linked to rubrics OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(rd.description_id ORDER BY rd.created_at DESC)
             FROM (
                 SELECT DISTINCT rd.description_id, MAX(rd.created_at) as created_at
                 FROM rubric_descriptions rd
                 JOIN descriptions d ON d.id = rd.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE rd.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       -- Option 1: Linked to rubrics (rubric_descriptions junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       rd.generated = false
                       OR
                       (
                           rd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = d.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY rd.description_id
                 ORDER BY MAX(rd.created_at) DESC
                 LIMIT 20
             ) rd),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Department suggestions: linked to rubrics with active=true OR same group with generated=true
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(rd.department_id ORDER BY rd.created_at DESC)
             FROM (
                 SELECT DISTINCT rd.department_id, MAX(rd.created_at) as created_at
                 FROM rubric_departments rd
                 JOIN departments d ON d.id = rd.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE rd.department_id IS NOT NULL
                   AND EXISTS (
                       SELECT 1 FROM department_flags df
                       JOIN flags fl ON df.flag_id = fl.id
                       WHERE df.department_id = d.id
                         AND fl.name = 'active'
                         AND df.type = 'active'::type_department_flags
                         AND df.value = true
                   )
                   AND (
                       -- Option 1: Linked to rubrics with active=true
                       rd.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           rd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = d.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY rd.department_id
                 ORDER BY MAX(rd.created_at) DESC
                 LIMIT 20
             ) rd),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Points suggestions: linked to rubrics OR same group with generated=true
points_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(rp.point_id ORDER BY rp.created_at DESC)
             FROM (
                 SELECT DISTINCT rp.point_id, MAX(rp.created_at) as created_at
                 FROM rubric_points rp
                 JOIN points p ON p.id = rp.point_id
                 CROSS JOIN draft_group_data dgd
                 WHERE rp.point_id IS NOT NULL
                   AND (
                       -- Option 1: Linked to rubrics (rubric_points junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       rp.generated = false
                       OR
                       (
                           rp.generated = true
                           AND p.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = p.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY rp.point_id
                 ORDER BY MAX(rp.created_at) DESC
                 LIMIT 20
             ) rp),
            ARRAY[]::uuid[]
        ) as points_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Standard group suggestions: linked to rubrics with active=true OR same group with generated=true
standard_group_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(rsg.standard_group_id ORDER BY rsg.created_at DESC)
             FROM (
                 SELECT DISTINCT rsg.standard_group_id, MAX(rsg.created_at) as created_at
                 FROM rubric_standard_groups rsg
                 JOIN standard_groups sg ON sg.id = rsg.standard_group_id
                 CROSS JOIN draft_group_data dgd
                 WHERE rsg.standard_group_id IS NOT NULL
                   AND (
                       -- Option 1: Linked to rubrics with active=true
                       rsg.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           rsg.generated = true
                           AND sg.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = sg.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY rsg.standard_group_id
                 ORDER BY MAX(rsg.created_at) DESC
                 LIMIT 20
             ) rsg),
            ARRAY[]::uuid[]
        ) as standard_group_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Suggested resource objects CTEs - fetch full resource objects for suggestions
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_rubric_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_rubric_v4_name_resource[]
        ) as names
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_rubric_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_rubric_v4_description_resource[]
        ) as descriptions
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
-- Agent selection helper CTEs (shared across all agent selections)
rubric_department_for_agents AS (
    SELECT rd.department_id
    FROM params p
    JOIN rubric_departments rd ON rd.rubric_id = p.rubric_id AND rd.active = true
    WHERE p.rubric_id IS NOT NULL
    LIMIT 1
),
profile_primary_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    WHERE p.rubric_id IS NULL
    LIMIT 1
),
selected_department_for_agents AS (
    SELECT 
        COALESCE(
            (SELECT department_id FROM rubric_department_for_agents),
            (SELECT department_id FROM profile_primary_department_for_agents)
        ) as department_id
    FROM params
    LIMIT 1
),
user_departments_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.active = true
),
-- Agent selection for 'names' resource
name_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (
            SELECT 1 FROM agent_flags af 
            JOIN flags fl ON af.flag_id = fl.id 
            WHERE af.agent_id = a.id 
              AND fl.name = 'active' 
              AND af.type = 'active'::type_agent_flags 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_domains adom
            JOIN domain_artifacts da ON da.domain_id = adom.domain_id
            WHERE adom.agent_id = a.id
              AND da.artifact = 'rubric'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool t ON t.id = at.tool_id AND t.active = true
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                WHERE af_mcp.agent_id = a.id
                  AND af_mcp.type = 'mcp'::type_agent_flags
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'descriptions' resource
description_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (
            SELECT 1 FROM agent_flags af 
            JOIN flags fl ON af.flag_id = fl.id 
            WHERE af.agent_id = a.id 
              AND fl.name = 'active' 
              AND af.type = 'active'::type_agent_flags 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_domains adom
            JOIN domain_artifacts da ON da.domain_id = adom.domain_id
            WHERE adom.agent_id = a.id
              AND da.artifact = 'rubric'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool t ON t.id = at.tool_id AND t.active = true
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'descriptions'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                WHERE af_mcp.agent_id = a.id
                  AND af_mcp.type = 'mcp'::type_agent_flags
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'departments' resource
departments_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (
            SELECT 1 FROM agent_flags af 
            JOIN flags fl ON af.flag_id = fl.id 
            WHERE af.agent_id = a.id 
              AND fl.name = 'active' 
              AND af.type = 'active'::type_agent_flags 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_domains adom
            JOIN domain_artifacts da ON da.domain_id = adom.domain_id
            WHERE adom.agent_id = a.id
              AND da.artifact = 'rubric'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool t ON t.id = at.tool_id AND t.active = true
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'departments'::resources
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'flags' resource
flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (
            SELECT 1 FROM agent_flags af 
            JOIN flags fl ON af.flag_id = fl.id 
            WHERE af.agent_id = a.id 
              AND fl.name = 'active' 
              AND af.type = 'active'::type_agent_flags 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_domains adom
            JOIN domain_artifacts da ON da.domain_id = adom.domain_id
            WHERE adom.agent_id = a.id
              AND da.artifact = 'rubric'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool t ON t.id = at.tool_id AND t.active = true
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'flags'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                WHERE af_mcp.agent_id = a.id
                  AND af_mcp.type = 'mcp'::type_agent_flags
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'points' resource
points_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (
            SELECT 1 FROM agent_flags af 
            JOIN flags fl ON af.flag_id = fl.id 
            WHERE af.agent_id = a.id 
              AND fl.name = 'active' 
              AND af.type = 'active'::type_agent_flags 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_domains adom
            JOIN domain_artifacts da ON da.domain_id = adom.domain_id
            WHERE adom.agent_id = a.id
              AND da.artifact = 'rubric'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool t ON t.id = at.tool_id AND t.active = true
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'points'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                WHERE af_mcp.agent_id = a.id
                  AND af_mcp.type = 'mcp'::type_agent_flags
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'standard_groups' resource
standard_groups_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (
            SELECT 1 FROM agent_flags af 
            JOIN flags fl ON af.flag_id = fl.id 
            WHERE af.agent_id = a.id 
              AND fl.name = 'active' 
              AND af.type = 'active'::type_agent_flags 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_domains adom
            JOIN domain_artifacts da ON da.domain_id = adom.domain_id
            WHERE adom.agent_id = a.id
              AND da.artifact = 'rubric'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool t ON t.id = at.tool_id AND t.active = true
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'standard_groups'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                WHERE af_mcp.agent_id = a.id
                  AND af_mcp.type = 'mcp'::type_agent_flags
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- UI flags
ui_flags AS (
    SELECT 
        -- Single-select resource flags (based on whether options exist)
        true as show_name,  -- Always show name picker
        true as show_description,  -- Always show description picker
        true as show_flag,  -- Flag is a boolean toggle that should be shown
        true as show_points,  -- Always show points picker
        true as show_pass_points,  -- Always show pass points picker
        -- Multi-select resource flags (based on business logic)
        CASE 
            WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
            ELSE false
        END as show_departments,
        true as show_standard_groups  -- Always show standard groups picker
    FROM params x
    CROSS JOIN user_profile up
),
-- Check for missing tools on required resources
-- IMPORTANT: We check for TOOLS existence (not agents). Tools are required, agents are optional.
-- If no tools exist for a resource, we error. If tools exist but no agent exists, that's fine (manual entry).
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resources 
              AND t.active = true
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool t ON t.id = rt.tool_id
            WHERE rt.resource = 'descriptions'::resources 
              AND t.active = true
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resources 
              AND t.active = true
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool t ON t.id = rt.tool_id
            WHERE rt.resource = 'flags'::resources 
              AND t.active = true
        ) as flags_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool t ON t.id = rt.tool_id
            WHERE rt.resource = 'points'::resources 
              AND t.active = true
        ) as points_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool t ON t.id = rt.tool_id
            WHERE rt.resource = 'standard_groups'::resources 
              AND t.active = true
        ) as standard_groups_has_tools
    FROM params x
),
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            -- Check if tools exist (not agents). Error only if NO tools exist.
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.descriptions_has_tools THEN 'description' ELSE NULL END,
            CASE WHEN NOT tec.departments_has_tools AND uf.show_departments THEN 'departments' ELSE NULL END,
            CASE WHEN NOT tec.flags_has_tools THEN 'flag' ELSE NULL END,
            CASE WHEN NOT tec.points_has_tools THEN 'points' ELSE NULL END,
            CASE WHEN NOT tec.standard_groups_has_tools AND uf.show_standard_groups THEN 'standard_groups' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
),
-- Permissions data
permissions_data_with_tools AS (
    SELECT 
        rdd.department_ids,
        CASE 
            WHEN (SELECT rubric_id FROM params) IS NULL THEN
                -- New mode permissions
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN (SELECT department_id FROM primary_department_id_data) IS NOT NULL THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode permissions
                CASE 
                    WHEN rdd.department_ids IS NULL AND up.role != 'superadmin' THEN false
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            WHEN (SELECT rubric_id FROM params) IS NULL THEN
                -- New mode: always editable if can_edit is true
                NULL::text
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN rdd.department_ids IS NULL AND up.role != 'superadmin' THEN 
                        'This is a default rubric that cannot be edited. You can view the details but cannot make changes.'::text
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN 
                        NULL::text
                    ELSE 
                        'This rubric cannot be edited. You can view the details but cannot make changes.'::text
                END
        END as base_disabled_reason
    FROM params x
    LEFT JOIN rubric_departments_data rdd ON true
    CROSS JOIN user_profile up
),
permissions_final AS (
    SELECT 
        pd.department_ids,
        mtc.missing_resources,
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN false
            ELSE pd.base_can_edit
        END as can_edit,
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN
                'No tool configured for ' || 
                array_to_string(mtc.missing_resources, ', ') || 
                '. Therefore we cannot proceed ahead.'::text
            ELSE pd.base_disabled_reason
        END as disabled_reason
    FROM permissions_data_with_tools pd
    CROSS JOIN missing_tools_check mtc
),
-- Names data (suggested options only)
names_data AS (
    SELECT DISTINCT
        n.id,
        n.name,
        COALESCE(n.generated, false) as generated
    FROM names n
    CROSS JOIN params p
    CROSS JOIN name_suggestions_data nsd
    WHERE 
        -- Always include selected name_id if it exists
        n.id = (SELECT name_id FROM name_resource_data)
        OR n.id = ANY(nsd.name_suggestions)
    ORDER BY n.name
),
-- Descriptions data (suggested options only)
descriptions_data AS (
    SELECT DISTINCT
        d.id,
        d.description,
        COALESCE(d.generated, false) as generated
    FROM descriptions d
    CROSS JOIN params p
    CROSS JOIN description_suggestions_data dsd
    WHERE 
        -- Always include selected description_id if it exists
        d.id = (SELECT description_id FROM description_resource_data)
        OR (
            d.id = ANY(dsd.description_suggestions)
            AND d.description IS NOT NULL
            AND d.description != ''
        )
    ORDER BY d.description
),
-- Flags data (all available flag options)
flags_data AS (
    SELECT DISTINCT
        f.id,
        f.name,
        f.description,
        f.icon_id,
        COALESCE(f.generated, false) as generated
    FROM flags f
    CROSS JOIN params p
    WHERE 
        -- Always include selected active_flag_id if it exists
        f.id = (SELECT active_flag_id FROM flag_resource_data)
        OR (SELECT active_flag_id FROM flag_resource_data) IS NULL
    ORDER BY f.name
),
-- Points data (all available points options)
points_data AS (
    SELECT DISTINCT
        p.id,
        p.value,
        COALESCE(p.generated, false) as generated
    FROM points p
    CROSS JOIN params p_params
    CROSS JOIN points_suggestions_data psd
    WHERE p.active = true
      AND (
        -- Always include selected total_points_id if it exists
        p.id = (SELECT total_points_id FROM total_points_resource_data)
        OR p.id = (SELECT pass_points_id FROM pass_points_resource_data)
        OR p.id = ANY(psd.points_suggestions)
      )
    ORDER BY p.value
),
-- Standard groups data (for selected standard groups - only when rubric_id provided)
standard_groups_selected_data AS (
    SELECT 
        sg.id as standard_group_id,
        sg.name,
        sg.description,
        sg.points,
        sg.pass_points,
        rsg.position,
        rsg.active,
        ARRAY_AGG(s.id ORDER BY (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1)) as standard_ids,
        COALESCE(rsg.generated, false) as generated
    FROM params x
    JOIN rubric_standard_groups rsg ON rsg.rubric_id = x.rubric_id AND rsg.active = true
    JOIN standard_groups sg ON sg.id = rsg.standard_group_id
    LEFT JOIN standards s ON s.standard_group_id = sg.id
    WHERE x.rubric_id IS NOT NULL
    GROUP BY sg.id, sg.name, sg.description, sg.points, sg.pass_points, rsg.position, rsg.active, rsg.generated
),
-- Standard groups data (all available standard groups for options array)
standard_groups_all_data AS (
    SELECT 
        sg.id as standard_group_id,
        sg.name,
        sg.description,
        sg.points,
        sg.pass_points,
        COALESCE(rsg.position, 0) as position,
        COALESCE(rsg.active, true) as active,
        ARRAY_AGG(s.id ORDER BY (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1)) FILTER (WHERE s.id IS NOT NULL) as standard_ids,
        COALESCE(sg.generated, false) as generated
    FROM params x
    CROSS JOIN standard_groups sg
    LEFT JOIN rubric_standard_groups rsg ON rsg.rubric_id = x.rubric_id AND rsg.standard_group_id = sg.id AND rsg.active = true
    LEFT JOIN standards s ON s.standard_group_id = sg.id
    WHERE sg.active = true
    GROUP BY sg.id, sg.name, sg.description, sg.points, sg.pass_points, rsg.position, rsg.active, sg.generated
),
standard_groups_data AS (
    SELECT 
        COALESCE(sg_selected.standard_group_id, sg_all.standard_group_id) as standard_group_id,
        COALESCE(sg_selected.name, sg_all.name) as name,
        COALESCE(sg_selected.description, sg_all.description) as description,
        COALESCE(sg_selected.points, sg_all.points) as points,
        COALESCE(sg_selected.pass_points, sg_all.pass_points) as pass_points,
        COALESCE(sg_selected.position, sg_all.position) as position,
        COALESCE(sg_selected.active, sg_all.active) as active,
        COALESCE(sg_selected.standard_ids, sg_all.standard_ids, ARRAY[]::uuid[]) as standard_ids,
        COALESCE(sg_selected.generated, sg_all.generated) as generated
    FROM params x
    FULL OUTER JOIN standard_groups_selected_data sg_selected ON true
    FULL OUTER JOIN standard_groups_all_data sg_all ON true
    WHERE (x.rubric_id IS NOT NULL AND sg_selected.standard_group_id IS NOT NULL)
       OR (x.rubric_id IS NULL AND sg_all.standard_group_id IS NOT NULL)
),
standard_groups_aggregated AS (
    SELECT 
        ARRAY_AGG(sg.standard_group_id ORDER BY sg.position, sg.name) FILTER (WHERE sg.standard_group_id IS NOT NULL) as standard_group_ids,
        COALESCE(
            ARRAY_AGG(
                (sg.standard_group_id, sg.name, COALESCE(sg.description, ''), sg.points, sg.pass_points, sg.position, sg.active, COALESCE(sg.standard_ids, ARRAY[]::uuid[]), sg.generated)::types.q_get_rubric_v4_standard_group_resource
                ORDER BY sg.position, sg.name
            ) FILTER (WHERE sg.standard_group_id IS NOT NULL),
            '{}'::types.q_get_rubric_v4_standard_group_resource[]
        ) as standard_groups
    FROM standard_groups_data sg
),
-- Standards data
standards_distinct AS (
    SELECT DISTINCT ON (s.id)
        s.id, 
        (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as name, 
        COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description, 
        s.points
    FROM standards s
    WHERE s.standard_group_id IN (
        SELECT DISTINCT standard_group_id 
        FROM standard_groups_data 
        WHERE standard_group_id IS NOT NULL
    )
    ORDER BY s.id, (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1)
),
standards_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sd.id, sd.name, sd.description, sd.points)::types.q_get_rubric_v4_standard
                ORDER BY sd.name
            ),
            '{}'::types.q_get_rubric_v4_standard[]
        ) as standards
    FROM standards_distinct sd
),
-- Draft payload extraction (for compatibility with existing frontend)
draft_standard_groups_extracted AS (
    SELECT 
        COALESCE(
            (SELECT payload->'standardGroups' FROM draft_payload_data),
            (SELECT payload->'standard_groups' FROM draft_payload_data),
            '[]'::jsonb
        ) as draft_standard_groups,
        COALESCE(
            (SELECT payload->'standards' FROM draft_payload_data),
            (SELECT payload->'standards' FROM draft_payload_data),
            '[]'::jsonb
        ) as draft_standards,
        COALESCE(
            (SELECT payload->'gridCells' FROM draft_payload_data),
            (SELECT payload->'grid_cells' FROM draft_payload_data),
            '{}'::jsonb
        ) as draft_grid_cells
    FROM params
    LIMIT 1
)
SELECT
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT rubric_exists FROM rubric_exists_check) as rubric_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    -- Group ID for linking resources
    dgd.group_id,
    -- Single-select resources: name
    (SELECT name_id FROM name_resource_data) as name_id,
    nrd.name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    (SELECT agent_id FROM name_agent_data) as name_agent_id,
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (nd.id, nd.name, nd.generated)::types.q_get_rubric_v4_name_resource
            ORDER BY nd.name
        ) FROM (SELECT DISTINCT id, name, generated FROM names_data) nd),
        COALESCE((SELECT names FROM names_suggestions_objects), ARRAY[]::types.q_get_rubric_v4_name_resource[])
    ) as names,
    -- Single-select resources: description
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT desc_res FROM (SELECT drd.draft_description_resource as desc_res UNION ALL SELECT drd.rubric_description_resource LIMIT 1) sub WHERE desc_res IS NOT NULL LIMIT 1) as description_resource,
    CASE 
        WHEN NOT tec.descriptions_has_tools THEN false
        ELSE uf.show_description
    END as show_description,
    (SELECT agent_id FROM description_agent_data) as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.id, dd.description, dd.generated)::types.q_get_rubric_v4_description_resource
            ORDER BY dd.description
        ) FROM (SELECT DISTINCT id, description, generated FROM descriptions_data) dd),
        COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), ARRAY[]::types.q_get_rubric_v4_description_resource[])
    ) as descriptions,
    -- Multi-select resources: departments
    COALESCE(
        CASE 
            WHEN (SELECT rubric_id FROM params) IS NULL THEN
                -- For new rubrics, leave department_ids empty (no auto-selection)
                ARRAY[]::uuid[]
            ELSE rdd.department_ids
        END,
        ARRAY[]::uuid[]
    ) as department_ids,
    -- Department resources (selected departments filtered by department_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_rubric_v4_department
            ORDER BY dmd.name
        )
        FROM department_mapping_data dmd
        WHERE dmd.department_id = ANY(
            COALESCE(
                CASE 
                    WHEN (SELECT rubric_id FROM params) IS NULL THEN
                        ARRAY[]::uuid[]
                    ELSE rdd.department_ids
                END,
                ARRAY[]::uuid[]
            )
        )),
        '{}'::types.q_get_rubric_v4_department[]
    ) as department_resources,
    CASE 
        WHEN NOT tec.departments_has_tools AND uf.show_departments THEN false
        WHEN EXISTS (SELECT 1 FROM department_mapping_data LIMIT 1) THEN true
        ELSE uf.show_departments
    END as show_departments,
    (SELECT agent_id FROM departments_agent_data) as departments_agent_id,
    CASE 
        WHEN uf.show_departments THEN true
        ELSE false
    END as departments_required,
    COALESCE((SELECT department_suggestions FROM department_suggestions_data), ARRAY[]::uuid[]) as department_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_rubric_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_rubric_v4_department[]
    ) as departments,
    -- Single-select resources: flag
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    (SELECT flag_res FROM (SELECT frd.draft_flag_resource as flag_res UNION ALL SELECT frd.rubric_flag_resource LIMIT 1) sub WHERE flag_res IS NOT NULL LIMIT 1) as flag_resource,
    uf.show_flag,
    (SELECT agent_id FROM flag_agent_data) as flag_agent_id,
    false as flag_required,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.id, fd.name, fd.description, fd.icon_id, fd.generated)::types.q_get_rubric_v4_flag_resource
            ORDER BY fd.name
        ) FROM (SELECT DISTINCT id, name, description, icon_id, generated FROM flags_data) fd),
        '{}'::types.q_get_rubric_v4_flag_resource[]
    ) as flags,
    -- Single-select resources: total_points
    (SELECT total_points_id FROM total_points_resource_data) as total_points_id,
    tprd.total_points_resource,
    CASE 
        WHEN NOT tec.points_has_tools THEN false
        ELSE uf.show_points
    END as show_points,
    (SELECT agent_id FROM points_agent_data) as points_agent_id,
    true as points_required,
    COALESCE((SELECT points_suggestions FROM points_suggestions_data), ARRAY[]::uuid[]) as points_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.id, pd.value, pd.generated)::types.q_get_rubric_v4_points_option
            ORDER BY pd.value
        ) FROM (SELECT DISTINCT id, value, generated FROM points_data) pd),
        '{}'::types.q_get_rubric_v4_points_option[]
    ) as points,
    -- Single-select resources: pass_points
    (SELECT pass_points_id FROM pass_points_resource_data) as pass_points_id,
    pprd.pass_points_resource,
    CASE 
        WHEN NOT tec.points_has_tools THEN false
        ELSE uf.show_pass_points
    END as show_pass_points,
    (SELECT agent_id FROM points_agent_data) as pass_points_agent_id,
    true as pass_points_required,
    COALESCE((SELECT points_suggestions FROM points_suggestions_data), ARRAY[]::uuid[]) as pass_points_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.id, pd.value, pd.generated)::types.q_get_rubric_v4_points_option
            ORDER BY pd.value
        ) FROM (SELECT DISTINCT id, value, generated FROM points_data) pd),
        '{}'::types.q_get_rubric_v4_points_option[]
    ) as pass_points,
    -- Multi-select resources: standard_groups
    COALESCE((SELECT standard_group_ids FROM standard_group_ids_data), ARRAY[]::uuid[]) as standard_group_ids,
    -- Standard group resources (selected standard groups filtered by standard_group_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sg.standard_group_id, sg.name, COALESCE(sg.description, ''), sg.points, sg.pass_points, sg.position, sg.active, COALESCE(sg.standard_ids, ARRAY[]::uuid[]), sg.generated)::types.q_get_rubric_v4_standard_group_resource
            ORDER BY sg.position, sg.name
        )
        FROM standard_groups_selected_data sg
        WHERE sg.standard_group_id = ANY(COALESCE((SELECT standard_group_ids FROM standard_group_ids_data), ARRAY[]::uuid[]))),
        '{}'::types.q_get_rubric_v4_standard_group_resource[]
    ) as standard_group_resources,
    CASE 
        WHEN NOT tec.standard_groups_has_tools AND uf.show_standard_groups THEN false
        ELSE uf.show_standard_groups
    END as show_standard_groups,
    (SELECT agent_id FROM standard_groups_agent_data) as standard_groups_agent_id,
    CASE 
        WHEN uf.show_standard_groups THEN true
        ELSE false
    END as standard_groups_required,
    COALESCE((SELECT standard_group_suggestions FROM standard_group_suggestions_data), ARRAY[]::uuid[]) as standard_group_suggestions,
    -- Standard groups array (all available standard groups)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sg.standard_group_id, sg.name, COALESCE(sg.description, ''), sg.points, sg.pass_points, sg.position, sg.active, COALESCE(sg.standard_ids, ARRAY[]::uuid[]), sg.generated)::types.q_get_rubric_v4_standard_group_resource
            ORDER BY sg.position, sg.name
        ) FROM standard_groups_all_data sg),
        '{}'::types.q_get_rubric_v4_standard_group_resource[]
    ) as standard_groups,
    -- Legacy standard_groups format (for compatibility - only selected ones)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sg.standard_group_id, sg.name, COALESCE(sg.description, ''), sg.points, sg.pass_points, sg.position, sg.active, COALESCE(sg.standard_ids, ARRAY[]::uuid[]))::types.q_get_rubric_v4_standard_group
            ORDER BY sg.position, sg.name
        ) FROM standard_groups_selected_data sg),
        '{}'::types.q_get_rubric_v4_standard_group[]
    ) as standard_groups_legacy,
    -- Standards array
    COALESCE((SELECT standards FROM standards_aggregated), '{}'::types.q_get_rubric_v4_standard[]) as standards,
    -- Draft version
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version,
    -- Draft payload fields (for compatibility)
    COALESCE((SELECT draft_standard_groups FROM draft_standard_groups_extracted), '[]'::jsonb) as draft_standard_groups,
    COALESCE((SELECT draft_standards FROM draft_standard_groups_extracted), '[]'::jsonb) as draft_standards,
    COALESCE((SELECT draft_grid_cells FROM draft_standard_groups_extracted), '{}'::jsonb) as draft_grid_cells
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
LEFT JOIN rubric_departments_data rdd ON true
CROSS JOIN active_departments_data add
CROSS JOIN draft_group_data dgd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN flag_resource_data frd
CROSS JOIN total_points_resource_data tprd
CROSS JOIN pass_points_resource_data pprd
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN names_suggestions_objects nso
CROSS JOIN descriptions_suggestions_objects dso
CROSS JOIN standard_group_ids_data sgid
CROSS JOIN standard_groups_aggregated sga
CROSS JOIN standards_aggregated sta
CROSS JOIN department_suggestions_data dsd_dept
CROSS JOIN points_suggestions_data psd
CROSS JOIN standard_group_suggestions_data sgsd
CROSS JOIN draft_standard_groups_extracted dsge
$$;
