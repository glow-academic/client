-- Get pricing runs_entry - paginated, filtered, searched, sorted group runs_entry
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- EARLY PAGINATION: filters + search first, lightweight grouping, then LIMIT/OFFSET, then expensive aggregations only for page
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
-- Drop types in dependency order: drop dependent types first (group_run -> run_summary -> debug_info_entry)
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
    -- Drop run_summary next (depends on debug_info_entry)
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
    debug_info_entry types.q_get_pricing_runs_v4_debug_info[]
);

CREATE TYPE types.q_get_pricing_runs_v4_group_run AS (
    group_id uuid,
    created_at timestamptz,
    run_count int,
    total_input_tokens int,
    total_output_tokens int,
    total_cost numeric,
    runs_entry types.q_get_pricing_runs_v4_run_summary[]
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
    agents types.q_get_pricing_runs_v4_agent[]
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
profile_type_check AS (
    -- Resolve profile_id and check role to determine effective filtering
    SELECT
        (SELECT resolved_profile_id FROM resolve_profile_id) as raw_profile_id,
        CASE
            WHEN (SELECT resolved_profile_id FROM resolve_profile_id) IS NULL THEN NULL::uuid
            WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id) LIMIT 1) IN ('admin', 'superadmin', 'instructional') THEN NULL::uuid
            ELSE (SELECT resolved_profile_id FROM resolve_profile_id)
        END as effective_profile_id
),
user_profile AS (
    SELECT COALESCE(
        (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) LIMIT 1),
        'System'
    ) as actor_name
),

-- ═══════════════════════════════════════════════════════════════
-- PHASE 1: Base filtering — EXISTS instead of 5-hop JOIN (no row multiplication)
-- ═══════════════════════════════════════════════════════════════

runs_base AS (
    SELECT DISTINCT
        mr.id as run_id,
        mr.created_at,
        mr.input_tokens,
        mr.output_tokens,
        am.model_id,
        mr.profile_id,
        mr.agent_id,
        mr.group_id
    FROM runs_entry mr
    LEFT JOIN agent_models_junction am ON am.agent_id = mr.agent_id AND am.active = true
    CROSS JOIN params p
    WHERE
        -- Date filters (always required)
        mr.created_at >= p.start_date
        AND mr.created_at <= p.end_date
        -- Department filter (via profile_departments_junction join)
        AND (
            p.department_ids IS NULL
            OR COALESCE(array_length(p.department_ids, 1), 0) = 0
            OR EXISTS (
                SELECT 1 FROM profile_departments_junction pd
                WHERE pd.profile_id = mr.profile_id
                  AND pd.department_id = ANY(p.department_ids)
            )
        )
        -- Profile filter (specific user) - only if role is not admin/superadmin/instructional
        AND (
            (SELECT effective_profile_id FROM profile_type_check) IS NULL
            OR mr.profile_id = (SELECT effective_profile_id FROM profile_type_check)
        )
        -- Role filter (only if no effective profile_id)
        AND (
            (SELECT effective_profile_id FROM profile_type_check) IS NOT NULL
            OR (SELECT roles FROM params) IS NULL
            OR COALESCE(array_length((SELECT roles FROM params), 1), 0) = 0
            OR mr.profile_id IN (
                SELECT DISTINCT p.id
                FROM profile_artifact p
                LEFT JOIN profile_roles_junction pr_j ON pr_j.profile_id = p.id
                LEFT JOIN roles_resource r ON pr_j.role_id = r.id
                WHERE COALESCE(r.role, 'member'::profile_type)::text = ANY((SELECT roles FROM params)::text[])
            )
        )
        -- Cohort filter (via profile_cohorts_junction)
        AND (
            p.cohort_ids IS NULL
            OR COALESCE(array_length(p.cohort_ids, 1), 0) = 0
            OR mr.profile_id IN (
                SELECT cp.profile_id FROM profile_cohorts_junction cp
                WHERE cp.cohort_id = ANY(p.cohort_ids) AND cp.active = true
            )
        )
        -- Simulation type filter: EXISTS via group_id linkage
        AND (
            p.simulation_filters IS NULL
            OR COALESCE(array_length(p.simulation_filters, 1), 0) = 0
            -- Runs not linked to any chat/attempt: always include (treat as "general")
            OR mr.group_id IS NULL
            OR NOT EXISTS (
                SELECT 1 FROM chats_entry c
                WHERE c.group_id = mr.group_id AND c.attempt_id IS NOT NULL
            )
            OR EXISTS (
                SELECT 1
                FROM chats_entry c
                JOIN attempts_entry sa ON sa.id = c.attempt_id
                JOIN simulation_artifact sim ON sim.id = sa.simulation_id
                WHERE c.group_id = mr.group_id
                  AND (
                    ('general' = ANY(p.simulation_filters)
                      AND NOT EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE)
                      AND COALESCE(sa.archived, FALSE) = FALSE)
                    OR ('practice' = ANY(p.simulation_filters)
                      AND EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE)
                      AND COALESCE(sa.archived, FALSE) = FALSE)
                    OR ('archived' = ANY(p.simulation_filters) AND COALESCE(sa.archived, FALSE) = TRUE)
                  )
            )
        )
        -- Exclude archived attempts unless 'archived' is explicitly in the filter list
        AND (
            p.simulation_filters IS NULL
            OR COALESCE(array_length(p.simulation_filters, 1), 0) = 0
            OR 'archived' = ANY(p.simulation_filters)
            OR mr.group_id IS NULL
            OR NOT EXISTS (
                SELECT 1 FROM chats_entry c
                JOIN attempts_entry sa ON sa.id = c.attempt_id
                WHERE c.group_id = mr.group_id AND COALESCE(sa.archived, FALSE) = TRUE
            )
        )
),

-- ═══════════════════════════════════════════════════════════════
-- PHASE 2: Name lookups + search (no debug_info pre-materialization)
-- ═══════════════════════════════════════════════════════════════

-- Pre-compute name lookups (one scan each, not per-row)
model_name_lookup AS (
    SELECT DISTINCT ON (mn.model_id) mn.model_id, n.name
    FROM model_names_junction mn
    JOIN names_resource n ON mn.name_id = n.id
),
profile_name_lookup AS (
    SELECT DISTINCT ON (pn.profile_id) pn.profile_id, n.name
    FROM profile_names_junction pn
    JOIN names_resource n ON pn.name_id = n.id
),
agent_name_lookup AS (
    SELECT DISTINCT ON (an.agent_id) an.agent_id, n.name
    FROM agent_names_junction an
    JOIN names_resource n ON an.name_id = n.id
),
-- Search with EXISTS for debug_info instead of pre-materialized array
runs_with_search AS (
    SELECT
        rb.run_id,
        rb.created_at,
        rb.input_tokens,
        rb.output_tokens,
        rb.model_id,
        rb.profile_id,
        rb.agent_id,
        rb.group_id,
        mnl.name as model_name,
        COALESCE(pnl.name, '') as profile_name,
        anl.name as agent_name
    FROM runs_base rb
    LEFT JOIN model_name_lookup mnl ON mnl.model_id = rb.model_id
    LEFT JOIN profile_name_lookup pnl ON pnl.profile_id = rb.profile_id
    LEFT JOIN agent_name_lookup anl ON anl.agent_id = rb.agent_id
    CROSS JOIN params p
    WHERE (
        p.search IS NULL
        OR p.search = ''
        OR LOWER(mnl.name) LIKE '%' || LOWER(p.search) || '%'
        OR LOWER(anl.name) LIKE '%' || LOWER(p.search) || '%'
        OR LOWER(COALESCE(pnl.name, '')) LIKE '%' || LOWER(p.search) || '%'
        OR EXISTS (
            SELECT 1 FROM debug_info_entry di
            WHERE di.run_id = rb.run_id
              AND LOWER(di.content) LIKE '%' || LOWER(p.search) || '%'
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
        rws.group_id,
        rws.model_name,
        rws.profile_name,
        rws.agent_name
    FROM runs_with_search rws
    CROSS JOIN params p
    WHERE (
        -- Model filter
        (p.model_ids IS NULL OR COALESCE(array_length(p.model_ids, 1), 0) = 0 OR rws.model_id = ANY(p.model_ids))
        -- Profile filter
        AND (p.profile_ids IS NULL OR COALESCE(array_length(p.profile_ids, 1), 0) = 0 OR rws.profile_id = ANY(p.profile_ids))
        -- Actor filter (agent)
        AND (
            p.actor_ids IS NULL
            OR COALESCE(array_length(p.actor_ids, 1), 0) = 0
            OR rws.agent_id = ANY(p.actor_ids)
        )
    )
),

-- ═══════════════════════════════════════════════════════════════
-- PHASE 3: Lightweight grouping + pagination
-- ═══════════════════════════════════════════════════════════════

-- Group by group_id with lightweight aggregates (no ARRAY_AGG, no per-run costs)
group_lightweight AS (
    SELECT
        mrf.group_id,
        COUNT(DISTINCT mrf.run_id)::int as run_count,
        SUM(mrf.input_tokens)::bigint as total_input_tokens,
        SUM(mrf.output_tokens)::bigint as total_output_tokens,
        MIN(mrf.created_at) as created_at
    FROM runs_filtered mrf
    WHERE mrf.group_id IS NOT NULL
    GROUP BY mrf.group_id
),
-- Group-level cost (needed for cost sort and display)
group_cost AS (
    SELECT
        rf.group_id,
        COALESCE(SUM(
            (rpu.count::numeric / u.value::numeric) * pr.price
        ), 0) as total_cost
    FROM runs_filtered rf
    JOIN run_pricing_entry rpu ON rpu.run_id = rf.run_id
    JOIN agent_models_junction am ON am.agent_id = rf.agent_id AND am.active = true
    JOIN model_pricing_junction mp ON mp.model_id = am.model_id AND mp.active = true
    JOIN pricing_resource pr ON pr.id = mp.pricing_id
        AND pr.pricing_type = rpu.pricing_type
        AND pr.unit_id = rpu.unit_id
        AND pr.active = true
    JOIN artifact_units_relation u ON u.id = rpu.unit_id
    WHERE rf.group_id IS NOT NULL
    GROUP BY rf.group_id
),
-- Paginate groups
paginated_group_ids AS (
    SELECT gl.group_id, COUNT(*) OVER() AS total_count
    FROM group_lightweight gl
    LEFT JOIN group_cost gc ON gc.group_id = gl.group_id
    CROSS JOIN params p
    ORDER BY
        CASE
            WHEN p.sort_by = 'createdAt' THEN
                CASE WHEN p.sort_order = 'ASC' THEN -EXTRACT(EPOCH FROM gl.created_at)::numeric
                     ELSE EXTRACT(EPOCH FROM gl.created_at)::numeric END
            WHEN p.sort_by = 'inputTokens' THEN
                CASE WHEN p.sort_order = 'ASC' THEN -gl.total_input_tokens::numeric
                     ELSE gl.total_input_tokens::numeric END
            WHEN p.sort_by = 'outputTokens' THEN
                CASE WHEN p.sort_order = 'ASC' THEN -gl.total_output_tokens::numeric
                     ELSE gl.total_output_tokens::numeric END
            WHEN p.sort_by = 'cost' THEN
                CASE WHEN p.sort_order = 'ASC' THEN -COALESCE(gc.total_cost, 0)
                     ELSE COALESCE(gc.total_cost, 0) END
            WHEN p.sort_by = 'runCount' THEN
                CASE WHEN p.sort_order = 'ASC' THEN -gl.run_count::numeric
                     ELSE gl.run_count::numeric END
            ELSE
                CASE WHEN p.sort_order = 'ASC' THEN -EXTRACT(EPOCH FROM gl.created_at)::numeric
                     ELSE EXTRACT(EPOCH FROM gl.created_at)::numeric END
        END DESC NULLS LAST
    LIMIT (SELECT limit_count FROM params) OFFSET (SELECT offset_count FROM params)
),

-- ═══════════════════════════════════════════════════════════════
-- PHASE 4: Full details — ONLY for paginated groups (~10 groups, ~50-200 runs)
-- ═══════════════════════════════════════════════════════════════

-- Get run IDs for paginated groups only
paginated_run_ids AS (
    SELECT
        rf.run_id,
        rf.group_id,
        rf.created_at,
        rf.input_tokens,
        rf.output_tokens,
        rf.model_id,
        rf.profile_id,
        rf.agent_id
    FROM runs_filtered rf
    WHERE rf.group_id IN (SELECT group_id FROM paginated_group_ids)
),
-- Per-run costs (only ~50-200 runs instead of 98K)
run_costs AS (
    SELECT
        rpu.run_id,
        COALESCE(SUM(
            (rpu.count::numeric / u.value::numeric) * pr.price
        ), 0) as run_cost
    FROM run_pricing_entry rpu
    JOIN runs_entry r ON r.id = rpu.run_id
    JOIN agent_models_junction am ON am.agent_id = r.agent_id AND am.active = true
    JOIN model_pricing_junction mp ON mp.model_id = am.model_id AND mp.active = true
    JOIN pricing_resource pr ON pr.id = mp.pricing_id
        AND pr.pricing_type = rpu.pricing_type
        AND pr.unit_id = rpu.unit_id
        AND pr.active = true
    JOIN artifact_units_relation u ON u.id = rpu.unit_id
    WHERE rpu.run_id IN (SELECT run_id FROM paginated_run_ids)
    GROUP BY rpu.run_id
),
-- Debug info (only for paginated runs)
runs_with_debug AS (
    SELECT
        pri.run_id,
        COALESCE(
            ARRAY_AGG(
                (di.id, di.created_at, di.content)::types.q_get_pricing_runs_v4_debug_info
                ORDER BY di.created_at
            ) FILTER (WHERE di.id IS NOT NULL),
            '{}'::types.q_get_pricing_runs_v4_debug_info[]
        ) as debug_info_entry
    FROM paginated_run_ids pri
    LEFT JOIN debug_info_entry di ON di.run_id = pri.run_id
    GROUP BY pri.run_id
),
-- Build full group composites with nested run arrays (only ~10 groups)
groups_with_full_detail AS (
    SELECT
        pri.group_id,
        gl.created_at,
        gl.run_count,
        gl.total_input_tokens::int as total_input_tokens,
        gl.total_output_tokens::int as total_output_tokens,
        COALESCE(gc.total_cost, 0) as total_cost,
        ARRAY_AGG(
            (pri.run_id, pri.created_at, pri.input_tokens, pri.output_tokens,
             COALESCE(rc.run_cost, 0), pri.model_id, pri.profile_id, pri.agent_id,
             COALESCE(rwd.debug_info_entry, '{}'::types.q_get_pricing_runs_v4_debug_info[]))::types.q_get_pricing_runs_v4_run_summary
            ORDER BY pri.created_at
        ) as runs_entry
    FROM paginated_run_ids pri
    JOIN group_lightweight gl ON gl.group_id = pri.group_id
    LEFT JOIN group_cost gc ON gc.group_id = pri.group_id
    LEFT JOIN run_costs rc ON rc.run_id = pri.run_id
    LEFT JOIN runs_with_debug rwd ON rwd.run_id = pri.run_id
    GROUP BY pri.group_id, gl.created_at, gl.run_count, gl.total_input_tokens, gl.total_output_tokens, gc.total_cost
),

-- ═══════════════════════════════════════════════════════════════
-- PHASE 5: Options + reference data (unchanged)
-- ═══════════════════════════════════════════════════════════════

-- Get all unique model options from filtered runs_entry (before pagination)
model_options_cte AS (
    SELECT
        m.id AS model_id,
        (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) AS model_name,
        COUNT(DISTINCT mrf.run_id) AS count
    FROM runs_filtered mrf
    JOIN model_artifact m ON m.id = mrf.model_id
    WHERE mrf.model_id IS NOT NULL
    GROUP BY m.id, (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1)
    ORDER BY model_name
),
-- Get all unique profile options from filtered runs_entry (before pagination)
profile_options_cte AS (
    SELECT
        p.id AS profile_id,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') AS profile_name,
        COUNT(DISTINCT mrf.run_id) AS count
    FROM runs_filtered mrf
    JOIN profile_artifact p ON p.id = mrf.profile_id
    WHERE mrf.profile_id IS NOT NULL
    GROUP BY p.id, (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1)
    ORDER BY profile_name
),
-- Get all unique actor options (agents) from filtered runs_entry (before pagination)
actor_options_cte AS (
    SELECT
        a.id AS actor_id,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) AS actor_name,
        COUNT(DISTINCT mrf.run_id) AS count
    FROM runs_filtered mrf
    JOIN agent_artifact a ON a.id = mrf.agent_id
    WHERE mrf.agent_id IS NOT NULL
    GROUP BY a.id, (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1)
    ORDER BY actor_name
),
-- Build mappings (same as summary endpoint)
model_pricing_aggregated AS (
    -- Aggregate pricing per model: sum all input/output prices normalized to per-million tokens
    SELECT
        mrf.model_id,
        COALESCE(SUM(CASE WHEN pr.pricing_type = 'input'::pricing_type THEN pr.price * (1000000.0 / u.value) ELSE 0 END), 0.0) as input_ppm,
        COALESCE(SUM(CASE WHEN pr.pricing_type = 'output'::pricing_type THEN pr.price * (1000000.0 / u.value) ELSE 0 END), 0.0) as output_ppm
    FROM (SELECT DISTINCT model_id FROM runs_filtered WHERE model_id IS NOT NULL) mrf
    LEFT JOIN model_pricing_junction mp ON mp.model_id = mrf.model_id AND mp.active = true
    LEFT JOIN pricing_resource pr ON pr.id = mp.pricing_id AND pr.active = true AND pr.pricing_type IN ('input'::pricing_type, 'output'::pricing_type)
    LEFT JOIN artifact_units_relation u ON u.id = pr.unit_id
    GROUP BY mrf.model_id
)
SELECT
    COALESCE((SELECT actor_name FROM user_profile LIMIT 1), 'System')::text as actor_name,
    COALESCE(
        (SELECT ARRAY_AGG(
            (gwfd.group_id, gwfd.created_at, gwfd.run_count, gwfd.total_input_tokens, gwfd.total_output_tokens, gwfd.total_cost, gwfd.runs_entry)::types.q_get_pricing_runs_v4_group_run
            ORDER BY
                CASE
                    WHEN (SELECT sort_by FROM params) = 'createdAt' THEN
                        CASE WHEN (SELECT sort_order FROM params) = 'ASC' THEN -EXTRACT(EPOCH FROM gwfd.created_at)::numeric
                             ELSE EXTRACT(EPOCH FROM gwfd.created_at)::numeric END
                    WHEN (SELECT sort_by FROM params) = 'inputTokens' THEN
                        CASE WHEN (SELECT sort_order FROM params) = 'ASC' THEN -gwfd.total_input_tokens::numeric
                             ELSE gwfd.total_input_tokens::numeric END
                    WHEN (SELECT sort_by FROM params) = 'outputTokens' THEN
                        CASE WHEN (SELECT sort_order FROM params) = 'ASC' THEN -gwfd.total_output_tokens::numeric
                             ELSE gwfd.total_output_tokens::numeric END
                    WHEN (SELECT sort_by FROM params) = 'cost' THEN
                        CASE WHEN (SELECT sort_order FROM params) = 'ASC' THEN -gwfd.total_cost
                             ELSE gwfd.total_cost END
                    WHEN (SELECT sort_by FROM params) = 'runCount' THEN
                        CASE WHEN (SELECT sort_order FROM params) = 'ASC' THEN -gwfd.run_count::numeric
                             ELSE gwfd.run_count::numeric END
                    ELSE
                        CASE WHEN (SELECT sort_order FROM params) = 'ASC' THEN -EXTRACT(EPOCH FROM gwfd.created_at)::numeric
                             ELSE EXTRACT(EPOCH FROM gwfd.created_at)::numeric END
                END DESC NULLS LAST
        ) FROM groups_with_full_detail gwfd),
        '{}'::types.q_get_pricing_runs_v4_group_run[]
    ) as group_runs,
    COALESCE((SELECT total_count FROM paginated_group_ids LIMIT 1), 0)::bigint as total_count,
    ((SELECT offset_count FROM params) / NULLIF((SELECT limit_count FROM params), 0))::int as page,
    (SELECT limit_count FROM params)::int as page_size,
    CASE
        WHEN (SELECT limit_count FROM params) > 0
        THEN ((COALESCE((SELECT total_count FROM paginated_group_ids LIMIT 1), 0) + (SELECT limit_count FROM params) - 1) / (SELECT limit_count FROM params))::int
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
            DISTINCT (m.id, (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1), COALESCE((SELECT d.description FROM model_descriptions_junction md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1), ''), COALESCE(mpa.input_ppm, 0.0), COALESCE(mpa.output_ppm, 0.0))::types.q_get_pricing_runs_v4_model
        )
        FROM (SELECT DISTINCT model_id FROM runs_filtered WHERE model_id IS NOT NULL) mrf
        JOIN model_artifact m ON m.id = mrf.model_id
        LEFT JOIN model_pricing_aggregated mpa ON mpa.model_id = m.id),
        '{}'::types.q_get_pricing_runs_v4_model[]
    ) as models,
    COALESCE(
        (SELECT ARRAY_AGG(
            DISTINCT (p.id, COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''))::types.q_get_pricing_runs_v4_profile
        )
        FROM (SELECT DISTINCT mrf.profile_id FROM runs_filtered mrf WHERE mrf.profile_id IS NOT NULL) prf
        JOIN profile_artifact p ON p.id = prf.profile_id),
        '{}'::types.q_get_pricing_runs_v4_profile[]
    ) as profiles,
    COALESCE(
        (SELECT ARRAY_AGG(
            DISTINCT (a.id, (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1))::types.q_get_pricing_runs_v4_agent
        )
        FROM (SELECT DISTINCT agent_id FROM runs_filtered WHERE agent_id IS NOT NULL) agt
        JOIN agent_artifact a ON a.id = agt.agent_id),
        '{}'::types.q_get_pricing_runs_v4_agent[]
    ) as agents
FROM params
LIMIT 1
$$;
