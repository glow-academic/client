-- Duplicate persona - creates copy linking to existing resources
-- Name resource created by Python (passed as name_resource_id)
-- SQL links junctions, never creates resources
-- Active flag set to FALSE
-- All other resources (color, icon, description, instructions, departments, fields, examples, parameters) link to existing
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_duplicate_persona_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_persona_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_duplicate_persona_v4(
    persona_id uuid,
    profile_id uuid,
    name_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
    new_persona_id uuid,
    original_name text
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT persona_id AS persona_id,
           profile_id AS profile_id,
           name_resource_id AS name_resource_id
),
original_persona AS (
    SELECT
        p.id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as name,
        (SELECT pd.description_id FROM persona_descriptions_junction pd WHERE pd.persona_id = p.id LIMIT 1) as description_id,
        (SELECT pc.color_id FROM persona_colors_junction pc WHERE pc.persona_id = p.id LIMIT 1) as color_id,
        (SELECT pi.icon_id FROM persona_icons_junction pi WHERE pi.persona_id = p.id LIMIT 1) as icon_id,
        (SELECT pij.instruction_id FROM persona_instructions_junction pij WHERE pij.persona_id = p.id LIMIT 1) as instruction_id
    FROM params x
    JOIN persona_artifact p ON p.id = x.persona_id
),
original_departments AS (
    -- Get department IDs from original persona
    SELECT department_id
    FROM params x
    JOIN persona_departments_junction pd ON pd.persona_id = x.persona_id AND pd.active = true
),
original_fields AS (
    -- Get parameter_field IDs from original persona
    SELECT ppfj.parameter_field_id
    FROM params x
    JOIN persona_parameter_fields_junction ppfj ON ppfj.persona_id = x.persona_id AND ppfj.active = true
),
original_examples AS (
    -- Get example IDs and idx from original persona
    SELECT pej.example_id, pej.idx
    FROM params x
    JOIN persona_examples_junction pej ON pej.persona_id = x.persona_id AND pej.active = true
),
-- persona_parameters_junction dropped — parameters now derived from parameter_fields
new_persona AS (
    INSERT INTO persona_artifact (
        created_at,
        updated_at
    )
    SELECT
        NOW(),
        NOW()
    FROM original_persona op
    RETURNING id
),
-- Link persona to name (created by Python, passed as name_resource_id)
link_persona_name AS (
    INSERT INTO persona_names_junction (persona_id, name_id, created_at)
    SELECT
        np.id,
        x.name_resource_id,
        NOW()
    FROM new_persona np
    CROSS JOIN params x
    WHERE x.name_resource_id IS NOT NULL
),
-- Link persona to existing description
link_persona_description AS (
    INSERT INTO persona_descriptions_junction (persona_id, description_id, created_at)
    SELECT
        np.id,
        op.description_id,
        NOW()
    FROM new_persona np
    CROSS JOIN original_persona op
    WHERE op.description_id IS NOT NULL
),
-- Link persona to existing color
link_persona_color AS (
    INSERT INTO persona_colors_junction (persona_id, color_id, created_at)
    SELECT
        np.id,
        op.color_id,
        NOW()
    FROM new_persona np
    CROSS JOIN original_persona op
    WHERE op.color_id IS NOT NULL
),
-- Link persona to existing icon
link_persona_icon AS (
    INSERT INTO persona_icons_junction (persona_id, icon_id, created_at)
    SELECT
        np.id,
        op.icon_id,
        NOW()
    FROM new_persona np
    CROSS JOIN original_persona op
    WHERE op.icon_id IS NOT NULL
),
-- Link persona to existing instruction
link_persona_instruction AS (
    INSERT INTO persona_instructions_junction (persona_id, instruction_id, created_at)
    SELECT
        np.id,
        op.instruction_id,
        NOW()
    FROM new_persona np
    CROSS JOIN original_persona op
    WHERE op.instruction_id IS NOT NULL
),
-- Link persona active flag (set to false for duplicate)
link_persona_active_flag AS (
    INSERT INTO persona_flags_junction (persona_id, flag_id, value, created_at)
    SELECT
        np.id,
        f.id,
        FALSE,
        NOW()
    FROM new_persona np
    CROSS JOIN flags_resource f
    WHERE f.type = 'persona_active'
),
copy_departments AS (
    -- Link to existing department IDs from original persona
    INSERT INTO persona_departments_junction (persona_id, department_id, active, created_at)
    SELECT
        np.id,
        od.department_id,
        true,
        NOW()
    FROM new_persona np
    CROSS JOIN original_departments od
    RETURNING persona_id
),
copy_fields AS (
    -- Link to existing parameter_field IDs from original persona
    INSERT INTO persona_parameter_fields_junction (persona_id, parameter_field_id, active, created_at)
    SELECT
        np.id,
        ofi.parameter_field_id,
        true,
        NOW()
    FROM new_persona np
    CROSS JOIN original_fields ofi
    RETURNING persona_id
),
copy_examples AS (
    -- Link to existing example IDs from original persona
    INSERT INTO persona_examples_junction (persona_id, example_id, idx, active, created_at)
    SELECT
        np.id,
        oe.example_id,
        oe.idx,
        true,
        NOW()
    FROM new_persona np
    CROSS JOIN original_examples oe
    RETURNING persona_id
),
-- persona_parameters_junction dropped — no copy_parameters needed
dummy_parameters AS (
    SELECT NULL::uuid as persona_id WHERE false
)
SELECT
    (SELECT id FROM new_persona LIMIT 1) as new_persona_id,
    (SELECT name FROM original_persona LIMIT 1) as original_name
$$;
