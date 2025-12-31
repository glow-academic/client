-- Get default eval detail for creation
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

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
            description text
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
    available_model_runs_page_size int DEFAULT 50
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
    available_model_runs_total_pages bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        available_model_runs_search AS available_model_runs_search,
        available_model_runs_agent_ids AS available_model_runs_agent_ids,
        available_model_runs_page AS available_model_runs_page,
        available_model_runs_page_size AS available_model_runs_page_size
),
user_profile AS (
    SELECT 
        role,
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
user_departments_for_agents AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
valid_departments_for_eval AS (
    SELECT DISTINCT d.id, d.title as name, COALESCE(d.description, '') as description
    FROM params x
    JOIN departments d ON d.active = true
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
        a.name,
        COALESCE(a.description, '') as description,
        ARRAY[a.role::text] as roles
    FROM params x
    JOIN agents a ON a.active = true AND a.role = 'grade'::agent_role
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    GROUP BY a.id, a.name, a.description, a.role
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
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
        a.name,
        COALESCE(a.description, '') as description,
        ARRAY[a.role::text] as roles
    FROM params x
    JOIN agents a ON a.active = true
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    GROUP BY a.id, a.name, a.description, a.role
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
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
    JOIN departments d ON d.active = true
    JOIN profile_departments pd ON d.id = pd.department_id AND pd.profile_id = x.profile_id AND pd.active = true
),
valid_rubrics_data AS (
    SELECT DISTINCT
        r.id,
        r.name,
        COALESCE(r.description, '') as description
    FROM params x
    JOIN rubrics r ON r.active = true
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    CROSS JOIN user_department_ids_for_rubrics udi
    WHERE (
        rd.department_id = ANY(udi.ids)
        OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
    )
),
rubrics_array AS (
    SELECT COALESCE(
        ARRAY_AGG((vr.id, vr.name, vr.description)::types.q_get_eval_detail_v4_rubric),
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
        m.name as model_name,
        p.first_name || ' ' || p.last_name as profile_name,
        a.name as agent_name,
        per.name as persona_name,
        CASE 
            WHEN rb.agent_id IS NOT NULL THEN 'agent'
            WHEN rb.persona_id IS NOT NULL THEN 'persona'
            ELSE NULL
        END as actor_type
    FROM runs_base rb
    LEFT JOIN models m ON m.id = rb.model_id
    LEFT JOIN profiles p ON p.id = rb.profile_id
    LEFT JOIN agents a ON a.id = rb.agent_id
    LEFT JOIN personas per ON per.id = rb.persona_id
),
runs_filtered AS (
    SELECT *
    FROM runs_with_names rwn
    CROSS JOIN available_model_runs_params amp
    WHERE (
        (
            amp.available_model_runs_search IS NULL 
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
        )
        OR (
            amp.available_model_runs_agent_ids IS NOT NULL
            AND COALESCE(array_length(amp.available_model_runs_agent_ids, 1), 0) > 0
            AND rwn.agent_id IS NOT NULL 
            AND rwn.agent_id = ANY(amp.available_model_runs_agent_ids)
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
    WHERE (
        amp.available_model_runs_search IS NOT NULL 
        AND amp.available_model_runs_search != ''
    )
    OR (
        amp.available_model_runs_agent_ids IS NOT NULL
        AND COALESCE(array_length(amp.available_model_runs_agent_ids, 1), 0) > 0
    )
)
SELECT 
    up.actor_name::text as actor_name,
    NULL::uuid as eval_id,
    ''::text as name,
    ''::text as description,
    ARRAY[]::text[] as agent_ids,
    ARRAY[]::text[] as model_run_ids,
    true as active,
    false as dynamic,
    ARRAY[]::text[] as department_ids,
    COALESCE((SELECT ids FROM valid_dept_ids), ARRAY[]::text[]) as valid_department_ids,
    COALESCE(da.departments, '{}'::types.q_get_eval_detail_v4_department[]) as departments,
    COALESCE(eaa.eval_agents, '{}'::types.q_get_eval_detail_v4_agent[]) as eval_agents,
    COALESCE(eaa.eval_agent_ids, ARRAY[]::text[]) as valid_eval_agent_ids,
    COALESCE(aa.agents, '{}'::types.q_get_eval_detail_v4_agent[]) as agents,
    COALESCE(aa.agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    COALESCE(ra.rubrics, '{}'::types.q_get_eval_detail_v4_rubric[]) as rubrics,
    COALESCE(ra.rubric_ids, ARRAY[]::text[]) as valid_rubric_ids,
    false as use_groups,
    CASE WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true ELSE false END as can_edit,
    CASE WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true ELSE false END as can_delete,
    COALESCE(amra.available_model_runs, '{}'::types.q_get_eval_detail_v4_available_model_run[]) as available_model_runs,
    COALESCE(amra.total_count, 0) as available_model_runs_total_count,
    COALESCE(amra.page, 1) as available_model_runs_page,
    COALESCE(amra.page_size, 50) as available_model_runs_page_size,
    COALESCE(amra.total_pages, 0) as available_model_runs_total_pages
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
$$;

COMMIT;
