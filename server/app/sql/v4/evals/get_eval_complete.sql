-- Unified get eval function - handles both new (eval_id = NULL) and detail (eval_id provided)
-- Converted to function with composite types following ARTIFACT.md
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_eval_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_eval_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_eval_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_eval_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_eval_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_get_eval_v4_rubric AS (
    rubric_id uuid,
    name text,
    description text,
    agent_role text,
    generated boolean
);

CREATE TYPE types.q_get_eval_v4_run_rubrics AS (
    run_id uuid,
    rubric_ids uuid[]
);

CREATE TYPE types.q_get_eval_v4_group_rubrics AS (
    group_id uuid,
    rubric_ids uuid[]
);

CREATE TYPE types.q_get_eval_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_eval_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_eval_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean
);

CREATE TYPE types.q_get_eval_v4_available_model_run AS (
    model_run_id uuid,
    created_at timestamptz,
    model_id uuid,
    model_name text,
    profile_id uuid,
    profile_name text,
    agent_id uuid,
    agent_name text,
    persona_id uuid,
    persona_name text,
    actor_type text
);

CREATE TYPE types.q_get_eval_v4_available_group AS (
    group_id uuid,
    name text,
    description text,
    created_at timestamptz,
    member_count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_eval_v4(
    profile_id uuid,
    eval_id uuid DEFAULT NULL,
    available_model_runs_search text DEFAULT NULL,
    available_model_runs_agent_ids uuid[] DEFAULT ARRAY[]::uuid[],
    available_model_runs_page int DEFAULT 1,
    available_model_runs_page_size int DEFAULT 50,
    draft_id uuid DEFAULT NULL,
    agent_search text DEFAULT NULL,
    group_search text DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    eval_exists boolean,
    can_edit boolean,
    disabled_reason text,
    draft_version int,
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_eval_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_eval_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_eval_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_eval_v4_description_resource[],
    -- Single-select resources: active flag
    active_flag_id uuid,
    active_flag_resource types.q_get_eval_v4_flag_resource,
    show_active_flag boolean,
    active_flag_agent_id uuid,
    active_flag_required boolean,
    -- Single-select resources: dynamic flag
    dynamic_flag_id uuid,
    dynamic_flag_resource types.q_get_eval_v4_flag_resource,
    show_dynamic_flag boolean,
    dynamic_flag_agent_id uuid,
    dynamic_flag_required boolean,
    -- Single-select resources: groups flag
    groups_flag_id uuid,
    groups_flag_resource types.q_get_eval_v4_flag_resource,
    show_groups_flag boolean,
    groups_flag_agent_id uuid,
    groups_flag_required boolean,
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_eval_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_eval_v4_department[],
    -- Multi-select resources: agents
    agent_ids uuid[],
    agent_resources types.q_get_eval_v4_agent[],
    show_agents boolean,
    agents_agent_id uuid,
    agents_required boolean,
    agent_suggestions uuid[],
    agents types.q_get_eval_v4_agent[],
    -- Multi-select resources: rubrics
    rubric_ids uuid[],
    rubric_resources types.q_get_eval_v4_rubric[],
    show_rubrics boolean,
    rubrics_agent_id uuid,
    rubrics_required boolean,
    rubric_suggestions uuid[],
    rubrics types.q_get_eval_v4_rubric[],
    -- Run/group selections + rubric mapping
    model_run_ids uuid[],
    group_ids uuid[],
    run_rubrics types.q_get_eval_v4_run_rubrics[],
    group_rubrics types.q_get_eval_v4_group_rubrics[],
    -- Additional eval-specific fields
    available_model_runs types.q_get_eval_v4_available_model_run[],
    available_model_runs_total_count bigint,
    available_model_runs_page int,
    available_model_runs_page_size int,
    available_model_runs_total_pages bigint,
    available_groups types.q_get_eval_v4_available_group[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        eval_id AS eval_id,
        profile_id AS profile_id,
        available_model_runs_search AS available_model_runs_search,
        COALESCE(available_model_runs_agent_ids, ARRAY[]::uuid[]) AS available_model_runs_agent_ids,
        available_model_runs_page AS available_model_runs_page,
        available_model_runs_page_size AS available_model_runs_page_size,
        draft_id AS draft_id,
        COALESCE(NULLIF(agent_search, ''), NULL) AS agent_search,
        COALESCE(NULLIF(group_search, ''), NULL) AS group_search,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check eval existence if eval_id provided
eval_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT eval_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM eval_artifact WHERE id = (SELECT eval_id FROM params))::boolean
        END as eval_exists
),
-- Draft data is now stored in draft_* junction tables, not in payload
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload
    FROM params x
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
draft_version_data AS (
    -- Keep draft_version for client-side expected_version sync to avoid unintended draft forks.
    SELECT d.version as draft_version
    FROM params x
    LEFT JOIN drafts d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
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
-- Conditional: Get eval department data only if eval_id provided
eval_departments_data AS (
    SELECT 
        ed.eval_id,
        ARRAY_AGG(ed.department_id ORDER BY ed.created_at) as department_ids
    FROM params x
    JOIN eval_departments ed ON ed.eval_id = x.eval_id AND ed.active = true
    WHERE x.eval_id IS NOT NULL
    GROUP BY ed.eval_id
),
eval_department_access_check AS (
    SELECT 
        e.id as eval_id,
        CASE 
            WHEN up.role = 'superadmin'::profile_role THEN true
            WHEN EXISTS (
                SELECT 1 FROM eval_departments ed 
                WHERE ed.eval_id = e.id 
                AND ed.active = true 
                AND ed.department_id IN (SELECT department_id FROM user_departments)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM eval_departments ed2 
                WHERE ed2.eval_id = e.id 
                AND ed2.active = true
            ) THEN true
            ELSE false
        END as has_access
    FROM params x
    JOIN eval_artifact e ON e.id = x.eval_id
    CROSS JOIN user_profile up
    WHERE x.eval_id IS NOT NULL
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
        EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
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
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'active' AND df.value = true)
    WHERE EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
),
-- Resource data CTEs - query from eval_* tables or draft_* tables if draft_id provided
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dn.names_id FROM draft_names dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT en.name_id FROM eval_names en WHERE en.eval_id = (SELECT eval_id FROM params) LIMIT 1)
        ) as name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_eval_v4_name_resource 
            FROM (
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 1 as priority
                FROM draft_names dn 
                JOIN names_resource n ON dn.names_id = n.id 
                WHERE dn.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 2 as priority
                FROM eval_names en 
                JOIN names_resource n ON en.name_id = n.id 
                WHERE en.eval_id = (SELECT eval_id FROM params)
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
            (SELECT ed.description_id FROM eval_descriptions ed WHERE ed.eval_id = (SELECT eval_id FROM params) LIMIT 1)
        ) as description_id,
        (
            SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_eval_v4_description_resource 
            FROM (
                SELECT d.id, d.description, COALESCE(d.generated, false) as generated, 1 as priority
                FROM draft_descriptions dd 
                JOIN descriptions_resource d ON dd.descriptions_id = d.id 
                WHERE dd.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT d.id, d.description, COALESCE(d.generated, false) as generated, 2 as priority
                FROM eval_descriptions ed 
                JOIN descriptions_resource d ON ed.description_id = d.id 
                WHERE ed.eval_id = (SELECT eval_id FROM params)
            ) d
            ORDER BY priority
            LIMIT 1
        ) as description_resource
    FROM params
),
-- Name suggestions: linked to evals OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(en.name_id ORDER BY en.created_at DESC)
             FROM (
                 SELECT DISTINCT en.name_id, MAX(en.created_at) as created_at
                 FROM eval_names en
                 JOIN names_resource n ON n.id = en.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE en.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to evals (eval_names junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       COALESCE(n.generated, false) = false
                       OR
                       (
                           COALESCE(n.generated, false) = true
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
                 GROUP BY en.name_id
                 ORDER BY MAX(en.created_at) DESC
                 LIMIT 20
             ) en),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_eval_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_eval_v4_name_resource[]
        ) as names
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
-- Description suggestions: linked to evals OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(ed.description_id ORDER BY ed.created_at DESC)
             FROM (
                 SELECT DISTINCT ed.description_id, MAX(ed.created_at) as created_at
                 FROM eval_descriptions ed
                 JOIN descriptions_resource d ON d.id = ed.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE ed.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       -- Option 1: Linked to evals (eval_descriptions junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       COALESCE(d.generated, false) = false
                       OR
                       (
                           COALESCE(d.generated, false) = true
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
                 GROUP BY ed.description_id
                 ORDER BY MAX(ed.created_at) DESC
                 LIMIT 20
             ) ed),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_eval_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_eval_v4_description_resource[]
        ) as descriptions
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
-- Flag resource data for active flag
active_flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM draft_flags df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.name = 'active' LIMIT 1),
            (SELECT ef.flag_id FROM eval_flags ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = 'active' AND ef.value = TRUE LIMIT 1)
        ) as active_flag_id,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_eval_v4_flag_resource 
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 1 as priority
                FROM draft_flags df 
                JOIN flags_resource f ON df.flags_id = f.id 
                WHERE df.draft_id = (SELECT draft_id FROM params) AND f.name = 'active'
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 2 as priority
                FROM eval_flags ef 
                JOIN flags_resource f ON ef.flag_id = f.id 
                WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = 'active' AND ef.value = TRUE
            ) f
            ORDER BY priority
            LIMIT 1
        ) as active_flag_resource
    FROM params
),
-- Flag resource data for dynamic flag
dynamic_flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM draft_flags df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.name = 'dynamic' LIMIT 1),
            (SELECT ef.flag_id FROM eval_flags ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = 'dynamic' AND ef.value = TRUE LIMIT 1)
        ) as dynamic_flag_id,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_eval_v4_flag_resource 
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 1 as priority
                FROM draft_flags df 
                JOIN flags_resource f ON df.flags_id = f.id 
                WHERE df.draft_id = (SELECT draft_id FROM params) AND f.name = 'dynamic'
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 2 as priority
                FROM eval_flags ef 
                JOIN flags_resource f ON ef.flag_id = f.id 
                WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = 'dynamic' AND ef.value = TRUE
            ) f
            ORDER BY priority
            LIMIT 1
        ) as dynamic_flag_resource
    FROM params
),
-- Flag resource data for groups flag
groups_flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM draft_flags df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.name = 'groups' LIMIT 1),
            (SELECT ef.flag_id FROM eval_flags ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = 'groups' AND ef.value = TRUE LIMIT 1)
        ) as groups_flag_id,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_eval_v4_flag_resource 
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 1 as priority
                FROM draft_flags df 
                JOIN flags_resource f ON df.flags_id = f.id 
                WHERE df.draft_id = (SELECT draft_id FROM params) AND f.name = 'groups'
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 2 as priority
                FROM eval_flags ef 
                JOIN flags_resource f ON ef.flag_id = f.id 
                WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = 'groups' AND ef.value = TRUE
            ) f
            ORDER BY priority
            LIMIT 1
        ) as groups_flag_resource
    FROM params
),
-- Flags (all available flag options for eval artifact type)
flags_data AS (
    SELECT DISTINCT
        f.id,
        f.name,
        f.description,
        f.icon_id,
        COALESCE(f.generated, false) as generated
    FROM flags_resource f
    JOIN artifact_flag_types aft ON f.type = aft.flag_type
    CROSS JOIN params p
    WHERE 
        aft.artifact = 'eval'::artifacts
        AND (
            -- Always include selected flags if they exist
            f.id = (SELECT active_flag_id FROM active_flag_resource_data)
            OR f.id = (SELECT dynamic_flag_id FROM dynamic_flag_resource_data)
            OR f.id = (SELECT groups_flag_id FROM groups_flag_resource_data)
            OR (
                (SELECT active_flag_id FROM active_flag_resource_data) IS NULL
                AND (SELECT dynamic_flag_id FROM dynamic_flag_resource_data) IS NULL
                AND (SELECT groups_flag_id FROM groups_flag_resource_data) IS NULL
            )
        )
    ORDER BY f.name
),
-- Department suggestions: linked to evals with active=true OR same group with generated=true
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(ed.department_id ORDER BY ed.created_at DESC)
             FROM (
                 SELECT DISTINCT ed.department_id, MAX(ed.created_at) as created_at
                 FROM eval_departments ed
                 JOIN departments_resource d ON d.id = ed.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE ed.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'active' AND df.value = true)
                   AND (
                       -- Option 1: Linked to evals with active=true
                       ed.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           ed.generated = true
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
                 GROUP BY ed.department_id
                 ORDER BY MAX(ed.created_at) DESC
                 LIMIT 20
             ) ed),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Agent selection helper CTEs (shared across all agent selections)
eval_department_for_agents AS (
    SELECT ed.department_id
    FROM params p
    JOIN eval_departments ed ON ed.eval_id = p.eval_id AND ed.active = true
    WHERE p.eval_id IS NOT NULL
    LIMIT 1
),
profile_primary_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    WHERE p.eval_id IS NULL
    LIMIT 1
),
selected_department_for_agents AS (
    SELECT 
        COALESCE(
            (SELECT department_id FROM eval_department_for_agents),
            (SELECT department_id FROM profile_primary_department_for_agents)
        ) as department_id
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
              AND ar.artifact = 'eval'::artifacts
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
              AND ar.artifact = 'eval'::artifacts
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
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'descriptions'::resources
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
-- Agent selection for 'flags' resource (for active, dynamic, groups flags)
active_flag_agent_data AS (
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
              AND ar.artifact = 'eval'::artifacts
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
dynamic_flag_agent_data AS (
    SELECT agent_id FROM active_flag_agent_data
),
groups_flag_agent_data AS (
    SELECT agent_id FROM active_flag_agent_data
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
              AND ar.artifact = 'eval'::artifacts
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
-- Valid agents for evals (filtered by artifact='eval')
valid_agents_for_eval_list AS (
    SELECT DISTINCT
        a.id,
        (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), '') as description,
        COALESCE(
            (SELECT ARRAY_AGG(DISTINCT ar.artifact::text)
             FROM agent_tools at
             JOIN resource_tools rt ON rt.tool_id = at.tool_id
             JOIN artifact_resources ar ON ar.resource = rt.resource
             WHERE at.agent_id = a.id
               AND at.active = TRUE),
            ARRAY[]::text[]
        ) as roles
    FROM params x
    JOIN agents_resource a ON EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE 
        EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'eval'::artifacts
        )
        AND (
            (SELECT agent_search FROM params LIMIT 1) IS NULL
            OR LOWER((SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1)) LIKE '%' || LOWER((SELECT agent_search FROM params LIMIT 1)) || '%'
            OR LOWER(COALESCE((SELECT d.description FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), '')) LIKE '%' || LOWER((SELECT agent_search FROM params LIMIT 1)) || '%'
        )
    GROUP BY a.id, (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT d.description FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1)
    HAVING 
        COUNT(*) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
agents_array AS (
    SELECT COALESCE(
        ARRAY_AGG((vae.id, vae.name, vae.description, vae.roles)::types.q_get_eval_v4_agent),
        '{}'::types.q_get_eval_v4_agent[]
    ) as agents,
    COALESCE(ARRAY_AGG(vae.id ORDER BY vae.name), ARRAY[]::uuid[]) as agent_ids
    FROM valid_agents_for_eval_list vae
),
agent_suggestions_data AS (
    SELECT 
        COALESCE((SELECT agent_ids FROM agents_array), ARRAY[]::uuid[]) as agent_suggestions
    FROM params
    LIMIT 1
),
-- Agent selection for multi-select agents
agents_agent_data AS (
    SELECT agent_id FROM name_agent_data LIMIT 1
),
-- Valid rubrics for evals
user_department_ids_for_rubrics AS (
    SELECT ARRAY_AGG(d.department_id) as ids
    FROM params x
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'active' AND df.value = true)
    JOIN profile_departments pd ON d.department_id = pd.department_id AND pd.profile_id = x.profile_id AND pd.active = true
),
valid_rubrics_data AS (
    SELECT DISTINCT
        r.id,
        (SELECT n.name FROM rubric_names rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM rubric_descriptions rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1), '') as description,
        (SELECT ra.artifact::text FROM rubric_artifacts ra WHERE ra.rubric_id = r.id LIMIT 1) as agent_role,
        COALESCE(r.generated, false) as generated
    FROM params x
    JOIN rubrics_resource r ON EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags_resource f ON rf.flag_id = f.id WHERE rf.rubric_id = r.id AND f.name = 'active' AND rf.value = true)
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    CROSS JOIN user_department_ids_for_rubrics udi
    WHERE (
        rd.department_id = ANY(udi.ids)
        OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
    )
),
rubrics_array AS (
    SELECT COALESCE(
        ARRAY_AGG((vr.id, vr.name, vr.description, vr.agent_role, vr.generated)::types.q_get_eval_v4_rubric),
        '{}'::types.q_get_eval_v4_rubric[]
    ) as rubrics,
    COALESCE(ARRAY_AGG(vr.id), ARRAY[]::uuid[]) as rubric_ids
    FROM valid_rubrics_data vr
),
rubric_suggestions_data AS (
    SELECT 
        COALESCE((SELECT rubric_ids FROM rubrics_array), ARRAY[]::uuid[]) as rubric_suggestions
    FROM params
    LIMIT 1
),
-- Agent selection for rubrics
rubrics_agent_data AS (
    SELECT agent_id FROM name_agent_data LIMIT 1
),
-- Eval agent IDs (selected agent IDs for eval)
eval_agent_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT eval_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ea.agent_id ORDER BY ea.created_at)
                 FROM eval_agents ea
                 WHERE ea.eval_id = (SELECT eval_id FROM params) AND ea.active = true),
                ARRAY[]::uuid[]
            )
        END as agent_ids
    FROM params
    LIMIT 1
),
-- Eval department IDs (selected department IDs for eval)
eval_department_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT eval_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ed.department_id ORDER BY ed.created_at)
                 FROM eval_departments ed
                 WHERE ed.eval_id = (SELECT eval_id FROM params) AND ed.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
-- Draft run/group selections (for new evals)
draft_run_ids_data AS (
    SELECT
        COALESCE(ARRAY_AGG(dr.runs_id ORDER BY dr.created_at), ARRAY[]::uuid[]) as run_ids
    FROM params x
    LEFT JOIN draft_runs dr ON dr.draft_id = x.draft_id
),
draft_group_ids_data AS (
    SELECT
        COALESCE(ARRAY_AGG(dg.groups_id ORDER BY dg.created_at), ARRAY[]::uuid[]) as group_ids
    FROM params x
    LEFT JOIN draft_groups dg ON dg.draft_id = x.draft_id
),
-- Eval run/group selections
eval_run_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT eval_id FROM params) IS NULL THEN COALESCE((SELECT run_ids FROM draft_run_ids_data), ARRAY[]::uuid[])
            ELSE COALESCE(
                (SELECT ARRAY_AGG(er.run_id ORDER BY er.created_at)
                 FROM eval_runs er
                 WHERE er.eval_id = (SELECT eval_id FROM params) AND er.active = true),
                ARRAY[]::uuid[]
            )
        END as run_ids
    FROM params
    LIMIT 1
),
eval_group_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT eval_id FROM params) IS NULL THEN COALESCE((SELECT group_ids FROM draft_group_ids_data), ARRAY[]::uuid[])
            ELSE COALESCE(
                (SELECT ARRAY_AGG(eg.group_id ORDER BY eg.created_at)
                 FROM eval_groups eg
                 WHERE eg.eval_id = (SELECT eval_id FROM params) AND eg.active = true),
                ARRAY[]::uuid[]
            )
        END as group_ids
    FROM params
    LIMIT 1
),
-- Eval rubric IDs (selected rubric IDs for eval)
eval_rubric_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT eval_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(DISTINCT rubric_id)
                 FROM (
                     SELECT err.rubric_id, err.created_at
                     FROM eval_runs_rubrics err
                     WHERE err.eval_id = (SELECT eval_id FROM params) AND err.active = true
                     UNION
                     SELECT egr.rubric_id, egr.created_at
                     FROM eval_groups_rubrics egr
                     WHERE egr.eval_id = (SELECT eval_id FROM params) AND egr.active = true
                     ORDER BY created_at
                 ) combined),
                ARRAY[]::uuid[]
            )
        END as rubric_ids
    FROM params
    LIMIT 1
),
-- Eval run/group rubric mappings
eval_run_rubrics_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG((err.run_id, err.rubric_ids)::types.q_get_eval_v4_run_rubrics),
            '{}'::types.q_get_eval_v4_run_rubrics[]
        ) as run_rubrics
    FROM (
        SELECT
            err.run_id,
            ARRAY_AGG(err.rubric_id ORDER BY err.created_at) as rubric_ids
        FROM eval_runs_rubrics err
        WHERE err.eval_id = (SELECT eval_id FROM params) AND err.active = true
        GROUP BY err.run_id
    ) err
),
eval_group_rubrics_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG((egr.group_id, egr.rubric_ids)::types.q_get_eval_v4_group_rubrics),
            '{}'::types.q_get_eval_v4_group_rubrics[]
        ) as group_rubrics
    FROM (
        SELECT
            egr.group_id,
            ARRAY_AGG(egr.rubric_id ORDER BY egr.created_at) as rubric_ids
        FROM eval_groups_rubrics egr
        WHERE egr.eval_id = (SELECT eval_id FROM params) AND egr.active = true
        GROUP BY egr.group_id
    ) egr
),
-- Check for missing tools on required resources
-- IMPORTANT: We check for TOOLS existence (not agents). Tools are required, agents are optional.
-- If no tools exist for a resource, we error. If tools exist but no agent exists, that's fine (manual entry).
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
            WHERE rt.resource = 'descriptions'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'flags'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as flags_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'agents'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as agents_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'rubrics'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as rubrics_has_tools
    FROM params x
),
ui_flags AS (
    SELECT 
        -- Single-select resource flags (based on whether options exist)
        true as show_name,  -- Always show name picker
        true as show_description,  -- Always show description picker
        true as show_active_flag,  -- Flag is a boolean toggle that should be shown
        true as show_dynamic_flag,  -- Flag is a boolean toggle that should be shown
        true as show_groups_flag,  -- Flag is a boolean toggle that should be shown
        -- Multi-select resource flags (based on business logic)
        CASE 
            WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
            ELSE false
        END as show_departments,
        CASE 
            WHEN (SELECT COUNT(*) FROM valid_agents_for_eval_list) > 0 THEN true
            ELSE false
        END as show_agents,
        CASE 
            WHEN (SELECT COUNT(*) FROM valid_rubrics_data) > 0 THEN true
            ELSE false
        END as show_rubrics
    FROM params x
    CROSS JOIN user_profile up
),
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            -- Check if tools exist (not agents). Error only if NO tools exist.
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.descriptions_has_tools THEN 'description' ELSE NULL END,
            CASE WHEN NOT tec.flags_has_tools THEN 'flags' ELSE NULL END,
            CASE WHEN NOT tec.departments_has_tools AND uf.show_departments THEN 'departments' ELSE NULL END,
            CASE WHEN NOT tec.agents_has_tools AND uf.show_agents THEN 'agents' ELSE NULL END,
            CASE WHEN NOT tec.rubrics_has_tools AND uf.show_rubrics THEN 'rubrics' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
),
permissions_data_with_tools AS (
    SELECT 
        edd.department_ids,
        CASE 
            WHEN (SELECT eval_id FROM params) IS NULL THEN
                -- New mode permissions
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role) THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode permissions
                CASE 
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            WHEN (SELECT eval_id FROM params) IS NULL THEN
                -- New mode: always editable if can_edit is true
                NULL::text
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN 
                        NULL::text
                    ELSE 
                        'This eval cannot be edited. You can view the details but cannot make changes.'::text
                END
        END as base_disabled_reason
    FROM params x
    LEFT JOIN eval_departments_data edd ON true
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
-- Available model runs query (adapted from get_eval_detail_complete.sql)
available_model_runs_params AS (
    SELECT 
        available_model_runs_search,
        available_model_runs_agent_ids,
        available_model_runs_page,
        available_model_runs_page_size
    FROM params
),
profile_role_check AS (
    SELECT 
        (SELECT profile_id FROM params) as raw_profile_id,
        CASE 
            WHEN (SELECT profile_id FROM params) IS NULL THEN NULL::uuid
            WHEN (SELECT role FROM user_profile) IN ('admin', 'superadmin', 'instructional') THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)
        END as effective_profile_id
),
runs_base AS (
    SELECT
        r.id as run_id,
        r.created_at,
        rm.model_id,
        rp.profile_id,
        r.agent_id,
        rper.persona_id
    FROM runs r
    LEFT JOIN run_models rm ON rm.run_id = r.id AND rm.active = true
    LEFT JOIN run_profiles rp ON rp.run_id = r.id AND rp.active = true
    LEFT JOIN run_personas rper ON rper.run_id = r.id AND rper.active = true
    WHERE 
        (SELECT effective_profile_id FROM profile_role_check) IS NULL
        OR rp.profile_id = (SELECT effective_profile_id FROM profile_role_check)
),
runs_with_names AS (
    SELECT
        rb.*,
        (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) as model_name,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as profile_name,
        (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = per.id LIMIT 1) as persona_name,
        CASE 
            WHEN rb.agent_id IS NOT NULL THEN 'agent'
            WHEN rb.persona_id IS NOT NULL THEN 'persona'
            ELSE NULL
        END as actor_type
    FROM runs_base rb
    LEFT JOIN models_resource m ON m.id = rb.model_id
    LEFT JOIN profile_artifact p ON p.id = rb.profile_id
    LEFT JOIN agents_resource a ON a.id = rb.agent_id
    LEFT JOIN personas_resource per ON per.id = rb.persona_id
),
runs_filtered AS (
    SELECT *
    FROM runs_with_names rwn
    CROSS JOIN available_model_runs_params amp
    WHERE (
        (amp.available_model_runs_search IS NULL OR amp.available_model_runs_search = '')
        AND (amp.available_model_runs_agent_ids IS NULL 
             OR COALESCE(array_length(amp.available_model_runs_agent_ids, 1), 0) = 0)
    )
    OR (
        amp.available_model_runs_search IS NOT NULL
        AND amp.available_model_runs_search != ''
        AND (
            LOWER(COALESCE(rwn.model_name, '')) LIKE '%' || LOWER(amp.available_model_runs_search) || '%'
            OR LOWER(COALESCE(rwn.agent_name, '')) LIKE '%' || LOWER(amp.available_model_runs_search) || '%'
            OR LOWER(COALESCE(rwn.persona_name, '')) LIKE '%' || LOWER(amp.available_model_runs_search) || '%'
            OR LOWER(COALESCE(rwn.profile_name, '')) LIKE '%' || LOWER(amp.available_model_runs_search) || '%'
        )
        AND (
            amp.available_model_runs_agent_ids IS NULL 
            OR COALESCE(array_length(amp.available_model_runs_agent_ids, 1), 0) = 0
            OR (rwn.agent_id IS NOT NULL AND rwn.agent_id = ANY(amp.available_model_runs_agent_ids))
        )
    )
    OR (
        amp.available_model_runs_agent_ids IS NOT NULL
        AND COALESCE(array_length(amp.available_model_runs_agent_ids, 1), 0) > 0
        AND rwn.agent_id IS NOT NULL 
        AND rwn.agent_id = ANY(amp.available_model_runs_agent_ids)
        AND (amp.available_model_runs_search IS NULL OR amp.available_model_runs_search = '')
    )
),
paginated_runs AS (
    SELECT
        rf.*,
        COUNT(*) OVER() AS total_count
    FROM runs_filtered rf
    CROSS JOIN available_model_runs_params amp
    ORDER BY rf.created_at DESC
    LIMIT (SELECT available_model_runs_page_size FROM available_model_runs_params LIMIT 1)
    OFFSET (SELECT (available_model_runs_page - 1) * available_model_runs_page_size FROM available_model_runs_params LIMIT 1)
),
available_model_runs_array AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (pr.run_id, pr.created_at, pr.model_id, pr.model_name,
                 pr.profile_id, pr.profile_name, pr.agent_id, pr.agent_name,
                 pr.persona_id, pr.persona_name, pr.actor_type
                )::types.q_get_eval_v4_available_model_run
            ),
            '{}'::types.q_get_eval_v4_available_model_run[]
        ) as available_model_runs,
        COALESCE(MAX(pr.total_count), 0) as total_count,
        MAX(amp.available_model_runs_page) as page,
        MAX(amp.available_model_runs_page_size) as page_size,
        CEIL(COALESCE(MAX(pr.total_count), 0)::float / NULLIF(MAX(amp.available_model_runs_page_size), 0)) as total_pages
    FROM paginated_runs pr
    CROSS JOIN available_model_runs_params amp
),
-- Available groups query (filtered by group_search)
groups_base AS (
    SELECT
        g.id as group_id,
        g.created_at,
        COUNT(gr.run_id) as member_count
    FROM groups g
    LEFT JOIN group_runs gr ON gr.group_id = g.id
    GROUP BY g.id, g.created_at
),
groups_filtered AS (
    SELECT *
    FROM groups_base gb
    CROSS JOIN params x
    WHERE (
        x.group_search IS NULL 
        OR x.group_search = ''
        OR LOWER(gb.group_id::text) LIKE '%' || LOWER(x.group_search) || '%'
        OR LOWER(gb.group_id::text) LIKE '%' || LOWER(REPLACE(x.group_search, '-', '')) || '%'
    )
),
available_groups_array AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (gf.group_id, 
                 'Group ' || SUBSTRING(gf.group_id::text, 1, 8),
                 COALESCE(gf.member_count::text, '0') || ' members',
                 gf.created_at,
                 gf.member_count)::types.q_get_eval_v4_available_group
                ORDER BY gf.created_at DESC
            ),
            '{}'::types.q_get_eval_v4_available_group[]
        ) as available_groups
    FROM groups_filtered gf
)
SELECT 
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT eval_exists FROM eval_exists_check) as eval_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    (SELECT draft_version FROM draft_version_data) as draft_version,
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
    COALESCE((SELECT names FROM names_suggestions_objects), ARRAY[]::types.q_get_eval_v4_name_resource[]) as names,
    -- Single-select resources: description
    (SELECT description_id FROM description_resource_data) as description_id,
    drd.description_resource,
    CASE 
        WHEN NOT tec.descriptions_has_tools THEN false
        ELSE uf.show_description
    END as show_description,
    (SELECT agent_id FROM description_agent_data) as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), ARRAY[]::types.q_get_eval_v4_description_resource[]) as descriptions,
    -- Single-select resources: active flag
    (SELECT active_flag_id FROM active_flag_resource_data) as active_flag_id,
    afrd.active_flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE uf.show_active_flag
    END as show_active_flag,
    (SELECT agent_id FROM active_flag_agent_data) as active_flag_agent_id,
    false as active_flag_required,
    -- Single-select resources: dynamic flag
    (SELECT dynamic_flag_id FROM dynamic_flag_resource_data) as dynamic_flag_id,
    dfrd.dynamic_flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE uf.show_dynamic_flag
    END as show_dynamic_flag,
    (SELECT agent_id FROM dynamic_flag_agent_data) as dynamic_flag_agent_id,
    false as dynamic_flag_required,
    -- Single-select resources: groups flag
    (SELECT groups_flag_id FROM groups_flag_resource_data) as groups_flag_id,
    gfrd.groups_flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE uf.show_groups_flag
    END as show_groups_flag,
    (SELECT agent_id FROM groups_flag_agent_data) as groups_flag_agent_id,
    false as groups_flag_required,
    -- Multi-select resources: departments
    COALESCE((SELECT department_ids FROM eval_department_ids_data), ARRAY[]::uuid[]) as department_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_eval_v4_department
            ORDER BY dmd.name
        )
        FROM department_mapping_data dmd
        WHERE dmd.department_id = ANY(COALESCE((SELECT department_ids FROM eval_department_ids_data), ARRAY[]::uuid[]))),
        '{}'::types.q_get_eval_v4_department[]
    ) as department_resources,
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
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_eval_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_eval_v4_department[]
    ) as departments,
    -- Multi-select resources: agents
    COALESCE((SELECT agent_ids FROM eval_agent_ids_data), ARRAY[]::uuid[]) as agent_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (aa.agent_id, aa.name, aa.description, aa.roles)::types.q_get_eval_v4_agent
            ORDER BY aa.name
        )
        FROM (SELECT DISTINCT id as agent_id, name, description, roles FROM valid_agents_for_eval_list WHERE id = ANY(COALESCE((SELECT agent_ids FROM eval_agent_ids_data), ARRAY[]::uuid[]))) aa),
        '{}'::types.q_get_eval_v4_agent[]
    ) as agent_resources,
    CASE 
        WHEN NOT tec.agents_has_tools AND uf.show_agents THEN false
        ELSE uf.show_agents
    END as show_agents,
    (SELECT agent_id FROM agents_agent_data) as agents_agent_id,
    CASE 
        WHEN uf.show_agents THEN true
        ELSE false
    END as agents_required,
    COALESCE((SELECT agent_suggestions FROM agent_suggestions_data), ARRAY[]::uuid[]) as agent_suggestions,
    COALESCE((SELECT agents FROM agents_array), '{}'::types.q_get_eval_v4_agent[]) as agents,
    -- Multi-select resources: rubrics
    COALESCE((SELECT rubric_ids FROM eval_rubric_ids_data), ARRAY[]::uuid[]) as rubric_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (vr.rubric_id, vr.name, vr.description, vr.agent_role, vr.generated)::types.q_get_eval_v4_rubric
            ORDER BY vr.name
        )
        FROM (SELECT DISTINCT id as rubric_id, name, description, agent_role, generated FROM valid_rubrics_data WHERE id = ANY(COALESCE((SELECT rubric_ids FROM eval_rubric_ids_data), ARRAY[]::uuid[]))) vr),
        '{}'::types.q_get_eval_v4_rubric[]
    ) as rubric_resources,
    CASE 
        WHEN NOT tec.rubrics_has_tools AND uf.show_rubrics THEN false
        ELSE uf.show_rubrics
    END as show_rubrics,
    (SELECT agent_id FROM rubrics_agent_data) as rubrics_agent_id,
    CASE 
        WHEN uf.show_rubrics THEN true
        ELSE false
    END as rubrics_required,
    COALESCE((SELECT rubric_suggestions FROM rubric_suggestions_data), ARRAY[]::uuid[]) as rubric_suggestions,
    COALESCE((SELECT rubrics FROM rubrics_array), '{}'::types.q_get_eval_v4_rubric[]) as rubrics,
    -- Run/group selections + rubric mapping
    COALESCE((SELECT run_ids FROM eval_run_ids_data), ARRAY[]::uuid[]) as model_run_ids,
    COALESCE((SELECT group_ids FROM eval_group_ids_data), ARRAY[]::uuid[]) as group_ids,
    COALESCE((SELECT run_rubrics FROM eval_run_rubrics_data), '{}'::types.q_get_eval_v4_run_rubrics[]) as run_rubrics,
    COALESCE((SELECT group_rubrics FROM eval_group_rubrics_data), '{}'::types.q_get_eval_v4_group_rubrics[]) as group_rubrics,
    -- Additional eval-specific fields
    COALESCE((SELECT available_model_runs FROM available_model_runs_array), '{}'::types.q_get_eval_v4_available_model_run[]) as available_model_runs,
    COALESCE((SELECT total_count FROM available_model_runs_array), 0) as available_model_runs_total_count,
    COALESCE((SELECT page FROM available_model_runs_array), 1) as available_model_runs_page,
    COALESCE((SELECT page_size FROM available_model_runs_array), 50) as available_model_runs_page_size,
    COALESCE((SELECT total_pages FROM available_model_runs_array), 0) as available_model_runs_total_pages,
    COALESCE((SELECT available_groups FROM available_groups_array), '{}'::types.q_get_eval_v4_available_group[]) as available_groups
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN draft_group_data dgd
CROSS JOIN draft_version_data dvd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN active_flag_resource_data afrd
CROSS JOIN dynamic_flag_resource_data dfrd
CROSS JOIN groups_flag_resource_data gfrd
CROSS JOIN department_mapping_data dmd
CROSS JOIN agents_array aa
CROSS JOIN rubrics_array ra
CROSS JOIN eval_agent_ids_data eaid
CROSS JOIN eval_department_ids_data edid
CROSS JOIN eval_rubric_ids_data erid
CROSS JOIN eval_run_ids_data erun
CROSS JOIN eval_group_ids_data egrp
CROSS JOIN eval_run_rubrics_data errd
CROSS JOIN eval_group_rubrics_data egrd
LEFT JOIN available_model_runs_array amra ON (
    (SELECT available_model_runs_search FROM params) IS NOT NULL 
    OR (SELECT available_model_runs_agent_ids FROM params) IS NOT NULL
    OR COALESCE(array_length((SELECT available_model_runs_agent_ids FROM params), 1), 0) > 0
)
CROSS JOIN available_groups_array aga
LIMIT 1
$$;
