-- Unified get profile function - handles both new (target_profile_id = NULL) and detail (target_profile_id provided)
-- Converted to function with composite types following ARTIFACT.md pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_profile_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profile_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_profile_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_profile_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_profile_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_profile_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_profile_v4_email_resource AS (
    id uuid,
    email text,
    generated boolean
);

CREATE TYPE types.q_get_profile_v4_request_limit_resource AS (
    id uuid,
    requests_per_day integer,
    generated boolean
);

CREATE TYPE types.q_get_profile_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_profile_v4(
    profile_id uuid,
    target_profile_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    profile_exists boolean,
    can_edit boolean,
    disabled_reason text,
    group_id uuid,
    -- Profile ID (for audit logging)
    profile_id uuid,
    -- Role (selected)
    role text,
    -- Role options
    role_options text[],
    -- Single-select resources: first_name
    first_name_id uuid,
    first_name_resource types.q_get_profile_v4_name_resource,
    show_first_name boolean,
    first_name_agent_id uuid,
    first_name_required boolean,
    first_name_suggestions uuid[],
    first_names types.q_get_profile_v4_name_resource[],
    -- Single-select resources: last_name
    last_name_id uuid,
    last_name_resource types.q_get_profile_v4_name_resource,
    show_last_name boolean,
    last_name_agent_id uuid,
    last_name_required boolean,
    last_name_suggestions uuid[],
    last_names types.q_get_profile_v4_name_resource[],
    -- Multi-select resources: emails
    email_ids uuid[],
    email_resources types.q_get_profile_v4_email_resource[],
    show_emails boolean,
    emails_agent_id uuid,
    emails_required boolean,
    email_suggestions uuid[],
    emails types.q_get_profile_v4_email_resource[],
    -- Single-select resources: request_limit
    request_limit_id uuid,
    request_limit_resource types.q_get_profile_v4_request_limit_resource,
    show_request_limit boolean,
    request_limit_agent_id uuid,
    request_limit_required boolean,
    request_limit_suggestions uuid[],
    request_limits types.q_get_profile_v4_request_limit_resource[],
    -- Single-select resources: flag
    active_flag_id uuid,
    flag_resource types.q_get_profile_v4_flag_resource,
    show_flag boolean,
    flag_agent_id uuid,
    flag_required boolean,
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_profile_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_profile_v4_department[],
    -- Multi-select resources: cohorts
    cohort_ids uuid[],
    cohort_resources types.q_get_profile_v4_cohort[],
    show_cohorts boolean,
    cohorts_agent_id uuid,
    cohorts_required boolean,
    cohort_suggestions uuid[],
    cohorts types.q_get_profile_v4_cohort[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id,
           target_profile_id AS target_profile_id,
           draft_id AS draft_id
),
-- Conditional: Only check profile existence if target_profile_id provided
profile_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT target_profile_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM profile_artifact WHERE id = (SELECT target_profile_id FROM params))::boolean
        END as profile_exists
),
resolve_current_profile_id AS (
    SELECT profile_id AS resolved_profile_id FROM params
),
resolve_target_profile_id AS (
    -- Use target_profile_id if provided, otherwise NULL (new mode)
    SELECT 
        CASE 
            WHEN (SELECT target_profile_id FROM params) IS NOT NULL 
            THEN (SELECT target_profile_id FROM params)
            ELSE NULL::uuid
        END as resolved_target_profile_id
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
target_profile_role_data AS (
    SELECT 
        CASE 
            WHEN (SELECT resolved_target_profile_id FROM resolve_target_profile_id) IS NULL THEN NULL::text
            ELSE (
                SELECT r.role::text
                FROM profile_roles pr
                JOIN roles_resource r ON pr.role_id = r.id
                WHERE pr.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)
                  AND pr.active = true
                LIMIT 1
            )
        END as role
    FROM params
    LIMIT 1
),
role_options_data AS (
    SELECT 
        CASE 
            WHEN up.role = 'superadmin'::profile_role THEN
                ARRAY(
                    SELECT r.role::text
                    FROM roles_resource r
                    WHERE r.active = true
                      AND r.role IN ('superadmin'::profile_role, 'admin'::profile_role, 'instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role)
                    ORDER BY array_position(ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest']::text[], r.role::text)
                )
            WHEN up.role = 'admin'::profile_role THEN
                ARRAY(
                    SELECT r.role::text
                    FROM roles_resource r
                    WHERE r.active = true
                      AND r.role IN ('admin'::profile_role, 'instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role)
                    ORDER BY array_position(ARRAY['admin', 'instructional', 'member', 'guest']::text[], r.role::text)
                )
            ELSE
                ARRAY(
                    SELECT r.role::text
                    FROM roles_resource r
                    WHERE r.active = true
                      AND r.role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role)
                    ORDER BY array_position(ARRAY['instructional', 'member', 'guest']::text[], r.role::text)
                )
        END as role_options
    FROM user_profile up
    LIMIT 1
),
-- Get group_id from target profile or current profile
group_id_data AS (
    SELECT 
        COALESCE(
            (SELECT d.group_id FROM drafts d WHERE d.id = (SELECT draft_id FROM params)),
            (SELECT p.group_id FROM profile_artifact p WHERE p.id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)),
            (SELECT p.group_id FROM profile_artifact p WHERE p.id = (SELECT resolved_profile_id FROM resolve_current_profile_id))
        ) as group_id
    FROM params
    LIMIT 1
),
-- First name resource data
first_name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dn.names_id FROM draft_names dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pn.name_id FROM profile_names pn WHERE pn.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id) AND pn.type = 'first' LIMIT 1),
            NULL::uuid
        ) as first_name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_profile_v4_name_resource
            FROM (
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 1 as priority
                FROM draft_names dn
                JOIN names_resource n ON n.id = dn.names_id
                WHERE dn.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 2 as priority
                FROM profile_names pn
                JOIN names_resource n ON n.id = pn.name_id
                WHERE pn.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id) AND pn.type = 'first'
            ) n
            ORDER BY priority
            LIMIT 1
        ) as first_name_resource
    FROM params
),
-- Last name resource data
last_name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dn.names_id FROM draft_names dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pn.name_id FROM profile_names pn WHERE pn.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id) AND pn.type = 'last' LIMIT 1),
            NULL::uuid
        ) as last_name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_profile_v4_name_resource
            FROM (
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 1 as priority
                FROM draft_names dn
                JOIN names_resource n ON n.id = dn.names_id
                WHERE dn.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 2 as priority
                FROM profile_names pn
                JOIN names_resource n ON n.id = pn.name_id
                WHERE pn.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id) AND pn.type = 'last'
            ) n
            ORDER BY priority
            LIMIT 1
        ) as last_name_resource
    FROM params
),
-- First name suggestions: linked to profiles with active=true OR same group with generated=true
first_name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pn.name_id ORDER BY pn.created_at DESC)
             FROM (
                 SELECT DISTINCT pn.name_id, MAX(pn.created_at) as created_at
                 FROM profile_names pn
                 JOIN names_resource n ON n.id = pn.name_id
                 CROSS JOIN group_id_data gid
                 WHERE pn.type = 'first'
                   AND pn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to profiles (profile_names junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true
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
                                 AND gr.group_id = gid.group_id
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
    LIMIT 1
),
first_names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_profile_v4_name_resource
                    ORDER BY array_position(fns.first_name_suggestions, n.id)
                )
                FROM first_name_suggestions_data fns
                CROSS JOIN LATERAL unnest(fns.first_name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_profile_v4_name_resource[]
        ) as first_names
    FROM params
    LIMIT 1
),
-- Last name suggestions: linked to profiles with active=true OR same group with generated=true
last_name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pn.name_id ORDER BY pn.created_at DESC)
             FROM (
                 SELECT DISTINCT pn.name_id, MAX(pn.created_at) as created_at
                 FROM profile_names pn
                 JOIN names_resource n ON n.id = pn.name_id
                 CROSS JOIN group_id_data gid
                 WHERE pn.type = 'last'
                   AND pn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to profiles (profile_names junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true
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
                                 AND gr.group_id = gid.group_id
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
    LIMIT 1
),
last_names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_profile_v4_name_resource
                    ORDER BY array_position(lns.last_name_suggestions, n.id)
                )
                FROM last_name_suggestions_data lns
                CROSS JOIN LATERAL unnest(lns.last_name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_profile_v4_name_resource[]
        ) as last_names
    FROM params
    LIMIT 1
),
-- Email IDs (selected email IDs for profile)
email_ids_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(de.emails_id ORDER BY de.created_at)
             FROM draft_emails de
             WHERE de.draft_id = (SELECT draft_id FROM params)
               AND de.active = true),
            (SELECT ARRAY_AGG(pe.email_id ORDER BY pe.is_primary DESC, pe.created_at)
             FROM profile_emails pe
             WHERE pe.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)
               AND pe.active = true),
            ARRAY[]::uuid[]
        ) as email_ids
    FROM params
    LIMIT 1
),
-- Email resources (selected emails filtered by email_ids)
email_resources_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (e.id, e.email, COALESCE(e.generated, false))::types.q_get_profile_v4_email_resource
                ORDER BY e.email
            )
            FROM emails_resource e
            CROSS JOIN email_ids_data eid
            WHERE e.id = ANY(eid.email_ids)),
            ARRAY[]::types.q_get_profile_v4_email_resource[]
        ) as email_resources
    FROM params
    LIMIT 1
),
-- Email suggestions: linked to profiles with active=true OR same group with generated=true
email_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pe.email_id ORDER BY pe.created_at DESC)
             FROM (
                 SELECT DISTINCT pe.email_id, MAX(pe.created_at) as created_at
                 FROM profile_emails pe
                 JOIN emails_resource e ON e.id = pe.email_id
                 CROSS JOIN group_id_data gid
                 WHERE pe.active = true
                   AND e.email IS NOT NULL
                   AND e.email != ''
                   AND (
                       -- Option 1: Linked to profiles (profile_emails junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true
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
                                 AND gr.group_id = gid.group_id
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
    LIMIT 1
),
-- Emails (all available email options)
emails_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (e.id, e.email, COALESCE(e.generated, false))::types.q_get_profile_v4_email_resource
                ORDER BY e.email
            )
            FROM emails_resource e
            WHERE e.active = true),
            ARRAY[]::types.q_get_profile_v4_email_resource[]
        ) as emails
    FROM params
    LIMIT 1
),
-- Request limit resource data
request_limit_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT drl.request_limits_id
             FROM draft_request_limits drl
             WHERE drl.draft_id = (SELECT draft_id FROM params)
             LIMIT 1),
            (SELECT prl.request_limit_id
             FROM profile_request_limits prl
             WHERE prl.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)
               AND prl.active = true
             ORDER BY prl.created_at DESC
             LIMIT 1),
            NULL::uuid
        ) as request_limit_id,
        (
            SELECT ROW(rl.id, rl.requests_per_day, COALESCE(rl.generated, false))::types.q_get_profile_v4_request_limit_resource
            FROM (
                SELECT rl.id, rl.requests_per_day, COALESCE(rl.generated, false) as generated, 1 as priority
                FROM draft_request_limits drl
                JOIN request_limits_resource rl ON rl.id = drl.request_limits_id
                WHERE drl.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT rl.id, rl.requests_per_day, COALESCE(rl.generated, false) as generated, 2 as priority
                FROM profile_request_limits prl
                JOIN request_limits_resource rl ON rl.id = prl.request_limit_id
                WHERE prl.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)
                  AND prl.active = true
            ) rl
            ORDER BY priority
            LIMIT 1
        ) as request_limit_resource
    FROM params
),
-- Request limit suggestions: linked to profiles with active=true OR same group with generated=true
request_limit_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(rl.id ORDER BY rl.created_at DESC)
             FROM request_limits_resource rl
             CROSS JOIN group_id_data gid
             WHERE (
                 -- Option 1: Linked to profiles (profile_request_limits junction table means it's validated/used)
                 EXISTS (
                     SELECT 1 FROM profile_request_limits prl
                     WHERE prl.request_limit_id = rl.id
                       AND prl.active = true
                 )
                 OR
                 -- Option 2: OR linked to same group with generated=true
                 (
                     rl.generated = true
                     AND EXISTS (
                         SELECT 1 FROM calls c
                         JOIN message_calls mc ON mc.call_id = c.id
                         JOIN message_runs mr ON mr.message_id = mc.message_id
                         JOIN group_runs gr ON gr.run_id = mr.run_id
                         WHERE c.id = rl.call_id
                           AND gr.group_id = gid.group_id
                     )
                 )
             )
             LIMIT 20),
            ARRAY[]::uuid[]
        ) as request_limit_suggestions
    FROM params
    LIMIT 1
),
-- Request limits (all available request limit options)
request_limits_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (rl.id, rl.requests_per_day, COALESCE(rl.generated, false))::types.q_get_profile_v4_request_limit_resource
                ORDER BY rl.requests_per_day
            )
            FROM request_limits_resource rl
            WHERE rl.active = true),
            ARRAY[]::types.q_get_profile_v4_request_limit_resource[]
        ) as request_limits
    FROM params
    LIMIT 1
),
-- Active flag resource data
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id
             FROM draft_flags df
             WHERE df.draft_id = (SELECT draft_id FROM params)
             LIMIT 1),
            (SELECT pf.flag_id
             FROM profile_flags pf
             JOIN flags_resource f ON pf.flag_id = f.id
             WHERE pf.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)
               AND f.name = 'active'
               AND pf.value = true
             LIMIT 1),
            NULL::uuid
        ) as active_flag_id,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_profile_v4_flag_resource
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 1 as priority
                FROM draft_flags df
                JOIN flags_resource f ON df.flags_id = f.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 2 as priority
                FROM profile_flags pf
                JOIN flags_resource f ON pf.flag_id = f.id
                WHERE pf.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)
                  AND f.name = 'active'
                  AND pf.value = true
            ) f
            ORDER BY priority
            LIMIT 1
        ) as flag_resource
    FROM params
),
-- Department mapping data (only active departments user is linked to)
department_mapping_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.department_id LIMIT 1), '') as description,
        COALESCE(pd.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN departments_resource d ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'active' AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
    LEFT JOIN profile_departments pd ON pd.department_id = d.id AND pd.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id) AND pd.active = true
),
-- Department IDs (selected department IDs for profile)
department_ids_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(dd.departments_id ORDER BY dd.created_at)
             FROM draft_departments dd
             WHERE dd.draft_id = (SELECT draft_id FROM params)
               AND dd.active = true),
            (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at)
             FROM profile_departments pd
             WHERE pd.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)
               AND pd.active = true),
            ARRAY[]::uuid[]
        ) as department_ids
    FROM params
    LIMIT 1
),
-- Department resources (selected departments filtered by department_ids)
department_resources_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_profile_v4_department
                ORDER BY dmd.name
            )
            FROM department_mapping_data dmd
            CROSS JOIN department_ids_data did
            WHERE dmd.department_id = ANY(did.department_ids)),
            ARRAY[]::types.q_get_profile_v4_department[]
        ) as department_resources
    FROM params
    LIMIT 1
),
-- Department suggestions: linked to profiles with active=true OR same group with generated=true
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(d.id ORDER BY d.created_at DESC)
             FROM departments_resource d
             CROSS JOIN group_id_data gid
             WHERE EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'active' AND df.value = true)
               AND (
                   -- Option 1: Linked to profiles (profile_departments junction table means it's validated/used)
                   EXISTS (
                       SELECT 1 FROM profile_departments pd
                       WHERE pd.department_id = d.id
                         AND pd.active = true
                   )
                   OR
                   -- Option 2: OR linked to same group with generated=true
                   (
                       d.generated = true
                       AND EXISTS (
                           SELECT 1 FROM calls c
                           JOIN message_calls mc ON mc.call_id = c.id
                           JOIN message_runs mr ON mr.message_id = mc.message_id
                           JOIN group_runs gr ON gr.run_id = mr.run_id
                           WHERE c.id = d.call_id
                             AND gr.group_id = gid.group_id
                       )
                   )
               )
             LIMIT 20),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    LIMIT 1
),
-- Cohorts mapping data (only active cohorts)
cohort_mapping_data AS (
    SELECT 
        c.id as cohort_id,
        (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM cohort_descriptions cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), '') as description,
        COALESCE(pc.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN cohort_artifact c ON EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'active' AND cf.value = true)
    LEFT JOIN profile_cohorts pc ON pc.cohort_id = c.id AND pc.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id) AND pc.active = true
),
-- Cohort IDs (selected cohort IDs for profile)
cohort_ids_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(dc.cohorts_id ORDER BY dc.created_at)
             FROM draft_cohorts dc
             WHERE dc.draft_id = (SELECT draft_id FROM params)
               AND dc.active = true),
            (SELECT ARRAY_AGG(pc.cohort_id ORDER BY pc.created_at)
             FROM profile_cohorts pc
             WHERE pc.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)
               AND pc.active = true),
            ARRAY[]::uuid[]
        ) as cohort_ids
    FROM params
    LIMIT 1
),
-- Cohort resources (selected cohorts filtered by cohort_ids)
cohort_resources_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (cmd.cohort_id, cmd.name, cmd.description, cmd.generated)::types.q_get_profile_v4_cohort
                ORDER BY cmd.name
            )
            FROM cohort_mapping_data cmd
            CROSS JOIN cohort_ids_data cid
            WHERE cmd.cohort_id = ANY(cid.cohort_ids)),
            ARRAY[]::types.q_get_profile_v4_cohort[]
        ) as cohort_resources
    FROM params
    LIMIT 1
),
-- Cohort suggestions: linked to profiles with active=true OR same group with generated=true
cohort_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(c.id ORDER BY c.created_at DESC)
             FROM cohort_artifact c
             CROSS JOIN group_id_data gid
             WHERE EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'active' AND cf.value = true)
               AND (
                   -- Option 1: Linked to profiles (profile_cohorts junction table means it's validated/used)
                   EXISTS (
                       SELECT 1 FROM profile_cohorts pc
                       WHERE pc.cohort_id = c.id
                         AND pc.active = true
                   )
                   OR
                   -- Option 2: OR linked to same group with generated=true (cohorts don't have call_id, so skip this check)
                   false
               )
             LIMIT 20),
            ARRAY[]::uuid[]
        ) as cohort_suggestions
    FROM params
    LIMIT 1
),
-- Cohorts (all available cohort options - only active cohorts)
cohorts_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (cmd.cohort_id, cmd.name, cmd.description, cmd.generated)::types.q_get_profile_v4_cohort
                ORDER BY cmd.name
            )
            FROM cohort_mapping_data cmd),
            ARRAY[]::types.q_get_profile_v4_cohort[]
        ) as cohorts
    FROM params
    LIMIT 1
),
-- UI flags
ui_flags AS (
    SELECT 
        -- Single-select resource flags (based on whether options exist)
        true as show_first_name,  -- Always show first name picker
        true as show_last_name,  -- Always show last name picker
        true as show_emails,  -- Always show emails picker
        true as show_request_limit,  -- Always show request limit picker
        true as show_flag,  -- Flag is a boolean toggle that should be shown
        -- Multi-select resource flags (based on business logic)
        CASE 
            WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
            ELSE false
        END as show_departments,
        CASE 
            WHEN (SELECT COUNT(*) FROM cohort_mapping_data) > 0 THEN true
            ELSE false
        END as show_cohorts
    FROM params x
    CROSS JOIN user_profile up
),
-- Primary department for agent selection
primary_department_id_data AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.is_primary = TRUE AND pd.active = true
    WHERE x.target_profile_id IS NULL
    LIMIT 1
),
selected_department_for_agents AS (
    SELECT 
        COALESCE(
            (SELECT department_id FROM profile_departments pd WHERE pd.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id) AND pd.is_primary = TRUE AND pd.active = true LIMIT 1),
            (SELECT department_id FROM primary_department_id_data)
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
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'profile'::artifacts
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
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resources
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
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'profile'::artifacts
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
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resources
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
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'profile'::artifacts
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
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'emails'::resources
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
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'profile'::artifacts
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
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'request_limits'::resources
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
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'profile'::artifacts
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
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'flags'::resources
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
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'profile'::artifacts
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
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
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
-- Agent selection for 'cohorts' resource (cohorts don't have agents, return NULL)
cohorts_agent_data AS (
    SELECT NULL::uuid as agent_id
),
-- Check for missing tools on required resources (after all agent selection CTEs and ui_flags)
-- IMPORTANT: We check for TOOLS existence (not agents). Tools are required, agents are optional.
-- If no tools exist for a resource, we error. If tools exist but no agent exists, that's fine (manual entry).
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'emails'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
        ) as emails_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'request_limits'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
        ) as request_limits_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'flags'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
        ) as flags_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
        ) as departments_has_tools
    FROM params x
),
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            -- Check if tools exist (not agents). Error only if NO tools exist.
            CASE WHEN NOT tec.names_has_tools THEN 'first_name' ELSE NULL END,
            CASE WHEN NOT tec.names_has_tools THEN 'last_name' ELSE NULL END,
            CASE WHEN NOT tec.departments_has_tools AND uf.show_departments THEN 'departments' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
),
permissions_data_with_tools AS (
    SELECT 
        CASE 
            WHEN (SELECT target_profile_id FROM params) IS NULL THEN
                -- New mode permissions
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN (SELECT department_id FROM primary_department_id_data) IS NOT NULL THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode permissions - check role hierarchy
                CASE 
                    WHEN up.role = 'superadmin'::profile_role THEN true
                    WHEN EXISTS (
                        SELECT 1 FROM profile_roles pr_j 
                        JOIN roles_resource r ON pr_j.role_id = r.id 
                        WHERE pr_j.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)
                          AND (
                              (up.role = 'admin'::profile_role AND r.role IN ('admin'::profile_role, 'instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role))
                              OR (up.role = 'instructional'::profile_role AND r.role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role))
                              OR (up.role = 'member'::profile_role AND r.role IN ('member'::profile_role, 'guest'::profile_role))
                              OR (up.role = 'guest'::profile_role AND r.role = 'guest'::profile_role)
                          )
                    ) THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            WHEN (SELECT target_profile_id FROM params) IS NULL THEN
                -- New mode: always editable if can_edit is true
                NULL::text
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN NOT EXISTS (SELECT 1 FROM profile_artifact WHERE id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)) THEN
                        'Profile not found or you do not have permission to view it'::text
                    WHEN up.role = 'superadmin'::profile_role THEN 
                        NULL::text
                    WHEN EXISTS (
                        SELECT 1 FROM profile_roles pr_j 
                        JOIN roles_resource r ON pr_j.role_id = r.id 
                        WHERE pr_j.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)
                          AND (
                              (up.role = 'admin'::profile_role AND r.role IN ('admin'::profile_role, 'instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role))
                              OR (up.role = 'instructional'::profile_role AND r.role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role))
                              OR (up.role = 'member'::profile_role AND r.role IN ('member'::profile_role, 'guest'::profile_role))
                              OR (up.role = 'guest'::profile_role AND r.role = 'guest'::profile_role)
                          )
                    ) THEN 
                        NULL::text
                    ELSE 
                        'You do not have permission to edit this profile'::text
                END
        END as base_disabled_reason
    FROM params x
    CROSS JOIN user_profile up
),
permissions_final AS (
    SELECT 
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
)
SELECT
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT profile_exists FROM profile_exists_check) as profile_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    (SELECT group_id FROM group_id_data) as group_id,
    -- Profile ID (for audit logging)
    (SELECT resolved_target_profile_id FROM resolve_target_profile_id) as profile_id,
    -- Role
    (SELECT role FROM target_profile_role_data) as role,
    COALESCE((SELECT role_options FROM role_options_data), ARRAY[]::text[]) as role_options,
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
    COALESCE((SELECT first_names FROM first_names_suggestions_objects), ARRAY[]::types.q_get_profile_v4_name_resource[]) as first_names,
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
    COALESCE((SELECT last_names FROM last_names_suggestions_objects), ARRAY[]::types.q_get_profile_v4_name_resource[]) as last_names,
    -- Multi-select resources: emails
    COALESCE((SELECT email_ids FROM email_ids_data), ARRAY[]::uuid[]) as email_ids,
    COALESCE((SELECT email_resources FROM email_resources_data), ARRAY[]::types.q_get_profile_v4_email_resource[]) as email_resources,
    uf.show_emails,
    (SELECT agent_id FROM emails_agent_data) as emails_agent_id,
    false as emails_required,
    COALESCE((SELECT email_suggestions FROM email_suggestions_data), ARRAY[]::uuid[]) as email_suggestions,
    COALESCE((SELECT emails FROM emails_data), ARRAY[]::types.q_get_profile_v4_email_resource[]) as emails,
    -- Single-select resources: request_limit
    (SELECT request_limit_id FROM request_limit_resource_data) as request_limit_id,
    (SELECT request_limit_resource FROM request_limit_resource_data) as request_limit_resource,
    uf.show_request_limit,
    (SELECT agent_id FROM request_limit_agent_data) as request_limit_agent_id,
    false as request_limit_required,
    COALESCE((SELECT request_limit_suggestions FROM request_limit_suggestions_data), ARRAY[]::uuid[]) as request_limit_suggestions,
    COALESCE((SELECT request_limits FROM request_limits_data), ARRAY[]::types.q_get_profile_v4_request_limit_resource[]) as request_limits,
    -- Single-select resources: flag
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    (SELECT flag_resource FROM flag_resource_data) as flag_resource,
    uf.show_flag,
    (SELECT agent_id FROM flag_agent_data) as flag_agent_id,
    false as flag_required,
    -- Multi-select resources: departments
    COALESCE((SELECT department_ids FROM department_ids_data), ARRAY[]::uuid[]) as department_ids,
    COALESCE((SELECT department_resources FROM department_resources_data), ARRAY[]::types.q_get_profile_v4_department[]) as department_resources,
    CASE 
        WHEN NOT tec.departments_has_tools AND uf.show_departments THEN false
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
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_profile_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_profile_v4_department[]
    ) as departments,
    -- Multi-select resources: cohorts
    COALESCE((SELECT cohort_ids FROM cohort_ids_data), ARRAY[]::uuid[]) as cohort_ids,
    COALESCE((SELECT cohort_resources FROM cohort_resources_data), ARRAY[]::types.q_get_profile_v4_cohort[]) as cohort_resources,
    uf.show_cohorts,
    (SELECT agent_id FROM cohorts_agent_data) as cohorts_agent_id,
    false as cohorts_required,
    COALESCE((SELECT cohort_suggestions FROM cohort_suggestions_data), ARRAY[]::uuid[]) as cohort_suggestions,
    COALESCE((SELECT cohorts FROM cohorts_data), ARRAY[]::types.q_get_profile_v4_cohort[]) as cohorts
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN target_profile_role_data tprd
CROSS JOIN role_options_data rod
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN group_id_data gid
CROSS JOIN first_name_resource_data fnrd
CROSS JOIN last_name_resource_data lnrd
CROSS JOIN first_name_suggestions_data fnsd
CROSS JOIN last_name_suggestions_data lnsd
CROSS JOIN first_names_suggestions_objects fnso
CROSS JOIN last_names_suggestions_objects lnso
CROSS JOIN email_ids_data eid
CROSS JOIN email_resources_data erd
CROSS JOIN email_suggestions_data esd
CROSS JOIN emails_data ed
CROSS JOIN request_limit_resource_data rlrd
CROSS JOIN request_limit_suggestions_data rlsd
CROSS JOIN request_limits_data rld
CROSS JOIN flag_resource_data frd
CROSS JOIN department_ids_data did
CROSS JOIN department_resources_data drd
CROSS JOIN department_suggestions_data dsd
CROSS JOIN cohort_ids_data cid
CROSS JOIN cohort_resources_data crd
CROSS JOIN cohort_suggestions_data csd
CROSS JOIN cohorts_data cd
$$;
