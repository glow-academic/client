-- Get randomization ranges for a scenario (or defaults if scenario_id is NULL)
-- Parameters: $1=scenario_id (uuid, nullable)
-- Returns: persona_min, persona_max, document_min, document_max, parameter_min, parameter_max, field_ranges_json
-- Uses same defaults as server if scenario_id is NULL or ranges don't exist

SELECT 
    COALESCE(
        (SELECT min_count FROM scenario_persona_ranges WHERE scenario_id = $1::uuid),
        1
    ) as persona_min,
    COALESCE(
        (SELECT max_count FROM scenario_persona_ranges WHERE scenario_id = $1::uuid),
        3
    ) as persona_max,
    COALESCE(
        (SELECT min_count FROM scenario_document_ranges WHERE scenario_id = $1::uuid),
        0
    ) as document_min,
    COALESCE(
        (SELECT max_count FROM scenario_document_ranges WHERE scenario_id = $1::uuid),
        3
    ) as document_max,
    COALESCE(
        (SELECT min_count FROM scenario_parameter_ranges WHERE scenario_id = $1::uuid),
        0
    ) as parameter_min,
    COALESCE(
        (SELECT max_count FROM scenario_parameter_ranges WHERE scenario_id = $1::uuid),
        3
    ) as parameter_max,
    COALESCE(
        (
            SELECT jsonb_object_agg(
                parameter_id::text,
                jsonb_build_object(
                    'min', min_count,
                    'max', max_count
                )
            )
            FROM scenario_field_ranges
            WHERE scenario_id = $1::uuid
        ),
        '{}'::jsonb
    ) as field_ranges_json

