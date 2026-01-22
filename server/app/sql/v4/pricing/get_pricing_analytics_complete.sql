-- Get pricing analytics - complete model run pricing with all mappings
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
        WHERE proname = 'api_get_pricing_analytics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_pricing_analytics_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop types in dependency order: drop dependent types first (model_run depends on debug_info_entry)
-- Use prefix pattern to find all types, but drop in correct order
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop model_run first (depends on debug_info_entry)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_pricing_analytics_v4_model_run'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
    -- Drop remaining types
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_pricing_analytics_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_pricing_analytics_v4_debug_info AS (
    id uuid,
    created_at timestamptz,
    content text
);

CREATE TYPE types.q_get_pricing_analytics_v4_model_run AS (
    run_id uuid,
    created_at timestamptz,
    input_tokens int,
    output_tokens int,
    model_id uuid,
    profile_id uuid,
    agent_id uuid,
    persona_id uuid,
    run_cost numeric,
    debug_info_entry types.q_get_pricing_analytics_v4_debug_info[]
);

CREATE TYPE types.q_get_pricing_analytics_v4_model AS (
    model_id uuid,
    name text,
    description text,
    input_ppm numeric,
    output_ppm numeric
);

CREATE TYPE types.q_get_pricing_analytics_v4_profile AS (
    profile_id uuid,
    name text
);

CREATE TYPE types.q_get_pricing_analytics_v4_agent AS (
    agent_id uuid,
    name text
);

CREATE TYPE types.q_get_pricing_analytics_v4_persona AS (
    persona_id uuid,
    name text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_pricing_analytics_v4(
    start_date text,
    end_date text,
    department_ids uuid[],
    profile_id uuid,
    roles text[],
    cohort_ids uuid[],
    simulation_filters text[]
)
RETURNS TABLE (
    actor_name text,
    model_runs types.q_get_pricing_analytics_v4_model_run[],
    models types.q_get_pricing_analytics_v4_model[],
    profiles types.q_get_pricing_analytics_v4_profile[],
    agents types.q_get_pricing_analytics_v4_agent[],
    personas types.q_get_pricing_analytics_v4_persona[]
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
        simulation_filters AS simulation_filters
),
profile_role_check AS (
    -- Resolve profile_id and check role to determine effective filtering
    SELECT 
        (SELECT profile_id FROM params) as raw_profile_id,
        CASE 
            WHEN (SELECT profile_id FROM params) IS NULL THEN NULL::uuid
            WHEN (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = (SELECT profile_id FROM params) LIMIT 1) IN ('admin', 'superadmin', 'instructional') THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)
        END as effective_profile_id
),
user_profile AS (
    SELECT 
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) LIMIT 1),
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile_artifact ON profile_artifact.id = x.profile_id
    WHERE x.profile_id IS NOT NULL
),
runs_base AS (
    SELECT
        mr.id as run_id,
        mr.created_at,
        mr.input_tokens,
        mr.output_tokens,
        (SELECT am.model_id FROM agent_models am WHERE am.agent_id = mr.agent_id AND am.active = true LIMIT 1) as model_id,
        mr.profile_id,
        mr.agent_id,
        NULL::uuid as persona_id,
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE) as practice_simulation,
        sa.archived
    FROM runs_entry mr
    -- Join to simulations via runs_entry.group_id → groups_entry → chats_entry (direct group_id) → attempts_entry → simulations
    LEFT JOIN groups_entry g ON g.id = mr.group_id
    LEFT JOIN chats_entry c ON c.group_id = g.id
    LEFT JOIN attempts_entry sa ON sa.id = c.attempt_id
    LEFT JOIN simulation_artifact sim ON sim.id = sa.simulation_id
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
                SELECT 1 FROM profile_departments pd
                WHERE pd.profile_id = mr.profile_id
                  AND pd.department_id = ANY(p.department_ids)
            )
        )
        -- Profile filter (specific user) - only if role is not admin/superadmin/instructional
        AND (
            (SELECT effective_profile_id FROM profile_role_check) IS NULL
            OR mr.profile_id = (SELECT effective_profile_id FROM profile_role_check)
        )
        -- Role filter (only if no effective profile_id)
        AND (
            (SELECT effective_profile_id FROM profile_role_check) IS NOT NULL
            OR (SELECT roles FROM params) IS NULL
            OR COALESCE(array_length((SELECT roles FROM params), 1), 0) = 0
            OR mr.profile_id IN (
                SELECT DISTINCT p.id
                FROM profile_artifact p
                LEFT JOIN profile_roles pr_j ON pr_j.profile_id = p.id
                LEFT JOIN roles_resource r ON pr_j.role_id = r.id
                WHERE COALESCE(r.role, 'member'::profile_type)::text = ANY((SELECT roles FROM params)::text[])
            )
        )
        -- Cohort filter (via profile_cohorts)
        AND (
            p.cohort_ids IS NULL
            OR COALESCE(array_length(p.cohort_ids, 1), 0) = 0
            OR mr.profile_id IN (
                SELECT profile_id FROM profile_cohorts
                WHERE cohort_id = ANY(p.cohort_ids) AND active = true
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
                ('general' = ANY(p.simulation_filters) AND NOT EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE) AND COALESCE(sa.archived, FALSE) = FALSE) OR
                ('practice' = ANY(p.simulation_filters) AND EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE) AND COALESCE(sa.archived, FALSE) = FALSE) OR
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
-- Calculate run costs using run_pricing_entry (source of truth for pricing)
run_costs AS (
    SELECT
        rpu.run_id,
        COALESCE(SUM(
            (rpu.count::numeric / u.value::numeric) * pr.price
        ), 0) as run_cost
    FROM run_pricing_entry rpu
    JOIN runs_entry r ON r.id = rpu.run_id
    JOIN agent_models am ON am.agent_id = r.agent_id AND am.active = true
    JOIN model_pricing mp ON mp.model_id = am.model_id AND mp.active = true
    JOIN pricing_resource pr ON pr.id = mp.pricing_id
        AND pr.pricing_type = rpu.pricing_type
        AND pr.unit_id = rpu.unit_id
        AND pr.active = true
    JOIN artifact_units_relation u ON u.id = rpu.unit_id
    GROUP BY rpu.run_id
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
        COALESCE(rc.run_cost, 0) as run_cost,
        COALESCE(
            ARRAY_AGG(
                (di.id, di.created_at, di.content)::types.q_get_pricing_analytics_v4_debug_info
                ORDER BY di.created_at
            ) FILTER (WHERE di.id IS NOT NULL),
            '{}'::types.q_get_pricing_analytics_v4_debug_info[]
        ) as debug_info_entry
    FROM runs_base mrb
    LEFT JOIN run_costs rc ON rc.run_id = mrb.run_id
    LEFT JOIN debug_info_entry di ON di.run_id = mrb.run_id
    GROUP BY mrb.run_id, mrb.created_at, mrb.input_tokens, mrb.output_tokens, mrb.model_id, mrb.profile_id, mrb.agent_id, mrb.persona_id, rc.run_cost
),
model_pricing_aggregated AS (
    -- Aggregate pricing per model: sum all input/output prices normalized to per-million tokens
    SELECT 
        mrb.model_id,
        COALESCE(SUM(CASE WHEN pr.pricing_type = 'input'::pricing_type THEN pr.price * (1000000.0 / u.value) ELSE 0 END), 0.0) as input_ppm,
        COALESCE(SUM(CASE WHEN pr.pricing_type = 'output'::pricing_type THEN pr.price * (1000000.0 / u.value) ELSE 0 END), 0.0) as output_ppm
    FROM (SELECT DISTINCT model_id FROM runs_base WHERE model_id IS NOT NULL) mrb
    LEFT JOIN model_pricing mp ON mp.model_id = mrb.model_id AND mp.active = true
    LEFT JOIN pricing_resource pr ON pr.id = mp.pricing_id AND pr.active = true AND pr.pricing_type IN ('input'::pricing_type, 'output'::pricing_type)
    LEFT JOIN artifact_units_relation u ON u.id = pr.unit_id
    GROUP BY mrb.model_id
)
SELECT 
    COALESCE((SELECT actor_name FROM user_profile LIMIT 1), 'System')::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (mrb.run_id, mrb.created_at, mrb.input_tokens, mrb.output_tokens, mrb.model_id, mrb.profile_id, mrb.agent_id, mrb.persona_id, mrb.run_cost, mrb.debug_info_entry)::types.q_get_pricing_analytics_v4_model_run
            ORDER BY mrb.created_at DESC
        ),
        '{}'::types.q_get_pricing_analytics_v4_model_run[]
    ) as model_runs,
    COALESCE(
        ARRAY_AGG(
            DISTINCT (m.id, (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1), COALESCE((SELECT d.description FROM model_descriptions md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1), ''), COALESCE(mpa.input_ppm, 0.0), COALESCE(mpa.output_ppm, 0.0))::types.q_get_pricing_analytics_v4_model
        ) FILTER (WHERE m.id IS NOT NULL),
        '{}'::types.q_get_pricing_analytics_v4_model[]
    ) as models,
    COALESCE(
        ARRAY_AGG(
            DISTINCT (p.id, COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''))::types.q_get_pricing_analytics_v4_profile
        ) FILTER (WHERE p.id IS NOT NULL),
        '{}'::types.q_get_pricing_analytics_v4_profile[]
    ) as profiles,
    COALESCE(
        ARRAY_AGG(
            DISTINCT (a.id, (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1))::types.q_get_pricing_analytics_v4_agent
        ) FILTER (WHERE a.id IS NOT NULL),
        '{}'::types.q_get_pricing_analytics_v4_agent[]
    ) as agents,
    COALESCE(
        ARRAY_AGG(
            DISTINCT (per.id, (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = per.id LIMIT 1))::types.q_get_pricing_analytics_v4_persona
        ) FILTER (WHERE per.id IS NOT NULL),
        '{}'::types.q_get_pricing_analytics_v4_persona[]
    ) as personas
FROM runs_with_debug mrb
LEFT JOIN models_resource m ON m.id = mrb.model_id
LEFT JOIN model_pricing_aggregated mpa ON mpa.model_id = m.id
LEFT JOIN profile_artifact p ON p.id = mrb.profile_id
LEFT JOIN agents_resource a ON a.id = mrb.agent_id
LEFT JOIN personas_resource per ON per.id = mrb.persona_id
GROUP BY (SELECT actor_name FROM user_profile LIMIT 1)
$$;
