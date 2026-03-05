-- List all models with provider info and usage counts
-- Resource-first: only touches model_artifact + model's own junctions + resource tables
-- No cross-entity artifact tables (provider_artifact, etc.)
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_list_models_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_models_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_list_models_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_models_v4_model AS (
    model_id uuid,
    name text,
    description text,
    is_inactive boolean,
    image_model boolean,
    updated_at timestamptz,
    provider_id uuid,
    department_ids text[],
    active_agent_count bigint
);

-- Filter option type: value/label/count (names resolved in SQL, no Python hydration needed)
CREATE TYPE types.q_list_models_v4_option AS (
    value text,
    label text,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_models_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    filter_provider_ids uuid[] DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    filter_agent_ids uuid[] DEFAULT NULL,
    provider_search text DEFAULT NULL,
    department_search text DEFAULT NULL,
    agent_search text DEFAULT NULL,
    page_size int DEFAULT 1000,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    models types.q_list_models_v4_model[],
    provider_options types.q_list_models_v4_option[],
    department_options types.q_list_models_v4_option[],
    agent_options types.q_list_models_v4_option[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT departments_id
    FROM params x
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
-- Pre-aggregate department IDs per model
model_departments_data AS (
    SELECT
        md.model_id,
        ARRAY_AGG(md.departments_id::text ORDER BY md.created_at) as department_ids
    FROM model_departments_junction md
    GROUP BY md.model_id
),
-- Provider ID per model
model_providers_data AS (
    SELECT
        mpj.model_id,
        mpj.providers_id as provider_id
    FROM model_providers_junction mpj
    WHERE mpj.active = true
),
-- Active agent count per model (via agent_models_junction)
agent_usage AS (
    SELECT
        amj.models_id,
        COUNT(DISTINCT amj.agent_id)::bigint as active_agent_count
    FROM agent_models_junction amj
    WHERE amj.active = true
    GROUP BY amj.models_id
),
-- Agent IDs per model (for filtering)
model_agents_data AS (
    SELECT
        amj.models_id,
        ARRAY_AGG(DISTINCT amj.agent_id) as agent_ids
    FROM agent_models_junction amj
    WHERE amj.active = true
    GROUP BY amj.models_id
),
-- Determine if model is an image model (has 'image' output modality)
image_model_check AS (
    SELECT
        mm.model_id,
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as image_model
    FROM model_modalities_junction mm
    JOIN modalities_resource mr ON mr.id = mm.modalities_id
    WHERE mr.modality = 'image' AND mr.is_input = false AND mm.active = true
    GROUP BY mm.model_id
),
model_data_base AS (
    SELECT
        m.id as model_id,
        (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON mn.names_id = n.id WHERE mn.model_id = m.id LIMIT 1) as model_name,
        (SELECT d.description FROM model_descriptions_junction md JOIN descriptions_resource d ON md.descriptions_id = d.id WHERE md.model_id = m.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM model_flags_junction mf JOIN flags_resource f ON mf.flags_id = f.id WHERE mf.model_id = m.id AND f.name = 'model_active' AND f.value = TRUE) as active,
        COALESCE(imc.image_model, false) as image_model,
        m.updated_at,
        mpd.provider_id,
        COALESCE(mdd.department_ids, NULL) as department_ids,
        COALESCE(au.active_agent_count, 0)::bigint as active_agent_count,
        COALESCE(mad.agent_ids, ARRAY[]::uuid[]) as agent_ids
    FROM model_artifact m
    LEFT JOIN model_departments_data mdd ON mdd.model_id = m.id
    LEFT JOIN model_providers_data mpd ON mpd.model_id = m.id
    LEFT JOIN agent_usage au ON au.models_id = m.id
    LEFT JOIN image_model_check imc ON imc.model_id = m.id
    LEFT JOIN model_agents_data mad ON mad.models_id = m.id
    LEFT JOIN model_departments_junction md ON md.model_id = m.id AND md.departments_id IN (SELECT departments_id FROM user_departments)
    GROUP BY m.id,
        (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON mn.names_id = n.id WHERE mn.model_id = m.id LIMIT 1),
        (SELECT d.description FROM model_descriptions_junction md JOIN descriptions_resource d ON md.descriptions_id = d.id WHERE md.model_id = m.id LIMIT 1),
        EXISTS (SELECT 1 FROM model_flags_junction mf JOIN flags_resource f ON mf.flags_id = f.id WHERE mf.model_id = m.id AND f.name = 'model_active' AND f.value = TRUE),
        imc.image_model, m.updated_at, mpd.provider_id, mdd.department_ids, au.active_agent_count, mad.agent_ids
    HAVING COUNT(md.model_id) > 0 OR NOT EXISTS (
        SELECT 1 FROM model_departments_junction md2 WHERE md2.model_id = m.id
    )
),
model_data AS (
    SELECT mdb.*
    FROM model_data_base mdb
),
-- Apply server-side filters
filtered_models AS (
    SELECT md.*
    FROM model_data md
    WHERE
        -- Search filter: match name or description (case-insensitive)
        (search IS NULL OR LOWER(md.model_name) LIKE '%' || LOWER(search) || '%' OR LOWER(md.description) LIKE '%' || LOWER(search) || '%')
        -- Provider filter: model must have one of the selected providers
        AND (filter_provider_ids IS NULL OR md.provider_id = ANY(filter_provider_ids))
        -- Department filter: model must belong to at least one selected department
        AND (filter_department_ids IS NULL OR md.department_ids && filter_department_ids::text[])
        -- Agent filter: model must be used by one of the selected agents
        AND (filter_agent_ids IS NULL OR md.agent_ids && filter_agent_ids)
),
-- Count total filtered results (before pagination)
filtered_count AS (
    SELECT COUNT(*)::bigint as total_count FROM filtered_models
),
-- Paginate filtered results
paginated_models AS (
    SELECT fm.*
    FROM filtered_models fm
    ORDER BY fm.updated_at DESC NULLS LAST
    LIMIT page_size OFFSET page_offset
),
-- Provider options with names resolved in SQL
all_provider_ids AS (
    SELECT DISTINCT provider_id
    FROM model_data
    WHERE provider_id IS NOT NULL
),
provider_option_data AS (
    SELECT
        pr.id::text as value,
        (SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON n.id = pn.names_id WHERE pn.provider_id = pp.provider_id LIMIT 1) as label,
        (SELECT COUNT(*) FROM model_data md WHERE md.provider_id = pr.id) as count
    FROM providers_resource pr
    JOIN provider_providers_junction pp ON pp.providers_id = pr.id
    WHERE pr.id IN (SELECT provider_id FROM all_provider_ids)
      AND (provider_search IS NULL OR LOWER((SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON n.id = pn.names_id WHERE pn.provider_id = pp.provider_id LIMIT 1)) LIKE '%' || LOWER(provider_search) || '%')
),
-- Department options with names resolved in SQL
department_option_data AS (
    SELECT
        dr.id::text as value,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON n.id = dn.names_id WHERE dn.department_id = dd.department_id LIMIT 1) as label,
        (SELECT COUNT(*) FROM model_data) as count
    FROM departments_resource dr
    JOIN department_departments_junction dd ON dd.department_id = dr.id
    WHERE dr.id IN (SELECT departments_id FROM user_departments)
      AND (department_search IS NULL OR LOWER((SELECT n.name FROM department_names_junction dn JOIN names_resource n ON n.id = dn.names_id WHERE dn.department_id = dd.department_id LIMIT 1)) LIKE '%' || LOWER(department_search) || '%')
),
-- Agent options with names resolved in SQL
all_agent_ids AS (
    SELECT DISTINCT unnest(agent_ids) as agent_id
    FROM model_data
    WHERE agent_ids IS NOT NULL AND array_length(agent_ids, 1) > 0
),
agent_option_data AS (
    SELECT
        aa.id::text as value,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON n.id = an.names_id WHERE an.agent_id = aa.id LIMIT 1) as label,
        (SELECT COUNT(*) FROM model_data md WHERE aa.id = ANY(md.agent_ids)) as count
    FROM agent_artifact aa
    WHERE aa.id IN (SELECT agent_id FROM all_agent_ids)
      AND (agent_search IS NULL OR LOWER((SELECT n.name FROM agent_names_junction an JOIN names_resource n ON n.id = an.names_id WHERE an.agent_id = aa.id LIMIT 1)) LIKE '%' || LOWER(agent_search) || '%')
)
SELECT
    -- Aggregate paginated models
    COALESCE(
        (SELECT ARRAY_AGG(
            (pm.model_id, pm.model_name, pm.description,
             NOT pm.active, pm.image_model, pm.updated_at,
             pm.provider_id, pm.department_ids,
             pm.active_agent_count
            )::types.q_list_models_v4_model
            ORDER BY pm.updated_at DESC NULLS LAST
        ) FROM paginated_models pm),
        '{}'::types.q_list_models_v4_model[]
    ) as models,
    -- Provider options (names resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (pod.value, pod.label, pod.count)::types.q_list_models_v4_option
            ORDER BY pod.label
        ) FROM provider_option_data pod),
        '{}'::types.q_list_models_v4_option[]
    ) as provider_options,
    -- Department options (names resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.value, dod.label, dod.count)::types.q_list_models_v4_option
            ORDER BY dod.label
        ) FROM department_option_data dod),
        '{}'::types.q_list_models_v4_option[]
    ) as department_options,
    -- Agent options (names resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (aod.value, aod.label, aod.count)::types.q_list_models_v4_option
            ORDER BY aod.label
        ) FROM agent_option_data aod),
        '{}'::types.q_list_models_v4_option[]
    ) as agent_options,
    -- Total count of filtered models (before pagination)
    (SELECT total_count FROM filtered_count) as total_count
FROM params
$$;
