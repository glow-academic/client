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
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
),
original_persona AS (
    SELECT 
        p.id,
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        (SELECT d.description FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1),
        (SELECT c.hex_code FROM persona_colors pc JOIN colors c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        (SELECT i.value FROM persona_icons pi JOIN icons i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon
    FROM params x
    JOIN personas p ON p.id = x.persona_id
),
original_departments AS (
    -- Get department IDs from original persona
    SELECT department_id
    FROM params x
    JOIN persona_departments pd ON pd.persona_id = x.persona_id AND pd.active = true
),
-- Insert name into names table
new_name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT name || ' Copy', NOW(), NOW()
    FROM original_persona
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name
),
-- Insert description into descriptions table
new_description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM original_persona
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id, description
),
-- Insert color into colors table (if exists)
new_color_resource AS (
    INSERT INTO colors (name, description, hex_code, created_at, updated_at)
    SELECT 'persona_color', 'Persona color', color, NOW(), NOW()
    FROM original_persona
    WHERE color IS NOT NULL AND color != ''
    ON CONFLICT (hex_code) DO UPDATE SET updated_at = NOW()
    RETURNING id as color_id, hex_code
),
-- Insert icon into icons table (if exists)
new_icon_resource AS (
    INSERT INTO icons (name, description, value, created_at, updated_at)
    SELECT 'persona_icon', 'Persona icon', icon, NOW(), NOW()
    FROM original_persona
    WHERE icon IS NOT NULL AND icon != ''
    ON CONFLICT (value) DO UPDATE SET updated_at = NOW()
    RETURNING id as icon_id, value
),
new_persona AS (
    INSERT INTO persona (
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
    INSERT INTO instructions (template, active, created_at, updated_at)
    SELECT 
        COALESCE(pi_orig.template, ''),
        true,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN original_persona op
    LEFT JOIN persona_instructions pi_orig_link ON pi_orig_link.persona_id = op.id
    LEFT JOIN instructions pi_orig ON pi_orig.id = pi_orig_link.instruction_id
    WHERE pi_orig.template IS NOT NULL AND pi_orig.template != ''
    RETURNING id as instruction_id
),
link_persona_instruction AS (
    INSERT INTO persona_instructions (persona_id, instruction_id, created_at, updated_at)
    SELECT 
        np.id,
        cpi.instruction_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN copy_persona_instruction cpi
    ON CONFLICT (persona_id, instruction_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona to name
link_persona_name AS (
    INSERT INTO persona_names (persona_id, name_id, created_at, updated_at)
    SELECT 
        np.id,
        nnr.name_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (persona_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona to description
link_persona_description AS (
    INSERT INTO persona_descriptions (persona_id, description_id, created_at, updated_at)
    SELECT 
        np.id,
        ndr.description_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN new_description_resource ndr
    ON CONFLICT (persona_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona to color
link_persona_color AS (
    INSERT INTO persona_colors (persona_id, color_id, created_at, updated_at)
    SELECT 
        np.id,
        ncr.color_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN new_color_resource ncr
    ON CONFLICT (persona_id, color_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona to icon
link_persona_icon AS (
    INSERT INTO persona_icons (persona_id, icon_id, created_at, updated_at)
    SELECT 
        np.id,
        nir.icon_id,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN new_icon_resource nir
    ON CONFLICT (persona_id, icon_id) DO UPDATE SET updated_at = NOW()
),
-- Link persona active flag (set to false for duplicate)
link_persona_active_flag AS (
    INSERT INTO persona_flags (persona_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        np.id,
        f.id,
        'active'::type_persona_flags,
        FALSE,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (persona_id, flag_id, type) DO UPDATE SET 
        value = FALSE,
        updated_at = NOW()
),
copy_departments AS (
    -- Copy department links from original persona
    INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
    SELECT 
        np.id,
        od.department_id,
        true,
        NOW(),
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