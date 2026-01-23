-- Get persona by ID for test verification
-- Returns persona data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_persona_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_persona_by_id_v4(
    input_persona_id uuid
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
STABLE
AS $$
    SELECT 
        p.id as persona_id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as name,
        (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1) as description,
        (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        (SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon,
        EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'active'  AND pf.value = TRUE) as active,
        (SELECT i.template FROM persona_instructions_junction pi JOIN instructions_resource i ON pi.instruction_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as instructions,
        p.created_at
    FROM personas_resource p
    WHERE p.id = test_get_persona_by_id_v4.input_persona_id;
$$;
