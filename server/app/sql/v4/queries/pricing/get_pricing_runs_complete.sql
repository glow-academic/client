-- Get pricing runs_entry - paginated, filtered, searched, sorted group runs_entry
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
    SELECT COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Pre-aggregate token counts from run_pricing_entry (avoids correlated subqueries)
run_token_agg AS (
    SELECT
        rpu.run_id,
        SUM(CASE WHEN rpu.pricing_type = 'input'::pricing_type THEN rpu.count END)::int as input_tokens,
        SUM(CASE WHEN rpu.pricing_type = 'output'::pricing_type THEN rpu.count END)::int as output_tokens
    FROM run_pricing_entry rpu
    JOIN runs_entry r ON r.id = rpu.run_id
    WHERE r.created_at >= (SELECT start_date FROM params)
      AND r.created_at <= (SELECT end_date FROM params)
    GROUP BY rpu.run_id
),
runs_base AS (
    SELECT
        mr.id as run_id,
        mr.created_at,
        COALESCE(rta.input_tokens, mr.input_tokens) as input_tokens,
        COALESCE(rta.output_tokens, mr.output_tokens) as output_tokens,
        am.model_id,
        prj.profile_id,
        arj.agent_id,
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE) as practice_simulation,
        sa.archived,
        mr.group_id
    FROM runs_entry mr
    LEFT JOIN profile_runs_junction prj ON prj.run_id = mr.id
    LEFT JOIN agent_runs_junction arj ON arj.run_id = mr.id
    LEFT JOIN run_token_agg rta ON rta.run_id = mr.id
    LEFT JOIN agent_models_junction am ON am.agent_id = arj.agent_id AND am.active = true
    -- Join to groups_entry via runs_entry.group_id
    LEFT JOIN groups_entry g ON g.id = mr.group_id
    -- Join to simulations via messages → chats → attempts_entry → simulations
    LEFT JOIN messages_entry m_chat ON m_chat.run_id = mr.id
    LEFT JOIN chats_entry c ON c.id = m_chat.chat_id
    LEFT JOIN attempts_entry sa ON sa.id = c.attempt_id
    LEFT JOIN simulation_attempts_junction saj ON saj.attempt_id = sa.id
    LEFT JOIN simulation_artifact sim ON sim.id = saj.simulation_id
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
                WHERE pd.profile_id = prj.profile_id
                  AND pd.department_id = ANY(p.department_ids)
            )
        )
        -- Profile filter (specific user) - only if role is not admin/superadmin/instructional
        AND (
            (SELECT effective_profile_id FROM profile_type_check) IS NULL
            OR prj.profile_id = (SELECT effective_profile_id FROM profile_type_check)
        )
        -- Role filter (only if no effective profile_id)
        AND (
            (SELECT effective_profile_id FROM profile_type_check) IS NOT NULL
            OR (SELECT roles FROM params) IS NULL
            OR COALESCE(array_length((SELECT roles FROM params), 1), 0) = 0
            OR prj.profile_id IN (
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
            OR prj.profile_id IN (
                SELECT cp.profile_id FROM profile_cohorts_junction cp
                WHERE cp.cohort_id = ANY(p.cohort_ids) AND cp.active = true
            )
        )
        -- Simulation type filtering: general (practice_simulation = FALSE), practice (practice_simulation = TRUE), archived (archived = TRUE)
        -- If no filters provided (NULL or empty), include all runs_entry (runs_entry not linked to simulations are included)
        -- If filters provided, only include runs_entry that match the filter OR runs_entry not linked to simulations (treat as "general")
        AND (
            p.simulation_filters IS NULL
            OR COALESCE(array_length(p.simulation_filters, 1), 0) = 0
            OR sim.id IS NULL  -- Runs not linked to simulations are always included
            OR (
                ('general' = ANY(p.simulation_filters) AND NOT EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE) AND COALESCE(sa.archived, FALSE) = FALSE) OR
                ('practice' = ANY(p.simulation_filters) AND EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE) AND COALESCE(sa.archived, FALSE) = FALSE) OR
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
        mrb.practice_simulation,
        mrb.archived,
        mrb.group_id,
        COALESCE(
            ARRAY_AGG(
                (di.id, di.created_at, di.content)::types.q_get_pricing_runs_v4_debug_info
                ORDER BY di.created_at
            ) FILTER (WHERE di.id IS NOT NULL),
            '{}'::types.q_get_pricing_runs_v4_debug_info[]
        ) as debug_info_entry
    FROM runs_base mrb
    LEFT JOIN debug_info_entry di ON di.run_id = mrb.run_id
    GROUP BY mrb.run_id, mrb.created_at, mrb.input_tokens, mrb.output_tokens, mrb.model_id, mrb.profile_id, mrb.agent_id, mrb.practice_simulation, mrb.archived, mrb.group_id
),
-- Calculate run costs using run_pricing_entry and model_pricing_junction (date-filtered)
run_costs AS (
    SELECT
        rpu.run_id,
        COALESCE(SUM(
            (rpu.count::numeric / u.value::numeric) * pr.price
        ), 0) as run_cost
    FROM run_pricing_entry rpu
    JOIN runs_entry r ON r.id = rpu.run_id
    LEFT JOIN agent_runs_junction arj ON arj.run_id = r.id
    JOIN agent_models_junction am ON am.agent_id = arj.agent_id AND am.active = true
    JOIN model_pricing_junction mp ON mp.model_id = am.model_id AND mp.active = true
    JOIN pricing_resource pr ON pr.id = mp.pricing_id
        AND pr.pricing_type = rpu.pricing_type
        AND pr.unit_id = rpu.unit_id
        AND pr.active = true
    JOIN artifact_units_relation u ON u.id = rpu.unit_id
    WHERE r.created_at >= (SELECT start_date FROM params)
      AND r.created_at <= (SELECT end_date FROM params)
    GROUP BY rpu.run_id
),
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
        mrwd.practice_simulation,
        mrwd.archived,
        mrwd.group_id,
        mrwd.debug_info_entry,
        mnl.name as model_name,
        COALESCE(pnl.name, '') as profile_name,
        anl.name as agent_name,
        COALESCE(rc.run_cost, 0) as run_cost
    FROM runs_with_debug mrwd
    LEFT JOIN model_name_lookup mnl ON mnl.model_id = mrwd.model_id
    LEFT JOIN profile_name_lookup pnl ON pnl.profile_id = mrwd.profile_id
    LEFT JOIN agent_name_lookup anl ON anl.agent_id = mrwd.agent_id
    LEFT JOIN run_costs rc ON rc.run_id = mrwd.run_id
),
-- Apply search filter (across model name, agent name, profile name, debug info)
runs_with_search AS (
    SELECT
        rwn.run_id,
        rwn.created_at,
        rwn.input_tokens,
        rwn.output_tokens,
        rwn.model_id,
        rwn.profile_id,
        rwn.agent_id,
        rwn.practice_simulation,
        rwn.archived,
        rwn.group_id,
        rwn.debug_info_entry,
        rwn.model_name,
        rwn.profile_name,
        rwn.agent_name,
        rwn.run_cost
    FROM runs_with_names rwn
    CROSS JOIN params p
    WHERE (
        p.search IS NULL
        OR p.search = ''
        OR LOWER(rwn.model_name) LIKE '%' || LOWER(p.search) || '%'
        OR LOWER(rwn.agent_name) LIKE '%' || LOWER(p.search) || '%'
        OR LOWER(rwn.profile_name) LIKE '%' || LOWER(p.search) || '%'
        OR EXISTS (
            SELECT 1 FROM unnest(rwn.debug_info_entry) AS di
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
        rws.practice_simulation,
        rws.archived,
        rws.group_id,
        rws.debug_info_entry,
        rws.model_name,
        rws.profile_name,
        rws.agent_name,
        rws.run_cost
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
-- Group runs_entry by group_id and aggregate
-- Note: Runs without groups_entry are excluded (they would have been in chat_runs before migration)
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
            (mrf.run_id, mrf.created_at, mrf.input_tokens, mrf.output_tokens, mrf.run_cost, mrf.model_id, mrf.profile_id, mrf.agent_id, mrf.debug_info_entry)::types.q_get_pricing_runs_v4_run_summary
            ORDER BY mrf.created_at
        ) FILTER (WHERE mrf.run_id IS NOT NULL) as runs_entry
    FROM runs_filtered mrf
    WHERE mrf.group_id IS NOT NULL  -- Only include runs_entry that belong to groups_entry
    GROUP BY mrf.group_id
),
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
        gws.runs_entry,
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
            (pg.group_id, pg.created_at, pg.run_count, pg.total_input_tokens, pg.total_output_tokens, pg.total_cost, pg.runs_entry)::types.q_get_pricing_runs_v4_group_run
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
