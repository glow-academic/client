-- Prepare training generation: rate limit check, group/run creation, and full context fetch
-- Returns everything needed for scenario content generation
-- All business logic in one SQL function - fail fast on rate limit

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_training_generation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_training_generation_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create composite type for tools (reuse existing if available)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type
        WHERE typname = 'i_get_text_run_context_and_create_run_v4_tool'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    ) THEN
        CREATE TYPE types.i_get_text_run_context_and_create_run_v4_tool AS (
            id uuid,
            name text,
            description text,
            resource text,
            artifact text,
            arguments jsonb,
            argument_descriptions jsonb,
            argument_defaults jsonb,
            active boolean
        );
    END IF;
END $$;

-- 3) Create the function
CREATE OR REPLACE FUNCTION socket_prepare_training_generation_v4(
    p_profile_id uuid,
    p_chat_entry_id uuid,
    p_department_id uuid,
    p_draft_id uuid DEFAULT NULL,
    p_resource_types text[] DEFAULT ARRAY['problem_statements', 'objectives', 'personas']
)
RETURNS TABLE (
    run_id uuid,
    group_id uuid,
    trace_id text,
    scenario_id uuid,
    -- Agent context
    agent_name text,
    system_prompt text,
    -- Model context (API key encrypted - Python handler decrypts)
    model_name text,
    provider_name text,
    base_url text,
    api_key text,
    temperature float,
    reasoning text,
    -- Tools filtered by resource type
    tools types.i_get_text_run_context_and_create_run_v4_tool[],
    -- Developer instruction templates (raw - Python renders with Jinja)
    developer_instruction_templates text[],
    -- Jinja context (simulation, scenario, current, available)
    jinja_context jsonb
)
LANGUAGE sql
VOLATILE
AS $$
WITH scope AS (
    SELECT
        tb.id AS chat_entry_id,
        scj_conn.scenarios_id AS scenarios_resource_id,
        COALESCE(hsc.simulations_id, psc.simulations_id) AS simulations_id,
        (
            SELECT ssj.simulation_id
            FROM simulation_simulations_junction ssj
            WHERE ssj.simulations_id = COALESCE(hsc.simulations_id, psc.simulations_id)
              AND ssj.active = true
            LIMIT 1
        ) AS simulation_artifact_id,
        (
            SELECT scj.scenario_id
            FROM scenario_scenarios_junction scj
            WHERE scj.scenarios_id = scj_conn.scenarios_id
              AND scj.active = true
            LIMIT 1
        ) AS scenario_artifact_id
    FROM chat_entry tb
    LEFT JOIN home_chat_entry hte ON hte.chat_id = tb.id
    LEFT JOIN home_entry he ON he.id = hte.home_id
    LEFT JOIN practice_chat_entry pte ON pte.chat_id = tb.id
    LEFT JOIN practice_entry pe ON pe.id = pte.practice_id
    LEFT JOIN home_simulations_connection hsc ON hsc.home_id = he.id AND hsc.active = true
    LEFT JOIN practice_simulations_connection psc ON psc.practice_id = pe.id AND psc.active = true
    LEFT JOIN chat_scenarios_connection scj_conn
      ON scj_conn.chat_id = tb.id
     AND scj_conn.active = true
    WHERE tb.id = p_chat_entry_id
      AND tb.active = true
    LIMIT 1
),
params AS (
    SELECT
        p_profile_id AS profile_id,
        (
            SELECT aa.agent_id
            FROM (
                SELECT
                    a.id AS agent_id,
                    COUNT(DISTINCT dr.resource::text) FILTER (
                        WHERE dr.resource IS NOT NULL
                          AND dr.resource::text = ANY(p_resource_types)
                    ) AS coverage
                FROM agent_artifact a
                LEFT JOIN agent_tools_junction at
                  ON at.agent_id = a.id
                 AND at.active = true
                LEFT JOIN tools_resource tr
                  ON tr.id = at.tool_id
                LEFT JOIN tool_tools_junction ttj
                  ON ttj.tools_id = tr.id
                LEFT JOIN tool_resources_junction tdj
                  ON tdj.tool_id = ttj.tool_id AND tdj.active = true
                LEFT JOIN resources_resource dr
                  ON dr.id = tdj.resource_id AND dr.active = true
                WHERE EXISTS (
                    SELECT 1
                    FROM agent_flags_junction af
                    JOIN flags_resource f ON f.id = af.flag_id
                    WHERE af.agent_id = a.id
                      AND f.name = 'agent_active'
                      AND af.value = true
                )
                  AND (
                    NOT EXISTS (
                        SELECT 1
                        FROM agent_departments_junction ad
                        WHERE ad.agent_id = a.id
                          AND ad.active = true
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM agent_departments_junction ad
                        WHERE ad.agent_id = a.id
                          AND ad.department_id = p_department_id
                          AND ad.active = true
                    )
                  )
                GROUP BY a.id
            ) aa
            ORDER BY aa.coverage DESC, aa.agent_id
            LIMIT 1
        ) AS agent_id,
        (SELECT s.simulation_artifact_id FROM scope s) AS simulation_id,
        (SELECT s.scenario_artifact_id FROM scope s) AS scenario_id,
        p_resource_types AS resource_types
),
-- Resolve scenario (use provided or first from simulation)
resolved_scenario AS (
    SELECT
        p.scenario_id AS scenario_id
    FROM params p
),
-- Validate agent exists and is active
selected_agent AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    CROSS JOIN params p
    WHERE a.id = p.agent_id
      AND EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    LIMIT 1
),
-- Create new group for training generation
create_group AS (
    INSERT INTO groups_entry (created_at, updated_at, session_id)
    SELECT NOW(), NOW(), (
        SELECT s.id FROM sessions_entry s
        JOIN profiles_sessions_connection psc ON psc.session_id = s.id
        WHERE psc.profiles_id = p_profile_id
          AND s.active = true
        ORDER BY s.created_at DESC
        LIMIT 1
    )
    FROM params p
    RETURNING id as group_id, trace_id
),
group_data AS (
    SELECT
        COALESCE(
            (SELECT group_id FROM create_group LIMIT 1),
            gen_random_uuid()::uuid
        ) as group_id,
        COALESCE(
            (SELECT trace_id FROM create_group LIMIT 1),
            gen_random_uuid()::text
        ) as trace_id
),
-- Create run with group_id
create_run AS (
    INSERT INTO runs_entry (group_id)
    SELECT gd.group_id
    FROM selected_agent sa
    CROSS JOIN params p
    CROSS JOIN group_data gd
    RETURNING id as run_id
),
link_run_to_profile AS (
    INSERT INTO profiles_runs_connection (profiles_id, run_id)
    SELECT ppj.profiles_id, cr.run_id
    FROM params p
    JOIN profile_profiles_junction ppj ON ppj.profile_id = p.profile_id
    CROSS JOIN create_run cr
    WHERE p.profile_id IS NOT NULL
),
-- Build tool arguments from args_resource
tool_schema_data AS (
    SELECT
        t.id as tool_id,
        ta.args_id as schema_id,
        COALESCE(
            jsonb_object_agg(
                ar.name,
                jsonb_build_object(
                    'type', CASE ar.field_type
                        WHEN 'string' THEN 'string'
                        WHEN 'number' THEN 'number'
                        WHEN 'boolean' THEN 'boolean'
                        WHEN 'array' THEN 'array'
                        ELSE 'string'
                    END,
                    'required', ar.required
                )
                ORDER BY ar.name
            ) FILTER (WHERE ar.name IS NOT NULL),
            '{}'::jsonb
        ) as arguments,
        COALESCE(
            jsonb_object_agg(
                ar.name,
                ar.description
                ORDER BY ar.name
            ) FILTER (WHERE ar.name IS NOT NULL AND ar.description != ''),
            '{}'::jsonb
        ) as argument_descriptions,
        COALESCE(
            jsonb_object_agg(
                ar.name,
                CASE
                    WHEN ar.default_value = '' THEN NULL
                    WHEN ar.field_type = 'number' THEN
                        CASE
                            WHEN ar.default_value ~ '^-?[0-9]+\.?[0-9]*$' THEN to_jsonb(ar.default_value::numeric)
                            ELSE NULL
                        END
                    WHEN ar.field_type = 'boolean' THEN
                        CASE
                            WHEN LOWER(ar.default_value) IN ('true', '1', 'yes') THEN 'true'::jsonb
                            WHEN LOWER(ar.default_value) IN ('false', '0', 'no') THEN 'false'::jsonb
                            ELSE NULL
                        END
                    WHEN ar.field_type = 'array' THEN
                        CASE
                            WHEN ar.default_value ~ '^\[.*\]$' THEN ar.default_value::jsonb
                            ELSE NULL
                        END
                    ELSE ar.default_value::jsonb
                END
                ORDER BY ar.name
            ) FILTER (WHERE ar.name IS NOT NULL AND ar.default_value != ''),
            '{}'::jsonb
        ) as argument_defaults
    FROM tool_artifact t
    LEFT JOIN tool_args_junction ta ON ta.tool_id = t.id
    LEFT JOIN args_resource ar ON ar.id = ta.args_id AND ar.active = true
    GROUP BY t.id, ta.args_id
),
-- Get agent tools filtered by resource_type (problem_statements, objectives, personas)
agent_tools_data AS (
    SELECT
        sa.agent_id,
        COALESCE(
            ARRAY_AGG(
                (t.id, (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1), COALESCE((SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1), ''), COALESCE(dr.resource::text, ''), COALESCE(NULL::artifact_type::text, ''), COALESCE(tsd.arguments, '{}'::jsonb), COALESCE(tsd.argument_descriptions, '{}'::jsonb), COALESCE(tsd.argument_defaults, '{}'::jsonb), EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true))::types.i_get_text_run_context_and_create_run_v4_tool
                ORDER BY COALESCE(dr.resource::text, ''), (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1)
            ) FILTER (WHERE t.id IS NOT NULL AND (
                p.resource_types IS NULL
                OR dr.resource IS NULL
                OR dr.resource::text = ANY(p.resource_types)
            )),
            '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]
        ) as tools
    FROM selected_agent sa
    CROSS JOIN params p
    LEFT JOIN agent_tools_junction at ON at.agent_id = sa.agent_id AND at.active = true
    LEFT JOIN tools_resource tr ON tr.id = at.tool_id
    LEFT JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    LEFT JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    LEFT JOIN tool_schema_data tsd ON tsd.tool_id = t.id
    LEFT JOIN tool_resources_junction tdj ON tdj.tool_id = t.id AND tdj.active = true
    LEFT JOIN resources_resource dr ON dr.id = tdj.resource_id AND dr.active = true
    GROUP BY sa.agent_id
),
-- Get developer instruction templates (array)
developer_instruction_data AS (
    SELECT
        sa.agent_id,
        COALESCE(
            ARRAY_AGG(i.template ORDER BY i.created_at),
            ARRAY[]::text[]
        ) as developer_instruction_templates
    FROM selected_agent sa
    INNER JOIN agent_artifact a ON a.id = sa.agent_id
    LEFT JOIN agent_agents_junction aaj ON aaj.agent_id = a.id AND aaj.active = true
    LEFT JOIN agents_resource ar ON ar.id = aaj.agents_id AND ar.active = true
    LEFT JOIN LATERAL UNNEST(ar.instruction_ids) AS iid ON true
    LEFT JOIN instructions_resource i ON i.id = iid AND i.active = true
    GROUP BY sa.agent_id
),
-- Fetch simulation data for Jinja context
simulation_context AS (
    SELECT
        jsonb_build_object(
            'id', s.id::text,
            'name', (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1),
            'description', (SELECT d.description FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1)
        ) as simulation_data
    FROM params p
    JOIN simulation_artifact s ON s.id = p.simulation_id
),
-- Fetch scenario data for Jinja context
scenario_context AS (
    SELECT
        sc.id as scenario_id,
        jsonb_build_object(
            'id', sc.id::text,
            'name', (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = sc.id LIMIT 1)
        ) as scenario_data
    FROM resolved_scenario rs
    JOIN scenario_artifact sc ON sc.id = rs.scenario_id
),
-- Fetch current scenario content (existing values)
current_content AS (
    SELECT
        -- Current problem statement (if exists)
        (SELECT jsonb_build_object(
            'id', psr.id::text,
            'problem_statement', psr.problem_statement
         )
         FROM scenario_problem_statements_junction spj
         JOIN problem_statements_resource psr ON psr.id = spj.problem_statement_id
         WHERE spj.scenario_id = rs.scenario_id AND spj.active = true
         LIMIT 1) as problem_statement,
        -- Current objectives (if exist)
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', o.id::text,
                'objective', o.objective
             ))
             FROM scenario_objectives_junction soj
             JOIN objectives_resource o ON o.id = soj.objective_id
             WHERE soj.scenario_id = rs.scenario_id AND soj.active = true),
            '[]'::jsonb
        ) as objectives,
        -- Current persona (if exists)
        (
            SELECT jsonb_build_object(
                'id', pa.id::text,
                'name', (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = pa.id LIMIT 1),
                'description', (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = pa.id LIMIT 1)
             )
            FROM persona_artifact pa
            WHERE pa.id = COALESCE(
                (
                    SELECT pdc.personas_id
                    FROM chat_drafts_personas_connection pdc
                    WHERE p_draft_id IS NOT NULL
                      AND pdc.draft_id = p_draft_id
                    LIMIT 1
                ),
                (
                    SELECT spj.persona_id
                    FROM scenario_personas_junction spj
                    WHERE spj.scenario_id = rs.scenario_id
                      AND spj.active = true
                    LIMIT 1
                )
            )
            LIMIT 1
        ) as persona
    FROM resolved_scenario rs
),
-- Fetch available resources for generation
available_resources AS (
    SELECT
        -- Available problem statements (from simulation or global)
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', psr.id::text,
                'problem_statement', psr.problem_statement
             ))
             FROM problem_statements_resource psr
             WHERE psr.active = true
             LIMIT 20),
            '[]'::jsonb
        ) as problem_statements,
        -- Available objectives
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', o.id::text,
                'objective', o.objective
             ))
             FROM objectives_resource o
             WHERE o.active = true
             LIMIT 50),
            '[]'::jsonb
        ) as objectives,
        -- Available personas
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', pa.id::text,
                'name', (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = pa.id LIMIT 1),
                'description', (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = pa.id LIMIT 1)
             ))
             FROM persona_artifact pa
             WHERE EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = pa.id AND f.type = 'persona_active' AND pf.value = true)
             LIMIT 20),
            '[]'::jsonb
        ) as personas
),
-- Combine all into Jinja context
combined_context AS (
    SELECT
        jsonb_build_object(
            'simulation', COALESCE((SELECT simulation_data FROM simulation_context), '{}'::jsonb),
            'scenario', COALESCE((SELECT scenario_data FROM scenario_context), '{}'::jsonb),
            'current', jsonb_build_object(
                'problem_statement', (SELECT problem_statement FROM current_content),
                'objectives', COALESCE((SELECT objectives FROM current_content), '[]'::jsonb),
                'persona', (SELECT persona FROM current_content)
            ),
            'available', jsonb_build_object(
                'problem_statements', COALESCE((SELECT problem_statements FROM available_resources), '[]'::jsonb),
                'objectives', COALESCE((SELECT objectives FROM available_resources), '[]'::jsonb),
                'personas', COALESCE((SELECT personas FROM available_resources), '[]'::jsonb)
            )
        ) as jinja_context
),
-- Context data with agent/model config
context_data AS (
    SELECT
        -- Agent data
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(ar.temperature, 0.0) as temperature,
        ar.reasoning as reasoning,

        -- Model data (denormalized on agents_resource and models_resource)
        m.value as model_name,
        COALESCE(n_prov.name, '') as provider_name,
        COALESCE(pr_prov_res.endpoint, '') as base_url,
        pr_prov_res.key as api_key,

        -- Tools data
        COALESCE(atd.tools, '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]) as tools,

        -- Developer instruction templates
        COALESCE(did.developer_instruction_templates, ARRAY[]::text[]) as developer_instruction_templates

    FROM selected_agent sa
    INNER JOIN agent_artifact a ON a.id = sa.agent_id

    -- agents_resource for denormalized fields
    INNER JOIN agent_agents_junction aaj ON aaj.agent_id = a.id AND aaj.active = true
    INNER JOIN agents_resource ar ON ar.id = aaj.agents_id

    -- Agent prompt via agents_resource
    LEFT JOIN prompts_resource pr_prompt ON pr_prompt.id = ar.prompt_id

    -- Model via denormalized agents_resource.model_id
    INNER JOIN models_resource m ON m.id = ar.model_id

    -- Get provider via models_resource.provider_id
    LEFT JOIN providers_resource pr_prov_res ON pr_prov_res.id = m.provider_id
    LEFT JOIN provider_providers_junction ppj_prov ON ppj_prov.providers_id = pr_prov_res.id AND ppj_prov.active = true
    LEFT JOIN provider_artifact pr_prov ON pr_prov.id = ppj_prov.provider_id
    LEFT JOIN provider_names_junction pn_prov ON pn_prov.provider_id = pr_prov.id
    LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.name_id

    -- Tools
    LEFT JOIN agent_tools_data atd ON atd.agent_id = sa.agent_id

    -- Developer instructions
    LEFT JOIN developer_instruction_data did ON did.agent_id = sa.agent_id
)
SELECT
    cr.run_id,
    gd.group_id,
    gd.trace_id::text as trace_id,
    rs.scenario_id,
    -- Agent context
    cd.agent_name,
    cd.system_prompt,
    -- Model context
    cd.model_name,
    cd.provider_name,
    cd.base_url,
    cd.api_key,
    cd.temperature,
    cd.reasoning,
    -- Tools
    cd.tools,
    -- Developer instruction templates (raw)
    cd.developer_instruction_templates,
    -- Jinja context
    cc.jinja_context
FROM create_run cr
CROSS JOIN group_data gd
CROSS JOIN resolved_scenario rs
CROSS JOIN context_data cd
CROSS JOIN combined_context cc
$$;
