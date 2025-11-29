-- Query model_runs for eval selection with filters
-- Parameters: 
--   $1 = profile_id (uuid or "guest-profile-id")
--   $2 = start_date (timestamp | NULL)
--   $3 = end_date (timestamp | NULL)
--   $4 = model_ids (uuid[] | NULL)
--   $5 = agent_ids (uuid[] | NULL)
--   $6 = persona_ids (uuid[] | NULL)
--   $7 = agent_type (text | NULL) - 'agent' or 'persona' to filter type
--   $8 = search (text | NULL)
--   $9 = page (int, default 1)
--   $10 = page_size (int, default 50)
-- Returns: JSONB object with paginated model_runs and mappings

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
profile_role_check AS (
    SELECT 
        (SELECT resolved_profile_id FROM resolve_profile_id) as raw_profile_id,
        CASE 
            WHEN (SELECT resolved_profile_id FROM resolve_profile_id) IS NULL THEN NULL::uuid
            WHEN (SELECT role FROM profiles WHERE id = (SELECT resolved_profile_id FROM resolve_profile_id)) IN ('admin', 'superadmin', 'instructional') THEN NULL::uuid
            ELSE (SELECT resolved_profile_id FROM resolve_profile_id)
        END as effective_profile_id
),
model_runs_base AS (
    SELECT
        mr.id as model_run_id,
        mr.created_at,
        mrm.model_id,
        mrp.profile_id,
        mra.agent_id,
        mrper.persona_id
    FROM model_runs mr
    LEFT JOIN model_run_models mrm ON mrm.model_run_id = mr.id AND mrm.active = true
    LEFT JOIN model_run_profiles mrp ON mrp.model_run_id = mr.id AND mrp.active = true
    LEFT JOIN model_run_agents mra ON mra.model_run_id = mr.id AND mra.active = true
    LEFT JOIN model_run_personas mrper ON mrper.model_run_id = mr.id AND mrper.active = true
    WHERE 
        -- Date filters (optional)
        ($2::timestamp IS NULL OR mr.created_at >= $2::timestamp)
        AND ($3::timestamp IS NULL OR mr.created_at <= $3::timestamp)
        -- Profile filter (specific user) - only if role is not admin/superadmin/instructional
        AND (
            (SELECT effective_profile_id FROM profile_role_check) IS NULL
            OR mrp.profile_id = (SELECT effective_profile_id FROM profile_role_check)
        )
),
model_runs_with_names AS (
    SELECT
        mrb.*,
        m.name as model_name,
        p.first_name || ' ' || p.last_name as profile_name,
        a.name as agent_name,
        per.name as persona_name,
        CASE 
            WHEN mrb.agent_id IS NOT NULL THEN 'agent'
            WHEN mrb.persona_id IS NOT NULL THEN 'persona'
            ELSE NULL
        END as actor_type
    FROM model_runs_base mrb
    LEFT JOIN models m ON m.id = mrb.model_id
    LEFT JOIN profiles p ON p.id = mrb.profile_id
    LEFT JOIN agents a ON a.id = mrb.agent_id
    LEFT JOIN personas per ON per.id = mrb.persona_id
),
-- Apply filters
model_runs_filtered AS (
    SELECT *
    FROM model_runs_with_names
    WHERE (
        -- Model filter
        ($4::uuid[] IS NULL OR COALESCE(array_length($4::uuid[], 1), 0) = 0 OR model_id = ANY($4::uuid[]))
        -- Agent filter
        AND ($5::uuid[] IS NULL OR COALESCE(array_length($5::uuid[], 1), 0) = 0 OR agent_id = ANY($5::uuid[]))
        -- Persona filter
        AND ($6::uuid[] IS NULL OR COALESCE(array_length($6::uuid[], 1), 0) = 0 OR persona_id = ANY($6::uuid[]))
        -- Agent type filter (agent vs persona)
        AND (
            $7::text IS NULL 
            OR $7::text = ''
            OR actor_type = $7::text
        )
        -- Search filter
        AND (
            $8::text IS NULL
            OR $8::text = ''
            OR LOWER(model_name) LIKE '%' || LOWER($8::text) || '%'
            OR LOWER(agent_name) LIKE '%' || LOWER($8::text) || '%'
            OR LOWER(persona_name) LIKE '%' || LOWER($8::text) || '%'
            OR LOWER(profile_name) LIKE '%' || LOWER($8::text) || '%'
        )
    )
),
-- Pagination
page_num AS (
    SELECT COALESCE($9::int, 1) as page
),
page_size_val AS (
    SELECT COALESCE($10::int, 50) as page_size
),
offset_val AS (
    SELECT (page - 1) * page_size as offset_val
    FROM page_num, page_size_val
),
paginated_runs AS (
    SELECT
        *,
        COUNT(*) OVER() AS total_count
    FROM model_runs_filtered
    ORDER BY created_at DESC
    LIMIT (SELECT page_size FROM page_size_val)
    OFFSET (SELECT offset_val FROM offset_val)
),
-- Build mappings
model_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            m.id::text,
            jsonb_build_object(
                'name', m.name,
                'description', COALESCE(m.description, '')
            )
        ) FILTER (WHERE m.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM (
        SELECT DISTINCT model_id FROM model_runs_filtered WHERE model_id IS NOT NULL
    ) mrf
    JOIN models m ON m.id = mrf.model_id
),
agent_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            a.id::text,
            a.name
        ) FILTER (WHERE a.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM (
        SELECT DISTINCT agent_id FROM model_runs_filtered WHERE agent_id IS NOT NULL
    ) mrf
    JOIN agents a ON a.id = mrf.agent_id
),
persona_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            per.id::text,
            per.name
        ) FILTER (WHERE per.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM (
        SELECT DISTINCT persona_id FROM model_runs_filtered WHERE persona_id IS NOT NULL
    ) mrf
    JOIN personas per ON per.id = mrf.persona_id
)
SELECT 
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'model_run_id', model_run_id::text,
                'created_at', created_at,
                'model_id', model_id::text,
                'model_name', model_name,
                'profile_id', profile_id::text,
                'profile_name', profile_name,
                'agent_id', agent_id::text,
                'agent_name', agent_name,
                'persona_id', persona_id::text,
                'persona_name', persona_name,
                'actor_type', actor_type
            ) ORDER BY created_at DESC
        ),
        '[]'::jsonb
    ) as model_runs,
    COALESCE((SELECT total_count FROM paginated_runs LIMIT 1), 0) as total_count,
    (SELECT page FROM page_num) as page,
    (SELECT page_size FROM page_size_val) as page_size,
    CEIL(COALESCE((SELECT total_count FROM paginated_runs LIMIT 1), 0)::float / (SELECT page_size FROM page_size_val)) as total_pages,
    (SELECT mapping FROM model_mapping_data) as model_mapping,
    (SELECT mapping FROM agent_mapping_data) as agent_mapping,
    (SELECT mapping FROM persona_mapping_data) as persona_mapping
FROM paginated_runs

