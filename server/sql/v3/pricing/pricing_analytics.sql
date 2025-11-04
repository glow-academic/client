-- Pricing analytics query - complete model run pricing with all mappings embedded
-- Parameters: $1 = department_ids (uuid[]), $2 = start_date (datetime), $3 = end_date (datetime)
-- Additional parameters for WHERE clause: profile_id, roles, cohort_ids (added dynamically)
-- WHERE clause is built dynamically and inserted at {WHERE_CLAUSE} placeholder

WITH model_runs_base AS (
    SELECT
        mr.id as model_run_id,
        mr.created_at,
        mr.input_tokens,
        mr.output_tokens,
        mrm.model_id,
        mrp.profile_id,
        mra.agent_id,
        mrper.persona_id
    FROM model_runs mr
    LEFT JOIN model_run_models mrm ON mrm.model_run_id = mr.id AND mrm.active = true
    LEFT JOIN model_run_profiles mrp ON mrp.model_run_id = mr.id AND mrp.active = true
    LEFT JOIN model_run_agents mra ON mra.model_run_id = mr.id AND mra.active = true
    LEFT JOIN model_run_personas mrper ON mrper.model_run_id = mr.id AND mrper.active = true
    WHERE {WHERE_CLAUSE}
),
model_runs_with_debug AS (
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
            WHERE di.model_run_id = mrb.model_run_id),
            '[]'::jsonb
        ) as debug_info
    FROM model_runs_base mrb
),
model_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            m.id::text,
            jsonb_build_object(
                'name', m.name,
                'description', m.description,
                'input_ppm', m.input_ppm,
                'output_ppm', m.output_ppm
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM (SELECT DISTINCT model_id FROM model_runs_base WHERE model_id IS NOT NULL) mrb
    JOIN models m ON m.id = mrb.model_id
),
profile_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            p.first_name || ' ' || p.last_name
        ),
        '{}'::jsonb
    ) as mapping
    FROM (SELECT DISTINCT profile_id FROM model_runs_base WHERE profile_id IS NOT NULL) mrb
    JOIN profiles p ON p.id = mrb.profile_id
),
agent_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            a.id::text,
            a.name
        ),
        '{}'::jsonb
    ) as mapping
    FROM (SELECT DISTINCT agent_id FROM model_runs_base WHERE agent_id IS NOT NULL) mrb
    JOIN agents a ON a.id = mrb.agent_id
),
persona_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            per.id::text,
            per.name
        ),
        '{}'::jsonb
    ) as mapping
    FROM (SELECT DISTINCT persona_id FROM model_runs_base WHERE persona_id IS NOT NULL) mrb
    JOIN personas per ON per.id = mrb.persona_id
)
SELECT jsonb_build_object(
    'model_runs', COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'model_run_id', model_run_id::text,
                'created_at', created_at,
                'input_tokens', input_tokens,
                'output_tokens', output_tokens,
                'model_id', CASE WHEN model_id IS NOT NULL THEN model_id::text ELSE NULL END,
                'profile_id', CASE WHEN profile_id IS NOT NULL THEN profile_id::text ELSE NULL END,
                'agent_id', CASE WHEN agent_id IS NOT NULL THEN agent_id::text ELSE NULL END,
                'persona_id', CASE WHEN persona_id IS NOT NULL THEN persona_id::text ELSE NULL END,
                'debug_info', debug_info
            ) ORDER BY created_at DESC
        ) FROM model_runs_with_debug),
        '[]'::jsonb
    ),
    'model_mapping', COALESCE((SELECT mapping FROM model_mapping LIMIT 1), '{}'::jsonb),
    'profile_mapping', COALESCE((SELECT mapping FROM profile_mapping LIMIT 1), '{}'::jsonb),
    'agent_mapping', COALESCE((SELECT mapping FROM agent_mapping LIMIT 1), '{}'::jsonb),
    'persona_mapping', COALESCE((SELECT mapping FROM persona_mapping LIMIT 1), '{}'::jsonb)
) as result

