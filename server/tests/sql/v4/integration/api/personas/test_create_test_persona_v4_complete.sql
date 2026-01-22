-- Create a test persona for test setup
-- Returns persona_id for use in tests_entry
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_persona_v4(text, text, text, text, boolean, text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_persona_v4(
    persona_name text DEFAULT 'Test Persona',
    description text DEFAULT 'Test Description',
    color text DEFAULT '#000000',
    icon text DEFAULT 'user',
    active boolean DEFAULT true,
    instructions text DEFAULT NULL
)
RETURNS TABLE (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text,
    active boolean,
    instructions text,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_persona AS (
        INSERT INTO personas_resource(created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id, created_at
    ),
    new_instruction AS (
        INSERT INTO instructions_resource(template, active, created_at, updated_at)
        SELECT 
            COALESCE(test_create_test_persona_v4.instructions, ''),
            true,
            NOW(),
            NOW()
        WHERE test_create_test_persona_v4.instructions IS NOT NULL
        RETURNING id
    ),
    persona_instruction_link AS (
        INSERT INTO persona_instructions_junction(persona_id, instruction_id, created_at, updated_at)
        SELECT np.id, ni.id, NOW(), NOW()
        FROM new_persona np
        CROSS JOIN new_instruction ni
        WHERE ni.id IS NOT NULL
        RETURNING persona_id
    ),
    name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (COALESCE(test_create_test_persona_v4.persona_name, 'Test Persona'))
        RETURNING id
    ),
    description_resource AS (
        INSERT INTO descriptions_resource(description)
        VALUES (COALESCE(test_create_test_persona_v4.description, 'Test Description'))
        RETURNING id
    ),
    color_resource AS (
        INSERT INTO colors_resource(name, description, hex_code)
        VALUES ('Test Color', 'Test Color Description', COALESCE(test_create_test_persona_v4.color, '#000000'))
        RETURNING id
    ),
    icon_resource AS (
        INSERT INTO icons_resource(name, description, value)
        VALUES ('Test Icon', 'Test Icon Description', COALESCE(test_create_test_persona_v4.icon, 'user'))
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    persona_name_link AS (
        INSERT INTO persona_names_junction(persona_id, name_id)
        SELECT np.id, nr.id
        FROM new_persona np, name_resource nr
        RETURNING persona_id
    ),
    persona_description_link AS (
        INSERT INTO persona_descriptions_junction(persona_id, description_id)
        SELECT np.id, dr.id
        FROM new_persona np, description_resource dr
        RETURNING persona_id
    ),
    persona_color_link AS (
        INSERT INTO persona_colors_junction(persona_id, color_id)
        SELECT np.id, cr.id
        FROM new_persona np, color_resource cr
        RETURNING persona_id
    ),
    persona_icon_link AS (
        INSERT INTO persona_icons_junction(persona_id, icon_id)
        SELECT np.id, ir.id
        FROM new_persona np, icon_resource ir
        RETURNING persona_id
    ),
    persona_flag_link AS (
        INSERT INTO persona_flags_junction (persona_id, flag_id, value)
        SELECT np.id, af.id, COALESCE(test_create_test_persona_v4.active, true)
        FROM new_persona np, active_flag af
        RETURNING persona_id
    )
    SELECT 
        np.id as persona_id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = np.id LIMIT 1) as name,
        (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = np.id LIMIT 1) as description,
        (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = np.id LIMIT 1) as color,
        (SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = np.id LIMIT 1) as icon,
        EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.persona_id = np.id AND fl.name = 'active'  AND pf.value = TRUE) as active,
        (SELECT i.template FROM persona_instructions_junction pi JOIN instructions_resource i ON pi.instruction_id = i.id WHERE pi.persona_id = np.id LIMIT 1) as instructions,
        np.created_at
    FROM new_persona np;
$$;