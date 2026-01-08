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
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        p.id as persona_id,
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as name,
        (SELECT d.description FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1) as description,
        (SELECT c.hex_code FROM persona_colors pc JOIN colors c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        (SELECT i.value FROM persona_icons pi JOIN icons i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon,
        EXISTS (SELECT 1 FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = TRUE) as active,
        (SELECT i.template FROM persona_instructions pi JOIN instructions i ON pi.instruction_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as instructions,
        p.created_at,
        p.updated_at
    FROM personas p
    WHERE p.id = test_get_persona_by_id_v4.input_persona_id;
$$;