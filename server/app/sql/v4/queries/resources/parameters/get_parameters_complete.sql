-- Get parameters resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[]), persona_parameter, document_parameter, scenario_parameter, video_parameter (boolean filters)
-- Returns: items (array of parameter resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_parameters_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_parameters_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop search function if exists (avoids type dependency conflicts)
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

-- Drop search_conditional_parameters function if exists (avoids type dependency conflicts)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_conditional_parameters_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_conditional_parameters_v4(%s)', r.sig);
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
    video_parameter boolean,
    conditional boolean
);

-- Create function
-- Note: Parameter names prefixed with p_ to avoid collision with column names
CREATE OR REPLACE FUNCTION api_get_parameters_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[],
    p_persona_parameter boolean DEFAULT NULL,
    p_document_parameter boolean DEFAULT NULL,
    p_scenario_parameter boolean DEFAULT NULL,
    p_video_parameter boolean DEFAULT NULL
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
            p.id,
            p.name,
            COALESCE(p.description, ''),
            COALESCE(p.value, ''),
            COALESCE(p.generated, false),
            COALESCE(p.persona_parameter, false),
            COALESCE(p.document_parameter, false),
            COALESCE(p.scenario_parameter, false),
            COALESCE(p.video_parameter, false),
            EXISTS (
                SELECT 1 FROM conditional_parameters_resource cpr
                WHERE cpr.parameter_id = p.id AND cpr.active = true
            )
        )::types.q_get_parameters_v4_item
        ORDER BY array_position(ids, p.id)
    ),
    ARRAY[]::types.q_get_parameters_v4_item[]
) as items
FROM parameters_resource p
WHERE p.id = ANY(ids)
  AND p.active = true
  AND p.name IS NOT NULL
  AND p.name != ''
  AND (p_persona_parameter IS NULL OR p.persona_parameter = p_persona_parameter)
  AND (p_document_parameter IS NULL OR p.document_parameter = p_document_parameter)
  AND (p_scenario_parameter IS NULL OR p.scenario_parameter = p_scenario_parameter)
  AND (p_video_parameter IS NULL OR p.video_parameter = p_video_parameter);
$$;
