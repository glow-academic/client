-- Unified get staff function - handles both new (staff_id = NULL) and detail (staff_id provided)
-- Converted to function with composite types
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_staff_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_staff_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_staff_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_staff_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_staff_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_staff_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_staff_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean
);

CREATE TYPE types.q_get_staff_v4_email_resource AS (
    id uuid,
    email text,
    generated boolean
);

CREATE TYPE types.q_get_staff_v4_request_limit_resource AS (
    id uuid,
    requests_per_day integer,
    generated boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_staff_v4(
    profile_id uuid,
    staff_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    staff_exists boolean,
    can_edit boolean,
    disabled_reason text,
    group_id uuid,
    -- Single-select resources: first_name
    first_name_id uuid,
    first_name_resource types.q_get_staff_v4_name_resource,
    show_first_name boolean,
    first_name_agent_id uuid,
    first_name_required boolean,
    first_name_suggestions uuid[],
    first_names types.q_get_staff_v4_name_resource[],
    -- Single-select resources: last_name
    last_name_id uuid,
    last_name_resource types.q_get_staff_v4_name_resource,
    show_last_name boolean,
    last_name_agent_id uuid,
    last_name_required boolean,
    last_name_suggestions uuid[],
    last_names types.q_get_staff_v4_name_resource[],
    -- Single-select resources: active_flag
    active_flag_id uuid,
    flag_resource types.q_get_staff_v4_flag_resource,
    show_flag boolean,
    flag_agent_id uuid,
    flag_required boolean,
    flags types.q_get_staff_v4_flag_resource[],
    -- Single-select resources: request_limit
    request_limit_id uuid,
    request_limit_resource types.q_get_staff_v4_request_limit_resource,
    show_request_limit boolean,
    request_limit_agent_id uuid,
    request_limit_required boolean,
    request_limit_suggestions uuid[],
    request_limits types.q_get_staff_v4_request_limit_resource[],
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_staff_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_staff_v4_department[],
    -- Multi-select resources: cohorts (artifacts, not resources)
    cohort_ids uuid[],
    cohorts types.q_get_staff_v4_cohort[],
    -- Multi-select resources: emails
    email_ids uuid[],
    email_resources types.q_get_staff_v4_email_resource[],
    show_emails boolean,
    emails_agent_id uuid,
    emails_required boolean,
    email_suggestions uuid[],
    emails types.q_get_staff_v4_email_resource[],
    -- Additional fields for backward compatibility
    first_name text,
    last_name text,
    name text,
    emails_text text[],
    primary_email text,
    primary_email_index integer,
    role text,
    active boolean,
    requests_per_day integer,
    primary_department_id text,
    primary_department_index integer,
    valid_department_ids text[],
    valid_cohort_ids text[],
    role_options text[],
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        staff_id AS staff_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check staff existence if staff_id provided
staff_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT staff_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM profile_artifact WHERE id = (SELECT staff_id FROM params))::boolean
        END as staff_exists
),
-- Draft data is now stored in draft_* junction tables, not in payload
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
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
        COALESCE((SELECT r.role FROM profile_roles pr_j 
                  JOIN roles_resource r ON pr_j.role_id = r.id 
                  WHERE pr_j.profile_id = p.id 
                  LIMIT 1), 'instructional'::profile_role) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    LEFT JOIN profile_artifact p ON p.id = x.profile_id
    LIMIT 1
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Conditional: Get staff department data only if staff_id provided (always return at least one row)
staff_departments_data AS (
    SELECT 
        COALESCE(pd.profile_id, (SELECT profile_id FROM params LIMIT 1)) as profile_id,
        COALESCE(ARRAY_AGG(pd.department_id ORDER BY pd.created_at) FILTER (WHERE pd.department_id IS NOT NULL), ARRAY[]::uuid[]) as department_ids
    FROM params x
    LEFT JOIN profile_departments pd ON pd.profile_id = x.staff_id AND pd.active = true AND x.staff_id IS NOT NULL
    GROUP BY pd.profile_id
    LIMIT 1
),
staff_cohorts_data AS (
    SELECT 
        COALESCE(cp.profile_id, (SELECT profile_id FROM params LIMIT 1)) as profile_id,
        COALESCE(ARRAY_AGG(cp.cohort_id ORDER BY cp.created_at) FILTER (WHERE cp.cohort_id IS NOT NULL), ARRAY[]::uuid[]) as cohort_ids
    FROM params x
    LEFT JOIN profile_cohorts cp ON cp.profile_id = x.staff_id AND cp.active = true AND x.staff_id IS NOT NULL
    GROUP BY cp.profile_id
    LIMIT 1
),
staff_emails_data AS (
    SELECT 
        COALESCE(pe.profile_id, (SELECT profile_id FROM params LIMIT 1)) as profile_id,
        COALESCE(ARRAY_AGG(pe.email_id ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true AND pe.email_id IS NOT NULL), ARRAY[]::uuid[]) as email_ids,
        COALESCE(ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true AND pe.email IS NOT NULL), ARRAY[]::text[]) as emails_text,
        (SELECT pe2.email FROM profile_emails pe2 WHERE pe2.profile_id = pe.profile_id AND pe2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email,
        (SELECT array_position(ARRAY_AGG(pe.email_id ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true), pe2.email_id) - 1 FROM profile_emails pe2 WHERE pe2.profile_id = pe.profile_id AND pe2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email_index
    FROM params x
    LEFT JOIN profile_emails pe ON pe.profile_id = x.staff_id AND pe.active = true AND x.staff_id IS NOT NULL
    GROUP BY pe.profile_id
    LIMIT 1
),
staff_department_access_check AS (
    SELECT 
        p.id as profile_id,
        CASE 
            WHEN up.role = 'superadmin'::profile_role THEN true
            WHEN EXISTS (
                SELECT 1 FROM profile_departments pd 
                WHERE pd.profile_id = p.id 
                AND pd.active = true 
                AND pd.department_id IN (SELECT department_id FROM user_departments)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM profile_departments pd3 
                WHERE pd3.profile_id = p.id 
                AND pd3.active = true
            ) THEN true
            ELSE false
        END as has_access
    FROM params x
    JOIN profile_artifact p ON p.id = x.staff_id
    CROSS JOIN user_profile up
    WHERE x.staff_id IS NOT NULL
),
department_mapping_data AS (
    SELECT 
        d.department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.department_id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN departments_resource d ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'active' AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.department_id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
),
primary_department_id_data AS (
    SELECT department_id
    FROM params x
    LEFT JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.is_primary = TRUE
    LIMIT 1
),
-- Active departments for user (departments with active flag that user is linked to) - always return at least one row
active_departments_data AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT d.department_id) FILTER (WHERE d.department_id IS NOT NULL), ARRAY[]::uuid[]) as department_ids
    FROM params x
    LEFT JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'active' AND df.value = true)
        AND EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.department_id AND pd.profile_id = x.profile_id AND pd.active = true)
    LIMIT 1
),
-- All cohorts (artifacts, not resources)
all_cohort_ids AS (
    SELECT DISTINCT c.id as cohort_id
    FROM cohort_artifact c
    WHERE EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'active' AND cf.value = true)
),
cohorts_data AS (
    SELECT 
        c.id as cohort_id,
        (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM cohort_descriptions cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), '') as description
    FROM cohort_artifact c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
),
-- UI flags
ui_flags AS (
    SELECT 
        -- Single-select resource flags
        true as show_first_name,
        true as show_last_name,
        true as show_flag,
        CASE 
            WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
            ELSE false
        END as show_departments,
        CASE 
            WHEN (SELECT COUNT(*) FROM cohorts_data) > 0 THEN true
            ELSE false
        END as show_cohorts,
        true as show_emails,
        true as show_request_limit
    FROM params x
    CROSS JOIN user_profile up
),
-- First name resource data
first_name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT pn.name_id FROM profile_names pn WHERE pn.profile_id = (SELECT staff_id FROM params) AND pn.type = 'first'::type_profile_names LIMIT 1),
            NULL::uuid
        ) as first_name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_staff_v4_name_resource 
            FROM profile_names pn 
            JOIN names_resource n ON pn.name_id = n.id 
            WHERE pn.profile_id = (SELECT staff_id FROM params) AND pn.type = 'first'::type_profile_names
            LIMIT 1
        ) as first_name_resource
    FROM params
),
-- Last name resource data
last_name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT pn.name_id FROM profile_names pn WHERE pn.profile_id = (SELECT staff_id FROM params) AND pn.type = 'last'::type_profile_names LIMIT 1),
            NULL::uuid
        ) as last_name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_staff_v4_name_resource 
            FROM profile_names pn 
            JOIN names_resource n ON pn.name_id = n.id 
            WHERE pn.profile_id = (SELECT staff_id FROM params) AND pn.type = 'last'::type_profile_names
            LIMIT 1
        ) as last_name_resource
    FROM params
),
-- Flag resource data
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT pf.flag_id FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = (SELECT staff_id FROM params) AND f.name = 'active' AND pf.value = TRUE LIMIT 1),
            NULL::uuid
        ) as active_flag_id,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_staff_v4_flag_resource 
            FROM profile_flags pf 
            JOIN flags_resource f ON pf.flag_id = f.id 
            JOIN flags_resource fl ON pf.flag_id = fl.id 
            WHERE pf.profile_id = (SELECT staff_id FROM params) AND fl.name = 'active' AND pf.value = TRUE
            LIMIT 1
        ) as flag_resource
    FROM params
),
-- Request limit resource data
request_limit_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT prl.request_limit_id FROM profile_request_limits prl WHERE prl.profile_id = (SELECT staff_id FROM params) AND prl.active = true LIMIT 1),
            NULL::uuid
        ) as request_limit_id,
        (
            SELECT ROW(rl.id, rl.requests_per_day, COALESCE(rl.generated, false))::types.q_get_staff_v4_request_limit_resource 
            FROM profile_request_limits prl 
            JOIN request_limits_resource rl ON prl.request_limit_id = rl.id 
            WHERE prl.profile_id = (SELECT staff_id FROM params) AND prl.active = true
            LIMIT 1
        ) as request_limit_resource
    FROM params
),
-- Name suggestions: linked to profiles OR same group with generated=true
first_name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pn.name_id ORDER BY pn.created_at DESC)
             FROM (
                 SELECT DISTINCT pn.name_id, MAX(pn.created_at) as created_at
                 FROM profile_names pn
                 JOIN names_resource n ON n.id = pn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND pn.type = 'first'::type_profile_names
                   AND (
                       -- Option 1: Linked to profiles (profile_names junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       pn.generated = false
                       OR
                       (
                           pn.generated = true
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
                 GROUP BY pn.name_id
                 ORDER BY MAX(pn.created_at) DESC
                 LIMIT 20
             ) pn),
            ARRAY[]::uuid[]
        ) as first_name_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
last_name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pn.name_id ORDER BY pn.created_at DESC)
             FROM (
                 SELECT DISTINCT pn.name_id, MAX(pn.created_at) as created_at
                 FROM profile_names pn
                 JOIN names_resource n ON n.id = pn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND pn.type = 'last'::type_profile_names
                   AND (
                       -- Option 1: Linked to profiles (profile_names junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       pn.generated = false
                       OR
                       (
                           pn.generated = true
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
                 GROUP BY pn.name_id
                 ORDER BY MAX(pn.created_at) DESC
                 LIMIT 20
             ) pn),
            ARRAY[]::uuid[]
        ) as last_name_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Suggested resource objects CTEs
first_names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_staff_v4_name_resource
                    ORDER BY array_position(fnsd.first_name_suggestions, n.id)
                )
                FROM first_name_suggestions_data fnsd
                CROSS JOIN LATERAL unnest(fnsd.first_name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_staff_v4_name_resource[]
        ) as first_names
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
last_names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_staff_v4_name_resource
                    ORDER BY array_position(lnsd.last_name_suggestions, n.id)
                )
                FROM last_name_suggestions_data lnsd
                CROSS JOIN LATERAL unnest(lnsd.last_name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_staff_v4_name_resource[]
        ) as last_names
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
-- Flags (all available flag options)
flags_data AS (
    SELECT DISTINCT
        f.id,
        f.name,
        f.description,
        f.icon_id,
        COALESCE(f.generated, false) as generated
    FROM flags_resource f
    CROSS JOIN params p
    WHERE f.name = 'active'
    ORDER BY f.name
),
-- Request limits (all available request limit options)
request_limits_data AS (
    SELECT DISTINCT
        rl.id,
        rl.requests_per_day,
        COALESCE(rl.generated, false) as generated
    FROM request_limits_resource rl
    CROSS JOIN params p
    WHERE rl.active = true
    ORDER BY rl.requests_per_day
),
-- Request limit suggestions: linked to profiles OR same group with generated=true
request_limit_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(prl.request_limit_id ORDER BY prl.created_at DESC)
             FROM (
                 SELECT DISTINCT prl.request_limit_id, MAX(prl.created_at) as created_at
                 FROM profile_request_limits prl
                 JOIN request_limits_resource rl ON rl.id = prl.request_limit_id
                 CROSS JOIN draft_group_data dgd
                 WHERE prl.request_limit_id IS NOT NULL
                   AND prl.active = true
                   AND (
                       -- Option 1: Linked to profiles (profile_request_limits junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       prl.generated = false
                       OR
                       (
                           prl.generated = true
                           AND rl.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = rl.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY prl.request_limit_id
                 ORDER BY MAX(prl.created_at) DESC
                 LIMIT 20
             ) prl),
            ARRAY[]::uuid[]
        ) as request_limit_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Department suggestions: linked to profiles with active=true OR same group with generated=true
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at DESC)
             FROM (
                 SELECT DISTINCT pd.department_id, MAX(pd.created_at) as created_at
                 FROM profile_departments pd
                 JOIN departments_resource d ON d.id = pd.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pd.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
                   AND (
                       -- Option 1: Linked to profiles with active=true
                       pd.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           pd.generated = true
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
                 GROUP BY pd.department_id
                 ORDER BY MAX(pd.created_at) DESC
                 LIMIT 20
             ) pd),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Email suggestions: linked to profiles OR same group with generated=true
email_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pe.email_id ORDER BY pe.created_at DESC)
             FROM (
                 SELECT DISTINCT pe.email_id, MAX(pe.created_at) as created_at
                 FROM profile_emails pe
                 JOIN emails_resource e ON e.id = pe.email_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pe.email_id IS NOT NULL
                   AND pe.active = true
                   AND (
                       -- Option 1: Linked to profiles (profile_emails junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       pe.generated = false
                       OR
                       (
                           pe.generated = true
                           AND e.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = e.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pe.email_id
                 ORDER BY MAX(pe.created_at) DESC
                 LIMIT 20
             ) pe),
            ARRAY[]::uuid[]
        ) as email_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Agent selection helper CTEs (shared across all agent selections)
profile_primary_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    WHERE p.staff_id IS NULL
    LIMIT 1
),
staff_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.staff_id AND pd.is_primary = TRUE AND pd.active = true
    WHERE p.staff_id IS NOT NULL
    LIMIT 1
),
selected_department_for_agents AS (
    SELECT 
        COALESCE(
            (SELECT department_id FROM staff_department_for_agents),
            (SELECT department_id FROM profile_primary_department_for_agents)
        ) as department_id
),
user_departments_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.active = true
),
-- Agent selection for 'names' resource (first_name)
first_name_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'profile'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
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
-- Agent selection for 'names' resource (last_name) - same as first_name
last_name_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'profile'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
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
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'profile'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'flags'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
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
-- Agent selection for 'request_limits' resource
request_limit_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'profile'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'request_limits'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
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
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'profile'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'departments'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
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
-- Agent selection for 'emails' resource
emails_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'profile'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'emails'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
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
-- Check for missing tools on required resources
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'flags'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as flags_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'request_limits'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as request_limits_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'emails'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as emails_has_tools
    FROM params x
),
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            -- Check if tools exist (not agents). Error only if NO tools exist.
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.flags_has_tools THEN 'flag' ELSE NULL END,
            CASE WHEN NOT tec.request_limits_has_tools THEN 'request_limit' ELSE NULL END,
            CASE WHEN NOT tec.departments_has_tools AND uf.show_departments THEN 'departments' ELSE NULL END,
            CASE WHEN NOT tec.emails_has_tools THEN 'emails' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
),
permissions_data_with_tools AS (
    SELECT 
        sdd.department_ids,
        CASE 
            WHEN (SELECT staff_id FROM params) IS NULL THEN
                -- New mode permissions
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN (SELECT department_id FROM primary_department_id_data) IS NOT NULL THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode permissions
                CASE 
                    WHEN up.role = 'superadmin'::profile_role THEN true
                    WHEN up.role = 'admin'::profile_role THEN true
                    WHEN up.role = 'instructional'::profile_role THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            WHEN (SELECT staff_id FROM params) IS NULL THEN
                -- New mode: always editable if can_edit is true
                NULL::text
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN 
                        NULL::text
                    ELSE 
                        'This staff member cannot be edited. You can view the details but cannot make changes.'::text
                END
        END as base_disabled_reason
    FROM params x
    LEFT JOIN staff_departments_data sdd ON true
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
-- Target profile data (for detail mode)
target_profile_data AS (
    SELECT 
        p.id,
        (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) as first_name,
        (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1) as last_name,
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'active' AND pf.value = TRUE) as active,
        (SELECT rl.requests_per_day FROM profile_request_limits prl JOIN request_limits_resource rl ON prl.request_limit_id = rl.id WHERE prl.profile_id = p.id AND prl.active = true LIMIT 1) as requests_per_day
    FROM params x
    JOIN profile_artifact p ON p.id = x.staff_id
    WHERE x.staff_id IS NOT NULL
)
SELECT
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT staff_exists FROM staff_exists_check) as staff_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    dgd.group_id,
    -- Single-select resources: first_name
    (SELECT first_name_id FROM first_name_resource_data) as first_name_id,
    (SELECT first_name_resource FROM first_name_resource_data) as first_name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_first_name
    END as show_first_name,
    (SELECT agent_id FROM first_name_agent_data) as first_name_agent_id,
    true as first_name_required,
    COALESCE((SELECT first_name_suggestions FROM first_name_suggestions_data), ARRAY[]::uuid[]) as first_name_suggestions,
    COALESCE((SELECT first_names FROM first_names_suggestions_objects), ARRAY[]::types.q_get_staff_v4_name_resource[]) as first_names,
    -- Single-select resources: last_name
    (SELECT last_name_id FROM last_name_resource_data) as last_name_id,
    (SELECT last_name_resource FROM last_name_resource_data) as last_name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_last_name
    END as show_last_name,
    (SELECT agent_id FROM last_name_agent_data) as last_name_agent_id,
    true as last_name_required,
    COALESCE((SELECT last_name_suggestions FROM last_name_suggestions_data), ARRAY[]::uuid[]) as last_name_suggestions,
    COALESCE((SELECT last_names FROM last_names_suggestions_objects), ARRAY[]::types.q_get_staff_v4_name_resource[]) as last_names,
    -- Single-select resources: active_flag
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    (SELECT flag_resource FROM flag_resource_data) as flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE uf.show_flag
    END as show_flag,
    (SELECT agent_id FROM flag_agent_data) as flag_agent_id,
    false as flag_required,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.id, fd.name, fd.description, fd.icon_id, fd.generated)::types.q_get_staff_v4_flag_resource
            ORDER BY fd.name
        ) FROM (SELECT DISTINCT id, name, description, icon_id, generated FROM flags_data) fd),
        '{}'::types.q_get_staff_v4_flag_resource[]
    ) as flags,
    -- Single-select resources: request_limit
    (SELECT request_limit_id FROM request_limit_resource_data) as request_limit_id,
    (SELECT request_limit_resource FROM request_limit_resource_data) as request_limit_resource,
    CASE 
        WHEN NOT tec.request_limits_has_tools THEN false
        ELSE uf.show_request_limit
    END as show_request_limit,
    (SELECT agent_id FROM request_limit_agent_data) as request_limit_agent_id,
    false as request_limit_required,
    COALESCE((SELECT request_limit_suggestions FROM request_limit_suggestions_data), ARRAY[]::uuid[]) as request_limit_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (rld.id, rld.requests_per_day, rld.generated)::types.q_get_staff_v4_request_limit_resource
            ORDER BY rld.requests_per_day
        ) FROM (SELECT DISTINCT id, requests_per_day, generated FROM request_limits_data) rld),
        '{}'::types.q_get_staff_v4_request_limit_resource[]
    ) as request_limits,
    -- Multi-select resources: departments
    COALESCE(
        CASE 
            WHEN (SELECT staff_id FROM params) IS NULL THEN
                -- For new staff, leave department_ids empty (no auto-selection)
                ARRAY[]::uuid[]
            ELSE sdd.department_ids
        END,
        ARRAY[]::uuid[]
    ) as department_ids,
    -- Department resources (selected departments filtered by department_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_staff_v4_department
            ORDER BY dmd.name
        )
        FROM department_mapping_data dmd
        WHERE dmd.department_id = ANY(
            COALESCE(
                CASE 
                    WHEN (SELECT staff_id FROM params) IS NULL THEN
                        -- For new staff, leave department_ids empty (no auto-selection)
                        ARRAY[]::uuid[]
                    ELSE sdd.department_ids
                END,
                ARRAY[]::uuid[]
            )
        )),
        '{}'::types.q_get_staff_v4_department[]
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
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_staff_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_staff_v4_department[]
    ) as departments,
    -- Multi-select resources: cohorts (artifacts, not resources)
    COALESCE(
        CASE 
            WHEN (SELECT staff_id FROM params) IS NULL THEN
                -- For new staff, leave cohort_ids empty (no auto-selection)
                ARRAY[]::uuid[]
            ELSE scd.cohort_ids
        END,
        ARRAY[]::uuid[]
    ) as cohort_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.cohort_id, cd.name, cd.description)::types.q_get_staff_v4_cohort
            ORDER BY cd.name
        )
        FROM cohorts_data cd),
        '{}'::types.q_get_staff_v4_cohort[]
    ) as cohorts,
    -- Multi-select resources: emails
    COALESCE(
        CASE 
            WHEN (SELECT staff_id FROM params) IS NULL THEN
                -- For new staff, leave email_ids empty (no auto-selection)
                ARRAY[]::uuid[]
            ELSE sed.email_ids
        END,
        ARRAY[]::uuid[]
    ) as email_ids,
    -- Email resources (selected emails filtered by email_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (e.id, e.email, COALESCE(e.generated, false))::types.q_get_staff_v4_email_resource
            ORDER BY array_position(
                COALESCE(
                    CASE 
                        WHEN (SELECT staff_id FROM params) IS NULL THEN
                            ARRAY[]::uuid[]
                        ELSE sed.email_ids
                    END,
                    ARRAY[]::uuid[]
                ),
                e.id
            )
        )
        FROM profile_emails pe
        JOIN emails_resource e ON e.id = pe.email_id
        WHERE pe.profile_id = (SELECT staff_id FROM params)
          AND pe.active = true
          AND e.id = ANY(
            COALESCE(
                CASE 
                    WHEN (SELECT staff_id FROM params) IS NULL THEN
                        ARRAY[]::uuid[]
                    ELSE sed.email_ids
                END,
                ARRAY[]::uuid[]
            )
        )),
        '{}'::types.q_get_staff_v4_email_resource[]
    ) as email_resources,
    CASE 
        WHEN NOT tec.emails_has_tools THEN false
        ELSE uf.show_emails
    END as show_emails,
    (SELECT agent_id FROM emails_agent_data) as emails_agent_id,
    true as emails_required,
    COALESCE((SELECT email_suggestions FROM email_suggestions_data), ARRAY[]::uuid[]) as email_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (e.id, e.email, COALESCE(e.generated, false))::types.q_get_staff_v4_email_resource
            ORDER BY e.email
        )
        FROM emails_resource e
        WHERE e.active = true
          AND (
              -- Always include selected email_ids if they exist
              e.id = ANY(
                COALESCE(
                    CASE 
                        WHEN (SELECT staff_id FROM params) IS NULL THEN
                            ARRAY[]::uuid[]
                        ELSE sed.email_ids
                    END,
                    ARRAY[]::uuid[]
                )
            )
            OR
            -- Include emails from suggestions
            e.id = ANY(COALESCE((SELECT email_suggestions FROM email_suggestions_data), ARRAY[]::uuid[]))
          )),
        '{}'::types.q_get_staff_v4_email_resource[]
    ) as emails,
    -- Additional fields for backward compatibility
    COALESCE(
        (SELECT payload->>'firstName' FROM draft_payload_data),
        (SELECT first_name FROM target_profile_data),
        ''::text
    ) as first_name,
    COALESCE(
        (SELECT payload->>'lastName' FROM draft_payload_data),
        (SELECT last_name FROM target_profile_data),
        ''::text
    ) as last_name,
    COALESCE(
        (SELECT payload->>'firstName' FROM draft_payload_data) || ' ' || 
        COALESCE((SELECT payload->>'lastName' FROM draft_payload_data), ''),
        COALESCE((SELECT first_name FROM target_profile_data) || ' ' || (SELECT last_name FROM target_profile_data), ''),
        ''::text
    ) as name,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'emails' IS NOT NULL AND jsonb_typeof(payload->'emails') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'emails'))::text[]
                ELSE NULL
            END
        FROM draft_payload_data),
        (SELECT emails_text FROM staff_emails_data),
        ARRAY[]::text[]
    ) as emails_text,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'emails' IS NOT NULL AND jsonb_typeof(payload->'emails') = 'array' AND
                     (payload->>'primaryEmailIndex') IS NOT NULL THEN
                    (ARRAY(SELECT jsonb_array_elements_text(payload->'emails'))::text[])[
                        COALESCE((payload->>'primaryEmailIndex')::integer, 0) + 1
                    ]
                ELSE NULL
            END
        FROM draft_payload_data),
        (SELECT primary_email FROM staff_emails_data),
        NULL::text
    ) as primary_email,
    COALESCE(
        (SELECT (payload->>'primaryEmailIndex')::integer FROM draft_payload_data),
        (SELECT primary_email_index FROM staff_emails_data),
        NULL::integer
    ) as primary_email_index,
    COALESCE(
        (SELECT payload->>'role' FROM draft_payload_data),
        (SELECT role::text FROM target_profile_data),
        'instructional'::text
    ) as role,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        (SELECT active FROM target_profile_data),
        true::boolean
    ) as active,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->>'reqPerDay' IS NOT NULL AND payload->>'reqPerDay' != '' THEN
                    (payload->>'reqPerDay')::integer
                ELSE NULL
            END
        FROM draft_payload_data),
        (SELECT requests_per_day FROM target_profile_data),
        NULL::integer
    ) as requests_per_day,
    COALESCE(
        (SELECT department_id::text FROM primary_department_id_data),
        (SELECT department_id::text FROM profile_departments WHERE profile_id = (SELECT staff_id FROM params) AND is_primary = TRUE AND active = true LIMIT 1),
        NULL::text
    ) as primary_department_id,
    COALESCE(
        CASE 
            WHEN (SELECT department_id FROM primary_department_id_data) IS NOT NULL THEN
                array_position(
                    COALESCE(
                        (SELECT array_agg(dd.department_id::text ORDER BY dd.name)
                         FROM department_mapping_data dd),
                        ARRAY[]::text[]
                    ),
                    (SELECT department_id::text FROM primary_department_id_data)
                ) - 1
            ELSE NULL
        END,
        NULL::integer
    ) as primary_department_index,
    COALESCE(
        (SELECT array_agg(dd.department_id::text ORDER BY dd.name)
         FROM department_mapping_data dd),
        ARRAY[]::text[]
    ) as valid_department_ids,
    COALESCE(
        (SELECT array_agg(cd.cohort_id::text ORDER BY cd.name)
         FROM cohorts_data cd),
        ARRAY[]::text[]
    ) as valid_cohort_ids,
    ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest']::text[] as role_options,
    COALESCE(
        (SELECT draft_version FROM draft_payload_data),
        0::int
    ) as draft_version
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
LEFT JOIN staff_departments_data sdd ON true
LEFT JOIN staff_cohorts_data scd ON true
LEFT JOIN staff_emails_data sed ON true
CROSS JOIN active_departments_data add
CROSS JOIN draft_group_data dgd
CROSS JOIN first_name_resource_data fnrd
CROSS JOIN last_name_resource_data lnrd
CROSS JOIN flag_resource_data frd
CROSS JOIN request_limit_resource_data rlrd
CROSS JOIN first_name_suggestions_data fnsd
CROSS JOIN last_name_suggestions_data lnsd
CROSS JOIN first_names_suggestions_objects fnso
CROSS JOIN last_names_suggestions_objects lnso
CROSS JOIN request_limit_suggestions_data rlsd
CROSS JOIN department_suggestions_data dsd
CROSS JOIN email_suggestions_data esd
$$;
