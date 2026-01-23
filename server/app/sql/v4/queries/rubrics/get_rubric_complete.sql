-- Unified get rubric function - handles both new (rubric_id = NULL) and detail (rubric_id provided)
-- Converted to function with composite types
-- Follows ARTIFACT.md pattern
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

CREATE TYPE types.q_get_rubric_v4_standard_resource AS (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points int,
    generated boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_rubric_v4(
    profile_id uuid,
    rubric_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    description_search text DEFAULT NULL,
    standard_group_search text DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    rubric_exists boolean,
    can_edit boolean,
    disabled_reason text,
    draft_version int,
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
    -- Multi-select resources: standards
    standard_ids uuid[],
    standard_resources types.q_get_rubric_v4_standard_resource[],
    show_standards boolean,
    standards_agent_id uuid,
    standards_required boolean,
    standard_suggestions uuid[],
    standards types.q_get_rubric_v4_standard_resource[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        rubric_id AS rubric_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        COALESCE(NULLIF(description_search, ''), NULL) AS description_search,
        COALESCE(NULLIF(standard_group_search, ''), NULL) AS standard_group_search,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check rubric existence if rubric_id provided
rubric_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT rubric_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM rubric_artifact WHERE id = (SELECT rubric_id FROM params))::boolean
        END as rubric_exists
),
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT 
        COALESCE(
            d.group_id,
            (SELECT id FROM groups_entry ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN drafts_entry d ON d.id = x.draft_id
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
    WHERE TRUE
    LIMIT 1
),
draft_version_data AS (
    -- Keep draft_version for client-side expected_version sync to avoid unintended draft forks.
    SELECT d.version as draft_version
    FROM params x
    LEFT JOIN drafts_entry d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
),
user_profile AS (
    SELECT role, actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Conditional: Get rubric department data only if rubric_id provided
rubric_departments_data AS (
    SELECT 
        rd.rubric_id,
        ARRAY_AGG(rd.department_id ORDER BY rd.created_at) as department_ids
    FROM params x
    JOIN rubric_departments_junction rd ON rd.rubric_id = x.rubric_id AND rd.active = true
    WHERE x.rubric_id IS NOT NULL
    GROUP BY rd.rubric_id
),
-- Department mapping data (for departments array - only active departments user is linked to)
department_mapping_data AS (
    SELECT
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.department_id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN departments_resource d ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments_junction pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
),
-- Departments aggregation CTE
departments_agg AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_rubric_v4_department
                ORDER BY dmd.name
            ),
            '{}'::types.q_get_rubric_v4_department[]
        ) AS departments
    FROM department_mapping_data dmd
    CROSS JOIN params
    LIMIT 1
),
primary_department_id_data AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.is_primary = TRUE
    LIMIT 1
),
-- Active departments for user (departments with active flag that user is linked to)
active_departments_data AS (
    SELECT ARRAY_AGG(DISTINCT d.id) as department_ids
    FROM params x
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
    WHERE EXISTS (SELECT 1 FROM profile_departments_junction pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
),
-- Resource data CTEs - query from rubric_* tables or draft_* tables if draft_id provided
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dn.names_id FROM names_draft dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT rn.name_id FROM rubric_names_junction rn WHERE rn.rubric_id = (SELECT rubric_id FROM params) LIMIT 1)
        ) as name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_rubric_v4_name_resource 
            FROM (
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 1 as priority
                FROM names_draft dn 
                JOIN names_resource n ON dn.names_id = n.id 
                WHERE dn.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 2 as priority
                FROM rubric_names_junction rn 
                JOIN names_resource n ON rn.name_id = n.id 
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
            (SELECT dd.descriptions_id FROM descriptions_draft dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT rd.description_id FROM rubric_descriptions_junction rd WHERE rd.rubric_id = (SELECT rubric_id FROM params) LIMIT 1)
        ) as description_id,
        (
            SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_rubric_v4_description_resource 
            FROM (
                SELECT d.id, d.description, COALESCE(d.generated, false) as generated, 1 as priority
                FROM descriptions_draft dd 
                JOIN descriptions_resource d ON dd.descriptions_id = d.id 
                WHERE dd.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT d.id, d.description, COALESCE(d.generated, false) as generated, 2 as priority
                FROM rubric_descriptions_junction rd 
                JOIN descriptions_resource d ON rd.description_id = d.id 
                WHERE rd.rubric_id = (SELECT rubric_id FROM params)
            ) d
            ORDER BY priority
            LIMIT 1
        ) as draft_description_resource,
        (
            SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_rubric_v4_description_resource 
            FROM rubric_descriptions_junction rd 
            JOIN descriptions_resource d ON rd.description_id = d.id 
            WHERE rd.rubric_id = (SELECT rubric_id FROM params)
            LIMIT 1
        ) as rubric_description_resource
    FROM params
),
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM flags_draft df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT rf.flag_id FROM rubric_flags_junction rf JOIN flags_resource f ON rf.flag_id = f.id WHERE rf.rubric_id = (SELECT rubric_id FROM params) AND f.name = 'rubric_active' AND rf.value = TRUE LIMIT 1)
        ) as active_flag_id,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_rubric_v4_flag_resource 
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 1 as priority
                FROM flags_draft df 
                JOIN flags_resource f ON df.flags_id = f.id 
                WHERE df.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 2 as priority
                FROM rubric_flags_junction rf 
                JOIN flags_resource f ON rf.flag_id = f.id 
                JOIN flags_resource fl ON rf.flag_id = fl.id 
                WHERE rf.rubric_id = (SELECT rubric_id FROM params) AND fl.name = 'active' AND f.name = 'rubric_active' AND rf.value = TRUE
            ) f
            ORDER BY priority
            LIMIT 1
        ) as draft_flag_resource,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_rubric_v4_flag_resource 
            FROM rubric_flags_junction rf 
            JOIN flags_resource f ON rf.flag_id = f.id 
            JOIN flags_resource fl ON rf.flag_id = fl.id 
            WHERE rf.rubric_id = (SELECT rubric_id FROM params) AND fl.name = 'active' AND f.name = 'rubric_active' AND rf.value = TRUE
            LIMIT 1
        ) as rubric_flag_resource
    FROM params
),
-- Points resource data (for total_points)
total_points_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dp.points_id FROM points_draft dp WHERE dp.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT rp.point_id FROM rubric_points_junction rp WHERE rp.rubric_id = (SELECT rubric_id FROM params) AND rp.type = 'total'::point_type LIMIT 1)
        ) as total_points_id,
        (
            SELECT ROW(p.id, p.value, COALESCE(p.generated, false))::types.q_get_rubric_v4_points_resource 
            FROM (
                SELECT p.id, p.value, COALESCE(p.generated, false) as generated, 1 as priority
                FROM points_draft dp 
                JOIN points_resource p ON dp.points_id = p.id 
                WHERE dp.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT p.id, p.value, COALESCE(p.generated, false) as generated, 2 as priority
                FROM rubric_points_junction rp 
                JOIN points_resource p ON rp.point_id = p.id 
                WHERE rp.rubric_id = (SELECT rubric_id FROM params) AND rp.type = 'total'::point_type
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
            (SELECT dp.points_id FROM points_draft dp WHERE dp.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT rp.point_id FROM rubric_points_junction rp WHERE rp.rubric_id = (SELECT rubric_id FROM params) AND rp.type = 'pass'::point_type LIMIT 1)
        ) as pass_points_id,
        (
            SELECT ROW(p.id, p.value, COALESCE(p.generated, false))::types.q_get_rubric_v4_points_resource 
            FROM (
                SELECT p.id, p.value, COALESCE(p.generated, false) as generated, 1 as priority
                FROM points_draft dp 
                JOIN points_resource p ON dp.points_id = p.id 
                WHERE dp.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT p.id, p.value, COALESCE(p.generated, false) as generated, 2 as priority
                FROM rubric_points_junction rp 
                JOIN points_resource p ON rp.point_id = p.id 
                WHERE rp.rubric_id = (SELECT rubric_id FROM params) AND rp.type = 'pass'::point_type
            ) p
            ORDER BY priority
            LIMIT 1
        ) as pass_points_resource
    FROM params
),
-- Standard groups_entry resource data (draft-first)
standard_group_links_data AS (
    SELECT 
        dsg.standard_groups_id as standard_group_id,
        ROW_NUMBER() OVER (ORDER BY dsg.created_at) as position,
        true as active,
        COALESCE(dsg.generated, false) as generated
    FROM params x
    JOIN standard_groups_draft dsg ON dsg.draft_id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    UNION ALL
    SELECT 
        rsg.standard_group_id,
        rsg.position,
        rsg.active,
        COALESCE(rsg.generated, false) as generated
    FROM params x
    JOIN rubric_standard_groups_junction rsg ON rsg.rubric_id = x.rubric_id AND rsg.active = true
    WHERE x.rubric_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM standard_groups_draft dsg
          WHERE dsg.draft_id = x.draft_id
      )
),
standard_group_ids_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(sgld.standard_group_id ORDER BY sgld.position),
            ARRAY[]::uuid[]
        ) as standard_group_ids
    FROM standard_group_links_data sgld
    CROSS JOIN params
    -- Always return at least one row
    LIMIT 1
),
-- Standards resource data (draft-first)
standard_ids_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(s.id ORDER BY s.created_at)
             FROM standard_groups_draft dsg
             JOIN standards_resource s ON s.standard_group_id = dsg.standard_groups_id
             WHERE dsg.draft_id = (SELECT draft_id FROM params)),
            (SELECT ARRAY_AGG(rs.standard_id ORDER BY rs.created_at)
             FROM rubric_standards_junction rs
             WHERE rs.rubric_id = (SELECT rubric_id FROM params) AND rs.active = true),
            ARRAY[]::uuid[]
        ) as standard_ids
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
                 FROM rubric_names_junction rn
                 JOIN names_resource n ON n.id = rn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE rn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to rubrics (rubric_names_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       rn.generated = false
                       OR
                       (
                           rn.generated = true
                           AND n.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN messages_entry m ON m.id = c.message_id
                               JOIN runs_entry r ON r.id = m.run_id
                               WHERE c.id = n.call_id
                                 AND r.group_id = dgd.group_id
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
                 FROM rubric_descriptions_junction rd
                 JOIN descriptions_resource d ON d.id = rd.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE rd.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       (SELECT description_search FROM params LIMIT 1) IS NULL
                       OR LOWER(d.description) LIKE '%' || LOWER((SELECT description_search FROM params LIMIT 1)) || '%'
                   )
                   AND (
                       -- Option 1: Linked to rubrics (rubric_descriptions_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       rd.generated = false
                       OR
                       (
                           rd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN messages_entry m ON m.id = c.message_id
                               JOIN runs_entry r ON r.id = m.run_id
                               WHERE c.id = d.call_id
                                 AND r.group_id = dgd.group_id
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
                 FROM rubric_departments_junction rd
                 JOIN departments_resource d ON d.id = rd.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE rd.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
                   AND (
                       -- Option 1: Linked to rubrics with active=true
                       rd.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           rd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN messages_entry m ON m.id = c.message_id
                               JOIN runs_entry r ON r.id = m.run_id
                               WHERE c.id = d.call_id
                                 AND r.group_id = dgd.group_id
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
                 FROM rubric_points_junction rp
                 JOIN points_resource p ON p.id = rp.point_id
                 CROSS JOIN draft_group_data dgd
                 WHERE rp.point_id IS NOT NULL
                   AND (
                       -- Option 1: Linked to rubrics (rubric_points_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       rp.generated = false
                       OR
                       (
                           rp.generated = true
                           AND p.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN messages_entry m ON m.id = c.message_id
                               JOIN runs_entry r ON r.id = m.run_id
                               WHERE c.id = p.call_id
                                 AND r.group_id = dgd.group_id
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
                 FROM rubric_standard_groups_junction rsg
                 JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
                 CROSS JOIN draft_group_data dgd
                 WHERE rsg.standard_group_id IS NOT NULL
                   AND (
                       (SELECT standard_group_search FROM params LIMIT 1) IS NULL
                       OR LOWER(sg.name) LIKE '%' || LOWER((SELECT standard_group_search FROM params LIMIT 1)) || '%'
                       OR LOWER(COALESCE(sg.description, '')) LIKE '%' || LOWER((SELECT standard_group_search FROM params LIMIT 1)) || '%'
                   )
                   AND (
                       -- Option 1: Linked to rubrics with active=true
                       rsg.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           rsg.generated = true
                           AND sg.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN messages_entry m ON m.id = c.message_id
                               JOIN runs_entry r ON r.id = m.run_id
                               WHERE c.id = sg.call_id
                                 AND r.group_id = dgd.group_id
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
-- Standard suggestions: linked to rubrics with active=true OR same group with generated=true
standard_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(rs.standard_id ORDER BY rs.created_at DESC)
             FROM (
                 SELECT DISTINCT rs.standard_id, MAX(rs.created_at) as created_at
                 FROM rubric_standards_junction rs
                 JOIN standards_resource s ON s.id = rs.standard_id
                 CROSS JOIN draft_group_data dgd
                 WHERE rs.standard_id IS NOT NULL
                   AND s.name IS NOT NULL
                   AND s.name != ''
                   AND (
                       -- Option 1: Linked to rubrics with active=true
                       rs.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           rs.generated = true
                           AND s.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN messages_entry m ON m.id = c.message_id
                               JOIN runs_entry r ON r.id = m.run_id
                               WHERE c.id = s.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY rs.standard_id
                 ORDER BY MAX(rs.created_at) DESC
                 LIMIT 20
             ) rs),
            ARRAY[]::uuid[]
        ) as standard_suggestions
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
                JOIN names_resource n ON n.id = suggestion_id
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
                JOIN descriptions_resource d ON d.id = suggestion_id
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
    JOIN rubric_departments_junction rd ON rd.rubric_id = p.rubric_id AND rd.active = true
    WHERE p.rubric_id IS NOT NULL
    LIMIT 1
),
profile_primary_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
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
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id AND pd.active = true
),
agent_artifact_tool_counts AS (
    SELECT 
        a.id as agent_id,
        COUNT(DISTINCT CASE WHEN ar.resource IS NOT NULL THEN rt.resource::text END) as matched_artifact_count,
        COUNT(DISTINCT CASE WHEN ar.resource IS NULL THEN rt.resource::text END) as extra_outside_count
    FROM agent_artifact a
    LEFT JOIN agent_tools_junction at ON at.agent_id = a.id AND at.active = true
    LEFT JOIN tools_resource tr ON tr.id = at.tool_id
    LEFT JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (
        SELECT 1 FROM tool_flags_junction tf
        JOIN flags_resource f ON tf.flag_id = f.id
        WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true
    )
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
    LEFT JOIN artifact_resources_relation ar ON ar.resource = rt.resource AND ar.artifact = 'rubric'::artifact_type
    GROUP BY a.id
),

-- Agent selection for 'names' resource
name_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'rubric'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
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
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'descriptions' resource
description_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'rubric'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'descriptions'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
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
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'departments' resource
departments_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'rubric'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'departments'::resource_type
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'flags' resource
flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'rubric'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'flags'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
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
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'points' resource
points_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'rubric'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'points'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
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
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'standard_groups' resource
standard_groups_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'rubric'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'standard_groups'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
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
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'standards' resource
standards_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'rubric'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'standards'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
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
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
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
        true as show_standard_groups,  -- Always show standard groups_entry picker
        CASE 
            WHEN COALESCE(array_length((SELECT standard_group_ids FROM standard_group_ids_data), 1), 0) > 0 THEN true
            ELSE false
        END as show_standards
    FROM params x
    CROSS JOIN user_profile up
),
-- Check for missing tools on required resources
-- IMPORTANT: We check for TOOLS existence (not agents). Tools are required, agents are optional.
-- If no tools exist for a resource, we error. If tools exist but no agent exists, that's fine (manual entry).
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'descriptions'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'flags'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as flags_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'points'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as points_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'standard_groups'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as standard_groups_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'standards'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as standards_has_tools
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
            CASE WHEN NOT tec.standard_groups_has_tools AND uf.show_standard_groups THEN 'standard_groups' ELSE NULL END,
            CASE WHEN NOT tec.standards_has_tools AND uf.show_standards THEN 'standards' ELSE NULL END
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
                    WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
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
                    WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN 
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
    FROM names_resource n
    CROSS JOIN params p
    CROSS JOIN name_suggestions_data nsd
    WHERE 
        -- Always include selected name_id if it exists
        n.id = (SELECT name_id FROM name_resource_data)
        OR n.id = ANY(nsd.name_suggestions)
    ORDER BY n.name
),
-- Names aggregation CTE
names_agg AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (nd.id, nd.name, nd.generated)::types.q_get_rubric_v4_name_resource
                ORDER BY nd.name
            ),
            COALESCE((SELECT names FROM names_suggestions_objects), '{}'::types.q_get_rubric_v4_name_resource[])
        ) AS names
    FROM names_data nd
    CROSS JOIN params
    LIMIT 1
),
-- Descriptions data (suggested options only)
descriptions_data AS (
    SELECT DISTINCT
        d.id,
        d.description,
        COALESCE(d.generated, false) as generated
    FROM descriptions_resource d
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
-- Descriptions aggregation CTE
descriptions_agg AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (dd.id, dd.description, dd.generated)::types.q_get_rubric_v4_description_resource
                ORDER BY dd.description
            ),
            COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), '{}'::types.q_get_rubric_v4_description_resource[])
        ) AS descriptions
    FROM descriptions_data dd
    CROSS JOIN params
    LIMIT 1
),
-- Flags data (all available flag options)
flags_data AS (
    SELECT DISTINCT
        f.id,
        f.name,
        f.description,
        f.icon_id,
        COALESCE(f.generated, false) as generated
    FROM flags_resource f
    CROSS JOIN params p
    WHERE 
        -- Always include selected active_flag_id if it exists
        f.id = (SELECT active_flag_id FROM flag_resource_data)
        OR (SELECT active_flag_id FROM flag_resource_data) IS NULL
    ORDER BY f.name
),
-- Flags aggregation CTE
flags_agg AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (fd.id, fd.name, fd.description, fd.icon_id, fd.generated)::types.q_get_rubric_v4_flag_resource
                ORDER BY fd.name
            ),
            '{}'::types.q_get_rubric_v4_flag_resource[]
        ) AS flags
    FROM flags_data fd
    CROSS JOIN params
    LIMIT 1
),
-- Points data (all available points options)
points_data AS (
    SELECT DISTINCT
        p.id,
        p.value,
        COALESCE(p.generated, false) as generated
    FROM points_resource p
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
-- Points aggregation CTE
points_agg AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (pd.id, pd.value, pd.generated)::types.q_get_rubric_v4_points_option
                ORDER BY pd.value
            ),
            '{}'::types.q_get_rubric_v4_points_option[]
        ) AS points
    FROM points_data pd
    CROSS JOIN params
    LIMIT 1
),
-- Standard groups_entry data (for selected standard groups_entry - only when rubric_id provided)
standard_groups_selected_data AS (
    SELECT 
        sg.id as standard_group_id,
        sg.name,
        sg.description,
        sg.points,
        sg.pass_points,
        sgld.position,
        sgld.active,
        ARRAY_AGG(s.id ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL) as standard_ids,
        COALESCE(sgld.generated, false) as generated
    FROM standard_group_links_data sgld
    JOIN standard_groups_resource sg ON sg.id = sgld.standard_group_id
    LEFT JOIN standards_resource s ON s.standard_group_id = sg.id
    GROUP BY sg.id, sg.name, sg.description, sg.points, sg.pass_points, sgld.position, sgld.active, sgld.generated
),
-- Standard groups_entry data (all available standard groups_entry for options array)
standard_groups_all_data AS (
    SELECT 
        sg.id as standard_group_id,
        sg.name,
        sg.description,
        sg.points,
        sg.pass_points,
        COALESCE(sgld.position, 0) as position,
        COALESCE(sgld.active, true) as active,
        ARRAY_AGG(s.id ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL) as standard_ids,
        COALESCE(sg.generated, false) as generated
    FROM params x
    CROSS JOIN standard_groups_resource sg
    LEFT JOIN standard_group_links_data sgld ON sgld.standard_group_id = sg.id
    LEFT JOIN standards_resource s ON s.standard_group_id = sg.id
    WHERE sg.active = true
      AND (
          (SELECT standard_group_search FROM params LIMIT 1) IS NULL
          OR LOWER(sg.name) LIKE '%' || LOWER((SELECT standard_group_search FROM params LIMIT 1)) || '%'
          OR LOWER(COALESCE(sg.description, '')) LIKE '%' || LOWER((SELECT standard_group_search FROM params LIMIT 1)) || '%'
      )
    GROUP BY sg.id, sg.name, sg.description, sg.points, sg.pass_points, sgld.position, sgld.active, sg.generated
),
-- Standard groups_entry aggregated (selected groups_entry for standard_group_resources)
standard_groups_selected_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sg.standard_group_id, sg.name, COALESCE(sg.description, ''), sg.points, sg.pass_points, sg.position, sg.active, COALESCE(sg.standard_ids, ARRAY[]::uuid[]), sg.generated)::types.q_get_rubric_v4_standard_group_resource
                ORDER BY sg.position, sg.name
            ),
            '{}'::types.q_get_rubric_v4_standard_group_resource[]
        ) as standard_group_resources
    FROM standard_groups_selected_data sg
    CROSS JOIN params
    LIMIT 1
),
-- Standard groups_entry aggregated (all available groups_entry for standard_groups array)
standard_groups_all_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sg.standard_group_id, sg.name, COALESCE(sg.description, ''), sg.points, sg.pass_points, sg.position, sg.active, COALESCE(sg.standard_ids, ARRAY[]::uuid[]), sg.generated)::types.q_get_rubric_v4_standard_group_resource
                ORDER BY sg.position, sg.name
            ),
            '{}'::types.q_get_rubric_v4_standard_group_resource[]
        ) as standard_groups
    FROM standard_groups_all_data sg
    CROSS JOIN params
    LIMIT 1
),
-- Standards data (selected standards)
standards_selected_data AS (
    SELECT 
        s.id as standard_id,
        s.standard_group_id,
        s.name,
        s.description,
        s.points,
        COALESCE(dsg.generated, rs.generated, s.generated, false) as generated
    FROM params x
    JOIN standards_resource s ON s.id IN (
        SELECT unnest(standard_ids) FROM standard_ids_data
    )
    LEFT JOIN standard_groups_draft dsg ON dsg.draft_id = x.draft_id AND dsg.standard_groups_id = s.standard_group_id
    LEFT JOIN rubric_standards_junction rs ON rs.rubric_id = x.rubric_id AND rs.standard_id = s.id AND rs.active = true
),
-- Standards data (all available standards for selected groups_entry)
standards_all_data AS (
    SELECT 
        s.id as standard_id,
        s.standard_group_id,
        s.name,
        s.description,
        s.points,
        COALESCE(s.generated, false) as generated
    FROM standards_resource s
    CROSS JOIN standard_group_ids_data sgid
    WHERE s.active = true
      AND s.standard_group_id = ANY(sgid.standard_group_ids)
),
-- Standards aggregated (selected standards for standard_resources)
standards_selected_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (s.standard_id, s.standard_group_id, s.name, COALESCE(s.description, ''), s.points, s.generated)::types.q_get_rubric_v4_standard_resource
                ORDER BY s.standard_group_id, s.name
            ),
            '{}'::types.q_get_rubric_v4_standard_resource[]
        ) as standard_resources
    FROM standards_selected_data s
    CROSS JOIN params
    LIMIT 1
),
-- Standards aggregated (all available standards for standards array)
standards_all_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (s.standard_id, s.standard_group_id, s.name, COALESCE(s.description, ''), s.points, s.generated)::types.q_get_rubric_v4_standard_resource
                ORDER BY s.standard_group_id, s.name
            ),
            '{}'::types.q_get_rubric_v4_standard_resource[]
        ) as standards
    FROM standards_all_data s
    CROSS JOIN params
    LIMIT 1
)
SELECT
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT rubric_exists FROM rubric_exists_check) as rubric_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    (SELECT draft_version FROM draft_version_data) as draft_version,
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
    (SELECT names FROM names_agg) as names,
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
    (SELECT descriptions FROM descriptions_agg) as descriptions,
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
    (SELECT departments FROM departments_agg) as departments,
    -- Single-select resources: flag
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    (SELECT flag_res FROM (SELECT frd.draft_flag_resource as flag_res UNION ALL SELECT frd.rubric_flag_resource LIMIT 1) sub WHERE flag_res IS NOT NULL LIMIT 1) as flag_resource,
    uf.show_flag,
    (SELECT agent_id FROM flag_agent_data) as flag_agent_id,
    false as flag_required,
    (SELECT flags FROM flags_agg) as flags,
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
    (SELECT points FROM points_agg) as points,
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
    (SELECT points FROM points_agg) as pass_points,
    -- Multi-select resources: standard_groups
    COALESCE((SELECT standard_group_ids FROM standard_group_ids_data), ARRAY[]::uuid[]) as standard_group_ids,
    -- Standard group resources (selected standard groups_entry filtered by standard_group_ids)
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
    -- Standard groups_entry array (all available standard groups_entry)
    (SELECT standard_groups FROM standard_groups_all_aggregated) as standard_groups,
    -- Multi-select resources: standards
    COALESCE((SELECT standard_ids FROM standard_ids_data), ARRAY[]::uuid[]) as standard_ids,
    (SELECT standard_resources FROM standards_selected_aggregated) as standard_resources,
    CASE 
        WHEN NOT tec.standards_has_tools AND uf.show_standards THEN false
        ELSE uf.show_standards
    END as show_standards,
    (SELECT agent_id FROM standards_agent_data) as standards_agent_id,
    CASE 
        WHEN uf.show_standards THEN true
        ELSE false
    END as standards_required,
    COALESCE((SELECT standard_suggestions FROM standard_suggestions_data), ARRAY[]::uuid[]) as standard_suggestions,
    (SELECT standards FROM standards_all_aggregated) as standards
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
LEFT JOIN rubric_departments_data rdd ON true
CROSS JOIN active_departments_data add
CROSS JOIN draft_group_data dgd
CROSS JOIN draft_version_data dvd
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
CROSS JOIN standard_groups_selected_aggregated sgsa
CROSS JOIN standard_groups_all_aggregated sgaa
CROSS JOIN department_suggestions_data dsd_dept
CROSS JOIN points_suggestions_data psd
CROSS JOIN standard_group_suggestions_data sgsd
CROSS JOIN standard_ids_data sid
CROSS JOIN standard_suggestions_data ssd
CROSS JOIN standards_selected_aggregated ssa
CROSS JOIN standards_all_aggregated saa
CROSS JOIN names_agg na
CROSS JOIN descriptions_agg da
CROSS JOIN departments_agg depta
CROSS JOIN flags_agg fa
CROSS JOIN points_agg pa
$$;
