-- Tools layer: Duplicate persona - creates copy linking to existing resources
-- Independent copy of duplicate_persona_complete.sql for tools layer evolution
-- Name resource created by Python (passed as name_resource_id)
-- SQL links junctions, never creates resources

-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'tools_duplicate_persona_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS tools_duplicate_persona_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION tools_duplicate_persona_v4(
    persona_id uuid,
    profile_id uuid,
    name_resource_id uuid DEFAULT NULL,
    active_value boolean DEFAULT true
)
RETURNS TABLE (
    new_persona_id uuid,
    original_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT persona_id AS persona_id,
           profile_id AS profile_id,
           name_resource_id AS name_resource_id
),
original_persona AS (
    SELECT
        p.id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as name,
        (SELECT pd.descriptions_id FROM persona_descriptions_junction pd WHERE pd.persona_id = p.id LIMIT 1) as descriptions_id,
        (SELECT pc.colors_id FROM persona_colors_junction pc WHERE pc.persona_id = p.id LIMIT 1) as color_id,
        (SELECT pi.icons_id FROM persona_icons_junction pi WHERE pi.persona_id = p.id LIMIT 1) as icon_id,
        (SELECT pij.instructions_id FROM persona_instructions_junction pij WHERE pij.persona_id = p.id LIMIT 1) as instructions_id
    FROM params x
    JOIN persona_artifact p ON p.id = x.persona_id
),
original_departments AS (
    SELECT departments_id
    FROM params x
    JOIN persona_departments_junction pd ON pd.persona_id = x.persona_id AND pd.active = true
),
original_fields AS (
    SELECT ppfj.parameter_fields_id
    FROM params x
    JOIN persona_parameter_fields_junction ppfj ON ppfj.persona_id = x.persona_id AND ppfj.active = true
),
original_examples AS (
    SELECT pej.examples_id
    FROM params x
    JOIN persona_examples_junction pej ON pej.persona_id = x.persona_id AND pej.active = true
),
new_persona AS (
    INSERT INTO persona_artifact (
        created_at,
        updated_at,
        active
    )
    SELECT
        NOW(),
        NOW(),
        active_value
    FROM original_persona op
    RETURNING id
),
-- Link persona to name (created by Python, passed as name_resource_id)
link_persona_name AS (
    INSERT INTO persona_names_junction (persona_id, names_id, created_at)
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
    INSERT INTO persona_descriptions_junction (persona_id, descriptions_id, created_at)
    SELECT
        np.id,
        op.descriptions_id,
        NOW()
    FROM new_persona np
    CROSS JOIN original_persona op
    WHERE op.descriptions_id IS NOT NULL
),
-- Link persona to existing color
link_persona_color AS (
    INSERT INTO persona_colors_junction (persona_id, colors_id, created_at)
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
    INSERT INTO persona_icons_junction (persona_id, icons_id, created_at)
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
    INSERT INTO persona_instructions_junction (persona_id, instructions_id, created_at)
    SELECT
        np.id,
        op.instructions_id,
        NOW()
    FROM new_persona np
    CROSS JOIN original_persona op
    WHERE op.instructions_id IS NOT NULL
),
-- Link persona active flag (set to false for duplicate)
link_persona_active_flag AS (
    INSERT INTO persona_flags_junction (persona_id, flags_id, created_at)
    SELECT
        np.id,
        f.id,
        NOW()
    FROM new_persona np
    CROSS JOIN flags_resource f
    WHERE f.type = 'persona_active'
),
copy_departments AS (
    INSERT INTO persona_departments_junction (persona_id, departments_id, active, created_at)
    SELECT
        np.id,
        od.departments_id,
        active_value,
        NOW()
    FROM new_persona np
    CROSS JOIN original_departments od
    RETURNING persona_id
),
copy_fields AS (
    INSERT INTO persona_parameter_fields_junction (persona_id, parameter_fields_id, active, created_at)
    SELECT
        np.id,
        ofi.parameter_fields_id,
        active_value,
        NOW()
    FROM new_persona np
    CROSS JOIN original_fields ofi
    RETURNING persona_id
),
copy_examples AS (
    INSERT INTO persona_examples_junction (persona_id, examples_id, active, created_at)
    SELECT
        np.id,
        oe.examples_id,
        active_value,
        NOW()
    FROM new_persona np
    CROSS JOIN original_examples oe
    RETURNING persona_id
),
dummy_parameters AS (
    SELECT NULL::uuid as persona_id WHERE false
)
SELECT
    (SELECT id FROM new_persona LIMIT 1) as new_persona_id,
    (SELECT name FROM original_persona LIMIT 1) as original_name
$$;
