-- Get scenario's current persona/document/parameter IDs and agent_id for regeneration
-- Converted to PostgreSQL function
-- Note: Uses JSON for arrays - may need refactoring per STANDARDS.md
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_scenario_ids_for_regeneration_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_ids_for_regeneration_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_scenario_ids_for_regeneration_v4(
    scenario_id uuid
)
RETURNS TABLE (
    persona_id uuid,
    scenario_domain_id text,
    document_ids json,
    parameter_item_ids json
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    (SELECT rp.persona_id FROM scenario_personas rp WHERE rp.scenario_id = s.id AND rp.active = true LIMIT 1) as persona_id,
    (SELECT sd.agent_domain_id::text FROM scenario_agent_domains sd WHERE sd.scenario_id = s.id AND sd.type = 'default'::type_scenario_domains LIMIT 1) as scenario_domain_id,
    COALESCE(
        json_agg(DISTINCT sd.document_id::text) FILTER (WHERE sd.document_id IS NOT NULL),
        '[]'::json
    ) as document_ids,
    COALESCE(
        json_agg(DISTINCT sf.field_id::text) FILTER (WHERE sf.field_id IS NOT NULL),
        '[]'::json
    ) as parameter_item_ids
FROM scenario s
LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id AND sd.active = true
LEFT JOIN scenario_fields sf ON sf.scenario_id = s.id AND sf.active = true
WHERE s.id = api_get_scenario_ids_for_regeneration_v4.scenario_id
GROUP BY s.id
$$;