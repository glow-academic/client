-- Get persona instructions only (not full system prompts) for personas in a chat
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_persona_instructions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_instructions_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_persona_instructions_v4(
    chat_id uuid
)
RETURNS TABLE (
    persona_id text,
    persona_name text,
    instructions text
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    p.id::text as persona_id,
    (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as persona_name,
    COALESCE((SELECT i.template FROM persona_instructions pi JOIN instructions i ON pi.instruction_id = i.id WHERE pi.persona_id = p.id LIMIT 1), '') as instructions
FROM chat c
JOIN scenario_personas sp ON sp.scenario_id = c.scenario_id AND sp.active = true
JOIN personas p ON p.id = sp.persona_id
WHERE c.id = chat_id
  AND EXISTS (SELECT 1 FROM persona_flags pf WHERE pf.persona_id = p.id AND pf.type = 'active'::type_persona_flags AND pf.value = true)
ORDER BY (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1)
$$;