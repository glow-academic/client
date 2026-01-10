-- Get pricing runs - paginated, filtered, searched, sorted group runs
-- Converted to function with composite types
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
        WHERE proname = 'api_get_pricing_runs_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_pricing_runs_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop types in dependency order: drop dependent types first (group_run -> run_summary -> debug_info)
-- Use prefix pattern to find all types, but drop in correct order
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop group_run first (depends on run_summary)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_pricing_runs_v4_group_run'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
    -- Drop run_summary next (depends on debug_info)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_pricing_runs_v4_run_summary'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
    -- Drop remaining types
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_pricing_runs_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_pricing_runs_v4_debug_info AS (
    id uuid,
    created_at timestamptz,
    content text
);

CREATE TYPE types.q_get_pricing_runs_v4_run_summary AS (
    run_id uuid,
    created_at timestamptz,
    input_tokens int,
    output_tokens int,
    cost numeric,
    model_id uuid,
    profile_id uuid,
    agent_id uuid,
    persona_id uuid,
    debug_info types.q_get_pricing_runs_v4_debug_info[]
);

CREATE TYPE types.q_get_pricing_runs_v4_group_run AS (
    group_id uuid,
    created_at timestamptz,
    run_count int,
    total_input_tokens int,
    total_output_tokens int,
    total_cost numeric,
    runs types.q_get_pricing_runs_v4_run_summary[]
);

CREATE TYPE types.q_get_pricing_runs_v4_filter_option AS (
    value text,
    label text,
    count int
);

CREATE TYPE types.q_get_pricing_runs_v4_model AS (
    model_id uuid,
    name text,
    description text,
    input_ppm numeric,
    output_ppm numeric
);

CREATE TYPE types.q_get_pricing_runs_v4_profile AS (
    profile_id uuid,
    name text
);

CREATE TYPE types.q_get_pricing_runs_v4_agent AS (
    agent_id uuid,
    name text
);

CREATE TYPE types.q_get_pricing_runs_v4_persona AS (
    persona_id uuid,
    name text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_pricing_runs_v4(
    start_date text,
    end_date text,
    department_ids uuid[],
    profile_id uuid,
    roles text[],
    cohort_ids uuid[],
    simulation_filters text[],
    search text,
    model_ids uuid[],
    profile_ids uuid[],
    actor_ids uuid[],
    sort_by text,
    sort_order text,
    limit_count int,
    offset_count int
)
RETURNS TABLE (
    actor_name text,
    group_runs types.q_get_pricing_runs_v4_group_run[],
    total_count bigint,
    page int,
    page_size int,
    total_pages int,
    model_options types.q_get_pricing_runs_v4_filter_option[],
    profile_options types.q_get_pricing_runs_v4_filter_option[],
    actor_options types.q_get_pricing_runs_v4_filter_option[],
    models types.q_get_pricing_runs_v4_model[],
    profiles types.q_get_pricing_runs_v4_profile[],
    agents types.q_get_pricing_runs_v4_agent[],
    personas types.q_get_pricing_runs_v4_persona[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        COALESCE(NULLIF(start_date, ''), NULL)::timestamptz AS start_date,
        COALESCE(NULLIF(end_date, ''), NULL)::timestamptz AS end_date,
        department_ids AS department_ids,
        profile_id AS profile_id,
        roles AS roles,
        cohort_ids AS cohort_ids,
        simulation_filters AS simulation_filters,
        search AS search,
        model_ids AS model_ids,
        profile_ids AS profile_ids,
        actor_ids AS actor_ids,
        COALESCE(sort_by, 'created_at') AS sort_by,
        COALESCE(UPPER(sort_order), 'DESC') AS sort_order,
        COALESCE(limit_count, 10) AS limit_count,
        COALESCE(offset_count, 0) AS offset_count
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params) IS NULL THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)
        END as resolved_profile_id
),
profile_role_check AS (
    -- Resolve profile_id and check role to determine effective filtering
    SELECT 
        (SELECT resolved_profile_id FROM resolve_profile_id) as raw_profile_id,
        CASE 
            WHEN (SELECT resolved_profile_id FROM resolve_profile_id) IS NULL THEN NULL::uuid
            WHEN (SELECT role FROM profile WHERE id = (SELECT resolved_profile_id FROM resolve_profile_id)) IN ('admin', 'superadmin', 'instructional') THEN NULL::uuid
            ELSE (SELECT resolved_profile_id FROM resolve_profile_id)
        END as effective_profile_id
),
user_profile AS (
    SELECT 
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) AND pn.type = 'full'::type_profile_names LIMIT 1),
            (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = (SELECT profile_id FROM params) AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile ON profile.id = x.profile_id
    WHERE x.profile_id IS NOT NULL
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
        mrper.persona_id,
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.simulation_id = sim.id AND fl.name = 'practice' AND sf.type = 'practice'::type_simulation_flags AND sf.value = TRUE) as practice_simulation,
        sa.archived,
        gr.group_id
    FROM run mr
    LEFT JOIN run_models mrm ON mrm.run_id = mr.id AND mrm.active = true
    LEFT JOIN run_profiles mrp ON mrp.run_id = mr.id AND mrp.active = true
    LEFT JOIN run_personas mrper ON mrper.run_id = mr.id AND mrper.active = true
    -- Join to groups via group_runs
    LEFT JOIN group_runs gr ON gr.run_id = mr.id
    LEFT JOIN groups g ON g.id = gr.group_id
    -- Join to simulations via chat_groups → groups → group_runs → runs → chats → attempt_chats → simulation_attempts → simulations
    -- Get chat_id from any chat in this run's group
    LEFT JOIN LATERAL (
        SELECT DISTINCT c.id AS chat_id
        FROM groups g2
        JOIN chat_groups cg ON cg.group_id = g2.id
        JOIN chat c ON c.id = cg.chat_id
        WHERE g2.id = g.id
        LIMIT 1
    ) chat_lookup ON true
    LEFT JOIN chat c ON c.id = chat_lookup.chat_id
    LEFT JOIN attempt_chats ac ON ac.chat_id = c.id
    LEFT JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    LEFT JOIN simulation sim ON sim.id = sa.simulation_id
    CROSS JOIN params p
    WHERE 
        -- Date filters (always required)
        mr.created_at >= p.start_date
        AND mr.created_at <= p.end_date
        -- Department filter (via profile_departments join)
        AND (
            p.department_ids IS NULL
            OR COALESCE(array_length(p.department_ids, 1), 0) = 0
            OR EXISTS (
                SELECT 1 FROM run_profiles mrp2
                JOIN profile_departments pd ON pd.profile_id = mrp2.profile_id
                WHERE mrp2.run_id = mr.id
                  AND mrp2.active = true
                  AND pd.department_id = ANY(p.department_ids)
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
            OR p.roles IS NULL
            OR COALESCE(array_length(p.roles, 1), 0) = 0
            OR mrp.profile_id IN (
                SELECT id FROM profile WHERE role::text = ANY(p.roles)
            )
        )
        -- Cohort filter (via cohort_profiles)
        AND (
            p.cohort_ids IS NULL
            OR COALESCE(array_length(p.cohort_ids, 1), 0) = 0
            OR mrp.profile_id IN (
                SELECT cp.profile_id FROM cohort_profiles cp
                WHERE cp.cohort_id = ANY(p.cohort_ids) AND cp.active = true
            )
        )
        -- Simulation type filtering: general (practice_simulation = FALSE), practice (practice_simulation = TRUE), archived (archived = TRUE)
        -- If no filters provided (NULL or empty), include all runs (runs not linked to simulations are included)
        -- If filters provided, only include runs that match the filter OR runs not linked to simulations (treat as "general")
        AND (
            p.simulation_filters IS NULL
            OR COALESCE(array_length(p.simulation_filters, 1), 0) = 0
            OR sim.id IS NULL  -- Runs not linked to simulations are always included
            OR (
                ('general' = ANY(p.simulation_filters) AND NOT EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.simulation_id = sim.id AND fl.name = 'practice' AND sf.type = 'practice'::type_simulation_flags AND sf.value = TRUE) AND COALESCE(sa.archived, FALSE) = FALSE) OR
                ('practice' = ANY(p.simulation_filters) AND EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.simulation_id = sim.id AND fl.name = 'practice' AND sf.type = 'practice'::type_simulation_flags AND sf.value = TRUE) AND COALESCE(sa.archived, FALSE) = FALSE) OR
                ('archived' = ANY(p.simulation_filters) AND COALESCE(sa.archived, FALSE) = TRUE)
            )
        )
        -- Exclude archived attempts unless 'archived' is explicitly in the filter list
        AND (
            p.simulation_filters IS NULL
            OR COALESCE(array_length(p.simulation_filters, 1), 0) = 0
            OR 'archived' = ANY(p.simulation_filters)
            OR COALESCE(sa.archived, FALSE) = FALSE
        )
),
runs_with_debug AS (
    SELECT
        mrb.run_id,
        mrb.created_at,
        mrb.input_tokens,
        mrb.output_tokens,
        mrb.model_id,
        mrb.profile_id,
        mrb.agent_id,
        mrb.persona_id,
        mrb.practice_simulation,
        mrb.archived,
        mrb.group_id,
        COALESCE(
            ARRAY_AGG(
                (di.id, di.created_at, di.content)::types.q_get_pricing_runs_v4_debug_info
                ORDER BY di.created_at
            ) FILTER (WHERE di.id IS NOT NULL),
            '{}'::types.q_get_pricing_runs_v4_debug_info[]
        ) as debug_info
    FROM runs_base mrb
    LEFT JOIN run_debug_info rdi ON rdi.run_id = mrb.run_id
    LEFT JOIN debug_info di ON di.id = rdi.debug_info_id
    GROUP BY mrb.run_id, mrb.created_at, mrb.input_tokens, mrb.output_tokens, mrb.model_id, mrb.profile_id, mrb.agent_id, mrb.persona_id, mrb.practice_simulation, mrb.archived, mrb.group_id
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
        mrwd.run_id,
        mrwd.created_at,
        mrwd.input_tokens,
        mrwd.output_tokens,
        mrwd.model_id,
        mrwd.profile_id,
        mrwd.agent_id,
        mrwd.persona_id,
        mrwd.practice_simulation,
        mrwd.archived,
        mrwd.group_id,
        mrwd.debug_info,
        (SELECT n.name FROM model_names mn JOIN names n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) as model_name,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as profile_name,
        (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = per.id LIMIT 1) as persona_name,
        COALESCE(rc.run_cost, 0) as run_cost
    FROM runs_with_debug mrwd
    LEFT JOIN models m ON m.id = mrwd.model_id
    LEFT JOIN profile p ON p.id = mrwd.profile_id
    LEFT JOIN agents a ON a.id = mrwd.agent_id
    LEFT JOIN personas per ON per.id = mrwd.persona_id
    LEFT JOIN run_costs rc ON rc.run_id = mrwd.run_id
),
-- Apply search filter (across model name, agent name, persona name, profile name, debug info)
runs_with_search AS (
    SELECT 
        rwn.run_id,
        rwn.created_at,
        rwn.input_tokens,
        rwn.output_tokens,
        rwn.model_id,
        rwn.profile_id,
        rwn.agent_id,
        rwn.persona_id,
        rwn.practice_simulation,
        rwn.archived,
        rwn.group_id,
        rwn.debug_info,
        rwn.model_name,
        rwn.profile_name,
        rwn.agent_name,
        rwn.persona_name,
        rwn.run_cost
    FROM runs_with_names rwn
    CROSS JOIN params p
    WHERE (
        p.search IS NULL
        OR p.search = ''
        OR LOWER(rwn.model_name) LIKE '%' || LOWER(p.search) || '%'
        OR LOWER(rwn.agent_name) LIKE '%' || LOWER(p.search) || '%'
        OR LOWER(rwn.persona_name) LIKE '%' || LOWER(p.search) || '%'
        OR LOWER(rwn.profile_name) LIKE '%' || LOWER(p.search) || '%'
        OR EXISTS (
            SELECT 1 FROM unnest(rwn.debug_info) AS di
            WHERE LOWER(di.content) LIKE '%' || LOWER(p.search) || '%'
        )
    )
),
-- Apply modelIds, profileIds, actorIds filters
runs_filtered AS (
    SELECT 
        rws.run_id,
        rws.created_at,
        rws.input_tokens,
        rws.output_tokens,
        rws.model_id,
        rws.profile_id,
        rws.agent_id,
        rws.persona_id,
        rws.practice_simulation,
        rws.archived,
        rws.group_id,
        rws.debug_info,
        rws.model_name,
        rws.profile_name,
        rws.agent_name,
        rws.persona_name,
        rws.run_cost
    FROM runs_with_search rws
    CROSS JOIN params p
    WHERE (
        -- Model filter
        (p.model_ids IS NULL OR COALESCE(array_length(p.model_ids, 1), 0) = 0 OR rws.model_id = ANY(p.model_ids))
        -- Profile filter
        AND (p.profile_ids IS NULL OR COALESCE(array_length(p.profile_ids, 1), 0) = 0 OR rws.profile_id = ANY(p.profile_ids))
        -- Actor filter (agent or persona)
        AND (
            p.actor_ids IS NULL 
            OR COALESCE(array_length(p.actor_ids, 1), 0) = 0 
            OR rws.agent_id = ANY(p.actor_ids)
            OR rws.persona_id = ANY(p.actor_ids)
        )
    )
),
-- Group runs by group_id and aggregate
-- Note: Runs without groups are excluded (they would have been in chat_runs before migration)
groups_with_runs AS (
    SELECT
        mrf.group_id,
        COUNT(DISTINCT mrf.run_id) as run_count,
        SUM(mrf.input_tokens) as total_input_tokens,
        SUM(mrf.output_tokens) as total_output_tokens,
        SUM(mrf.run_cost) as total_cost,
        MIN(mrf.created_at) as created_at,  -- Use earliest run's created_at
        -- Aggregate run summaries for display
        ARRAY_AGG(
            (mrf.run_id, mrf.created_at, mrf.input_tokens, mrf.output_tokens, mrf.run_cost, mrf.model_id, mrf.profile_id, mrf.agent_id, mrf.persona_id, mrf.debug_info)::types.q_get_pricing_runs_v4_run_summary
            ORDER BY mrf.created_at
        ) FILTER (WHERE mrf.run_id IS NOT NULL) as runs
    FROM runs_filtered mrf
    WHERE mrf.group_id IS NOT NULL  -- Only include runs that belong to groups
    GROUP BY mrf.group_id
),
-- Get all unique model options from filtered runs (before pagination)
model_options_cte AS (
    SELECT 
        m.id AS model_id,
        (SELECT n.name FROM model_names mn JOIN names n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) AS model_name,
        COUNT(DISTINCT mrf.run_id) AS count
    FROM runs_filtered mrf
    JOIN models m ON m.id = mrf.model_id
    WHERE mrf.model_id IS NOT NULL
    GROUP BY m.id, (SELECT n.name FROM model_names mn JOIN names n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1)
    ORDER BY model_name
),
-- Get all unique profile options from filtered runs (before pagination)
profile_options_cte AS (
    SELECT 
        p.id AS profile_id,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') AS profile_name,
        COUNT(DISTINCT mrf.run_id) AS count
    FROM runs_filtered mrf
    JOIN profile p ON p.id = mrf.profile_id
    WHERE mrf.profile_id IS NOT NULL
    GROUP BY p.id, (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first'::type_profile_names LIMIT 1), (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'last'::type_profile_names LIMIT 1)
    ORDER BY profile_name
),
-- Get all unique actor options (agents + personas) from filtered runs (before pagination)
actor_options_cte AS (
    SELECT 
        COALESCE(a.id, per.id) AS actor_id,
        COALESCE((SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = per.id LIMIT 1)) AS actor_name,
        COUNT(DISTINCT mrf.run_id) AS count
    FROM runs_filtered mrf
    LEFT JOIN agents a ON a.id = mrf.agent_id
    LEFT JOIN personas per ON per.id = mrf.persona_id
    WHERE mrf.agent_id IS NOT NULL OR mrf.persona_id IS NOT NULL
    GROUP BY COALESCE(a.id, per.id), COALESCE((SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = per.id LIMIT 1))
    ORDER BY actor_name
),
-- Add pagination and sorting
-- Use CASE statement to handle dynamic sort column (no string replacement needed)
-- Compute sort value based on sort_by parameter, converting all to numeric for consistent ordering
-- For ASC, negate the value so DESC ordering gives ASC result
groups_with_sort AS (
    SELECT
        gwr.*,
        CASE 
            WHEN p.sort_by = 'createdAt' THEN 
                CASE WHEN p.sort_order = 'ASC' THEN -EXTRACT(EPOCH FROM gwr.created_at)::numeric
                     ELSE EXTRACT(EPOCH FROM gwr.created_at)::numeric END
            WHEN p.sort_by = 'inputTokens' THEN 
                CASE WHEN p.sort_order = 'ASC' THEN -gwr.total_input_tokens::numeric
                     ELSE gwr.total_input_tokens::numeric END
            WHEN p.sort_by = 'outputTokens' THEN 
                CASE WHEN p.sort_order = 'ASC' THEN -gwr.total_output_tokens::numeric
                     ELSE gwr.total_output_tokens::numeric END
            WHEN p.sort_by = 'cost' THEN 
                CASE WHEN p.sort_order = 'ASC' THEN -gwr.total_cost
                     ELSE gwr.total_cost END
            WHEN p.sort_by = 'runCount' THEN 
                CASE WHEN p.sort_order = 'ASC' THEN -gwr.run_count::numeric
                     ELSE gwr.run_count::numeric END
            ELSE 
                CASE WHEN p.sort_order = 'ASC' THEN -EXTRACT(EPOCH FROM gwr.created_at)::numeric
                     ELSE EXTRACT(EPOCH FROM gwr.created_at)::numeric END
        END as sort_value
    FROM groups_with_runs gwr
    CROSS JOIN params p
),
paginated_groups AS (
    SELECT
        gws.group_id,
        gws.created_at,
        gws.run_count,
        gws.total_input_tokens,
        gws.total_output_tokens,
        gws.total_cost,
        gws.runs,
        COUNT(*) OVER() AS total_count
    FROM groups_with_sort gws
    ORDER BY gws.sort_value DESC NULLS LAST
    LIMIT (SELECT limit_count FROM params) OFFSET (SELECT offset_count FROM params)
),
-- Build mappings (same as summary endpoint)
model_pricing_aggregated AS (
    -- Aggregate pricing per model: sum all input/output prices normalized to per-million tokens
    SELECT 
        mrf.model_id,
        COALESCE(SUM(CASE WHEN mp.pricing_type = 'input'::pricing_type THEN mp.price * (1000000.0 / u.value) ELSE 0 END), 0.0) as input_ppm,
        COALESCE(SUM(CASE WHEN mp.pricing_type = 'output'::pricing_type THEN mp.price * (1000000.0 / u.value) ELSE 0 END), 0.0) as output_ppm
    FROM (SELECT DISTINCT model_id FROM runs_filtered WHERE model_id IS NOT NULL) mrf
    LEFT JOIN model_pricing mp ON mp.model_id = mrf.model_id AND mp.active = true AND mp.pricing_type IN ('input'::pricing_type, 'output'::pricing_type)
    LEFT JOIN units u ON u.id = mp.unit_id
    GROUP BY mrf.model_id
)
SELECT 
    COALESCE((SELECT actor_name FROM user_profile LIMIT 1), 'System')::text as actor_name,
    COALESCE(
        (SELECT ARRAY_AGG(
            (pg.group_id, pg.created_at, pg.run_count, pg.total_input_tokens, pg.total_output_tokens, pg.total_cost, pg.runs)::types.q_get_pricing_runs_v4_group_run
        ) FROM paginated_groups pg),
        '{}'::types.q_get_pricing_runs_v4_group_run[]
    ) as group_runs,
    COALESCE((SELECT total_count FROM paginated_groups LIMIT 1), 0)::bigint as total_count,
    ((SELECT offset_count FROM params) / NULLIF((SELECT limit_count FROM params), 0))::int as page,
    (SELECT limit_count FROM params)::int as page_size,
    CASE 
        WHEN (SELECT limit_count FROM params) > 0 
        THEN ((COALESCE((SELECT total_count FROM paginated_groups LIMIT 1), 0) + (SELECT limit_count FROM params) - 1) / (SELECT limit_count FROM params))::int
        ELSE 0
    END as total_pages,
    COALESCE(
        (SELECT ARRAY_AGG(
            (moc.model_id::text, moc.model_name, moc.count)::types.q_get_pricing_runs_v4_filter_option
        ) FROM model_options_cte moc),
        '{}'::types.q_get_pricing_runs_v4_filter_option[]
    ) as model_options,
    COALESCE(
        (SELECT ARRAY_AGG(
            (poc.profile_id::text, poc.profile_name, poc.count)::types.q_get_pricing_runs_v4_filter_option
        ) FROM profile_options_cte poc),
        '{}'::types.q_get_pricing_runs_v4_filter_option[]
    ) as profile_options,
    COALESCE(
        (SELECT ARRAY_AGG(
            (aoc.actor_id::text, aoc.actor_name, aoc.count)::types.q_get_pricing_runs_v4_filter_option
        ) FROM actor_options_cte aoc),
        '{}'::types.q_get_pricing_runs_v4_filter_option[]
    ) as actor_options,
    COALESCE(
        (SELECT ARRAY_AGG(
            DISTINCT (m.id, (SELECT n.name FROM model_names mn JOIN names n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1), COALESCE((SELECT d.description FROM model_descriptions md JOIN descriptions d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1), ''), COALESCE(mpa.input_ppm, 0.0), COALESCE(mpa.output_ppm, 0.0))::types.q_get_pricing_runs_v4_model
        ) 
        FROM (SELECT DISTINCT model_id FROM runs_filtered WHERE model_id IS NOT NULL) mrf
        JOIN models m ON m.id = mrf.model_id
        LEFT JOIN model_pricing_aggregated mpa ON mpa.model_id = m.id),
        '{}'::types.q_get_pricing_runs_v4_model[]
    ) as models,
    COALESCE(
        (SELECT ARRAY_AGG(
            DISTINCT (p.id, COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''))::types.q_get_pricing_runs_v4_profile
        )
        FROM (SELECT DISTINCT mrf.profile_id FROM runs_filtered mrf WHERE mrf.profile_id IS NOT NULL) prf
        JOIN profile p ON p.id = prf.profile_id),
        '{}'::types.q_get_pricing_runs_v4_profile[]
    ) as profiles,
    COALESCE(
        (SELECT ARRAY_AGG(
            DISTINCT (a.id, (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1))::types.q_get_pricing_runs_v4_agent
        )
        FROM (SELECT DISTINCT agent_id FROM runs_filtered WHERE agent_id IS NOT NULL) agt
        JOIN agents a ON a.id = agt.agent_id),
        '{}'::types.q_get_pricing_runs_v4_agent[]
    ) as agents,
    COALESCE(
        (SELECT ARRAY_AGG(
            DISTINCT (per.id, (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = per.id LIMIT 1))::types.q_get_pricing_runs_v4_persona
        )
        FROM (SELECT DISTINCT persona_id FROM runs_filtered WHERE persona_id IS NOT NULL) pers
        JOIN personas per ON per.id = pers.persona_id),
        '{}'::types.q_get_pricing_runs_v4_persona[]
    ) as personas
FROM params
LIMIT 1
$$;