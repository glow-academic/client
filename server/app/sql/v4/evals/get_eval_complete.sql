-- Unified get eval function - handles both new (eval_id = NULL) and detail (eval_id provided)
-- Converted to function with composite types following RETURN_STRUCTURE_GUIDELINES.md
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
    agent_role text
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
    -- Multi-select resources: rubrics (complex - handled separately)
    rubric_ids uuid[],
    rubric_resources types.q_get_eval_v4_rubric[],
    show_rubrics boolean,
    rubrics_agent_id uuid,
    rubrics_required boolean,
    rubric_suggestions uuid[],
    rubrics types.q_get_eval_v4_rubric[],
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
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'active' AND df.value = true)
    WHERE EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.department_id AND pd.profile_id = x.profile_id AND pd.active = true)
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
-- Flag resource data for active flag
active_flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM draft_flags df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT ef.flag_id FROM eval_flags ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = 'active' AND ef.value = TRUE LIMIT 1)
        ) as active_flag_id,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_eval_v4_flag_resource 
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 1 as priority
                FROM draft_flags df 
                JOIN flags_resource f ON df.flags_id = f.id 
                WHERE df.draft_id = (SELECT draft_id FROM params)
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
            (SELECT df.flags_id FROM draft_flags df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT ef.flag_id FROM eval_flags ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = 'dynamic' AND ef.value = TRUE LIMIT 1)
        ) as dynamic_flag_id,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_eval_v4_flag_resource 
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 1 as priority
                FROM draft_flags df 
                JOIN flags_resource f ON df.flags_id = f.id 
                WHERE df.draft_id = (SELECT draft_id FROM params)
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
            (SELECT df.flags_id FROM draft_flags df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
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
                WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = 'groups' AND f.name = 'groups' AND ef.value = TRUE
            ) f
            ORDER BY priority
            LIMIT 1
        ) as groups_flag_resource
    FROM params
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
-- Valid agents for evals (filtered by artifact='grade')
valid_agents_for_eval_list AS (
    SELECT 
        a.id,
        (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1),
        COALESCE((SELECT (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), '') as description,
        ARRAY[COALESCE(NULL::artifacts::text, '')] as roles
    FROM params x
    JOIN agents_resource a ON EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
    
    
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE 
        (SELECT agent_search FROM params LIMIT 1) IS NULL
        OR LOWER((SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1)) LIKE '%' || LOWER((SELECT agent_search FROM params LIMIT 1)) || '%'
        OR LOWER(COALESCE((SELECT (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), '')) LIKE '%' || LOWER((SELECT agent_search FROM params LIMIT 1)) || '%'
    GROUP BY a.id, (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), NULL::artifacts
    HAVING 
        COUNT(NULL::uuid) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
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
-- Valid rubrics for evals
user_department_ids_for_rubrics AS (
    SELECT ARRAY_AGG(id) as ids
    FROM params x
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
    JOIN profile_departments pd ON d.id = pd.department_id AND pd.profile_id = x.profile_id AND pd.active = true
),
valid_rubrics_data AS (
    SELECT DISTINCT
        r.id,
        (SELECT n.name FROM rubric_names rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1),
        COALESCE((SELECT d.description FROM rubric_descriptions rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1), '') as description,
        (SELECT ra.artifact::text FROM rubric_artifacts ra WHERE ra.rubric_id = r.id LIMIT 1) as agent_role
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
        ARRAY_AGG((vr.id, vr.name, vr.description, vr.agent_role)::types.q_get_eval_v4_rubric),
        '{}'::types.q_get_eval_v4_rubric[]
    ) as rubrics,
    COALESCE(ARRAY_AGG(vr.id), ARRAY[]::uuid[]) as rubric_ids
    FROM valid_rubrics_data vr
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
),
-- Eval agent IDs (selected agent IDs for eval)
eval_agent_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT eval_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ea.agent_id ORDER BY ea.created_at)
                 FROM eval_agents ea
                 WHERE ea.eval_id = (SELECT eval_id FROM params)),
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
)
SELECT 
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT eval_exists FROM eval_exists_check) as eval_exists,
    CASE WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true ELSE false END as can_edit,
    NULL::text as disabled_reason,
    dgd.group_id,
    -- Single-select resources: name
    (SELECT name_id FROM name_resource_data) as name_id,
    nrd.name_resource,
    true::boolean as show_name,
    NULL::uuid as name_agent_id,
    true::boolean as name_required,
    ARRAY[]::uuid[] as name_suggestions,
    ARRAY[]::types.q_get_eval_v4_name_resource[] as names,
    -- Single-select resources: description
    (SELECT description_id FROM description_resource_data) as description_id,
    drd.description_resource,
    true::boolean as show_description,
    NULL::uuid as description_agent_id,
    false::boolean as description_required,
    ARRAY[]::uuid[] as description_suggestions,
    ARRAY[]::types.q_get_eval_v4_description_resource[] as descriptions,
    -- Single-select resources: active flag
    (SELECT active_flag_id FROM active_flag_resource_data) as active_flag_id,
    afrd.active_flag_resource,
    true::boolean as show_active_flag,
    NULL::uuid as active_flag_agent_id,
    false::boolean as active_flag_required,
    -- Single-select resources: dynamic flag
    (SELECT dynamic_flag_id FROM dynamic_flag_resource_data) as dynamic_flag_id,
    dfrd.dynamic_flag_resource,
    true::boolean as show_dynamic_flag,
    NULL::uuid as dynamic_flag_agent_id,
    false::boolean as dynamic_flag_required,
    -- Single-select resources: groups flag
    (SELECT groups_flag_id FROM groups_flag_resource_data) as groups_flag_id,
    gfrd.groups_flag_resource,
    true::boolean as show_groups_flag,
    NULL::uuid as groups_flag_agent_id,
    false::boolean as groups_flag_required,
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
        WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
        ELSE false
    END as show_departments,
    NULL::uuid as departments_agent_id,
    false::boolean as departments_required,
    ARRAY[]::uuid[] as department_suggestions,
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
        WHEN (SELECT COUNT(*) FROM valid_agents_for_eval_list) > 0 THEN true
        ELSE false
    END as show_agents,
    NULL::uuid as agents_agent_id,
    false::boolean as agents_required,
    ARRAY[]::uuid[] as agent_suggestions,
    COALESCE((SELECT agents FROM agents_array), '{}'::types.q_get_eval_v4_agent[]) as agents,
    -- Multi-select resources: rubrics
    ARRAY[]::uuid[] as rubric_ids,
    ARRAY[]::types.q_get_eval_v4_rubric[] as rubric_resources,
    CASE 
        WHEN (SELECT COUNT(*) FROM valid_rubrics_data) > 0 THEN true
        ELSE false
    END as show_rubrics,
    NULL::uuid as rubrics_agent_id,
    false::boolean as rubrics_required,
    ARRAY[]::uuid[] as rubric_suggestions,
    COALESCE((SELECT rubrics FROM rubrics_array), '{}'::types.q_get_eval_v4_rubric[]) as rubrics,
    -- Additional eval-specific fields
    COALESCE((SELECT available_model_runs FROM available_model_runs_array), '{}'::types.q_get_eval_v4_available_model_run[]) as available_model_runs,
    COALESCE((SELECT total_count FROM available_model_runs_array), 0) as available_model_runs_total_count,
    COALESCE((SELECT page FROM available_model_runs_array), 1) as available_model_runs_page,
    COALESCE((SELECT page_size FROM available_model_runs_array), 50) as available_model_runs_page_size,
    COALESCE((SELECT total_pages FROM available_model_runs_array), 0) as available_model_runs_total_pages,
    COALESCE((SELECT available_groups FROM available_groups_array), '{}'::types.q_get_eval_v4_available_group[]) as available_groups
FROM user_profile up
CROSS JOIN draft_group_data dgd
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
LEFT JOIN available_model_runs_array amra ON (
    (SELECT available_model_runs_search FROM params) IS NOT NULL 
    OR (SELECT available_model_runs_agent_ids FROM params) IS NOT NULL
    OR COALESCE(array_length((SELECT available_model_runs_agent_ids FROM params), 1), 0) > 0
)
CROSS JOIN available_groups_array aga
LIMIT 1
$$;
