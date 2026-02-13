-- Search parameters resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), persona_parameter, document_parameter, scenario_parameter, video_parameter (boolean filters), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of parameter resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_parameters_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_parameters_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
-- Note: Parameter names prefixed with p_ to avoid collision with column names
CREATE OR REPLACE FUNCTION api_search_parameters_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    p_persona_parameter boolean DEFAULT NULL,
    p_document_parameter boolean DEFAULT NULL,
    p_scenario_parameter boolean DEFAULT NULL,
    p_video_parameter boolean DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    document boolean DEFAULT false,
    parameter boolean DEFAULT false,
    persona boolean DEFAULT false,
    scenario boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_parameters_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            q.parameter_id,
            q.name,
            q.description,
            q.value,
            q.generated,
            q.persona_parameter,
            q.document_parameter,
            q.scenario_parameter,
            q.video_parameter,
            q.conditional,
            q.field_ids
        )::types.q_get_parameters_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_parameters_v4_item[]
) as items
FROM (
    SELECT
        p.id AS parameter_id,
        p.name,
        COALESCE(p.description, '') AS description,
        COALESCE(p.value, '') AS value,
        COALESCE(p.generated, false) AS generated,
        COALESCE(p.persona_parameter, false) AS persona_parameter,
        COALESCE(p.document_parameter, false) AS document_parameter,
        COALESCE(p.scenario_parameter, false) AS scenario_parameter,
        COALESCE(p.video_parameter, false) AS video_parameter,
        EXISTS (
            SELECT 1 FROM conditional_parameters_resource cpr
            WHERE cpr.parameter_id = p.id AND cpr.active = true
        ) AS conditional,
        COALESCE(p.field_ids, ARRAY[]::uuid[]) AS field_ids
    FROM parameters_resource p
    WHERE p.active = true
      AND p.name IS NOT NULL
      AND p.name != ''
      AND (search IS NULL OR search = '' OR LOWER(p.name) LIKE '%' || LOWER(search) || '%')
      AND (p_persona_parameter IS NULL OR p.persona_parameter = p_persona_parameter)
      AND (p_document_parameter IS NULL OR p.document_parameter = p_document_parameter)
      AND (p_scenario_parameter IS NULL OR p.scenario_parameter = p_scenario_parameter)
      AND (p_video_parameter IS NULL OR p.video_parameter = p_video_parameter)
      AND (exclude_ids IS NULL OR NOT (p.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(department_ids, 1), 0) = 0 OR p.department_ids && department_ids)
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT document OR EXISTS (SELECT 1 FROM document_parameters_junction j WHERE j.parameter_id = p.id AND j.active = true))
      AND (NOT parameter OR EXISTS (SELECT 1 FROM parameter_parameters_junction j WHERE j.parameter_id = p.id AND j.active = true))
      AND (NOT persona OR EXISTS (SELECT 1 FROM persona_parameters_junction j WHERE j.parameter_id = p.id AND j.active = true))
      AND (NOT scenario OR EXISTS (SELECT 1 FROM scenario_parameters_junction j WHERE j.parameter_id = p.id AND j.active = true))
    ORDER BY p.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
