-- Prepare persona generation: rate limit check, group/run creation, and full context fetch
-- All business logic in one SQL function - fail fast on rate limit
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_persona_generation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_persona_generation_v4(%s)', r.sig);
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
CREATE OR REPLACE FUNCTION socket_prepare_persona_generation_v4(
    p_profile_id uuid,
    p_agent_id uuid,
    p_group_id uuid DEFAULT NULL,  -- Optional: for regeneration (uses existing group)
    p_resources types.i_persona_resource_v4[] DEFAULT NULL,  -- Optional: array of (resource_type, resource_ids) for Jinja context
    p_current_resources types.i_persona_resource_v4[] DEFAULT NULL,  -- Optional: form state for "current" variable in Jinja templates
    p_resource_types text[] DEFAULT NULL  -- Optional: resource types to filter tools (e.g., ARRAY['names', 'colors'])
)
RETURNS TABLE (
    run_id uuid,
    group_id uuid,
    trace_id text,
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
    voice text,
    quality text,
    -- Tools filtered by resource type
    tools types.i_get_text_run_context_and_create_run_v4_tool[],
    -- Developer instruction templates (raw - Python renders with Jinja)
    developer_instruction_templates text[],
    -- Jinja context (whitelisted fields only)
    jinja_context jsonb,
    -- Output modalities
    output_modalities text[]
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        p_profile_id AS profile_id,
        p_agent_id AS agent_id,
        p_group_id AS group_id,
        p_resources AS resources,
        p_current_resources AS current_resources,
        p_resource_types AS resource_types
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
-- Get agent model output modalities
agent_model_modalities AS (
    SELECT
        array_agg(mr.modality::text ORDER BY mr.modality) as output_modalities
    FROM agent_artifact a
    JOIN agent_models_junction am ON am.agent_id = a.id
    JOIN model_modalities_junction mm ON mm.model_id = am.model_id
    JOIN modalities_resource mr ON mr.id = mm.modality_id
    CROSS JOIN params p
    WHERE a.id = p.agent_id
      AND mm.type = 'output'::direction_type
      AND mm.active = true
      AND mr.active = true
),
-- Get or create group (for trace_id and group_id)
existing_group_from_param AS (
    SELECT g.id as group_id, g.trace_id
    FROM params p
    JOIN view_groups_entry g ON g.id = p.group_id
    WHERE p.group_id IS NOT NULL
    LIMIT 1
),
create_group_if_needed AS (
    INSERT INTO view_groups_entry (created_at, updated_at, session_id)
    SELECT NOW(), NOW(), (SELECT id FROM view_sessions_entry WHERE view_sessions_entry.profile_id = p_profile_id AND view_sessions_entry.active = true ORDER BY created_at DESC LIMIT 1)
    FROM params p
    WHERE p.group_id IS NULL
    RETURNING id as group_id, trace_id
),
group_data AS (
    SELECT
        COALESCE(
            (SELECT group_id FROM existing_group_from_param LIMIT 1),
            (SELECT group_id FROM create_group_if_needed LIMIT 1),
            gen_random_uuid()::uuid
        ) as group_id,
        COALESCE(
            (SELECT trace_id FROM existing_group_from_param LIMIT 1),
            (SELECT trace_id FROM create_group_if_needed LIMIT 1),
            gen_random_uuid()::text
        ) as trace_id
),
-- Create run with group_id directly
create_run AS (
    INSERT INTO runs_entry (input_tokens, output_tokens, group_id)
    SELECT 0, 0, gd.group_id
    FROM selected_agent sa
    CROSS JOIN params p
    CROSS JOIN group_data gd
    RETURNING id as run_id
),
link_run_to_profile AS (
    INSERT INTO profile_runs_junction (profile_id, run_id)
    SELECT p.profile_id, cr.run_id
    FROM params p
    CROSS JOIN create_run cr
    WHERE p.profile_id IS NOT NULL
),
-- Get primary department for profile (for key lookup)
profile_primary_department AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id
    WHERE pd.is_primary = TRUE
      AND pd.active = true
    LIMIT 1
),
-- Get active settings (for API key)
default_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings_junction sd
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings_junction sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys_junction spk
    JOIN keys_resource kr ON kr.id = spk.key_id
    WHERE spk.active = true AND kr.active
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings_junction sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
      AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings_junction sd
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
active_settings AS (
    SELECT
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings_with_keys),
            (SELECT settings_id FROM default_settings_with_keys),
            (SELECT settings_id FROM settings_with_keys LIMIT 1),
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM setting_artifact WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = setting_artifact.id AND f.name = 'setting_active' AND sf.value = TRUE) LIMIT 1)
        ) as settings_id
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
                ORDER BY ar.position
            ) FILTER (WHERE ar.name IS NOT NULL),
            '{}'::jsonb
        ) as arguments,
        COALESCE(
            jsonb_object_agg(
                ar.name,
                ar.description
                ORDER BY ar.position
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
                ORDER BY ar.position
            ) FILTER (WHERE ar.name IS NOT NULL AND ar.default_value != ''),
            '{}'::jsonb
        ) as argument_defaults
    FROM tool_artifact t
    LEFT JOIN tool_args_junction ta ON ta.tool_id = t.id
    LEFT JOIN args_resource ar ON ar.id = ta.args_id AND ar.active = true
    GROUP BY t.id, ta.args_id
),
-- Get agent tools filtered by resource_type
agent_tools_data AS (
    SELECT
        sa.agent_id,
        COALESCE(
            ARRAY_AGG(
                (t.id, (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1), COALESCE((SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1), ''), COALESCE(rt.resource::text, ''), COALESCE(NULL::artifact_type::text, ''), COALESCE(tsd.arguments, '{}'::jsonb), COALESCE(tsd.argument_descriptions, '{}'::jsonb), COALESCE(tsd.argument_defaults, '{}'::jsonb), EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true))::types.i_get_text_run_context_and_create_run_v4_tool
                ORDER BY COALESCE(rt.resource::text, ''), (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1)
            ) FILTER (WHERE t.id IS NOT NULL AND (
                p.resource_types IS NULL
                OR rt.resource IS NULL
                OR rt.resource::text = ANY(p.resource_types)
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
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
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
    LEFT JOIN agent_instructions_junction ai ON ai.agent_id = a.id
    LEFT JOIN instructions_resource i ON i.id = ai.instruction_id AND i.active = true
    GROUP BY sa.agent_id
),
-- Fetch whitelisted resources for Jinja context
names_resources AS (
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', n.id::text,
                    'name', n.name
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS name_id
    JOIN names_resource n ON n.id = name_id
    WHERE r.resource_type = 'names'
),
descriptions_resources AS (
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', d.id::text,
                    'description', d.description
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS desc_id
    JOIN descriptions_resource d ON d.id = desc_id
    WHERE r.resource_type = 'descriptions'
),
colors_resources AS (
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', c.id::text,
                    'name', c.name,
                    'description', c.description,
                    'hex_code', c.hex_code
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS color_id
    JOIN colors_resource c ON c.id = color_id
    WHERE r.resource_type = 'colors'
),
icons_resources AS (
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', i.id::text,
                    'name', i.name,
                    'description', i.description,
                    'value', i.value
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS icon_id
    JOIN icons_resource i ON i.id = icon_id
    WHERE r.resource_type = 'icons'
),
instructions_resources AS (
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', inst.id::text,
                    'template', inst.template
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS inst_id
    JOIN instructions_resource inst ON inst.id = inst_id
    WHERE r.resource_type = 'instructions'
),
flags_resources AS (
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', f.id::text,
                    'name', f.name,
                    'description', f.description
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS flag_id
    JOIN flags_resource f ON f.id = flag_id
    WHERE r.resource_type = 'flags'
),
departments_resources AS (
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', d.id::text,
                    'name', (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1),
                    'description', (SELECT desc_data.description FROM department_descriptions_junction dd JOIN descriptions_resource desc_data ON dd.description_id = desc_data.id WHERE dd.department_id = d.id LIMIT 1)
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS dept_id
    JOIN departments_resource d ON d.id = dept_id
    WHERE r.resource_type = 'departments'
),
fields_resources AS (
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', ffj.field_id::text,
                    'name', (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1),
                    'description', (SELECT desc_data.description FROM field_descriptions_junction fd JOIN descriptions_resource desc_data ON fd.description_id = desc_data.id WHERE fd.field_id = ffj.field_id LIMIT 1)
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS field_id_val
    JOIN fields_resource f ON f.id = field_id_val
    JOIN field_fields_junction ffj ON ffj.fields_id = f.id
    WHERE r.resource_type = 'fields'
),
parameters_resources AS (
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', pa.id::text,
                    'name', (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = pa.id LIMIT 1),
                    'description', (SELECT desc_data.description FROM parameter_descriptions_junction pd JOIN descriptions_resource desc_data ON pd.description_id = desc_data.id WHERE pd.parameter_id = pa.id LIMIT 1)
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS param_id
    JOIN parameter_artifact pa ON pa.id = param_id
    WHERE r.resource_type = 'parameters'
),
examples_resources AS (
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', e.id::text,
                    'example', e.example
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS example_id
    JOIN examples_resource e ON e.id = example_id
    WHERE r.resource_type = 'examples'
),
-- Fetch current resources for "current" variable in Jinja context (form state from frontend)
current_names_resources AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id', n.id::text, 'name', n.name)
    ), '[]'::jsonb) as data
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS name_id
    JOIN names_resource n ON n.id = name_id
    WHERE r.resource_type = 'names'
),
current_descriptions_resources AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id', d.id::text, 'description', d.description)
    ), '[]'::jsonb) as data
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS desc_id
    JOIN descriptions_resource d ON d.id = desc_id
    WHERE r.resource_type = 'descriptions'
),
current_colors_resources AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id', c.id::text, 'name', c.name, 'description', c.description, 'hex_code', c.hex_code)
    ), '[]'::jsonb) as data
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS color_id
    JOIN colors_resource c ON c.id = color_id
    WHERE r.resource_type = 'colors'
),
current_icons_resources AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id', i.id::text, 'name', i.name, 'description', i.description, 'value', i.value)
    ), '[]'::jsonb) as data
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS icon_id
    JOIN icons_resource i ON i.id = icon_id
    WHERE r.resource_type = 'icons'
),
current_instructions_resources AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id', inst.id::text, 'template', inst.template)
    ), '[]'::jsonb) as data
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS inst_id
    JOIN instructions_resource inst ON inst.id = inst_id
    WHERE r.resource_type = 'instructions'
),
current_flags_resources AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id', f.id::text, 'name', f.name, 'description', f.description)
    ), '[]'::jsonb) as data
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS flag_id
    JOIN flags_resource f ON f.id = flag_id
    WHERE r.resource_type = 'flags'
),
current_departments_resources AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', d.id::text,
            'name', (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1),
            'description', (SELECT desc_data.description FROM department_descriptions_junction dd JOIN descriptions_resource desc_data ON dd.description_id = desc_data.id WHERE dd.department_id = d.id LIMIT 1)
        )
    ), '[]'::jsonb) as data
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS dept_id
    JOIN departments_resource d ON d.id = dept_id
    WHERE r.resource_type = 'departments'
),
current_parameter_fields_resources AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', ffj.field_id::text,
            'name', (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1),
            'description', (SELECT desc_data.description FROM field_descriptions_junction fd JOIN descriptions_resource desc_data ON fd.description_id = desc_data.id WHERE fd.field_id = ffj.field_id LIMIT 1)
        )
    ), '[]'::jsonb) as data
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS field_id_val
    JOIN fields_resource f ON f.id = field_id_val
    JOIN field_fields_junction ffj ON ffj.fields_id = f.id
    WHERE r.resource_type = 'parameter_fields'
),
current_parameters_resources AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', pa.id::text,
            'name', (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = pa.id LIMIT 1),
            'description', (SELECT desc_data.description FROM parameter_descriptions_junction pd JOIN descriptions_resource desc_data ON pd.description_id = desc_data.id WHERE pd.parameter_id = pa.id LIMIT 1)
        )
    ), '[]'::jsonb) as data
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS param_id
    JOIN parameter_artifact pa ON pa.id = param_id
    WHERE r.resource_type = 'parameters'
),
current_examples_resources AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id', e.id::text, 'example', e.example)
    ), '[]'::jsonb) as data
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS example_id
    JOIN examples_resource e ON e.id = example_id
    WHERE r.resource_type = 'examples'
),
-- Combine all resources into single JSONB object
combined_resources AS (
    SELECT
        jsonb_build_object(
            'names', COALESCE((SELECT resources FROM names_resources), '[]'::jsonb),
            'descriptions', COALESCE((SELECT resources FROM descriptions_resources), '[]'::jsonb),
            'colors', COALESCE((SELECT resources FROM colors_resources), '[]'::jsonb),
            'icons', COALESCE((SELECT resources FROM icons_resources), '[]'::jsonb),
            'instructions', COALESCE((SELECT resources FROM instructions_resources), '[]'::jsonb),
            'flags', COALESCE((SELECT resources FROM flags_resources), '[]'::jsonb),
            'departments', COALESCE((SELECT resources FROM departments_resources), '[]'::jsonb),
            'fields', COALESCE((SELECT resources FROM fields_resources), '[]'::jsonb),
            'parameters', COALESCE((SELECT resources FROM parameters_resources), '[]'::jsonb),
            'examples', COALESCE((SELECT resources FROM examples_resources), '[]'::jsonb),
            -- Current selections (form state from frontend)
            'current', jsonb_build_object(
                'names', COALESCE((SELECT data FROM current_names_resources), '[]'::jsonb),
                'descriptions', COALESCE((SELECT data FROM current_descriptions_resources), '[]'::jsonb),
                'colors', COALESCE((SELECT data FROM current_colors_resources), '[]'::jsonb),
                'icons', COALESCE((SELECT data FROM current_icons_resources), '[]'::jsonb),
                'instructions', COALESCE((SELECT data FROM current_instructions_resources), '[]'::jsonb),
                'flags', COALESCE((SELECT data FROM current_flags_resources), '[]'::jsonb),
                'departments', COALESCE((SELECT data FROM current_departments_resources), '[]'::jsonb),
                'parameter_fields', COALESCE((SELECT data FROM current_parameter_fields_resources), '[]'::jsonb),
                'parameters', COALESCE((SELECT data FROM current_parameters_resources), '[]'::jsonb),
                'examples', COALESCE((SELECT data FROM current_examples_resources), '[]'::jsonb)
            )
        ) as jinja_context
),
-- Context data with agent/model config
context_data AS (
    SELECT
        -- Agent data
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(tl.temperature, 0.0) as temperature,
        rl.reasoning_level as reasoning,

        -- Model data (models_resource.value contains the model name directly)
        m.value as model_name,
        COALESCE(n_prov.name, '') as provider_name,
        COALESCE(e.base_url, '') as base_url,
        kr.key as api_key,

        -- Voice and quality (for audio/image models)
        NULL::text as voice,
        NULL::text as quality,

        -- Tools data
        COALESCE(atd.tools, '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]) as tools,

        -- Developer instruction templates
        COALESCE(did.developer_instruction_templates, ARRAY[]::text[]) as developer_instruction_templates

    FROM selected_agent sa
    INNER JOIN agent_artifact a ON a.id = sa.agent_id

    -- Agent prompt
    LEFT JOIN agent_prompts_junction ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts_resource pr_prompt ON pr_prompt.id = ap_default.prompt_id

    -- Model: agent_models_junction.model_id -> model_artifact -> model_models_junction -> models_resource
    INNER JOIN agent_models_junction am ON am.agent_id = a.id
    INNER JOIN model_artifact ma ON ma.id = am.model_id
    INNER JOIN model_models_junction mmj ON mmj.model_id = ma.id
    INNER JOIN models_resource m ON m.id = mmj.models_id

    -- Temperature (uses model_artifact.id)
    LEFT JOIN agent_temperature_levels_junction atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels_junction mtl ON mtl.temperature_level_id = atl.temperature_level_id AND mtl.model_id = ma.id
    LEFT JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id AND tl.active = true

    -- Reasoning (uses model_artifact.id)
    LEFT JOIN agent_reasoning_levels_junction arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels_junction mrl ON mrl.reasoning_level_id = arl.reasoning_level_id AND mrl.model_id = ma.id
    LEFT JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id AND rl.active = true

    -- Endpoint/base_url (uses model_artifact.id)
    LEFT JOIN model_endpoints_junction me_j ON me_j.model_id = ma.id
    LEFT JOIN endpoints_resource e ON e.id = me_j.endpoint_id AND e.active = true

    -- API key via provider -> settings -> keys (uses model_artifact.id)
    LEFT JOIN model_providers_junction mp ON mp.model_id = ma.id
    LEFT JOIN providers_resource p_prov ON p_prov.id = mp.providers_id
    LEFT JOIN provider_providers_junction ppj ON ppj.providers_id = p_prov.id
    LEFT JOIN provider_artifact pr_prov ON pr_prov.id = ppj.provider_id
    LEFT JOIN provider_names_junction pn_prov ON pn_prov.provider_id = pr_prov.id
    LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.name_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys_junction spk ON spk.providers_id = p_prov.id
        AND spk.settings_id = act_s.settings_id
        AND spk.active = true
    LEFT JOIN keys_resource kr ON kr.id = spk.key_id AND kr.active

    -- Tools
    LEFT JOIN agent_tools_data atd ON atd.agent_id = sa.agent_id

    -- Developer instructions
    LEFT JOIN developer_instruction_data did ON did.agent_id = sa.agent_id
)
SELECT
    cr.run_id,
    gd.group_id,
    gd.trace_id::text as trace_id,
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
    cd.voice,
    cd.quality,
    -- Tools
    cd.tools,
    -- Developer instruction templates (raw)
    cd.developer_instruction_templates,
    -- Jinja context
    cr_combined.jinja_context,
    -- Output modalities
    COALESCE(
        (SELECT output_modalities FROM agent_model_modalities),
        ARRAY[]::text[]
    ) as output_modalities
FROM create_run cr
CROSS JOIN group_data gd
CROSS JOIN context_data cd
CROSS JOIN combined_resources cr_combined
$$;
