-- Get run detail with all messages and pricing information
-- Parameters: $1=run_id (uuid), $2=profile_id (uuid)
-- Returns: run metadata, messages array, pricing info, and mappings

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = (SELECT resolved_profile_id FROM resolve_profile_id)
),
run_base AS (
    SELECT 
        r.id,
        r.created_at,
        r.input_tokens,
        r.output_tokens,
        r.cached_input_tokens,
        r.key_id,
        r.agent_id
    FROM runs r
    WHERE r.id = $1::uuid
),
run_metadata AS (
    SELECT 
        rb.id,
        rb.created_at,
        rb.input_tokens,
        rb.output_tokens,
        rb.cached_input_tokens,
        rb.key_id,
        rb.agent_id,
        rm.model_id,
        rp.profile_id,
        rper.persona_id
    FROM run_base rb
    LEFT JOIN run_models rm ON rm.run_id = rb.id AND rm.active = true
    LEFT JOIN run_profiles rp ON rp.run_id = rb.id AND rp.active = true
    LEFT JOIN run_personas rper ON rper.run_id = rb.id AND rper.active = true
),
-- Get department ID from run (via agent or profile)
run_department AS (
    SELECT DISTINCT
        d.id as department_id
    FROM run_metadata rm
    LEFT JOIN agents a ON a.id = rm.agent_id
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    LEFT JOIN departments d ON d.id = ad.department_id AND d.active = true
    WHERE d.id IS NOT NULL
    LIMIT 1
),
-- Check department access
run_access_check AS (
    SELECT 
        CASE 
            WHEN up.role = 'superadmin' THEN true
            WHEN EXISTS (
                SELECT 1 FROM run_department rd
                JOIN profile_departments pd ON pd.department_id = rd.department_id
                WHERE pd.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
                AND pd.active = true
            ) THEN true
            WHEN NOT EXISTS (SELECT 1 FROM run_department) THEN true  -- Cross-department resource
            ELSE false
        END as has_access
    FROM user_profile up
),
-- Calculate run cost
run_costs AS (
    SELECT 
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
    WHERE rpu.run_id = $1::uuid
),
-- Get all messages for the run
messages_data AS (
    SELECT 
        m.id,
        m.role,
        m.content,
        m.created_at,
        m.updated_at,
        m.completed
    FROM messages m
    JOIN message_runs mr ON mr.message_id = m.id
    CROSS JOIN run_base rb
    WHERE mr.run_id = rb.id
    ORDER BY m.created_at
),
-- Build model mapping
model_mapping_data AS (
    SELECT 
        jsonb_object_agg(
            m.id::text,
            jsonb_build_object(
                'name', m.name,
                'description', COALESCE(m.description, '')
            )
        ) as model_mapping
    FROM run_metadata rm
    LEFT JOIN models m ON m.id = rm.model_id
    WHERE m.id IS NOT NULL
),
-- Build agent mapping
agent_mapping_data AS (
    SELECT 
        jsonb_object_agg(
            a.id::text,
            a.name
        ) as agent_mapping
    FROM run_metadata rm
    LEFT JOIN agents a ON a.id = rm.agent_id
    WHERE a.id IS NOT NULL
),
-- Build profile mapping
profile_mapping_data AS (
    SELECT 
        jsonb_object_agg(
            p.id::text,
            p.first_name || ' ' || p.last_name
        ) as profile_mapping
    FROM run_metadata rm
    LEFT JOIN profiles p ON p.id = rm.profile_id
    WHERE p.id IS NOT NULL
)
SELECT 
    CASE 
        WHEN (SELECT has_access FROM run_access_check) = false THEN
            NULL::jsonb
        ELSE
            jsonb_build_object(
                'run', jsonb_build_object(
                    'id', rm.id::text,
                    'createdAt', rm.created_at,
                    'inputTokens', rm.input_tokens,
                    'outputTokens', rm.output_tokens,
                    'cachedInputTokens', rm.cached_input_tokens,
                    'cost', rc.run_cost,
                    'modelId', rm.model_id::text,
                    'agentId', rm.agent_id::text,
                    'profileId', rm.profile_id::text,
                    'personaId', rm.persona_id::text
                ),
                'messages', COALESCE(
                    (SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', md.id::text,
                            'role', md.role,
                            'content', md.content,
                            'createdAt', md.created_at,
                            'updatedAt', md.updated_at,
                            'completed', md.completed
                        ) ORDER BY md.created_at
                    )
                    FROM messages_data md),
                    '[]'::jsonb
                ),
                'modelMapping', mmd.model_mapping,
                'agentMapping', amd.agent_mapping,
                'profileMapping', pmd.profile_mapping
            )
    END as result
FROM run_metadata rm
CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT run_cost FROM run_costs LIMIT 1), 0) as run_cost
) rc
CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT model_mapping FROM model_mapping_data LIMIT 1), '{}'::jsonb) as model_mapping
) mmd
CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT agent_mapping FROM agent_mapping_data LIMIT 1), '{}'::jsonb) as agent_mapping
) amd
CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT profile_mapping FROM profile_mapping_data LIMIT 1), '{}'::jsonb) as profile_mapping
) pmd
WHERE rm.id = $1::uuid;

