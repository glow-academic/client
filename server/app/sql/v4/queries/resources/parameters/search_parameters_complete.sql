-- Search parameters resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), persona_parameter, document_parameter, scenario_parameter, video_parameter (boolean filters), exclude_ids (uuid[])
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

-- Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_parameters_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for parameter item
CREATE TYPE types.q_get_parameters_v4_item AS (
    parameter_id uuid,
    name text,
    description text,
    value text,
    generated boolean,
    persona_parameter boolean,
    document_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_search_parameters_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    persona_parameter boolean DEFAULT NULL,
    document_parameter boolean DEFAULT NULL,
    scenario_parameter boolean DEFAULT NULL,
    video_parameter boolean DEFAULT NULL,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
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
            q.video_parameter
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
        COALESCE(p.video_parameter, false) AS video_parameter
    FROM parameters_resource p
    WHERE p.active = true
      AND p.name IS NOT NULL
      AND p.name != ''
      AND (search IS NULL OR search = '' OR LOWER(p.name) LIKE '%' || LOWER(search) || '%')
      AND (persona_parameter IS NULL OR p.persona_parameter = persona_parameter)
      AND (document_parameter IS NULL OR p.document_parameter = document_parameter)
      AND (scenario_parameter IS NULL OR p.scenario_parameter = scenario_parameter)
      AND (video_parameter IS NULL OR p.video_parameter = video_parameter)
      AND (exclude_ids IS NULL OR NOT (p.id = ANY(exclude_ids)))
    ORDER BY p.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
