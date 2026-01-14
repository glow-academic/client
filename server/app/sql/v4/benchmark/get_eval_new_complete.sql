-- Get default eval detail for creation
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
        WHERE proname = 'api_get_eval_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_eval_new_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Note: We reuse q_get_eval_detail_v4_* types from detail endpoint
-- Types are created in get_eval_detail_complete.sql, so we don't drop/recreate them here
-- We only ensure they exist (they will be created by get_eval_detail if not present)

-- 3) Recreate shared types if they don't exist (they're created in get_eval_detail_complete.sql)
-- Use DO block to create only if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'q_get_eval_detail_v4_department' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')) THEN
        CREATE TYPE types.q_get_eval_detail_v4_department AS (
            department_id uuid,
            name text,
            description text
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'q_get_eval_detail_v4_agent' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')) THEN
        CREATE TYPE types.q_get_eval_detail_v4_agent AS (
            agent_id uuid,
            name text,
            description text,
            roles text[]
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'q_get_eval_detail_v4_rubric' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')) THEN
        CREATE TYPE types.q_get_eval_detail_v4_rubric AS (
            rubric_id uuid,
            name text,
            description text,
            agent_role text
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'q_get_eval_detail_v4_available_model_run' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')) THEN
        CREATE TYPE types.q_get_eval_detail_v4_available_model_run AS (
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
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'q_get_eval_detail_v4_available_group' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')) THEN
        CREATE TYPE types.q_get_eval_detail_v4_available_group AS (
            group_id uuid,
            name text,
            description text,
            created_at timestamptz,
            member_count bigint
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'q_get_eval_detail_v4_rubric_grade_agent' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')) THEN
        CREATE TYPE types.q_get_eval_detail_v4_rubric_grade_agent AS (
            rubric_grade_agent_id uuid,
            rubric_id uuid,
            rubric_name text,
            agent_id uuid,
            agent_name text
        );
    END IF;
END $$;

-- 4) Recreate function (reuse composite types from detail endpoint)
CREATE OR REPLACE FUNCTION api_get_eval_new_v4(
    profile_id uuid,
    available_model_runs_search text DEFAULT NULL,
    available_model_runs_agent_ids uuid[] DEFAULT ARRAY[]::uuid[],
    available_model_runs_page int DEFAULT 1,
    available_model_runs_page_size int DEFAULT 50,
    draft_id uuid DEFAULT NULL,
    agent_search text DEFAULT NULL,
    group_search text DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    eval_id uuid,
    name text,
    description text,
    agent_ids text[],
    model_run_ids text[],
    active boolean,
    dynamic boolean,
    department_ids text[],
    valid_department_ids text[],
    departments types.q_get_eval_detail_v4_department[],
    eval_agents types.q_get_eval_detail_v4_agent[],
    valid_eval_agent_ids text[],
    agents types.q_get_eval_detail_v4_agent[],
    valid_agent_ids text[],
    rubrics types.q_get_eval_detail_v4_rubric[],
    valid_rubric_ids text[],
    use_groups boolean,
    can_edit boolean,
    can_delete boolean,
    available_model_runs types.q_get_eval_detail_v4_available_model_run[],
    available_model_runs_total_count bigint,
    available_model_runs_page int,
    available_model_runs_page_size int,
    available_model_runs_total_pages bigint,
    available_groups types.q_get_eval_detail_v4_available_group[],
    draft_version int,
    rubric_grade_agent_pairs jsonb,
    rubric_grade_agent_active_states jsonb,
    rubric_grade_agent_positions jsonb,
    run_rubric_grade_agents jsonb,
    group_rubric_grade_agents jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        available_model_runs_search AS available_model_runs_search,
        COALESCE(available_model_runs_agent_ids, ARRAY[]::uuid[]) AS available_model_runs_agent_ids,
        available_model_runs_page AS available_model_runs_page,
        available_model_runs_page_size AS available_model_runs_page_size,
        draft_id AS draft_id,
        COALESCE(NULLIF(agent_search, ''), NULL) AS agent_search,
        COALESCE(NULLIF(group_search, ''), NULL) AS group_search
),
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    
    LIMIT 1
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
user_departments_for_agents AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
valid_departments_for_eval AS (
    SELECT DISTINCT d.id, (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name, COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM params x
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = true)
    JOIN profile_departments pd ON pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true
),
valid_dept_ids AS (
    SELECT ARRAY_AGG(id::text) as ids FROM valid_departments_for_eval
),
departments_array AS (
    SELECT COALESCE(
        ARRAY_AGG((vd.id, vd.name, vd.description)::types.q_get_eval_detail_v4_department),
        '{}'::types.q_get_eval_detail_v4_department[]
    ) as departments
    FROM valid_departments_for_eval vd
),
valid_eval_agents_list AS (
    SELECT 
        a.id,
        (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1),
        COALESCE((SELECT (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), '') as description,
        ARRAY[COALESCE(NULL::artifacts::text, '')] as roles
    FROM params x
    JOIN agents_resource a ON EXISTS (SELECT 1 FROM agent_flags af WHERE af.agent_id = a.id AND af.type = 'active'::type_agent_flags AND af.value = true)
    
    
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    GROUP BY a.id, (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), NULL::artifacts
    HAVING 
        COUNT(NULL::uuid) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
eval_agents_array AS (
    SELECT COALESCE(
        ARRAY_AGG((vea.id, vea.name, vea.description, vea.roles)::types.q_get_eval_detail_v4_agent),
        '{}'::types.q_get_eval_detail_v4_agent[]
    ) as eval_agents,
    COALESCE(ARRAY_AGG(vea.id::text ORDER BY vea.name), ARRAY[]::text[]) as eval_agent_ids
    FROM valid_eval_agents_list vea
),
valid_agents_for_eval_list AS (
    SELECT 
        a.id,
        (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1),
        COALESCE((SELECT (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), '') as description,
        ARRAY[COALESCE(NULL::artifacts::text, '')] as roles
    FROM params x
    JOIN agents_resource a ON EXISTS (SELECT 1 FROM agent_flags af WHERE af.agent_id = a.id AND af.type = 'active'::type_agent_flags AND af.value = true)
    
    
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
        ARRAY_AGG((vae.id, vae.name, vae.description, vae.roles)::types.q_get_eval_detail_v4_agent),
        '{}'::types.q_get_eval_detail_v4_agent[]
    ) as agents,
    COALESCE(ARRAY_AGG(vae.id::text ORDER BY vae.name), ARRAY[]::text[]) as agent_ids
    FROM valid_agents_for_eval_list vae
),
user_department_ids_for_rubrics AS (
    SELECT ARRAY_AGG(id) as ids
    FROM params x
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = true)
    JOIN profile_departments pd ON d.id = pd.department_id AND pd.profile_id = x.profile_id AND pd.active = true
),
valid_rubrics_data AS (
    SELECT DISTINCT
        r.id,
        (SELECT n.name FROM rubric_names rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1),
        COALESCE((SELECT d.description FROM rubric_descriptions rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1), '') as description,
        (SELECT ra.artifact::text FROM rubric_artifacts ra WHERE ra.rubric_id = r.id LIMIT 1) as agent_role  -- Derive from rubric_artifacts junction
    FROM params x
    JOIN rubrics_resource r ON EXISTS (SELECT 1 FROM rubric_flags rf WHERE rf.rubric_id = r.id AND rf.type = 'active'::type_rubric_flags AND rf.value = true)
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    CROSS JOIN user_department_ids_for_rubrics udi
    WHERE (
        rd.department_id = ANY(udi.ids)
        OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
    )
),
rubrics_array AS (
    SELECT COALESCE(
        ARRAY_AGG((vr.id, vr.name, vr.description, vr.agent_role)::types.q_get_eval_detail_v4_rubric),
        '{}'::types.q_get_eval_detail_v4_rubric[]
    ) as rubrics,
    COALESCE(ARRAY_AGG(vr.id::text), ARRAY[]::text[]) as rubric_ids
    FROM valid_rubrics_data vr
),
-- Available model runs query (same as detail endpoint)
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
        -- Show all runs when both filters are null/empty (default case)
        (
            (amp.available_model_runs_search IS NULL OR amp.available_model_runs_search = '')
            AND (amp.available_model_runs_agent_ids IS NULL 
                 OR COALESCE(array_length(amp.available_model_runs_agent_ids, 1), 0) = 0)
        )
        OR (
            -- Apply search filter when search term is provided
            amp.available_model_runs_search IS NOT NULL
            AND amp.available_model_runs_search != ''
            AND (
                LOWER(COALESCE(rwn.model_name, '')) LIKE '%' || LOWER(amp.available_model_runs_search) || '%'
                OR LOWER(COALESCE(rwn.agent_name, '')) LIKE '%' || LOWER(amp.available_model_runs_search) || '%'
                OR LOWER(COALESCE(rwn.persona_name, '')) LIKE '%' || LOWER(amp.available_model_runs_search) || '%'
                OR LOWER(COALESCE(rwn.profile_name, '')) LIKE '%' || LOWER(amp.available_model_runs_search) || '%'
            )
            -- If agent_ids filter is also provided, combine filters (run must match search AND be in agent_ids)
            AND (
                amp.available_model_runs_agent_ids IS NULL 
                OR COALESCE(array_length(amp.available_model_runs_agent_ids, 1), 0) = 0
                OR (rwn.agent_id IS NOT NULL AND rwn.agent_id = ANY(amp.available_model_runs_agent_ids))
            )
        )
        OR (
            -- Apply agent_ids filter when agent_ids are provided (without search)
            amp.available_model_runs_agent_ids IS NOT NULL
            AND COALESCE(array_length(amp.available_model_runs_agent_ids, 1), 0) > 0
            AND rwn.agent_id IS NOT NULL 
            AND rwn.agent_id = ANY(amp.available_model_runs_agent_ids)
            -- Only apply agent_ids filter if search is null/empty
            AND (amp.available_model_runs_search IS NULL OR amp.available_model_runs_search = '')
        )
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
                )::types.q_get_eval_detail_v4_available_model_run
            ),
            '{}'::types.q_get_eval_detail_v4_available_model_run[]
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
                 gf.member_count)::types.q_get_eval_detail_v4_available_group
                ORDER BY gf.created_at DESC
            ),
            '{}'::types.q_get_eval_detail_v4_available_group[]
        ) as available_groups
    FROM groups_filtered gf
)
SELECT 
    up.actor_name::text as actor_name,
    NULL::uuid as eval_id,
    -- Default values for new eval (merged with draft payload if draft_id provided)
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        ''::text
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        ''::text
    ) as description,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'agent_ids' IS NOT NULL AND jsonb_typeof(payload->'agent_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'agent_ids'))
                ELSE NULL
            END
        FROM draft_payload_data),
        ARRAY[]::text[]
    ) as agent_ids,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'model_run_ids' IS NOT NULL AND jsonb_typeof(payload->'model_run_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'model_run_ids'))
                ELSE NULL
            END
        FROM draft_payload_data),
        ARRAY[]::text[]
    ) as model_run_ids,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        true::boolean
    ) as active,
    COALESCE(
        (SELECT (payload->>'dynamic')::boolean FROM draft_payload_data),
        false::boolean
    ) as dynamic,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))
                ELSE NULL
            END
        FROM draft_payload_data),
        ARRAY[]::text[]
    ) as department_ids,
    COALESCE((SELECT ids FROM valid_dept_ids), ARRAY[]::text[]) as valid_department_ids,
    COALESCE(da.departments, '{}'::types.q_get_eval_detail_v4_department[]) as departments,
    COALESCE(eaa.eval_agents, '{}'::types.q_get_eval_detail_v4_agent[]) as eval_agents,
    COALESCE(eaa.eval_agent_ids, ARRAY[]::text[]) as valid_eval_agent_ids,
    COALESCE(aa.agents, '{}'::types.q_get_eval_detail_v4_agent[]) as agents,
    COALESCE(aa.agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    COALESCE(ra.rubrics, '{}'::types.q_get_eval_detail_v4_rubric[]) as rubrics,
    COALESCE(ra.rubric_ids, ARRAY[]::text[]) as valid_rubric_ids,
    COALESCE(
        (SELECT (payload->>'use_groups')::boolean FROM draft_payload_data),
        false::boolean
    ) as use_groups,
    CASE WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true ELSE false END as can_edit,
    CASE WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true ELSE false END as can_delete,
    COALESCE(amra.available_model_runs, '{}'::types.q_get_eval_detail_v4_available_model_run[]) as available_model_runs,
    COALESCE(amra.total_count, 0) as available_model_runs_total_count,
    COALESCE(amra.page, 1) as available_model_runs_page,
    COALESCE(amra.page_size, 50) as available_model_runs_page_size,
    COALESCE(amra.total_pages, 0) as available_model_runs_total_pages,
    COALESCE(aga.available_groups, '{}'::types.q_get_eval_detail_v4_available_group[]) as available_groups,
    COALESCE((SELECT version FROM draft_payload_data), 0) as draft_version,
    COALESCE(
        (SELECT payload->'rubric_grade_agent_pairs' FROM draft_payload_data),
        '[]'::jsonb
    ) as rubric_grade_agent_pairs,
    COALESCE(
        (SELECT payload->'rubric_grade_agent_active_states' FROM draft_payload_data),
        '{}'::jsonb
    ) as rubric_grade_agent_active_states,
    COALESCE(
        (SELECT payload->'rubric_grade_agent_positions' FROM draft_payload_data),
        '[]'::jsonb
    ) as rubric_grade_agent_positions,
    COALESCE(
        (SELECT payload->'run_rubric_grade_agents' FROM draft_payload_data),
        '{}'::jsonb
    ) as run_rubric_grade_agents,
    COALESCE(
        (SELECT payload->'group_rubric_grade_agents' FROM draft_payload_data),
        '{}'::jsonb
    ) as group_rubric_grade_agents
FROM user_profile up
CROSS JOIN valid_dept_ids vdi
CROSS JOIN departments_array da
CROSS JOIN eval_agents_array eaa
CROSS JOIN agents_array aa
CROSS JOIN rubrics_array ra
LEFT JOIN available_model_runs_array amra ON (
    (SELECT available_model_runs_search FROM params) IS NOT NULL 
    OR (SELECT available_model_runs_agent_ids FROM params) IS NOT NULL
    OR COALESCE(array_length((SELECT available_model_runs_agent_ids FROM params), 1), 0) > 0
)
CROSS JOIN available_groups_array aga
$$;