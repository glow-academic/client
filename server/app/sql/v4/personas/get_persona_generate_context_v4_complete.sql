-- Get persona generate context: agent_id, resources with whitelist, and developer instruction templates
-- Accepts all fields from GeneratePersonaPayload
-- Uses safe drop/recreate pattern
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_persona_generate_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_generate_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_get_persona_generate_context_v4(
    profile_id uuid,
    resource_types text[],
    agent_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    color_id uuid DEFAULT NULL,
    icon_id uuid DEFAULT NULL,
    instructions_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    field_ids uuid[] DEFAULT NULL,
    example_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    agent_id uuid,
    resources jsonb,
    developer_instruction_templates text[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        resource_types AS resource_types,
        agent_id AS agent_id,
        group_id AS group_id,
        name_id AS name_id,
        description_id AS description_id,
        color_id AS color_id,
        icon_id AS icon_id,
        instructions_id AS instructions_id,
        active_flag_id AS active_flag_id,
        department_ids AS department_ids,
        field_ids AS field_ids,
        example_ids AS example_ids
),
-- Get agent_id: use provided if present, otherwise use get_best_agent_for_persona_resources_v4 logic
selected_agent AS (
    SELECT 
        CASE 
            WHEN p.agent_id IS NOT NULL THEN p.agent_id
            ELSE (
                SELECT ba.agent_id
                FROM api_get_best_agent_for_persona_resources_v4(p.profile_id, p.resource_types) ba
                LIMIT 1
            )
        END as agent_id
    FROM params p
),
-- Get developer instruction templates for the agent
developer_instruction_templates_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(i.template ORDER BY i.created_at),
            ARRAY[]::text[]
        ) as templates
    FROM selected_agent sa
    JOIN agent_instructions ai ON ai.agent_id = sa.agent_id
    JOIN instructions_resource i ON i.id = ai.instruction_id
    WHERE i.active = true
),
-- Fetch resources with whitelist: names
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
    JOIN names_resource n ON n.id = p.name_id
    WHERE p.name_id IS NOT NULL
),
-- Fetch resources with whitelist: descriptions
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
    JOIN descriptions_resource d ON d.id = p.description_id
    WHERE p.description_id IS NOT NULL
),
-- Fetch resources with whitelist: colors
colors_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', c.id::text,
                    'color', c.hex_code
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    JOIN colors_resource c ON c.id = p.color_id
    WHERE p.color_id IS NOT NULL
),
-- Fetch resources with whitelist: icons
icons_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', i.id::text,
                    'icon', i.value
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    JOIN icons_resource i ON i.id = p.icon_id
    WHERE p.icon_id IS NOT NULL
),
-- Fetch resources with whitelist: instructions
instructions_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', inst.id::text,
                    'instructions', inst.template
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    JOIN instructions_resource inst ON inst.id = p.instructions_id
    WHERE p.instructions_id IS NOT NULL
),
-- Fetch resources with whitelist: flags
flags_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', f.id::text,
                    'name', f.name
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    JOIN flags_resource f ON f.id = p.active_flag_id
    WHERE p.active_flag_id IS NOT NULL
),
-- Fetch resources with whitelist: departments
departments_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', d.id::text,
                    'name', (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1),
                    'description', (SELECT desc_data.description FROM department_descriptions dd JOIN descriptions_resource desc_data ON dd.description_id = desc_data.id WHERE dd.department_id = d.id LIMIT 1)
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    JOIN departments_resource d ON d.id = ANY(p.department_ids)
    WHERE p.department_ids IS NOT NULL
),
-- Fetch resources with whitelist: fields
fields_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', f.id::text,
                    'name', (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
                    'description', (SELECT desc_data.description FROM field_descriptions fd JOIN descriptions_resource desc_data ON fd.description_id = desc_data.id WHERE fd.field_id = f.id LIMIT 1)
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    JOIN fields_resource f ON f.id = ANY(p.field_ids)
    WHERE p.field_ids IS NOT NULL
),
-- Fetch resources with whitelist: examples
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
    JOIN examples_resource e ON e.id = ANY(p.example_ids)
    WHERE p.example_ids IS NOT NULL
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
            'examples', COALESCE((SELECT resources FROM examples_resources), '[]'::jsonb)
        ) as resources
)
SELECT 
    sa.agent_id,
    cr.resources,
    COALESCE(dit.templates, ARRAY[]::text[]) as developer_instruction_templates
FROM selected_agent sa
CROSS JOIN combined_resources cr
LEFT JOIN developer_instruction_templates_data dit ON true
$$;
