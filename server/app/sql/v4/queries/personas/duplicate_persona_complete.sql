-- Duplicate persona - fetches original and creates copy with prompt and department links in single query
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
    profile_id uuid
)
RETURNS TABLE (
    new_persona_id uuid,
    original_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT persona_id AS persona_id,
           profile_id AS profile_id
),
user_profile AS (
    SELECT actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
original_persona AS (
    SELECT 
        p.id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1),
        (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        (SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon
    FROM params x
    JOIN persona_artifact p ON p.id = x.persona_id
),
original_departments AS (
    -- Get department IDs from original persona
    SELECT department_id
    FROM params x
    JOIN persona_departments_junction pd ON pd.persona_id = x.persona_id AND pd.active = true
),
default_call AS (
    SELECT id as call_id
    FROM calls_entry
    LIMIT 1
),
-- Insert name INTO names_resource table
new_name_resource AS (
    INSERT INTO names_resource (name, created_at)
    SELECT name || ' Copy', NOW()
    FROM original_persona
    CROSS JOIN default_call dc
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as name_id, name
),
-- Insert description INTO descriptions_resource table
new_description_resource AS (
    INSERT INTO descriptions_resource (description, created_at)
    SELECT description, NOW()
    FROM original_persona
    CROSS JOIN default_call dc
    WHERE description IS NOT NULL AND description != ''
    RETURNING id as description_id, description
),
-- Insert color INTO colors_resource table (if exists)
new_color_resource AS (
    INSERT INTO colors_resource (name, description, hex_code, created_at)
    SELECT 'persona_color', 'Persona color', color, NOW()
    FROM original_persona
    CROSS JOIN default_call dc
    WHERE color IS NOT NULL AND color != ''
    RETURNING id as color_id, hex_code
),
-- Insert icon INTO icons_resource table (if exists)
new_icon_resource AS (
    INSERT INTO icons_resource (name, description, value, created_at)
    SELECT 'persona_icon', 'Persona icon', icon, NOW()
    FROM original_persona
    CROSS JOIN default_call dc
    WHERE icon IS NOT NULL AND icon != ''
    RETURNING id as icon_id, value
),
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
-- Copy instruction if original persona has one
copy_persona_instruction AS (
    INSERT INTO instructions_resource (template, active, created_at)
    SELECT
        COALESCE(pi_orig.template, ''),
        true,
        NOW()
    FROM new_persona np
    CROSS JOIN original_persona op
    CROSS JOIN default_call dc
    LEFT JOIN persona_instructions_junction pi_orig_link ON pi_orig_link.persona_id = op.id
    LEFT JOIN instructions_resource pi_orig ON pi_orig.id = pi_orig_link.instruction_id
    WHERE pi_orig.template IS NOT NULL AND pi_orig.template != ''
    RETURNING id as instruction_id
),
link_persona_instruction AS (
    INSERT INTO persona_instructions_junction (persona_id, instruction_id, created_at)
    SELECT 
        np.id,
        cpi.instruction_id,
        NOW()
    FROM new_persona np
    CROSS JOIN copy_persona_instruction cpi
),
-- Link persona to name
link_persona_name AS (
    INSERT INTO persona_names_junction (persona_id, name_id, created_at)
    SELECT 
        np.id,
        nnr.name_id,
        NOW()
    FROM new_persona np
    CROSS JOIN new_name_resource nnr
),
-- Link persona to description
link_persona_description AS (
    INSERT INTO persona_descriptions_junction (persona_id, description_id, created_at)
    SELECT 
        np.id,
        ndr.description_id,
        NOW()
    FROM new_persona np
    CROSS JOIN new_description_resource ndr
),
-- Link persona to color
link_persona_color AS (
    INSERT INTO persona_colors_junction (persona_id, color_id, created_at)
    SELECT 
        np.id,
        ncr.color_id,
        NOW()
    FROM new_persona np
    CROSS JOIN new_color_resource ncr
),
-- Link persona to icon
link_persona_icon AS (
    INSERT INTO persona_icons_junction (persona_id, icon_id, created_at)
    SELECT 
        np.id,
        nir.icon_id,
        NOW()
    FROM new_persona np
    CROSS JOIN new_icon_resource nir
),
-- Link persona active flag (set to false for duplicate)
link_persona_active_flag AS (
    INSERT INTO persona_flags_junction (persona_id, flag_id, value, created_at) SELECT np.id,
        f.id,
        FALSE,
        NOW()
    FROM new_persona np
    CROSS JOIN flags_resource f
    WHERE f.name = 'persona_active'
),
copy_departments AS (
    -- Copy department links from original persona
    INSERT INTO persona_departments_junction (persona_id, department_id, active, created_at)
    SELECT 
        np.id,
        od.department_id,
        true,
        NOW()
    FROM new_persona np
    CROSS JOIN original_departments od
    RETURNING persona_id
)
SELECT 
    (SELECT id FROM new_persona LIMIT 1) as new_persona_id,
    (SELECT name FROM original_persona LIMIT 1) as original_name,
    (SELECT actor_name FROM user_profile LIMIT 1) as actor_name
$$;