-- Get scenario's current persona/document/parameter IDs and agent_id for regeneration
-- Parameters: $1=scenario_id (uuid)
-- Returns: persona_id (uuid), scenario_agent_id (text), document_ids (json), parameter_item_ids (json)
SELECT 
    (SELECT rp.persona_id FROM scenario_personas rp WHERE rp.scenario_id = s.id AND rp.active = true LIMIT 1) as persona_id,
    s.scenario_agent_id::text as scenario_agent_id,
    COALESCE(
        json_agg(DISTINCT sd.document_id::text) FILTER (WHERE sd.document_id IS NOT NULL),
        '[]'::json
    ) as document_ids,
    COALESCE(
        json_agg(DISTINCT sf.field_id::text) FILTER (WHERE sf.field_id IS NOT NULL),
        '[]'::json
    ) as parameter_item_ids
FROM scenarios s
LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id AND sd.active = true
LEFT JOIN scenario_fields sf ON sf.scenario_id = s.id AND sf.active = true
WHERE s.id = $1::uuid
GROUP BY s.id, s.scenario_agent_id

