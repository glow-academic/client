-- Pricing runs query - paginated, filtered, searched, sorted model runs
-- Parameters: 
--   $1 = start_date (timestamp)
--   $2 = end_date (timestamp)
--   $3 = department_ids (uuid[] | NULL)
--   $4 = profile_id (uuid | NULL) - raw profile ID (role check happens in SQL)
--   $5 = roles (text[] | NULL) - only used if profile_id is NULL or role is admin/superadmin/instructional
--   $6 = cohort_ids (uuid[] | NULL)
--   $7 = search (text | NULL) - text search across model name, agent name, persona name, profile name, debug info
--   $8 = model_ids (uuid[] | NULL) - filter by model IDs
--   $9 = profile_ids (uuid[] | NULL) - filter by profile IDs
--   $10 = actor_ids (uuid[] | NULL) - filter by agent/persona IDs (combined)
-- Returns: JSONB object with data (paginated runs), totalCount, page, pageSize, totalPages, filter options, mappings

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $4::text IS NULL OR $4::text = '' THEN NULL::uuid
            ELSE $4::uuid
        END as resolved_profile_id
),
profile_role_check AS (
    -- Resolve profile_id and check role to determine effective filtering
    SELECT 
        (SELECT resolved_profile_id FROM resolve_profile_id) as raw_profile_id,
        CASE 
            WHEN (SELECT resolved_profile_id FROM resolve_profile_id) IS NULL THEN NULL::uuid
            WHEN (SELECT role FROM profiles WHERE id = (SELECT resolved_profile_id FROM resolve_profile_id)) IN ('admin', 'superadmin', 'instructional') THEN NULL::uuid
            ELSE (SELECT resolved_profile_id FROM resolve_profile_id)
        END as effective_profile_id
),
runs_base AS (
    SELECT
        mr.id as run_id,
        mr.created_at,
        mr.input_tokens,
        mr.output_tokens,
        mrm.model_id,
        mrp.profile_id,
        mr.agent_id,
        mrper.persona_id
    FROM runs mr
    LEFT JOIN run_models mrm ON mrm.run_id = mr.id AND mrm.active = true
    LEFT JOIN run_profiles mrp ON mrp.run_id = mr.id AND mrp.active = true
    LEFT JOIN run_personas mrper ON mrper.run_id = mr.id AND mrper.active = true
    WHERE 
        -- Date filters (always required)
        mr.created_at >= $1
        AND mr.created_at <= $2
        -- Department filter (via profile_departments join)
        AND (
            $3::uuid[] IS NULL 
            OR COALESCE(array_length($3::uuid[], 1), 0) = 0
            OR EXISTS (
                SELECT 1 FROM run_profiles mrp2
                JOIN profile_departments pd ON pd.profile_id = mrp2.profile_id
                WHERE mrp2.run_id = mr.id
                  AND mrp2.active = true
                  AND pd.department_id = ANY($3::uuid[])
            )
        )
        -- Profile filter (specific user) - only if role is not admin/superadmin/instructional
        AND (
            (SELECT effective_profile_id FROM profile_role_check) IS NULL
            OR mrp.profile_id = (SELECT effective_profile_id FROM profile_role_check)
        )
        -- Role filter (only if no effective profile_id)
        AND (
            (SELECT effective_profile_id FROM profile_role_check) IS NOT NULL
            OR $5::text[] IS NULL
            OR mrp.profile_id IN (
                SELECT id FROM profiles WHERE role::text = ANY($5::text[])
            )
        )
        -- Cohort filter (via cohort_profiles)
        AND (
            $6::uuid[] IS NULL
            OR COALESCE(array_length($6::uuid[], 1), 0) = 0
            OR mrp.profile_id IN (
                SELECT profile_id FROM cohort_profiles
                WHERE cohort_id = ANY($6::uuid[]) AND active = true
            )
        )
),
runs_with_debug AS (
    SELECT
        mrb.*,
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'id', di.id::text,
                    'created_at', di.created_at,
                    'content', di.content
                ) ORDER BY di.created_at
            )
            FROM debug_info di
            WHERE di.run_id = mrb.run_id),
            '[]'::jsonb
        ) as debug_info
    FROM runs_base mrb
),
-- Calculate run costs using run_pricing_usage and model_pricing
run_costs AS (
    SELECT 
        rpu.run_id,
        COALESCE(SUM(
            (rpu.count::numeric / u.value::numeric) * mp.price
        ), 0) as run_cost
    FROM run_pricing_usage rpu
    JOIN run_models rm ON rm.run_id = rpu.run_id AND rm.active = true
    JOIN model_pricing mp ON mp.model_id = rm.model_id 
        AND mp.pricing_type = rpu.pricing_type 
        AND mp.unit_id = rpu.unit_id
        AND mp.active = true
    JOIN units u ON u.id = rpu.unit_id
    GROUP BY rpu.run_id
),
-- Join with mappings for search and display
runs_with_names AS (
    SELECT
        mrwd.*,
        m.name as model_name,
        p.first_name || ' ' || p.last_name as profile_name,
        a.name as agent_name,
        per.name as persona_name,
        COALESCE(rc.run_cost, 0) as run_cost
    FROM runs_with_debug mrwd
    LEFT JOIN models m ON m.id = mrwd.model_id
    LEFT JOIN profiles p ON p.id = mrwd.profile_id
    LEFT JOIN agents a ON a.id = mrwd.agent_id
    LEFT JOIN personas per ON per.id = mrwd.persona_id
    LEFT JOIN run_costs rc ON rc.run_id = mrwd.run_id
),
-- Apply search filter (across model name, agent name, persona name, profile name, debug info)
runs_with_search AS (
    SELECT *
    FROM runs_with_names
    WHERE (
        $7::text IS NULL
        OR $7::text = ''
        OR LOWER(model_name) LIKE '%' || LOWER($7::text) || '%'
        OR LOWER(agent_name) LIKE '%' || LOWER($7::text) || '%'
        OR LOWER(persona_name) LIKE '%' || LOWER($7::text) || '%'
        OR LOWER(profile_name) LIKE '%' || LOWER($7::text) || '%'
        OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(debug_info) AS di
            WHERE LOWER(di->>'content') LIKE '%' || LOWER($7::text) || '%'
        )
    )
),
-- Apply modelIds, profileIds, actorIds filters
runs_filtered AS (
    SELECT *
    FROM runs_with_search
    WHERE (
        -- Model filter
        ($8::uuid[] IS NULL OR COALESCE(array_length($8::uuid[], 1), 0) = 0 OR model_id = ANY($8::uuid[]))
        -- Profile filter
        AND ($9::uuid[] IS NULL OR COALESCE(array_length($9::uuid[], 1), 0) = 0 OR profile_id = ANY($9::uuid[]))
        -- Actor filter (agent or persona)
        AND (
            $10::uuid[] IS NULL 
            OR COALESCE(array_length($10::uuid[], 1), 0) = 0 
            OR agent_id = ANY($10::uuid[])
            OR persona_id = ANY($10::uuid[])
        )
    )
),
-- Get all unique model options from filtered runs (before pagination)
model_options_cte AS (
    SELECT 
        m.id AS model_id,
        m.name AS model_name,
        COUNT(DISTINCT mrf.run_id) AS count
    FROM runs_filtered mrf
    JOIN models m ON m.id = mrf.model_id
    WHERE mrf.model_id IS NOT NULL
    GROUP BY m.id, m.name
    ORDER BY model_name
),
-- Get all unique profile options from filtered runs (before pagination)
profile_options_cte AS (
    SELECT 
        p.id AS profile_id,
        p.first_name || ' ' || p.last_name AS profile_name,
        COUNT(DISTINCT mrf.run_id) AS count
    FROM runs_filtered mrf
    JOIN profiles p ON p.id = mrf.profile_id
    WHERE mrf.profile_id IS NOT NULL
    GROUP BY p.id, p.first_name, p.last_name
    ORDER BY profile_name
),
-- Get all unique actor options (agents + personas) from filtered runs (before pagination)
actor_options_cte AS (
    SELECT 
        COALESCE(a.id, per.id) AS actor_id,
        COALESCE(a.name, per.name) AS actor_name,
        COUNT(DISTINCT mrf.run_id) AS count
    FROM runs_filtered mrf
    LEFT JOIN agents a ON a.id = mrf.agent_id
    LEFT JOIN personas per ON per.id = mrf.persona_id
    WHERE mrf.agent_id IS NOT NULL OR mrf.persona_id IS NOT NULL
    GROUP BY COALESCE(a.id, per.id), COALESCE(a.name, per.name)
    ORDER BY actor_name
),
-- Add pagination and sorting
paginated_runs AS (
    SELECT
        *,
        COUNT(*) OVER() AS total_count
    FROM runs_filtered
    {ORDER_BY_CLAUSE}
    {LIMIT_OFFSET_CLAUSE}
),
-- Build mappings (same as summary endpoint)
model_pricing_aggregated AS (
    -- Aggregate pricing per model: sum all input/output prices normalized to per-million tokens
    SELECT 
        mrf.model_id,
        COALESCE(SUM(CASE WHEN mp.pricing_type = 'input' THEN mp.price * (1000000.0 / u.value) ELSE 0 END), 0.0) as input_ppm,
        COALESCE(SUM(CASE WHEN mp.pricing_type = 'output' THEN mp.price * (1000000.0 / u.value) ELSE 0 END), 0.0) as output_ppm
    FROM (SELECT DISTINCT model_id FROM runs_filtered WHERE model_id IS NOT NULL) mrf
    LEFT JOIN model_pricing mp ON mp.model_id = mrf.model_id AND mp.active = true AND mp.pricing_type IN ('input', 'output')
    LEFT JOIN units u ON u.id = mp.unit_id
    GROUP BY mrf.model_id
),
model_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            m.id::text,
            jsonb_build_object(
                'name', m.name,
                'description', m.description,
                'input_ppm', COALESCE(mpa.input_ppm, 0.0),
                'output_ppm', COALESCE(mpa.output_ppm, 0.0)
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM (SELECT DISTINCT model_id FROM runs_filtered WHERE model_id IS NOT NULL) mrf
    JOIN models m ON m.id = mrf.model_id
    LEFT JOIN model_pricing_aggregated mpa ON mpa.model_id = m.id
),
profile_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            p.first_name || ' ' || p.last_name
        ),
        '{}'::jsonb
    ) as mapping
    FROM (SELECT DISTINCT profile_id FROM runs_filtered WHERE profile_id IS NOT NULL) mrf
    JOIN profiles p ON p.id = mrf.profile_id
),
agent_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            a.id::text,
            a.name
        ),
        '{}'::jsonb
    ) as mapping
    FROM (SELECT DISTINCT agent_id FROM runs_filtered WHERE agent_id IS NOT NULL) mrf
    JOIN agents a ON a.id = mrf.agent_id
),
persona_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            per.id::text,
            per.name
        ),
        '{}'::jsonb
    ) as mapping
    FROM (SELECT DISTINCT persona_id FROM runs_filtered WHERE persona_id IS NOT NULL) mrf
    JOIN personas per ON per.id = mrf.persona_id
)
SELECT jsonb_build_object(
    'data', COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'run_id', run_id::text,
                'created_at', created_at,
                'input_tokens', input_tokens,
                'output_tokens', output_tokens,
                'cost', run_cost,
                'model_id', CASE WHEN model_id IS NOT NULL THEN model_id::text ELSE NULL END,
                'profile_id', CASE WHEN profile_id IS NOT NULL THEN profile_id::text ELSE NULL END,
                'agent_id', CASE WHEN agent_id IS NOT NULL THEN agent_id::text ELSE NULL END,
                'persona_id', CASE WHEN persona_id IS NOT NULL THEN persona_id::text ELSE NULL END,
                'debug_info', debug_info
            ) {JSON_AGG_ORDER_BY}
        ) FROM paginated_runs),
        '[]'::jsonb
    ),
    'totalCount', COALESCE((SELECT total_count FROM (SELECT * FROM paginated_runs LIMIT 1) pr_count), 0),
    'modelOptions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'value', moc.model_id::text,
            'label', moc.model_name,
            'count', moc.count
        ))
        FROM model_options_cte moc
    ), '[]'::jsonb),
    'profileOptions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'value', poc.profile_id::text,
            'label', poc.profile_name,
            'count', poc.count
        ))
        FROM profile_options_cte poc
    ), '[]'::jsonb),
    'actorOptions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'value', aoc.actor_id::text,
            'label', aoc.actor_name,
            'count', aoc.count
        ))
        FROM actor_options_cte aoc
    ), '[]'::jsonb),
    'model_mapping', COALESCE((SELECT mapping FROM model_mapping LIMIT 1), '{}'::jsonb),
    'profile_mapping', COALESCE((SELECT mapping FROM profile_mapping LIMIT 1), '{}'::jsonb),
    'agent_mapping', COALESCE((SELECT mapping FROM agent_mapping LIMIT 1), '{}'::jsonb),
    'persona_mapping', COALESCE((SELECT mapping FROM persona_mapping LIMIT 1), '{}'::jsonb)
) as result

